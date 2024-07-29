import { createPayment, getAccessToken } from "../../packages/vipps/src/index.js";
import { createSessionClient, ID } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
    log('On Vipps Payment POST request');
    log('Fetching access token...');
    const token = await getAccessToken();
    log('Access token fetched: ' + JSON.stringify(token));

    // Ensure the body is parsed correctly
    let body;
    try {
        body = JSON.parse(req.body);
    } catch (err) {
        log('Error parsing request body: ' + err);
        return res.json({ error: 'Invalid JSON' });
    }

    const { amount, description, returnUrl, membershipId, phoneNumber, paymentMethod } = body;
    log('Parsed request body: ' + JSON.stringify(body));

    if (!amount || !description || !returnUrl) {
        log('Missing required parameters');
        return res.json({ error: 'Missing required parameters' });
    }

    const reference = ID.unique();

    if (token.ok) {
    try {
        const checkout = await createPayment({
            reference,
            amount,
            description,
            returnUrl,
            token: token.data.access_token,
            membershipId,
            phoneNumber,
            paymentMethod,
        });

        if (checkout.ok) {
            log('Checkout created: ' + JSON.stringify(checkout));
            log('Initiating Session Client...');
            const { databases } = await createSessionClient(req.headers['x-appwrite-user-jwt'] as string);

            log('Creating checkout document...');

            const doc = await databases.createDocument('app', 'payments', reference, {
                reference,
                amount,
                description,
                membership: membershipId,
                membership_id: membershipId,
                status: 'pending',
            });

            log('Checkout document created: ' + JSON.stringify(doc));

            return res.json({ checkout });
        } else {
            log('Error initiating checkout: ' + JSON.stringify(checkout.error));
            return res.json({ error: 'Failed to initiate checkout' });
        }
    } catch (err) {
        if (err instanceof Error) {
            log('Error initiating checkout: ' + err.message);
            return res.json({ error: 'Failed to initiate checkout', details: err.message });
        } else {
            log('Unknown error initiating checkout: ' + err);
            return res.json({ error: 'Failed to initiate checkout', details: 'Unknown error occurred' });
        }
    }
}
}