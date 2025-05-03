import axios from 'axios';


const GPT_API_URL = 'https://api.openai.com/v1/chat/completions';
const GPT_API_KEY = process.env.OPENAI_API_KEY || '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'; // Use environment variable for security

export async function translateText(text: string, source_lang: string, target_lang: string) {
    const prompt = {
        source_lang: source_lang,
        target_lang: target_lang,
        text: text
    };

    const messages = [
        {
            role: "system",
            content: "You are a helpful assistant that translates text. You are provided an object containing three properties: source language, target language, and the text requiring translation. Your task is to translate the content and return it back as a JSON object in the exact structure it was sent to you. Never provide a description of the result. You are only to return the content itself."
        },
        {
            role: "user",
            content: JSON.stringify(prompt)
        }
    ];

    try {
        const response = await axios.post(GPT_API_URL, {
            model: "gpt-3.5-turbo",
            messages: messages
        }, {
            headers: {
                'Authorization': `Bearer ${GPT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const translatedContent = JSON.parse(response.data.choices[0].message.content.trim());
        return translatedContent.text;
    } catch (error) {
        console.error('Error translating text:', error);
        throw new Error('Translation failed');
    }
}