import { createCheckout } from "../../packages/vipps/src/index.js";
import { createSessionClient, ID } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
log('On Vipps Payment POST request');
    const { amount, description, returnUrl, membershipId } = JSON.parse(req.body);

    log('Parsed request body: ' + JSON.stringify(req.body));
    if (!amount || !description || !returnUrl ) {
        log('Missing required parameters');
        return res.json({ error: 'Missing required parameters' });
    }

    const reference = ID.unique();

    try {
    const checkout = await createCheckout({
        reference,
        amount,
        description,
        returnUrl,
    });

    if (checkout.ok) {

        log('Checkout created: ' + JSON.stringify(checkout));
        log('Initiating Session Client...');
        const { databases } = await createSessionClient(req.headers['x-appwrite-user-jwt'] as string);

        log('Creating checkout document...');

        const doc = await databases.createDocument('app', 'checkout', reference, {
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
        log('Error initiating checkout:' + checkout.error);
        return res.json({ error: 'Failed to initiate checkout' });
      }
} catch (error) {
    log('Error initiating checkout:' + error);
    return res.json({ error: 'Failed to initiate checkout' });
  }
}