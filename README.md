# Gemini Translator Chrome Extension

This project is a Chrome extension that translates selected text using Google's Gemini AI.

**Technologies Used:**

*   **Extension (Frontend):**
    *   TypeScript
    *   HTML/CSS
    *   Chrome Extension APIs
*   **Server (Backend):**
    *   Node.js
    *   Express.js
    *   TypeScript
    *   `@google/generative-ai` for Gemini API interaction
    *   `dotenv` for environment variable management

**How to Run:**

**1. Server:**

   *   Navigate to the `server` directory: `cd server`
   *   Install dependencies: `npm install`
   *   Create a `.env` file in the `server` directory and add your Gemini API key:
        ```env
        PORT=3000
        GEMINI_API_KEY=YOUR_GEMINI_API_KEY
        ```
   *   Build the server: `npm run build`
   *   Start the server: `npm start`
   *   For development (with auto-rebuild): `npm run dev`

**2. Extension:**

   *   Navigate to the `extension` directory: `cd extension`
   *   Install dependencies: `npm install`
   *   Build the extension: `npm run build`
   *   Load the extension in Chrome:
        1.  Open Chrome and go to `chrome://extensions`.
        2.  Enable "Developer mode".
        3.  Click "Load unpacked".
        4.  Select the `extension` directory.

Ensure the server is running before using the extension. Select text on a webpage, right-click, and choose "Translate with Gemini".
