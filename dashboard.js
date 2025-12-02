document.addEventListener('DOMContentLoaded', async () => {
    const windowsContainer = document.getElementById('windows-container');
    const statsEl = document.getElementById('stats');

    // 0. Inject CSS for Memory Stats Badges AND Drag & Drop Styles
    const style = document.createElement('style');
    style.textContent = `
        .status-badge {
            font-size: 0.7rem;
            padding: 2px 8px;
            border-radius: 12px;
            margin-left: 8px;
            font-weight: 600;
            white-space: nowrap;
        }
        .status-active {
            background-color: #dcfce7;
            color: #166534;
            border: 1px solid #bbf7d0;
        }
        .status-suspended {
            background-color: #f3f4f6;
            color: #6b7280;
            border: 1px solid #e5e7eb;
        }
        .status-loading {
            background-color: #e0f2fe;
            color: #0369a1;
            border: 1px solid #bae6fd;
        }
        /* Drag and Drop Styles */
        .window-card.drag-over {
            border: 2px dashed #2563eb;
            background-color: #eff6ff;
            transform: scale(1.02);
            transition: all 0.2s;
        }
        .tab-item.dragging {
            opacity: 0.5;
            background-color: #e5e7eb;
        }
    `;
    document.head.appendChild(style);

    // 1. Get all tabs AND all windows
    const [tabs, allWindows] = await Promise.all([
        chrome.tabs.query({}),
        chrome.windows.getAll()
    ]);
    
    // 2. Group tabs and Calculate Stats
    const tabsByWindow = {};
    let suspendedCount = 0;

    tabs.forEach(tab => {
        if (!tabsByWindow[tab.windowId]) {
            tabsByWindow[tab.windowId] = [];
        }
        tabsByWindow[tab.windowId].push(tab);

        if (tab.discarded) {
            suspendedCount++;
        }
    });

    // Update stats header
    const windowCount = Object.keys(tabsByWindow).length;
    statsEl.innerHTML = `
        <strong>${tabs.length}</strong> total tabs 
        <span style="color: #6b7280; margin: 0 5px;">•</span> 
        <strong>${suspendedCount}</strong> suspended
        <span style="color: #6b7280; margin: 0 5px;">•</span> 
        across <strong>${windowCount}</strong> window${windowCount > 1 ? 's' : ''}
    `;

    // Helper to update window counts in UI after changes
    const updateWindowUI = (cardElement) => {
        const count = cardElement.querySelectorAll('.tab-item').length;
        const countSpan = cardElement.querySelector('.window-header span:last-child');
        if (countSpan) countSpan.textContent = `${count} tabs`;
        
        // Update stats header (simple recalculation based on DOM)
        const totalTabs = document.querySelectorAll('.tab-item').length;
        // Check for suspended tabs in DOM for accuracy
        const totalSuspended = document.querySelectorAll('.status-suspended').length;
        statsEl.innerHTML = `
            <strong>${totalTabs}</strong> total tabs 
            <span style="color: #6b7280; margin: 0 5px;">•</span> 
            <strong>${totalSuspended}</strong> suspended
            <span style="color: #6b7280; margin: 0 5px;">•</span> 
            across <strong>${document.querySelectorAll('.window-card').length}</strong> windows
        `;

        if (count === 0) cardElement.remove();
    };

    // 3. Render Windows
    allWindows.forEach((win, index) => {
        const windowTabs = tabsByWindow[win.id];
        
        // Skip empty windows (unless you want to allow dropping into empty windows, but standard logic skips them initially)
        if ((!windowTabs || windowTabs.length === 0)) return;

        // Create Window Card
        const card = document.createElement('div');
        card.className = 'window-card';
        card.id = `window-${win.id}`; // ID used for Drag & Drop targeting
        
        // --- Drag & Drop: Drop Zone Handlers ---
        card.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
            card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', async (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');

            const dataRaw = e.dataTransfer.getData('application/json');
            if (!dataRaw) return;
            
            const data = JSON.parse(dataRaw);
            const sourceWindowId = data.windowId;
            const targetWindowId = win.id;
            const tabId = data.tabId;

            // Don't do anything if dropping on same window
            if (sourceWindowId === targetWindowId) return;

            try {
                // 1. Move tab in Chrome
                await chrome.tabs.move(tabId, { windowId: targetWindowId, index: -1 });

                // 2. Move DOM Element
                const tabEl = document.getElementById(`tab-${tabId}`);
                if (tabEl) {
                    list.appendChild(tabEl); // Move to this list
                    
                    // 3. Update UI Counts
                    updateWindowUI(card); // Target window
                    const sourceCard = document.getElementById(`window-${sourceWindowId}`);
                    if (sourceCard) updateWindowUI(sourceCard);
                }
            } catch (err) {
                console.error("Failed to move tab:", err);
            }
        });
        // ---------------------------------------

        // Determine Window Name
        let windowTitle = `Window ${index + 1}`;
        if (win.incognito) windowTitle += ' (Private)';
        if (win.type === 'popup') windowTitle += ' (Popup)';

        // Header
        const header = document.createElement('div');
        header.className = 'window-header';
        header.innerHTML = `<span>${windowTitle}</span> <span>${windowTabs.length} tabs</span>`;
        card.appendChild(header);

        // List
        const list = document.createElement('ul');
        list.className = 'tab-list';

        windowTabs.forEach(tab => {
            const li = document.createElement('li');
            li.className = 'tab-item';
            li.id = `tab-${tab.id}`; // ID needed for DOM manipulation after drop
            
            // --- Drag & Drop: Draggable Item Handlers ---
            li.draggable = true;
            
            li.addEventListener('dragstart', (e) => {
                li.classList.add('dragging');
                // Send tabId and source windowId
                e.dataTransfer.setData('application/json', JSON.stringify({
                    tabId: tab.id,
                    windowId: win.id
                }));
                e.dataTransfer.effectAllowed = 'move';
            });

            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
            });
            // ---------------------------------------------
            
            // Tab Content
            const content = document.createElement('div');
            content.className = 'tab-content';
            content.title = tab.title;
            
            // Favicon
            const faviconUrl = tab.favIconUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTA 1MCAxMi40OCAyIDIyeS00LjQ4LTEwLTEwUzE3LjUyIDIgMTIgMnptLTIgMTVsLTUtNSAxLjQxLTEuNDFMNCAxMC4xN2w3LjE3LTcuMTcgMS40MSAxLjQxTDUgMTd6Ii8+PC9zdmc+';
            
            const img = document.createElement('img');
            img.src = faviconUrl;
            img.className = 'tab-icon';
            img.onerror = () => { img.style.display = 'none'; };
            
            const title = document.createElement('span');
            title.className = 'tab-title';
            title.textContent = tab.title;

            content.appendChild(img);
            content.appendChild(title);

            // --- Memory Status Badge ---
            const badge = document.createElement('span');
            badge.className = 'status-badge';
            
            if (tab.discarded) {
                badge.textContent = 'Suspended';
                badge.classList.add('status-suspended');
                badge.title = "This tab is unloaded to save memory";
            } else if (tab.status === 'loading') {
                badge.textContent = 'Loading';
                badge.classList.add('status-loading');
            } else {
                badge.textContent = 'Active';
                badge.classList.add('status-active');
                badge.title = "This tab is currently in memory";
            }
            content.appendChild(badge);

            // Switch Tab Click
            content.addEventListener('click', async () => {
                await chrome.tabs.update(tab.id, { active: true });
                await chrome.windows.update(win.id, { focused: true });
            });

            // Close Button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-btn';
            closeBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            
            closeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await chrome.tabs.remove(tab.id);
                    li.remove();
                    updateWindowUI(card);
                } catch (err) {
                    console.error("Error closing tab:", err);
                }
            });

            li.appendChild(content);
            li.appendChild(closeBtn);
            list.appendChild(li);
        });

        card.appendChild(list);
        windowsContainer.appendChild(card);
    });
});