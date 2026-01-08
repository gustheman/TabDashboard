(function() {
    // Deduplication: Check if already injected
    if (window.hasTabDashboardNote) return;
    window.hasTabDashboardNote = true;

    const HOST_ID = 'tab-dashboard-note-host';
    let host = null;
    let container = null;
    let textarea = null;

    // --- State Management ---
    let isVisible = false;
    let activeShortcut = {
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        code: 'KeyX'
    };
    
    console.log('Tab Dashboard Note: Script Loaded');

    // Load saved shortcut
    chrome.storage.local.get(['noteShortcut'], (result) => {
        if (result.noteShortcut) {
            activeShortcut = result.noteShortcut;
        }
    });

    // Listen for shortcut changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.noteShortcut) {
            activeShortcut = changes.noteShortcut.newValue;
        }
    });

    // --- Event Listener (Shortcut Trigger) ---
    document.addEventListener('keydown', (e) => {
        // Match against activeShortcut
        const matches = 
            e.ctrlKey === activeShortcut.ctrlKey &&
            e.shiftKey === activeShortcut.shiftKey &&
            e.altKey === activeShortcut.altKey &&
            e.metaKey === activeShortcut.metaKey &&
            e.code === activeShortcut.code;

        if (matches) {
            console.log('Tab Dashboard Note: Shortcut Triggered');
            e.preventDefault();
            toggleNote();
        }
        
        // Close on Escape
        if (e.key === 'Escape' && isVisible) {
            toggleNote();
        }
    });

    function toggleNote() {
        if (!host) {
            initUI();
        }
        
        isVisible = !isVisible;
        
        if (isVisible) {
            container.style.display = 'flex';
            textarea.focus();
        } else {
            container.style.display = 'none';
        }
    }

    function initUI() {
        host = document.createElement('div');
        host.id = HOST_ID;
        host.style.position = 'fixed';
        host.style.zIndex = '2147483647';
        host.style.top = '0';
        host.style.left = '0';
        host.style.width = '0';
        host.style.height = '0';

        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            #note-container {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 300px;
                height: 250px;
                background-color: #fef3c7;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                display: none; /* Hidden by default */
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                z-index: 10000;
            }

            #note-header {
                padding: 8px 12px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: #fde68a;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
                cursor: move;
                user-select: none;
            }

            #note-title {
                font-size: 0.85rem;
                font-weight: 600;
                color: #78350f;
            }

            #close-btn {
                background: none;
                border: none;
                color: #92400e;
                cursor: pointer;
                font-size: 1.2rem;
                line-height: 1;
                padding: 0 4px;
            }

            #close-btn:hover {
                color: #451a03;
            }

            textarea {
                flex: 1;
                width: 100%;
                border: none;
                resize: none;
                padding: 12px;
                background-color: transparent;
                font-size: 0.95rem;
                color: #374151;
                outline: none;
                box-sizing: border-box;
                line-height: 1.5;
                border-bottom-left-radius: 8px;
                border-bottom-right-radius: 8px;
            }
            
            textarea::placeholder {
                color: #9ca3af;
            }

            .status {
                font-size: 0.7rem;
                color: #9ca3af;
                position: absolute;
                bottom: 5px;
                right: 10px;
                pointer-events: none;
                transition: opacity 0.3s;
                opacity: 0;
            }
        `;

        container = document.createElement('div');
        container.id = 'note-container';

        const header = document.createElement('div');
        header.id = 'note-header';
        header.innerHTML = `
            <span id="note-title">Tab Note</span>
            <button id="close-btn" title="Close (Alt+N)">&times;</button>
        `;

        textarea = document.createElement('textarea');
        textarea.placeholder = "Type your notes for this page...";

        const status = document.createElement('span');
        status.className = 'status';
        status.innerText = 'Saved';

        container.appendChild(header);
        container.appendChild(textarea);
        container.appendChild(status);
        shadow.appendChild(style);
        shadow.appendChild(container);

        document.body.appendChild(host);

        // --- Logic ---

        // 1. Close Button
        header.querySelector('#close-btn').addEventListener('click', () => {
            toggleNote();
        });

        // 2. Load Note
        const currentUrl = window.location.href;
        const storageKey = `note_${currentUrl}`;

        chrome.storage.local.get([storageKey], (result) => {
            if (result[storageKey]) {
                textarea.value = result[storageKey];
            }
        });

        // 3. Auto-save
        let timeout;
        textarea.addEventListener('input', () => {
            status.style.opacity = '0';
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const note = textarea.value;
                const data = {};
                data[storageKey] = note;
                chrome.storage.local.set(data, () => {
                    status.innerText = 'Saved';
                    status.style.opacity = '1';
                    setTimeout(() => { status.style.opacity = '0'; }, 2000);
                });
            }, 500);
        });

        // 4. Drag Support
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener("mousedown", dragStart);
        document.addEventListener("mouseup", dragEnd);
        document.addEventListener("mousemove", drag);

        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            if (e.target === header || e.target.parentNode === header) {
                isDragging = true;
            }
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        }
    }

})();