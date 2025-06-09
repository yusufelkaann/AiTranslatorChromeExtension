"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const gemini_1 = require("./gemini");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Translation endpoint
app.post('/translate', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        const translation = await (0, gemini_1.translateText)(text);
        res.json({ translation });
    }
    catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({
            error: 'Translation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
