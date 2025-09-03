const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const TokenStorage = require('./tokenStorage');
require('dotenv').config();

const GEMINI_API_KEY = "";
const SHEET_ID_FILE = path.join(__dirname, 'sheetId.json');

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required in environment variables');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Function to save the translation to Google Sheets
async function getOrCreateSheetId(accessToken) {
  try {
    // Check if Sheet ID exists
    if (fs.existsSync(SHEET_ID_FILE)) {
      const data = JSON.parse(fs.readFileSync(SHEET_ID_FILE, 'utf-8'));
      if (data.sheetId) return data.sheetId;
    }

    // Create a new Google Sheet
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const fileMetaData = {
      name: 'Translator Extension English-Turkish',
      mimeType: 'application/vnd.google-apps.spreadsheet',
    };

    const file = await drive.files.create({
      resource: fileMetaData,
      fields: 'id',
    });

    const sheetId = file.data.id;
    
    // Set up headers for the sheet
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1:C1',
      valueInputOption: 'RAW',
      resource: {
        values: [['Original Text', 'Translation', 'Timestamp']]
      }
    });

    fs.writeFileSync(SHEET_ID_FILE, JSON.stringify({ sheetId }));
    console.log('New Google Sheet created with ID:', sheetId);
    return sheetId;
  } catch (error) {
    console.error('Error creating/getting sheet ID:', error);
    throw new Error('Failed to create or get Google Sheet');
  }
}

async function translateText(text, accessToken = null) {
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

    // If accessToken is provided, save to Google Sheets
    if (accessToken) {
      try {
        const sheetId = await getOrCreateSheetId(accessToken);
        await saveToGoogleSheets(text, translation, accessToken, sheetId);
      } catch (sheetError) {
        console.error('Google Sheets save failed, but translation succeeded:', sheetError);
        // Don't throw here - translation was successful even if sheets save failed
      }
    } else {
      // Try to use stored tokens if no accessToken provided
      const tokens = TokenStorage.getTokens();
      if (tokens && tokens.access_token) {
        try {
          const sheetId = await getOrCreateSheetId(tokens.access_token);
          await saveToGoogleSheets(text, translation, tokens.access_token, sheetId);
        } catch (sheetError) {
          console.error('Google Sheets save failed with stored tokens:', sheetError);
          // Don't throw here - translation was successful even if sheets save failed
        }
      }
    }

    return translation.trim();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Translation failed');
  }
}

async function saveToGoogleSheets(originalText, translatedText, accessToken, sheetId) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const timestamp = new Date().toISOString();
    const values = [
      [
        originalText,
        translatedText,
        timestamp
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:C',
      valueInputOption: 'RAW',
      resource: {
        values
      }
    });

    console.log('Translation saved to Google Sheets successfully');
  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
    throw new Error('Failed to save to Google Sheets: ' + error.message);
  }
}

module.exports = { translateText};
