document.addEventListener('DOMContentLoaded', () => {
    const windowsContainer = document.getElementById('windows-container');
    const statsEl = document.getElementById('stats');
    const viewByWindowBtn = document.getElementById('view-by-window');
    const viewByDomainBtn = document.getElementById('view-by-domain');

    let currentView = localStorage.getItem('tabDashboard-view') || 'window';

    const getDomain = (url) => {
        if (!url) return 'Other';
        try {
            const hostname = new URL(url).hostname;
            // Strip "www."
            return hostname.replace(/^www\./, '');
        } catch (e) {
            // Handle special URLs like chrome://, file://, etc.
            const protocol = url.split(':')[0];
            return protocol.endsWith('s') || protocol.endsWith('p') ? 'Other' : protocol;
        }
    };

    const createTabListItem = (tab, tabsById) => {
        const li = document.createElement('li');
        li.className = 'tab-item';
        li.id = `tab-${tab.id}`;
        
        const content = document.createElement('div');
        content.className = 'tab-content';
        
        const faviconUrl = tab.favIconUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAgLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyeiIvPg==';
        const img = document.createElement('img');
        img.src = faviconUrl;
        img.className = 'tab-icon';
        img.onerror = () => { img.style.display = 'none'; };
        
        if (tab.pinned) {
            const pinIcon = document.createElement('div');
            pinIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" class="pinned-icon"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" /></svg>`;
            content.appendChild(pinIcon.firstElementChild);
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
            await chrome.windows.update(tab.windowId, { focused: true });
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.remove(tab.id);
        });

        li.appendChild(content);
        li.appendChild(closeBtn);
        return li;
    };

    const render = async () => {
        const scrollY = window.scrollY;
        const fragment = document.createDocumentFragment();

        const [tabs, allWindows, devices] = await Promise.all([
            chrome.tabs.query({}),
            chrome.windows.getAll(),
            chrome.sessions.getDevices()
        ]);
        
        const tabsById = new Map(tabs.map(tab => [tab.id, tab]));
        let suspendedCount = tabs.filter(t => t.discarded).length;

        if (currentView === 'window') {
            const tabsByWindow = tabs.reduce((acc, tab) => {
                if (!acc[tab.windowId]) acc[tab.windowId] = [];
                acc[tab.windowId].push(tab);
                return acc;
            }, {});

            statsEl.innerHTML = `<strong>${tabs.length}</strong> total tabs <span style="color: #6b7280; margin: 0 5px;">•</span> <strong>${suspendedCount}</strong> suspended <span style="color: #6b7280; margin: 0 5px;">•</span> across <strong>${Object.keys(tabsByWindow).length}</strong> windows`;

            allWindows.forEach((win, index) => {
                const windowTabs = tabsByWindow[win.id];
                if (!windowTabs || windowTabs.length === 0) return;

                const card = document.createElement('div');
                card.className = 'window-card';
                card.id = `window-${win.id}`;
                li.draggable = true;
                
                li.addEventListener('dragstart', (e) => {
                    li.classList.add('dragging');
                    e.dataTransfer.setData('application/json', JSON.stringify({ tabId: tab.id, windowId: win.id }));
                    e.dataTransfer.effectAllowed = 'move';
                });
                li.addEventListener('dragend', () => li.classList.remove('dragging'));

                let windowTitle = `Window ${index + 1}`;
                if (win.incognito) windowTitle += ' (Private)';
                const header = document.createElement('div');
                header.className = 'window-header';
                header.innerHTML = `<span>${windowTitle}</span> <span>${windowTabs.length} tabs</span>`;
                card.appendChild(header);

                const list = document.createElement('ul');
                list.className = 'tab-list';
                windowTabs.forEach(tab => list.appendChild(createTabListItem(tab, tabsById)));
                card.appendChild(list);
                fragment.appendChild(card);
            });

        } else { // 'domain' view
            const tabsByDomain = tabs.reduce((acc, tab) => {
                const domain = getDomain(tab.url);
                if (!acc[domain]) acc[domain] = [];
                acc[domain].push(tab);
                return acc;
            }, {});

            statsEl.innerHTML = `<strong>${tabs.length}</strong> total tabs <span style="color: #6b7280; margin: 0 5px;">•</span> <strong>${suspendedCount}</strong> suspended <span style="color: #6b7280; margin: 0 5px;">•</span> across <strong>${Object.keys(tabsByDomain).length}</strong> domains`;

            Object.keys(tabsByDomain).sort().forEach(domain => {
                const domainTabs = tabsByDomain[domain];
                const card = document.createElement('div');
                card.className = 'window-card';
                
                const header = document.createElement('div');
                header.className = 'window-header';
                header.innerHTML = `<span>${domain}</span> <span>${domainTabs.length} tabs</span>`;
                card.appendChild(header);

                const list = document.createElement('ul');
                list.className = 'tab-list';
                domainTabs.forEach(tab => list.appendChild(createTabListItem(tab, tabsById)));
                card.appendChild(list);
                fragment.appendChild(card);
            });
        }
        
        windowsContainer.innerHTML = '';
        windowsContainer.appendChild(fragment);
        window.scrollTo(0, scrollY);
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
    
    chrome.tabs.onCreated.addListener(render);
    chrome.tabs.onRemoved.addListener(render);
    chrome.tabs.onUpdated.addListener(render);
    chrome.tabs.onMoved.addListener(render);
    chrome.tabs.onAttached.addListener(render);
    chrome.tabs.onDetached.addListener(render);

    // Initial Setup
    updateView(currentView);
});
