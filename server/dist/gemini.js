"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateText = translateText;
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required in environment variables');
}
const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
async function translateText(text) {
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
    }
    catch (error) {
        console.error('Gemini API error:', error);
        throw new Error(error instanceof Error ? error.message : 'Translation failed');
    }
}
