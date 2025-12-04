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
        li.id = `tab-${tab.id}`;

        if (isDraggable) {
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
        if (tab.openerTabId) {
            const openerTab = tabsById.get(tab.openerTabId);
            if (openerTab) {
                const openerIconWrapper = document.createElement('span');
                openerIconWrapper.className = 'opener-icon';
                openerIconWrapper.title = `Opened from: ${openerTab.title}`;
                openerIconWrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19,15l-6,6l-1.42-1.42L15.17,16H4V4h2v10h9.17l-3.59-3.58L13,9l6,6z"/></svg>`;
                content.appendChild(openerIconWrapper);
                fullTitle += `\nOpened from: ${openerTab.title}`;
            }
        }
        content.title = fullTitle;

        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = tab.title;

        content.appendChild(img);
        content.appendChild(title);

        const badge = document.createElement('span');
        badge.className = 'status-badge';
        if (tab.discarded) {
            badge.textContent = 'Suspended'; badge.classList.add('status-suspended');
        } else if (tab.status === 'loading') {
            badge.textContent = 'Loading'; badge.classList.add('status-loading');
        } else {
            badge.textContent = 'Active'; badge.classList.add('status-active');
        }
        content.appendChild(badge);

        content.addEventListener('click', async () => {
            await chrome.tabs.update(tab.id, { active: true });
            if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); chrome.tabs.remove(tab.id); });
        closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

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
            /* ... other styles ... */
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
        } else { // 'domain' view
            const tabsByDomain = tabs.reduce((acc, tab) => {
                const domain = getDomain(tab.url);
                if (!acc[domain]) acc[domain] = [];
                acc[domain].push(tab);
                return acc;
            }, {});
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