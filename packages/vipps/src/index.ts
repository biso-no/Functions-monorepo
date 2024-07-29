import { Client, EPaymentMethod, EPaymentMethodType } from "@vippsmobilepay/sdk";
import { ID } from "node-appwrite";

const merchantSerialNumber = process.env.VIPPS_MERCHANT_SERIAL_NUMBER!;
const subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY!;
const clientId = process.env.VIPPS_CLIENT_ID!;
const clientSecret = process.env.VIPPS_CLIENT_SECRET!;

const client = Client({
    merchantSerialNumber,
    subscriptionKey,
    useTestMode: process.env.VIPPS_TEST_MODE === "true" ? true : false,
    retryRequests: false,
    pluginName: 'appwrite-plugin-vipps',
    pluginVersion: '1.0.0',
    systemName: 'appwrite-plugin-vipps',
    systemVersion: '1.0.0',
  });


export async function getAccessToken() {
  const token = await client.auth.getToken(clientId, clientSecret);
  return token;
}

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

export async function createPayment({
    token,
    reference,
    amount,
    description,
    returnUrl,
    membershipId,
    membershipName,
    phoneNumber,
    paymentMethod,
}: {
  token: string,
    reference: string,
    amount: number,
    description: string,
    returnUrl: string,
    membershipId: string,
    membershipName: string,
    phoneNumber: string,
    paymentMethod: EPaymentMethodType,
}) {

  const amountWithCents = amount * 100;
  
    const payment = await client.payment.create(token, {
      amount: {
        currency: "NOK",
        value: amountWithCents, // This value equals 10 NOK
      },
      paymentMethod: { type: paymentMethod },
      customer: { phoneNumber: phoneNumber },
      receipt: {
        orderLines: [
          {
            name: membershipName,
            id: membershipId,
            totalAmount: amountWithCents,
            totalAmountExcludingTax: amountWithCents,
            totalTaxAmount: 0,
            taxPercentage: 0,
          }
        ],
        bottomLine: {
          currency: "NOK",
          posId: membershipId,
          receiptNumber: ID.unique(),
      }
    },
    reference: reference,
    userFlow: "WEB_REDIRECT",
      returnUrl: returnUrl,
      paymentDescription: membershipId + " - " + description,
    });

    if (payment.ok) {
      return payment
    }

    return payment;
  }

export async function getPayment({
    reference,
    token,
}: {
    reference: string,
    token: string,
}) {
  
    const payment = await client.payment.info(token, reference);

    return payment; 

}