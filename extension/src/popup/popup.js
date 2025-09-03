// Configuration
const SERVER_URL = 'http://localhost:3000';

// DOM Elements
let authBtn, logoutBtn, authStatus, statusIndicator, statusText;
let inputText, translateBtn, translationResult, translatedText, copyBtn;
let historyList, clearHistoryBtn, loadingOverlay;
let autoSaveSheets, showNotifications;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    initializeElements();
    await checkAuthStatus();
    await displayTranslations();
    setupEventListeners();
    loadSettings();
});

function initializeElements() {
    authBtn = document.getElementById('auth-btn');
    logoutBtn = document.getElementById('logout-btn');
    authStatus = document.getElementById('auth-status');
    statusIndicator = document.getElementById('status-indicator');
    statusText = document.getElementById('status-text');
    
    inputText = document.getElementById('input-text');
    translateBtn = document.getElementById('translate-btn');
    translationResult = document.getElementById('translation-result');
    translatedText = document.getElementById('translated-text');
    copyBtn = document.getElementById('copy-btn');
    
    historyList = document.getElementById('history-list');
    clearHistoryBtn = document.getElementById('clear-history');
    loadingOverlay = document.getElementById('loading-overlay');
    
    autoSaveSheets = document.getElementById('auto-save-sheets');
    showNotifications = document.getElementById('show-notifications');
}

function setupEventListeners() {
    authBtn.addEventListener('click', handleAuth);
    logoutBtn.addEventListener('click', handleLogout);
    translateBtn.addEventListener('click', handleManualTranslation);
    copyBtn.addEventListener('click', copyTranslation);
    clearHistoryBtn.addEventListener('click', clearHistory);
    
    // Settings
    autoSaveSheets.addEventListener('change', saveSettings);
    showNotifications.addEventListener('change', saveSettings);
    
    // Enter key in textarea
    inputText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleManualTranslation();
        }
    });
    
    // Storage changes listener
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.translations) {
            displayTranslations();
        }
    });
}

// Authentication functions
async function checkAuthStatus() {
    try {
        const response = await fetch(`${SERVER_URL}/auth/status`);
        const data = await response.json();
        
        updateAuthUI(data.authenticated);
        statusText.textContent = data.authenticated ? 'Connected' : 'Not connected';
        
        if (data.authenticated) {
            statusIndicator.classList.add('connected');
        } else {
            statusIndicator.classList.remove('connected');
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        updateAuthUI(false);
        statusText.textContent = 'Server offline';
    }
}

function updateAuthUI(isAuthenticated) {
    if (isAuthenticated) {
        authBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-flex';
    } else {
        authBtn.style.display = 'inline-flex';
        logoutBtn.style.display = 'none';
    }
}

async function handleAuth() {
    try {
        // Open auth URL in new tab
        const authUrl = `${SERVER_URL}/auth`;
        await chrome.tabs.create({ url: authUrl });
        
        // Close popup to avoid blocking
        window.close();
    } catch (error) {
        console.error('Error during authentication:', error);
        showNotification('Authentication failed. Please try again.', 'error');
    }
}

async function handleLogout() {
    try {
        const response = await fetch(`${SERVER_URL}/auth/logout`, {
            method: 'POST'
        });
        
        if (response.ok) {
            await checkAuthStatus();
            showNotification('Logged out successfully', 'success');
        }
    } catch (error) {
        console.error('Error during logout:', error);
        showNotification('Logout failed', 'error');
    }
}

// Translation functions
async function handleManualTranslation() {
    const text = inputText.value.trim();
    if (!text) {
        showNotification('Please enter text to translate', 'error');
        return;
    }
    
    showLoading(true);
    translateBtn.disabled = true;
    
    try {
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
        
        const response = await fetch(`${SERVER_URL}/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                accessToken: accessToken
            })
        });
        
        if (!response.ok) {
            throw new Error('Translation failed');
        }
        
        const data = await response.json();
        const translation = data.translation;
        
        // Display result
        translatedText.textContent = translation;
        translationResult.style.display = 'block';
        
        // Save to local storage
        await saveTranslation(text, translation);
        
        // Show notification if enabled
        if (settings.showNotifications) {
            showNotification('Translation completed!', 'success');
        }
        
        // Clear input
        inputText.value = '';
        
    } catch (error) {
        console.error('Translation error:', error);
        showNotification('Translation failed. Please try again.', 'error');
    } finally {
        showLoading(false);
        translateBtn.disabled = false;
    }
}

async function copyTranslation() {
    try {
        await navigator.clipboard.writeText(translatedText.textContent);
        
        // Visual feedback
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span class="btn-icon">✓</span> Copied!';
        copyBtn.style.background = '#2ed573';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.background = '#6c757d';
        }, 2000);
        
    } catch (error) {
        console.error('Copy failed:', error);
        showNotification('Copy failed', 'error');
    }
}

// History functions
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

async function displayTranslations() {
    const result = await chrome.storage.local.get('translations');
    const translations = result.translations || [];
    
    if (translations.length === 0) {
        historyList.innerHTML = '<div class="no-history">No translations yet. Select text on any webpage to translate!</div>';
        return;
    }
    
    historyList.innerHTML = '';
    translations.forEach((translation) => {
        historyList.appendChild(createTranslationElement(translation));
    });
}

function createTranslationElement(translation) {
    const div = document.createElement('div');
    div.className = 'translation-item';
    
    const original = document.createElement('div');
    original.className = 'original-text';
    original.textContent = truncateText(translation.original, 100);
    
    const translated = document.createElement('div');
    translated.className = 'translated-text';
    translated.textContent = truncateText(translation.translated, 100);
    
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatDate(translation.timestamp);
    
    div.appendChild(original);
    div.appendChild(translated);
    div.appendChild(timestamp);
    
    // Click to copy functionality
    div.style.cursor = 'pointer';
    div.title = 'Click to copy translation';
    div.addEventListener('click', () => {
        navigator.clipboard.writeText(translation.translated);
        showNotification('Translation copied!', 'success');
    });
    
    return div;
}

async function clearHistory() {
    if (confirm('Are you sure you want to clear all translation history?')) {
        await chrome.storage.local.set({ translations: [] });
        displayTranslations();
        showNotification('History cleared', 'success');
    }
}

// Settings functions
async function loadSettings() {
    const result = await chrome.storage.local.get(['autoSaveSheets', 'showNotifications']);
    
    autoSaveSheets.checked = result.autoSaveSheets !== false; // default true
    showNotifications.checked = result.showNotifications !== false; // default true
}

async function saveSettings() {
    await chrome.storage.local.set({
        autoSaveSheets: autoSaveSheets.checked,
        showNotifications: showNotifications.checked
    });
}

async function getSettings() {
    const result = await chrome.storage.local.get(['autoSaveSheets', 'showNotifications']);
    return {
        autoSaveSheets: result.autoSaveSheets !== false,
        showNotifications: result.showNotifications !== false
    };
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // less than 1 minute
        return 'Just now';
    } else if (diff < 3600000) { // less than 1 hour
        return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) { // less than 1 day
        return `${Math.floor(diff / 3600000)}h ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 16px',
        borderRadius: '6px',
        color: 'white',
        fontSize: '14px',
        zIndex: '10000',
        opacity: '0',
        transform: 'translateY(-20px)',
        transition: 'all 0.3s ease'
    });
    
    if (type === 'success') {
        notification.style.background = '#2ed573';
    } else if (type === 'error') {
        notification.style.background = '#ff4757';
    } else {
        notification.style.background = '#667eea';
    }
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}
