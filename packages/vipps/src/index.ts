import { Client } from "@vippsmobilepay/sdk";
import { ID } from "node-appwrite";

const merchantSerialNumber = process.env.MERCHANT_SERIAL_NUMBER!;
const subscriptionKey = process.env.SUBSCRIPTION_KEY!;
const clientId = process.env.CLIENT_ID!;
const clientSecret = process.env.CLIENT_SECRET!;

const client = Client({
    merchantSerialNumber,
    subscriptionKey,
    useTestMode: process.env.VIPPS_TEST_MODE ? true : false,
    retryRequests: false,
  });


export const accessToken = await client.auth.getToken(clientId, clientSecret);

export async function createCheckout({
    reference,
    amount,
    description,
    returnUrl,
}: {
    reference: string,
    amount: number,
    description: string,
    returnUrl: string,
}) {
  
    const checkout = await client.checkout.create(clientId, clientSecret, {
        merchantInfo: {
          callbackUrl: process.env.VIPPS_CALLBACK_URL!,
          returnUrl: returnUrl,
          callbackAuthorizationToken: ID.unique(),
        },
        transaction: {
        reference: reference,
          amount: {
            currency: 'NOK',
            value: amount, 
          },
          paymentDescription: description
        },
      });

      return checkout;
    }

export async function getCheckout({
    reference,
}: {
    reference: string,
}) {
  
    const checkout = await client.checkout.info(clientId, clientSecret, reference);

      return checkout;
}