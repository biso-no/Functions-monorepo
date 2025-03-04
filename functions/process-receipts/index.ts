import OpenAI from 'openai';
import { ExchangeRateResponse } from '@biso/types';
import { Context } from '@biso/types';
import { createAdminClient } from '@biso/appwrite';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to get exchange rate for a specific date
async function getHistoricalRate(date: string, currency: string): Promise<number | null> {
  if (currency === 'NOK') return 1;
  
  try {
    const response = await fetch(
      `https://api.frankfurter.app/${date}?from=${currency}&to=NOK`
    );
    const data = await response.json() as ExchangeRateResponse;
    return data.rates?.NOK || null;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return null;
  }
}

export default async ({ req, res, log, error }: Context) => {
  try {
    const {databases, storage} = await createAdminClient()

    log("Request received");
    log(req.body);

    const extractedText = req.body;

    if (!extractedText) {
      throw new Error("No text found in the request body");
    }

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant designed to output JSON. You will analyze receipt text and output a JSON object with:
          - date in YYYY-MM-DD format
          - amount as a number
          - description (max 10 words)
          - currency (3-letter code, e.g., NOK, USD, EUR)
          - confidence (0-1 indicating how confident you are in the extraction)

          Pay special attention to currency symbols (€, $, £, kr) and currency codes to determine the correct currency.
          Default to NOK if no currency is clearly indicated and the text appears to be Norwegian.`
        },
        { role: "user", content: extractedText },
      ],
      model: "gpt-3.5-turbo-0125",
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0].message?.content;
    if (!text) {
      throw new Error("No text found in the completion response");
    }

    const json = JSON.parse(text);
    
    // Get exchange rate if not NOK
    if (json.currency && json.currency !== 'NOK' && json.date) {
      const rate = await getHistoricalRate(json.date, json.currency);
      
      return res.json({
        date: json.date,
        amount: json.amount,
        description: json.description,
        currency: json.currency,
        confidence: json.confidence,
        exchangeRate: rate,
        nokAmount: rate ? json.amount * rate : null
      });
    }

    return res.json({
      date: json.date,
      amount: json.amount,
      description: json.description,
      currency: json.currency || 'NOK',
      confidence: json.confidence
    });

  } catch (err: any) {
    error(err.message || err);
    return res.json({ error: err.message || err });
  }
}