// Configuration
const SERVER_URL = 'http://localhost:3000';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '🌐 Translate with Gemini',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    try {
      // Show loading badge
      if (tab?.id && tab.id >= 0) {
        chrome.action.setBadgeText({ text: '...', tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#667eea', tabId: tab.id });
      }

      // Get settings and auth token
      const settings = await getSettings();
      let accessToken = null;
      
      if (settings.autoSaveSheets) {
        try {
          const tokenResponse = await fetch(`${SERVER_URL}/auth/token`);
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            accessToken = tokenData.access_token;
          }
        } catch (e) {
          console.log('No auth token available');
        }
      }

      // Make translation request
      const response = await fetch(`${SERVER_URL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: info.selectionText,
          accessToken: accessToken
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Store translation in local storage
      await saveTranslation(info.selectionText, data.translation);

      // Show success badge
      if (tab?.id && tab.id >= 0) {
        chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#2ed573', tabId: tab.id });
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '', tabId: tab.id });
        }, 2000);
      }

      // Send message to content script to show translation
      await showTranslationInPage(tab, data.translation);

      // Show notification if enabled
      if (settings.showNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Translation Complete',
          message: `"${truncateText(info.selectionText, 50)}" → "${truncateText(data.translation, 50)}"`
        });
      }

    } catch (error) {
      console.error('Translation error:', error);
      
      // Show error badge
      if (tab?.id && tab.id >= 0) {
        chrome.action.setBadgeText({ text: '✗', tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#ff4757', tabId: tab.id });
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '', tabId: tab.id });
        }, 3000);
      }

      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Translation Failed',
        message: 'Could not translate the selected text. Please check your connection and try again.'
      });
    }
  }
});

// Helper functions
async function saveTranslation(original, translated) {
  const result = await chrome.storage.local.get('translations');
  const translations = result.translations || [];

  const newTranslation = {
    id: Date.now(),
    original,
    translated,
    timestamp: new Date().toISOString()
  };

  translations.unshift(newTranslation);

  // Keep only last 50 translations
  const limitedTranslations = translations.slice(0, 50);

  await chrome.storage.local.set({ translations: limitedTranslations });
}

async function getSettings() {
  const result = await chrome.storage.local.get(['autoSaveSheets', 'showNotifications']);
  return {
    autoSaveSheets: result.autoSaveSheets !== false,
    showNotifications: result.showNotifications !== false
  };
}

async function showTranslationInPage(tab, translation) {
  if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'showTranslation',
        translation: translation
      });
    } catch (messageError) {
      console.log('Could not send message to content script, trying to inject:', messageError);
      try {
        // Try to inject the content script manually
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content.js']
        });

        // Wait a bit for the script to load, then try again
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'showTranslation',
              translation: translation
            });
          } catch (retryError) {
            console.log('Retry failed, content script injection unsuccessful');
          }
        }, 100);
      } catch (injectError) {
        console.log('Could not inject content script:', injectError);
      }
    }
  }
}

function truncateText(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
