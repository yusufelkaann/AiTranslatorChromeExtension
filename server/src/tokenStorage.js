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
    return tokens && tokens.access_token;
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
