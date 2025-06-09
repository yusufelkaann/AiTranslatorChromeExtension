import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required in environment variables');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function translateText(text: string): Promise<string> {
  try {
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Construct the prompt
    const prompt = `Translate the following text into Turkish. If the text is already in Turkish, translate it to English. Only provide the translation without any additional text or explanation:
    
    "${text}"`;

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translation = response.text();

    return translation.trim();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Translation failed');
  }
}
