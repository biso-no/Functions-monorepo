import { translateText } from "../../packages/openai/translate.js";
import { Context } from "@biso/types";

export default async ({ req, res, log, error }: Context) => {
 
  if (req.method !== "POST") {
    res.json({ error: "Method not allowed" });
    return;
  }

  const { source_lang, target_lang, text } = req.body;
  if (!source_lang || !target_lang || !text) {
    res.json({ error: "Missing required parameters" });
    return;
  }

  try {
    const translatedText = await translateText(text, source_lang, target_lang);
    log(translatedText);
    res.json({ translatedText });
  } catch (error) {
    res.json({ error: "Failed to translate text" });
  }
}