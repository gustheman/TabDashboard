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
        const stored = result[noteKey];
        if (stored) {
            // Handle both string (legacy) and object formats
            textarea.value = typeof stored === 'object' ? stored.content : stored;
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
            // Save as object with metadata for better Dashboard display
            data[noteKey] = {
                content: note,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
                updatedAt: Date.now()
            };
            chrome.storage.local.set(data, () => {
                statusEl.style.opacity = '1';
                setTimeout(() => { statusEl.style.opacity = '0'; }, 2000);
            });
        }, 500);
    });
    
    // Focus immediately
    textarea.focus();
});