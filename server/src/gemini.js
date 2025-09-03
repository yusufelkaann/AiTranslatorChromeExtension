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

// Function to get the first sheet's name from a spreadsheet
async function getFirstSheetName(sheets, spreadsheetId) {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
      fields: 'sheets.properties.title'
    });
    
    if (response.data.sheets && response.data.sheets.length > 0) {
      return response.data.sheets[0].properties.title;
    }
    
    // Fallback to creating a new sheet if none exist
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: 'Translations'
            }
          }
        }]
      }
    });
    
    return 'Translations';
  } catch (error) {
    console.error('Error getting sheet name:', error);
    return 'Sheet1'; // Fallback to default name
  }
}

// Function to save the translation to Google Sheets
async function getOrCreateSheetId(accessToken) {
  try {
    console.log('Getting or creating sheet ID...');
    
    // Check if Sheet ID exists
    if (fs.existsSync(SHEET_ID_FILE)) {
      const data = JSON.parse(fs.readFileSync(SHEET_ID_FILE, 'utf-8'));
      if (data.sheetId) {
        console.log('Found existing sheet ID:', data.sheetId);
        return data.sheetId;
      }
    }

    // Always refresh tokens before creating sheets
    const refreshedTokens = await TokenStorage.refreshTokensIfNeeded();
    const validToken = refreshedTokens ? refreshedTokens.access_token : accessToken;
    
    if (!validToken) {
      throw new Error('No valid access token available');
    }

    // Create a new Google Sheet
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: validToken });
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
    
    // Get the actual sheet name
    const sheetName = await getFirstSheetName(sheets, sheetId);
    
    // Check if headers already exist
    try {
      const existingData = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1:C1`
      });
      
      if (!existingData.data.values || existingData.data.values.length === 0) {
        // Add headers if they don't exist
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${sheetName}!A1:C1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['Original Text', 'Translation', 'Timestamp']]
          }
        });
      }
    } catch (headerError) {
      console.log('Could not check/set headers, continuing without them:', headerError.message);
    }

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
        // Always refresh tokens before using them
        const refreshedTokens = await TokenStorage.refreshTokensIfNeeded();
        const validToken = refreshedTokens ? refreshedTokens.access_token : accessToken;
        
        const sheetId = await getOrCreateSheetId(validToken);
        await saveToGoogleSheets(text, translation, validToken, sheetId);
      } catch (sheetError) {
        console.error('Google Sheets save failed, but translation succeeded:', sheetError);
        // Don't throw here - translation was successful even if sheets save failed
      }
    } else {
      // Try to use stored tokens if no accessToken provided
      const tokens = TokenStorage.getTokens();
      if (tokens && tokens.access_token) {
        try {
          // Refresh tokens if needed
          const refreshedTokens = await TokenStorage.refreshTokensIfNeeded();
          const validToken = refreshedTokens ? refreshedTokens.access_token : tokens.access_token;
          
          const sheetId = await getOrCreateSheetId(validToken);
          await saveToGoogleSheets(text, translation, validToken, sheetId);
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
    console.log('Starting Google Sheets save...');
    
    // Always refresh tokens before making API calls
    const refreshedTokens = await TokenStorage.refreshTokensIfNeeded();
    const validToken = refreshedTokens ? refreshedTokens.access_token : accessToken;
    
    if (!validToken) {
      throw new Error('No valid access token available');
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: validToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Get the actual sheet name instead of hardcoding 'Sheet1'
    const sheetName = await getFirstSheetName(sheets, sheetId);
    
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
      range: `${sheetName}!A:C`,
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
