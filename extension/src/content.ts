let translationPopup: HTMLDivElement | null = null;

// Create and show the translation popup
function showTranslationPopup(translation: string, position: { x: number, y: number }) {
    // Remove existing popup if any
    if (translationPopup) {
        document.body.removeChild(translationPopup);
    }

    // Create new popup
    translationPopup = document.createElement('div');
    translationPopup.style.cssText = `
        position: fixed;
        z-index: 10000;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 12px;
        max-width: 300px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
    `;

    // Add translation text
    translationPopup.textContent = translation;

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 18px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        color: #666;
    `;
    closeButton.onmouseover = () => {
        closeButton.style.backgroundColor = '#f0f0f0';
    };
    closeButton.onmouseout = () => {
        closeButton.style.backgroundColor = 'none';
    };
    closeButton.onclick = () => {
        if (translationPopup) {
            document.body.removeChild(translationPopup);
            translationPopup = null;
        }
    };

    translationPopup.appendChild(closeButton);
    document.body.appendChild(translationPopup);
    
    // Smart positioning: show above text, but below if not enough space
    const popupRect = translationPopup.getBoundingClientRect();
    const spaceAbove = position.y;
    const spaceBelow = window.innerHeight - position.y;
    
    if (spaceAbove >= popupRect.height + 20 || spaceAbove > spaceBelow) {
        // Position above the selection
        translationPopup.style.left = `${position.x}px`;
        translationPopup.style.top = `${position.y - popupRect.height - 10}px`;
    } else {
        // Position below the selection
        translationPopup.style.left = `${position.x}px`;
        translationPopup.style.top = `${position.y + 25}px`;
    }
    
    // Ensure popup doesn't go off screen horizontally
    const popupLeft = parseInt(translationPopup.style.left);
    if (popupLeft + popupRect.width > window.innerWidth) {
        translationPopup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
    }
    if (popupLeft < 10) {
        translationPopup.style.left = '10px';
    }

    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
        if (translationPopup && !translationPopup.contains(e.target as Node)) {
            document.body.removeChild(translationPopup);
            translationPopup = null;
        }
    });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {    if (message.action === 'showTranslation') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            showTranslationPopup(message.translation, {
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY - 10
            });
        }
        // Send response to confirm message was received
        sendResponse({ success: true });
    }
    return true; // Keep the message channel open for async response
});
