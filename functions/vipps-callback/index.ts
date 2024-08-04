import { getCheckout, getPayment, getAccessToken } from "../../packages/vipps/src/index.js";
import { createAdminClient, Query } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface PaymentData {
    ok: boolean;
    data: {
      aggregate: {
        authorizedAmount: Amount;
        cancelledAmount: Amount;
        capturedAmount: Amount;
        refundedAmount: Amount;
      };
      amount: Amount;
      state: string;
      paymentMethod: PaymentMethod;
      profile: object;
      pspReference: string;
      redirectUrl: string;
      reference: string;
    };
  }
  
  interface Amount {
    currency: string;
    value: number;
  }
  
  interface PaymentMethod {
    type: string;
    cardBin: string;
  }

export default async ({ req, res, log, error }: Context) => {
    log('On Vipps Payment POST request');

    const webhookSecret = process.env.VIPPS_WEBHOOK_SECRET!;
    log("Request: " + JSON.stringify(req));

    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (err) {
        if (err instanceof Error) {
            error('JSON Parse error: ' + err.message);
        } else {
            error('Unknown error during JSON parsing');
        }
        return res.json({ error: 'Invalid JSON' });
    }

    log('Retreiving access token...');
    const token = await getAccessToken();
    if (!token.ok) {
        log('Error fetching access token: ' + token.error);
        return res.json({ error: 'Failed to fetch access token' });
    }

    const { reference, name, amount, success } = body;
    log('Parsed request body: ' + JSON.stringify(body));

    if (!reference || !name || !amount || !success) {
        log('Missing required parameters');
        return res.json({ error: 'Missing required parameters' });
    }

    const payment = await getPayment({
        reference,
        token: token.data.access_token,
    });
    const { databases } = await createAdminClient();
    if (!payment.ok) {
        log('Error getting payment:' + payment.error);

        return res.json({ payment });
    }

    log('Payment found: ' + JSON.stringify(payment));

    const existingDoc = await databases.getDocument('app', 'payments', payment.data.reference, [
        Query.select(['membership_id', 'user_id'])
    ]);
    log("Existing doc: " + JSON.stringify(existingDoc));

    const studentId = await databases.listDocuments('app', 'student_id', [
        Query.select(['$id']),
        Query.equal('user_id', existingDoc.user_id)
    ]);
    log("Student IDs: " + JSON.stringify(studentId));

    const studentIdDoc = studentId.documents[0];

    log("Student ID doc: " + JSON.stringify(studentIdDoc));

    log("Updating student ID doc: " + JSON.stringify(studentIdDoc));
    const updateStudentId = await databases.updateDocument('app', 'student_id', studentIdDoc.$id, {
        isMember: true,
        membership_id: existingDoc.membership_id,
        memberships: [existingDoc.membership_id],
    });

    log("Updated student ID doc: " + JSON.stringify(updateStudentId));

    const updatePayment = await databases.updateDocument('app', 'payments', payment.data.reference, {
        status: payment.data.state === 'AUTHORIZED' ? 'SUCCESS' : 'FAILED',
        paid_amount: payment.data.amount.value,
        payment_method: payment.data.paymentMethod.type,
    });
    log('Payment document updated: ' + JSON.stringify(updatePayment));

    return res.json({ payment });

}