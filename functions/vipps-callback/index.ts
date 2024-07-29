import { getCheckout } from "../../packages/vipps/src/index.js";
import { createAdminClient } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
log('On Vipps Payment POST request');
    
const body = req.body;
log('Body: ' + JSON.stringify(body));
const bodyToJson = JSON.stringify(body);
const { reference } = JSON.parse(req.body);
    const { databases } = await createAdminClient();
    try {
    const checkout = await getCheckout(reference);

    if (checkout.ok) {
        log('Checkout found: ' + JSON.stringify(checkout));

        const paymentDoc = await databases.getDocument('app', 'payment', reference);

        const membershipUpdated = await databases.updateDocument('app', 'user', paymentDoc.user.$id, {
            student_id: {
                isMember: true,
            }
        });

        const doc = await databases.updateDocument('app', 'checkout', reference, {
            payment_method: checkout.data.paymentMethod,
            status: checkout.data.sessionState,
            paid_amount: checkout.data.paymentDetails?.amount
        });
        log('Checkout document updated: ' + JSON.stringify(doc));
        return res.json({ checkout });
      } else {
        log('Error getting checkout:' + checkout.error);
        const doc = await databases.updateDocument('app', 'checkout', reference, {
            status: checkout.error
        });
        log('Checkout document updated: ' + JSON.stringify(doc));
        return res.json({ checkout });
      }
    } catch (error) {
        log('Error initiating checkout:' + error);
        const doc = await databases.updateDocument('app', 'checkout', reference, {
            status: error
        });
        log('Checkout document updated: ' + JSON.stringify(doc));
        return res.json({ error: 'Failed to initiate checkout' });
      }
}