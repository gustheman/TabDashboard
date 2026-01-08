document.addEventListener('DOMContentLoaded', () => {
    const windowsContainer = document.getElementById('windows-container');
    const statsEl = document.getElementById('stats');
    const viewByWindowBtn = document.getElementById('view-by-window');
    const viewByDomainBtn = document.getElementById('view-by-domain');
    const viewByNotesBtn = document.getElementById('view-by-notes');

    let currentView = localStorage.getItem('tabDashboard-view') || 'window';
    let isRendering = false;
    
    // ... existing code ...

    const updateView = (newView) => {
        currentView = newView;
        localStorage.setItem('tabDashboard-view', newView);
        viewByWindowBtn.classList.toggle('active', newView === 'window');
        viewByDomainBtn.classList.toggle('active', newView === 'domain');
        viewByNotesBtn.classList.toggle('active', newView === 'notes');
        render();
    };

    viewByWindowBtn.addEventListener('click', () => updateView('window'));
    viewByDomainBtn.addEventListener('click', () => updateView('domain'));
    viewByNotesBtn.addEventListener('click', () => updateView('notes'));

    const getDomain = (url) => {
        if (!url) return 'Other';
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            if (hostname === 'docs.google.com') {
                if (urlObj.pathname.startsWith('/document/')) return 'Google Docs';
                if (urlObj.pathname.startsWith('/spreadsheets/')) return 'Google Sheets';
                if (urlObj.pathname.startsWith('/presentation/')) return 'Google Slides';
                if (urlObj.pathname.startsWith('/forms/')) return 'Google Forms';
                return 'Google Drive';
            }
            return hostname.replace(/^www\./, '');
        } catch (e) {
            const protocol = url.split(':')[0];
            return protocol.endsWith('s') || protocol.endsWith('p') ? 'Other' : protocol;
        }
    };

    const createTabListItem = (tab, tabsById, isDraggable, storageData) => {
        const li = document.createElement('li');
        li.className = 'tab-item';
        if (tab.isRemote) {
            li.classList.add('remote-item');
        }
        // Use a unique ID fallback if tab.id is missing (remote tabs)
        li.id = `tab-${tab.id || Math.random().toString(36).substr(2, 9)}`;

        if (isDraggable && !tab.isRemote) {
            li.draggable = true;
            li.addEventListener('dragstart', (e) => {
                li.classList.add('dragging');
                e.dataTransfer.setData('application/json', JSON.stringify({ tabId: tab.id, windowId: tab.windowId }));
                e.dataTransfer.effectAllowed = 'move';
            });
            li.addEventListener('dragend', () => li.classList.remove('dragging'));
        }
        
        const content = document.createElement('div');
        content.className = 'tab-content';
        if (tab.isRemote) {
            content.classList.add('remote-tab');
        }
        
        const faviconUrl = tab.favIconUrl || `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ccc"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>')}`;
        const img = document.createElement('img');
        img.src = faviconUrl;
        img.className = 'tab-icon';
        img.onerror = () => { img.style.display = 'none'; };
        
        if (tab.pinned) {
            const pinIconWrapper = document.createElement('span');
            pinIconWrapper.className = 'pinned-icon-wrapper';
            pinIconWrapper.innerHTML = `<svg class="pinned-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" /></svg>`;
            content.appendChild(pinIconWrapper);
        }

        // Check for notes
        if (storageData) {
            const noteKey = `note_${tab.url}`;
            const noteContent = storageData[noteKey];
            if (noteContent) {
                const noteIconWrapper = document.createElement('span');
                noteIconWrapper.className = 'note-icon-wrapper';
                noteIconWrapper.title = noteContent; // Tooltip with note content
                noteIconWrapper.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`;
                noteIconWrapper.style.marginRight = '8px';
                noteIconWrapper.style.display = 'flex';
                noteIconWrapper.style.alignItems = 'center';
                content.appendChild(noteIconWrapper);
            }
        }

        let fullTitle = tab.title;
        if (tab.isRemote && tab.deviceName) {
            fullTitle += `\nOn device: ${tab.deviceName}`;
        }
        
        content.title = fullTitle;

        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = tab.title;

        content.appendChild(img);
        content.appendChild(title);

        if (tab.openerTabId && !tab.isRemote) {
            const openerTab = tabsById.get(tab.openerTabId);
            if (openerTab) {
                const openerBadge = document.createElement('span');
                openerBadge.className = 'opener-badge';
                openerBadge.title = `Go to parent: ${openerTab.title}`;
                openerBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 15l-6 6m0 0l-6-6m6 6V9a6 6 0 0 1 12 0v3"/></svg> From: ${openerTab.title.substring(0, 15)}${openerTab.title.length > 15 ? '...' : ''}`;
                
                openerBadge.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        await chrome.tabs.update(openerTab.id, { active: true });
                        if (openerTab.windowId) await chrome.windows.update(openerTab.windowId, { focused: true });
                    } catch (err) {
                        console.error("Parent tab might be closed", err);
                    }
                });
                content.appendChild(openerBadge);
                fullTitle += `\nOpened from: ${openerTab.title}`;
                content.title = fullTitle;
            }
        }

        const badge = document.createElement('span');
        badge.className = 'status-badge';
        if (tab.isRemote) {
             badge.textContent = tab.deviceName || 'Remote';
             badge.classList.add('status-remote');
        } else if (tab.discarded) {
            badge.textContent = 'Suspended'; badge.classList.add('status-suspended');
        } else if (tab.status === 'loading') {
            badge.textContent = 'Loading'; badge.classList.add('status-loading');
        } else {
            badge.textContent = 'Active'; badge.classList.add('status-active');
        }
        content.appendChild(badge);

        content.addEventListener('click', async () => {
            if (tab.isRemote) {
                await chrome.tabs.create({ url: tab.url, active: true });
            } else {
                await chrome.tabs.update(tab.id, { active: true });
                if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
            }
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.title = 'Close tab';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (tab.isRemote) {
                li.remove();
            } else {
                chrome.tabs.remove(tab.id);
            }
        });
        // Using a more robust SVG for the "X"
        closeBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>`;
        
        li.appendChild(content);
        li.appendChild(closeBtn);
        return li;
    };

    const render = async () => {
        if (isRendering) return;
        isRendering = true;

        try {
            const scrollY = window.scrollY;
            
            const style = document.createElement('style');
            style.textContent = `
                .window-card { transition: opacity 0.3s ease, transform 0.3s ease; }
                .card-enter { opacity: 0; transform: translateY(20px); }
                .card-exit { opacity: 0; transform: scale(0.95); }
                .status-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; margin-left: 8px; font-weight: 600; white-space: nowrap; }
                .status-active { background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                .status-suspended { background-color: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }
                .status-loading { background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
                .status-remote { background-color: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
                .window-card.drag-over { border: 2px dashed #2563eb; background-color: #eff6ff; transform: scale(1.02); transition: all 0.2s; }
                .tab-item.dragging { opacity: 0.5; background-color: #e5e7eb; }
                .pinned-icon-wrapper { width: 24px; height: 24px; margin-right: 6px; color: #666; flex-shrink: 0; transform: rotate(45deg); display: inline-flex; align-items: center; }
                .pinned-icon-svg { width: 100%; height: 100%; }
                .opener-icon { width: 12px; height: 12px; margin-right: 4px; color: #999; flex-shrink: 0; }
                
                /* Remote specific styles */
                .remote-card { border: 1px solid #c7d2fe; background-color: #f8faff; }
                .remote-card .window-header { background-color: #eef2ff; color: #3730a3; border-bottom: 1px solid #c7d2fe; }
                .tab-item.remote-item { border-left: 3px solid #818cf8; }
                .tab-item.remote-item:hover { background-color: #f0f4ff; }
                
                /* Notes View Styles */
                .note-view-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; width: 100%; }
                .note-card { background-color: #fef3c7; border: 1px solid #d1d5db; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: transform 0.2s; }
                .note-card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                .note-card-header { display: flex; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e5e7eb; cursor: pointer; }
                            .note-card-header:hover .note-card-title { color: #2563eb; }
                            .note-card-title { font-weight: 600; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 8px; color: #4b5563; }
                            .note-card-content { font-family: 'Segoe UI', sans-serif; color: #374151; font-size: 0.95rem; line-height: 1.6; flex: 1; min-height: 80px; width: 100%; border: none; background: transparent; resize: vertical; outline: none; padding: 0; }
                            .note-card-footer { margin-top: 1rem; display: flex; justify-content: flex-end; }
                                        .note-action-btn { background: white; border: 1px solid #d1d5db; padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; color: #4b5563; transition: all 0.2s; }
                                        .note-action-btn:hover { background: #f3f4f6; color: #111; border-color: #9ca3af; }
                                        .note-delete-btn:hover { background-color: #fee2e2 !important; color: #b91c1c !important; border-color: #f87171 !important; }
                                    `;
            if (!document.head.querySelector('style#dynamic-styles')) {
                style.id = 'dynamic-styles';
                document.head.appendChild(style);
            }

            const [tabs, allWindows, devices, storageData] = await Promise.all([
                chrome.tabs.query({}),
                chrome.windows.getAll(),
                chrome.sessions.getDevices().catch(() => []), // Return empty array on error
                chrome.storage.local.get(null).catch(() => ({})) // Return empty object on error
            ]);
            
            const tabsById = new Map(tabs.map(tab => [tab.id, tab]));
            const suspendedCount = tabs.filter(t => t.discarded).length;

            // Determine what cards should exist
            let newCardData = new Map();
            if (currentView === 'window') {
                const tabsByWindow = tabs.reduce((acc, tab) => {
                    if (!acc[tab.windowId]) acc[tab.windowId] = [];
                    acc[tab.windowId].push(tab);
                    return acc;
                }, {});
                statsEl.innerHTML = `<strong>${tabs.length}</strong> tabs <span class="bull">&bull;</span> <strong>${suspendedCount}</strong> suspended <span class="bull">&bull;</span> <strong>${Object.keys(tabsByWindow).length}</strong> windows`;
                allWindows.forEach((win, index) => {
                    const windowTabs = tabsByWindow[win.id];
                    if (!windowTabs || windowTabs.length === 0) return;
                    let windowTitle = `Window ${index + 1}${win.incognito ? ' (Private)' : ''}`;
                    newCardData.set(`window-${win.id}`, { id: `window-${win.id}`, title: windowTitle, tabs: windowTabs, isDraggable: true });
                });

                // Process remote devices for window view
                if (devices) {
                    devices.forEach(device => {
                        if (!device.sessions) return;
                        const deviceName = device.deviceName || 'Unknown Device';
                        
                        device.sessions.forEach((session, sessionIndex) => {
                            let remoteTabs = [];
                            let title = `${deviceName}`;
                            
                            if (session.window && session.window.tabs) {
                                remoteTabs = session.window.tabs;
                                title += ` - Window ${sessionIndex + 1}`;
                            } else if (session.tab) {
                                remoteTabs = [session.tab];
                                title += ` - Tab`;
                            }

                            if (remoteTabs.length > 0) {
                                const mappedTabs = remoteTabs.map(t => ({
                                    ...t,
                                    isRemote: true,
                                    deviceName: deviceName,
                                    id: t.id || null, 
                                    title: t.title || 'Untitled',
                                    url: t.url,
                                    favIconUrl: t.favIconUrl
                                }));
                                // Use a safe ID for the card
                                const safeDeviceName = deviceName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                                const cardId = `device-${safeDeviceName}-${sessionIndex}`;
                                
                                newCardData.set(cardId, {
                                    id: cardId,
                                    title: title,
                                    tabs: mappedTabs,
                                    isDraggable: false,
                                    isRemote: true
                                });
                            }
                        });
                    });
                }

            } else if (currentView === 'notes') {
                // Notes View
                windowsContainer.className = 'note-view-grid'; // Use grid layout
                let noteCount = 0;
                
                // Check local tabs
                if (storageData) {
                    tabs.forEach(tab => {
                        if (!tab.url) return;
                        const noteKey = `note_${tab.url}`;
                        const noteContent = storageData[noteKey];
                        if (noteContent && noteContent.trim().length > 0) {
                            noteCount++;
                            const cardId = `note-card-${tab.id}`;
                            newCardData.set(cardId, {
                                id: cardId,
                                type: 'note',
                                tab: tab,
                                content: noteContent
                            });
                        }
                    });
                }
                statsEl.innerHTML = `<strong>${noteCount}</strong> notes found`;

            } else { // 'domain' view
                const tabsByDomain = tabs.reduce((acc, tab) => {
                    const domain = getDomain(tab.url);
                    if (!acc[domain]) acc[domain] = [];
                    acc[domain].push(tab);
                    return acc;
                }, {});
                
                // Process remote devices for domain view
                if (devices) {
                    devices.forEach(device => {
                        if (!device.sessions) return;
                        device.sessions.forEach(session => {
                            let remoteTabs = [];
                            if (session.window && session.window.tabs) remoteTabs = session.window.tabs;
                            else if (session.tab) remoteTabs = [session.tab];
                            
                            remoteTabs.forEach(t => {
                                const domain = getDomain(t.url);
                                if (!tabsByDomain[domain]) tabsByDomain[domain] = [];
                                tabsByDomain[domain].push({
                                    ...t,
                                    isRemote: true,
                                    deviceName: device.deviceName,
                                    id: t.id || null, 
                                    title: t.title || 'Untitled',
                                    url: t.url,
                                    favIconUrl: t.favIconUrl
                                });
                            });
                        });
                    });
                }

                statsEl.innerHTML = `<strong>${tabs.length}</strong> tabs <span class="bull">&bull;</span> <strong>${suspendedCount}</strong> suspended <span class="bull">&bull;</span> <strong>${Object.keys(tabsByDomain).length}</strong> domains`;
                Object.keys(tabsByDomain).sort().forEach(domain => {
                    const domainTabs = tabsByDomain[domain];
                    newCardData.set(`domain-${domain}`, { id: `domain-${domain}`, title: domain, tabs: domainTabs, isDraggable: false });
                });
            }

            const existingCardIds = new Set(Array.from(windowsContainer.children).map(c => c.id));
            
            // Remove old cards
            existingCardIds.forEach(id => {
                if (!newCardData.has(id)) {
                    const card = document.getElementById(id);
                    if (card) {
                        card.classList.add('card-exit');
                        card.addEventListener('transitionend', () => card.remove(), { once: true });
                    }
                }
            });

            const fragment = document.createDocumentFragment();
            let animationIndex = 0;

            // Update existing cards and create new ones
            if (currentView !== 'notes') {
                windowsContainer.className = 'windows-grid';
            }
            
            newCardData.forEach(data => {
                const existingCard = document.getElementById(data.id);
                
                            if (data.type === 'note') {
                                if (existingCard) {
                                    // Update content if needed (simple replacement for now)
                                    const contentEl = existingCard.querySelector('.note-card-content');
                                    if (contentEl.value !== data.content) contentEl.value = data.content;
                                } else {
                                    const card = document.createElement('div');                        card.className = 'note-card card-enter';
                        card.id = data.id;
                        
                        const faviconUrl = data.tab.favIconUrl || `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ccc"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>')}`;
                        
                        const header = document.createElement('div');
                        header.className = 'note-card-header';
                        
                        const img = document.createElement('img');
                        img.src = faviconUrl;
                        img.width = 16;
                        img.height = 16;
                        img.style.flexShrink = '0';
                        
                        const title = document.createElement('span');
                        title.className = 'note-card-title';
                        title.textContent = data.tab.title;
                        
                        header.appendChild(img);
                        header.appendChild(title);
                        
                                            const content = document.createElement('textarea');
                                            content.className = 'note-card-content';
                                            content.value = data.content;
                                            content.placeholder = "Add your notes here...";
                                            
                                                                const footer = document.createElement('div');
                                                                footer.className = 'note-card-footer';
                                                                
                                                                const deleteBtn = document.createElement('button');
                                                                deleteBtn.className = 'note-action-btn note-delete-btn';
                                                                deleteBtn.textContent = 'Delete';
                                                                deleteBtn.style.color = '#ef4444';
                                                                deleteBtn.style.borderColor = '#fca5a5';
                                                                deleteBtn.style.marginRight = 'auto'; // Push to left
                                            
                                                                const btn = document.createElement('button');
                                                                btn.className = 'note-action-btn';
                                                                btn.textContent = 'Go to Tab';
                                                                
                                                                footer.appendChild(deleteBtn);
                                                                footer.appendChild(btn);
                                                                
                                                                card.appendChild(header);
                                                                card.appendChild(content);
                                                                card.appendChild(footer);
                                                                
                                                                const jumpToTab = async () => {
                                                                    await chrome.tabs.update(data.tab.id, { active: true });
                                                                    if (data.tab.windowId) await chrome.windows.update(data.tab.windowId, { focused: true });
                                                                };
                                            
                                                                const deleteNote = async (e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm('Are you sure you want to delete this note?')) {
                                                                        const noteKey = `note_${data.tab.url}`;
                                                                        await chrome.storage.local.remove(noteKey);
                                                                        
                                                                        card.style.opacity = '0';
                                                                        card.style.transform = 'scale(0.9)';
                                                                        setTimeout(() => {
                                                                            card.remove();
                                                                            // Update stats manually or let re-render handle it
                                                                            const currentCount = parseInt(statsEl.querySelector('strong').textContent);
                                                                            statsEl.innerHTML = `<strong>${Math.max(0, currentCount - 1)}</strong> notes found`;
                                                                        }, 300);
                                                                    }
                                                                };
                                            
                                                                header.addEventListener('click', jumpToTab);
                                                                btn.addEventListener('click', jumpToTab);
                                                                deleteBtn.addEventListener('click', deleteNote);
                                                                
                                                                // Auto-save logic
                                                                let saveTimeout;                                            content.addEventListener('input', () => {
                                                clearTimeout(saveTimeout);
                                                saveTimeout = setTimeout(() => {
                                                    const noteKey = `note_${data.tab.url}`;
                                                    const newContent = content.value;
                                                    const storageUpdate = {};
                                                    storageUpdate[noteKey] = newContent;
                                                    chrome.storage.local.set(storageUpdate);
                                                }, 500);
                                            });
                                            
                                            fragment.appendChild(card);                    }
                    return;
                }

                if (existingCard) {
                    // Update header
                    const header = existingCard.querySelector('.window-header');
                    header.innerHTML = `<span>${data.title}</span> <span>${data.tabs.length} tabs</span>`;
                    // Update list
                    const list = existingCard.querySelector('.tab-list');
                    list.innerHTML = '';
                    data.tabs.forEach(tab => list.appendChild(createTabListItem(tab, tabsById, data.isDraggable, storageData)));
                } else {
                    const card = document.createElement('div');
                    card.className = 'window-card card-enter';
                    if (data.isRemote) {
                        card.classList.add('remote-card');
                    }
                    card.id = data.id;
                    
                    const header = document.createElement('div');
                    header.className = 'window-header';
                    header.innerHTML = `<span>${data.title}</span> <span>${data.tabs.length} tabs</span>`;
                    card.appendChild(header);

                    const list = document.createElement('ul');
                    list.className = 'tab-list';
                    data.tabs.forEach(tab => list.appendChild(createTabListItem(tab, tabsById, data.isDraggable, storageData)));
                    card.appendChild(list);

                    if (data.isDraggable) {
                        card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
                        card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
                        card.addEventListener('drop', async (e) => {
                            e.preventDefault();
                            card.classList.remove('drag-over');
                            const dropData = JSON.parse(e.dataTransfer.getData('application/json'));
                            if (!dropData || dropData.windowId === parseInt(data.id.replace('window-',''))) return;
                            try {
                                await chrome.tabs.move(dropData.tabId, { windowId: parseInt(data.id.replace('window-','')), index: -1 });
                            } catch (err) { console.error("Failed to move tab:", err); }
                        });
                    }
                    fragment.appendChild(card);
                }
            });

            windowsContainer.appendChild(fragment);
            
            // Animate new cards
            const newCards = windowsContainer.querySelectorAll('.card-enter');
            newCards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.remove('card-enter');
                }, (animationIndex + index) * 50);
            });

            window.scrollTo(0, scrollY);

        } catch (error) {
            console.error("TabDashboard: Render failed", error);
        } finally {
            isRendering = false;
        }
    };

    let renderTimeout;
    const debouncedRender = () => {
        if (renderTimeout) clearTimeout(renderTimeout);
        renderTimeout = setTimeout(render, 100);
    };

    chrome.tabs.onCreated.addListener(debouncedRender);
    chrome.tabs.onRemoved.addListener(debouncedRender);
    chrome.tabs.onUpdated.addListener(debouncedRender);
    chrome.tabs.onMoved.addListener(debouncedRender);
    chrome.tabs.onAttached.addListener(debouncedRender);
    chrome.tabs.onDetached.addListener(debouncedRender);

    updateView(currentView);
});