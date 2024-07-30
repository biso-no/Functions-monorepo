import { getCheckout, getPayment, getAccessToken } from "../../packages/vipps/src/index.js";
import { createAdminClient } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
log('On Vipps Payment POST request');
    
const webhookSecret = process.env.VIPPS_WEBHOOK_SECRET!;
log("Request: " + JSON.stringify(req));

const body = JSON.parse(req.body);

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

    const paymentDoc = await databases.updateDocument('app', 'payment', reference, {
        status: name,
        paid_amount: success ? amount : 0,
        payment_method: success ? payment.data.paymentMethod : null,
    });
    log('Payment document updated: ' + JSON.stringify(paymentDoc));
    return res.json({ payment });
} else {
    log('Error getting payment:' + payment.error);
    const paymentDoc = await databases.updateDocument('app', 'payment', reference, {
        status: 'failed',
        paid_amount: 0,
        payment_method: null,
    });
    log('Payment document updated: ' + JSON.stringify(paymentDoc));
    return res.json({ payment });
}
} else {
    log('Error fetching access token: ' + token.error);
    return res.json({ error: 'Failed to fetch access token' });
}
}