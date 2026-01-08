document.addEventListener('DOMContentLoaded', () => {
    const windowsContainer = document.getElementById('windows-container');
    const statsEl = document.getElementById('stats');
    const viewByWindowBtn = document.getElementById('view-by-window');
    const viewByDomainBtn = document.getElementById('view-by-domain');

    let currentView = localStorage.getItem('tabDashboard-view') || 'window';
    let isRendering = false;

    const getDomain = (url) => {
        if (!url) return 'Other';
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            if (hostname === 'docs.google.com') {
                if (urlObj.pathname.startsWith('/document/')) return 'Google Docs';
                if (urlObj.pathname.startsWith('/spreadsheets/')) return 'Google Sheets';
                if (urlObj.pathname.startsWith('/presentation/')) return 'Google Slides';
                return 'Google Drive';
            }
            return hostname.replace(/^www\./, '');
        } catch (e) {
            const protocol = url.split(':')[0];
            return protocol.endsWith('s') || protocol.endsWith('p') ? 'Other' : protocol;
        }
    };

    const createTabListItem = (tab, tabsById, isDraggable) => {
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
        `;
        if (!document.head.querySelector('style#dynamic-styles')) {
            style.id = 'dynamic-styles';
            document.head.appendChild(style);
        }

        const [tabs, allWindows, devices] = await Promise.all([
            chrome.tabs.query({}),
            chrome.windows.getAll(),
            chrome.sessions.getDevices()
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
                    device.sessions.forEach((session, sessionIndex) => {
                        let remoteTabs = [];
                        let title = `${device.deviceName}`;
                        
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
                                deviceName: device.deviceName,
                                id: t.id || null, 
                                title: t.title || 'Untitled',
                                url: t.url,
                                favIconUrl: t.favIconUrl
                            }));
                            // Use a safe ID for the card
                            const safeDeviceName = device.deviceName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
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
        newCardData.forEach(data => {
            const existingCard = document.getElementById(data.id);
            if (existingCard) {
                // Update header
                const header = existingCard.querySelector('.window-header');
                header.innerHTML = `<span>${data.title}</span> <span>${data.tabs.length} tabs</span>`;
                // Update list
                const list = existingCard.querySelector('.tab-list');
                list.innerHTML = '';
                data.tabs.forEach(tab => list.appendChild(createTabListItem(tab, tabsById, data.isDraggable)));
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
                data.tabs.forEach(tab => list.appendChild(createTabListItem(tab, tabsById, data.isDraggable)));
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
        isRendering = false;
    };

    const updateView = (newView) => {
        currentView = newView;
        localStorage.setItem('tabDashboard-view', newView);
        viewByWindowBtn.classList.toggle('active', newView === 'window');
        viewByDomainBtn.classList.toggle('active', newView === 'domain');
        render();
    };

    viewByWindowBtn.addEventListener('click', () => updateView('window'));
    viewByDomainBtn.addEventListener('click', () => updateView('domain'));
    
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