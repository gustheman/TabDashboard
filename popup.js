document.addEventListener('DOMContentLoaded', async () => {
    const titleEl = document.getElementById('title');
    const textarea = document.getElementById('note-input');
    const statusEl = document.getElementById('status');
    const openDashboardBtn = document.getElementById('open-dashboard');

    // Open Dashboard Logic
    openDashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'dashboard.html' });
    });

    // 1. Get Active Tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
        titleEl.textContent = "No active page";
        textarea.disabled = true;
        return;
    }

    // 2. Setup UI
    titleEl.textContent = tab.title || "Tab Note";
    titleEl.title = tab.title; // Tooltip for full title

    const noteKey = `note_${tab.url}`;

    // 3. Load Note
    chrome.storage.local.get([noteKey], (result) => {
        if (result[noteKey]) {
            textarea.value = result[noteKey];
        }
    });

    // 4. Auto-save
    let saveTimeout;
    textarea.addEventListener('input', () => {
        statusEl.style.opacity = '0';
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const note = textarea.value;
            const data = {};
            data[noteKey] = note;
            chrome.storage.local.set(data, () => {
                statusEl.style.opacity = '1';
                setTimeout(() => { statusEl.style.opacity = '0'; }, 2000);
            });
        }, 500);
    });
    
    // Focus immediately
    textarea.focus();
});