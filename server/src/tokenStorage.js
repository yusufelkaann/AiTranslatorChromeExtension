const fs = require('fs');
const path = require('path');

const TOKENS_FILE = path.join(__dirname, 'tokens.json');

class TokenStorage {
  static saveTokens(tokens) {
    try {
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
      console.log('Tokens saved successfully');
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  static getTokens() {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        const data = fs.readFileSync(TOKENS_FILE, 'utf-8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Error reading tokens:', error);
      return null;
    }
  }

  static hasValidTokens() {
    const tokens = this.getTokens();
    if (!tokens || !tokens.access_token) {
      return false;
    }
    
    // Check if token is expired (with 5 minute buffer)
    if (tokens.expiry_date) {
      const now = Date.now();
      const expiryTime = tokens.expiry_date;
      return (expiryTime - now) > (5 * 60 * 1000); // 5 minutes buffer
    }
    
    return true;
  }

  static async refreshTokensIfNeeded() {
    const tokens = this.getTokens();
    if (!tokens || !tokens.refresh_token) {
      console.log('No tokens or refresh token available');
      return null;
    }

    // Check if token is expired or will expire soon (within 10 minutes)
    const now = Date.now();
    const expiryTime = tokens.expiry_date || 0;
    const needsRefresh = (expiryTime - now) < (10 * 60 * 1000); // 10 minutes buffer

    console.log(`Token expiry: ${new Date(expiryTime)}, Current: ${new Date(now)}, Needs refresh: ${needsRefresh}`);

    if (needsRefresh) {
      try {
        console.log('Refreshing tokens...');
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
          '',
          '',
          'http://localhost:3000/oauth2callback'
        );

        oauth2Client.setCredentials({
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token
        });

        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Merge with existing tokens to preserve refresh_token
        const updatedTokens = {
          ...tokens,
          ...credentials,
          refresh_token: tokens.refresh_token // Ensure we keep the refresh token
        };
        
        this.saveTokens(updatedTokens);
        console.log('Tokens refreshed successfully');
        return updatedTokens;
      } catch (error) {
        console.error('Error refreshing tokens:', error);
        return null;
      }
    }

    return tokens;
  }

  static clearTokens() {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        fs.unlinkSync(TOKENS_FILE);
        console.log('Tokens cleared successfully');
      }
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }
}

module.exports = TokenStorage;
