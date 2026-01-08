document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('shortcut-display');
    const saveBtn = document.getElementById('save-btn');
    const status = document.getElementById('status');

    let currentShortcut = {
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        code: 'KeyX',
        key: 'X'
    };

    // Load saved settings
    chrome.storage.local.get(['noteShortcut'], (result) => {
        if (result.noteShortcut) {
            currentShortcut = result.noteShortcut;
            updateDisplay();
        }
    });

    function formatShortcut(s) {
        const parts = [];
        if (s.ctrlKey) parts.push('Ctrl');
        if (s.metaKey) parts.push('Cmd');
        if (s.altKey) parts.push('Alt');
        if (s.shiftKey) parts.push('Shift');
        // Clean up key name (e.g., 'KeyX' -> 'X')
        const keyName = s.code.startsWith('Key') ? s.code.slice(3) : s.key.toUpperCase();
        parts.push(keyName);
        return parts.join(' + ');
    }

    function updateDisplay() {
        display.textContent = formatShortcut(currentShortcut);
    }

    // Recording logic
    let isRecording = false;

    display.addEventListener('click', () => {
        isRecording = true;
        display.classList.add('recording');
        display.textContent = 'Press keys...';
    });

    document.addEventListener('keydown', (e) => {
        if (!isRecording) return;
        
        e.preventDefault();
        
        // Ignore modifier-only presses
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

        currentShortcut = {
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
            code: e.code,
            key: e.key
        };

        updateDisplay();
        isRecording = false;
        display.classList.remove('recording');
    });

    // Save logic
    saveBtn.addEventListener('click', () => {
        chrome.storage.local.set({ noteShortcut: currentShortcut }, () => {
            status.style.opacity = '1';
            setTimeout(() => { status.style.opacity = '0'; }, 2000);
        });
    });
});