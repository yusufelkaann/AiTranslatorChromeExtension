interface Translation {
    original: string;
    translated: string;
    timestamp: string;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function createTranslationElement(translation: Translation): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'translation-item';

    const original = document.createElement('div');
    original.className = 'original-text';
    original.textContent = translation.original;

    const translated = document.createElement('div');
    translated.className = 'translated-text';
    translated.textContent = translation.translated;

    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatDate(translation.timestamp);

    div.appendChild(original);
    div.appendChild(translated);
    div.appendChild(timestamp);

    return div;
}

async function displayTranslations() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    const result = await chrome.storage.local.get('translations');
    const translations = result.translations || [];

    historyList.innerHTML = '';
    translations.forEach((translation: Translation) => {
        historyList.appendChild(createTranslationElement(translation));
    });
}

// Initial load
document.addEventListener('DOMContentLoaded', displayTranslations);

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.translations) {
        displayTranslations();
    }
});
