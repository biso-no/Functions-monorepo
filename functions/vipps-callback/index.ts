import { getCheckout, getPayment, getAccessToken } from "../../packages/vipps/src/index.js";
import { createAdminClient } from "@biso/appwrite";

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
    if (token.ok) {
        log('Access token fetched: ' + JSON.stringify(token));

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
        if (payment.ok) {
            log('Payment found: ' + JSON.stringify(payment));

            const paymentDoc = await databases.updateDocument('app', 'payments', reference, {
                status: success ? 'SUCCESS' : 'FAILED',
                paid_amount: success ? amount.value : 0,
                payment_method: success ? payment.data.paymentMethod : null,
            });
            log('Payment document updated: ' + JSON.stringify(paymentDoc));
            return res.json({ payment });
        } else {
            log('Error getting payment:' + payment.error);
            const paymentDoc = await databases.updateDocument('app', 'payment', reference, {
                status: 'failed',
                paid_amount: 0,
                payment_method: 'unknown',
            });
            log('Payment document updated: ' + JSON.stringify(paymentDoc));
            return res.json({ payment });
        }
    } else {
        log('Error fetching access token: ' + token.error);
        return res.json({ error: 'Failed to fetch access token' });
    }
}
