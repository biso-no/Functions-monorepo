
import OpenAI from 'openai';
import { Context } from '@biso/types';


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// This is your Appwrite function
// It's executed each time we get a request
export default async ({ req, res, log, error }: Context) => {
  try {
    // Initialize Appwrite client


    log("Request received");

    // Log the received request body
    log(req.body);

    const object = JSON.parse(req.body);


    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant designed to output JSON. In the following message, you are presented with a stringified version of an object. This object contains 2 fields. descriptions and event. Your task is to determine a suitable description for an entire expense based on all the provided descriptions and the optional eventName if eventName is present. You will generate the overall descriptions of the expense based on the overall contents of the attachment descriptions and eventName in the following message. You will then output the result in JSON output with the following field: description."
        },
        { role: "user", content: req.body },
      ],
      model: "gpt-3.5-turbo-0125",
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0].message?.content;
    if (!text) {
      throw new Error("No text found in the completion response");
    }

    const json = JSON.parse(text);

    log(json);
    
    return res.json({
      date: json.date,
      amount: json.amount,
      description: json.description
    });

  } catch (err: any) {
    error(err.message || err);
    return res.json({ error: err.message || err });
  }
}