chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate with Gemini',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    try {
      const response = await fetch('http://localhost:3000/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: info.selectionText
        })
      });      const data = await response.json();
      
      // Store translation in local storage
      const result = await chrome.storage.local.get('translations');
      const translations = result.translations || [];
      
      translations.unshift({
        original: info.selectionText,
        translated: data.translation,
        timestamp: new Date().toISOString()
      });

      // Keep only last 10 translations
      if (translations.length > 10) {
        translations.splice(10);
      }      await chrome.storage.local.set({ translations });      // Send message to content script to show translation
      if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'showTranslation',
            translation: data.translation
          });
        } catch (messageError) {
          console.log('Could not send message to content script, trying to inject:', messageError);
          try {
            // Try to inject the content script manually
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['dist/content.js']
            });
            
            // Wait a bit for the script to load, then try again
            setTimeout(async () => {
              try {
                await chrome.tabs.sendMessage(tab.id!, {
                  action: 'showTranslation',
                  translation: data.translation
                });              } catch (retryError) {
                console.log('Retry failed, showing badge instead');
                if (tab.id && tab.id >= 0) {
                  chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
                  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
                  setTimeout(() => {
                    chrome.action.setBadgeText({ text: '', tabId: tab.id! });
                  }, 2000);
                }
              }
            }, 100);          } catch (injectError) {
            console.log('Could not inject content script:', injectError);
            // Fallback: show notification badge
            if (tab.id && tab.id >= 0) {
              chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
              chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
              setTimeout(() => {
                chrome.action.setBadgeText({ text: '', tabId: tab.id });
              }, 2000);
            }
          }
        }      } else {
        // Not a valid page for content scripts, show badge
        if (tab?.id && tab.id >= 0) {
          chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
          chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
          setTimeout(() => {
            chrome.action.setBadgeText({ text: '', tabId: tab.id });
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
  }
});
