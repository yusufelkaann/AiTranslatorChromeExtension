const express = require('express');
const { google } = require('googleapis');
const TokenStorage = require('./tokenStorage');

const router = express.Router();
const GOOGLE_CLIENT_ID = '';
const GOOGLE_CLIENT_SECRET = '';

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
)

// Route to initiate OAuth2 flow
router.get('/auth', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file'
        ],
    });

    res.redirect(authUrl);
});

// Callback route to handle OAuth2 response
router.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        
        // Store tokens securely
        TokenStorage.saveTokens(tokens);
        
        console.log('Tokens saved successfully');
        res.send(`
            <html>
                <body>
                    <h2>Authentication successful!</h2>
                    <p>You can now use the translation feature with Google Sheets integration.</p>
                    <p>You can close this window and return to your extension.</p>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Error retrieving access token:', error);
        res.status(500).send(`
            <html>
                <body>
                    <h2>Authentication failed</h2>
                    <p>Error: ${error.message}</p>
                    <p>Please try again.</p>
                </body>
            </html>
        `);
    }
});

// Check authentication status
router.get('/auth/status', (req, res) => {
    const hasTokens = TokenStorage.hasValidTokens();
    res.json({ 
        authenticated: hasTokens,
        message: hasTokens ? 'User is authenticated' : 'User needs to authenticate'
    });
});

// Get stored access token
router.get('/auth/token', (req, res) => {
    const tokens = TokenStorage.getTokens();
    if (tokens && tokens.access_token) {
        res.json({ access_token: tokens.access_token });
    } else {
        res.status(401).json({ error: 'No valid tokens found' });
    }
});

// Logout route
router.post('/auth/logout', (req, res) => {
    TokenStorage.clearTokens();
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;