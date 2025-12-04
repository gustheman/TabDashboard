document.addEventListener('DOMContentLoaded', () => {
    const windowsContainer = document.getElementById('windows-container');
    const statsEl = document.getElementById('stats');

    const render = async () => {
        // Save scroll position
        const scrollY = window.scrollY;

        // 0. Clear Existing UI
        windowsContainer.innerHTML = ''; 

        // 1. Inject CSS (only needs to be done once, but harmless to keep here)
        const style = document.createElement('style');
        style.textContent = `
            .status-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; margin-left: 8px; font-weight: 600; white-space: nowrap; }
            .status-active { background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
            .status-suspended { background-color: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }
            .status-loading { background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
            .window-card.drag-over { border: 2px dashed #2563eb; background-color: #eff6ff; transform: scale(1.02); transition: all 0.2s; }
            .tab-item.dragging { opacity: 0.5; background-color: #e5e7eb; }
            .pinned-icon { width: 14px; height: 14px; margin-right: 6px; color: #666; flex-shrink: 0; transform: rotate(45deg); }
        `;
        if (!document.head.querySelector('style')) { // Inject only if not already present
            document.head.appendChild(style);
        }

        // 2. Get all fresh data
        const [tabs, allWindows, devices] = await Promise.all([
            chrome.tabs.query({}),
            chrome.windows.getAll(),
            chrome.sessions.getDevices()
        ]);
        
        // 3. Group tabs and Calculate Stats
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
        const windowCount = allWindows.filter(win => tabsByWindow[win.id] && tabsByWindow[win.id].length > 0).length;
        statsEl.innerHTML = `
            <strong>${tabs.length}</strong> total tabs 
            <span style="color: #6b7280; margin: 0 5px;">•</span> 
            <strong>${suspendedCount}</strong> suspended
            <span style="color: #6b7280; margin: 0 5px;">•</span> 
            across <strong>${windowCount}</strong> window${windowCount > 1 ? 's' : ''}
        `;
        
        const updateWindowUI = (cardElement) => {
            const count = cardElement.querySelectorAll('.tab-item').length;
            const countSpan = cardElement.querySelector('.window-header span:last-child');
            if (countSpan) countSpan.textContent = `${count} tabs`;
            if (count === 0) cardElement.remove();
            // Re-calculate global stats after a change
            const totalTabs = document.querySelectorAll('.tab-item[id^="tab-"]').length; // only local tabs
            const totalSuspended = document.querySelectorAll('.status-suspended').length;
            const totalWindows = document.querySelectorAll('.window-card').length - document.querySelectorAll('.window-card[style*="border-top"]').length; // Exclude remote
             statsEl.innerHTML = `
                <strong>${totalTabs}</strong> total tabs 
                <span style="color: #6b7280; margin: 0 5px;">•</span> 
                <strong>${totalSuspended}</strong> suspended
                <span style="color: #6b7280; margin: 0 5px;">•</span> 
                across <strong>${totalWindows}</strong> window${totalWindows > 1 ? 's' : ''}
            `;
        };

        // 4. Render Windows
        allWindows.forEach((win, index) => {
            const windowTabs = tabsByWindow[win.id];
            
            if ((!windowTabs || windowTabs.length === 0)) return;

            const card = document.createElement('div');
            card.className = 'window-card';
            card.id = `window-${win.id}`;
            
            card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
            card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (!data || data.windowId === win.id) return;
                try {
                    await chrome.tabs.move(data.tabId, { windowId: win.id, index: -1 });
                    // No need for manual DOM move, render() will handle it
                } catch (err) { console.error("Failed to move tab:", err); }
            });

            let windowTitle = `Window ${index + 1}`;
            if (win.incognito) windowTitle += ' (Private)';
            if (win.type === 'popup') windowTitle += ' (Popup)';

            const header = document.createElement('div');
            header.className = 'window-header';
            header.innerHTML = `<span>${windowTitle}</span> <span>${windowTabs.length} tabs</span>`;
            card.appendChild(header);

            const list = document.createElement('ul');
            list.className = 'tab-list';

            windowTabs.forEach(tab => {
                const li = document.createElement('li');
                li.className = 'tab-item';
                li.id = `tab-${tab.id}`;
                li.draggable = true;
                
                li.addEventListener('dragstart', (e) => {
                    li.classList.add('dragging');
                    e.dataTransfer.setData('application/json', JSON.stringify({ tabId: tab.id, windowId: win.id }));
                    e.dataTransfer.effectAllowed = 'move';
                });
                li.addEventListener('dragend', () => li.classList.remove('dragging'));
                
                const content = document.createElement('div');
                content.className = 'tab-content';
                content.title = tab.title;
                
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
                    await chrome.windows.update(win.id, { focused: true });
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'close-btn';
                closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
                closeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        await chrome.tabs.remove(tab.id);
                        // No need for manual DOM removal, render() will be called by listener
                    } catch (err) { 
                        // If tab is already gone, the listener might not fire, so remove manually as a fallback.
                        li.remove();
                        updateWindowUI(card);
                    }
                });

                li.appendChild(content);
                li.appendChild(closeBtn);
                list.appendChild(li);
            });

            card.appendChild(list);
            windowsContainer.appendChild(card);
        });

        // 5. Render Remote Devices
        devices.forEach(device => {
            device.sessions.forEach((session) => {
                let sessionTabs = session.window ? session.window.tabs : (session.tab ? [session.tab] : []);
                if (sessionTabs.length === 0) return;

                let sessionTitle = device.deviceName + (session.window ? ' (Window)' : ' (Single Tab)');
                
                const card = document.createElement('div');
                card.className = 'window-card';
                card.style.borderTop = "4px solid #8b5cf6";

                const header = document.createElement('div');
                header.className = 'window-header';
                header.innerHTML = `<span>${sessionTitle}</span> <span>${sessionTabs.length} tabs</span>`;
                card.appendChild(header);

                const list = document.createElement('ul');
                list.className = 'tab-list';

                sessionTabs.forEach(tab => {
                    const li = document.createElement('li');
                    li.className = 'tab-item';
                    
                    const content = document.createElement('div');
                    content.className = 'tab-content';
                    content.title = tab.url;
                    content.addEventListener('click', () => chrome.tabs.create({ url: tab.url }));

                    const faviconUrl = tab.favIconUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzY2NiI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAgLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyeiIvPg==';
                    const img = document.createElement('img');
                    img.src = faviconUrl;
                    img.className = 'tab-icon';

                    const title = document.createElement('span');
                    title.className = 'tab-title';
                    title.textContent = tab.title || tab.url;

                    content.appendChild(img);
                    content.appendChild(title);
                    
                    const badge = document.createElement('span');
                    badge.className = 'status-badge';
                    badge.textContent = 'Remote';
                    badge.style.cssText = 'background-color: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe;';
                    content.appendChild(badge);
                    
                    li.appendChild(content);
                    list.appendChild(li);
                });

                card.appendChild(list);
                windowsContainer.appendChild(card);
            });
        });

        // Restore scroll position
        window.scrollTo(0, scrollY);
    };

    // --- Real-time Listeners ---
    // These listeners simply re-render the entire dashboard on any change.
    chrome.tabs.onCreated.addListener(render);
    chrome.tabs.onRemoved.addListener(render);
    chrome.tabs.onUpdated.addListener(render); // For title/url/pinnned changes
    chrome.tabs.onMoved.addListener(render);   // For re-ordering
    chrome.tabs.onAttached.addListener(render); // For moving between windows
    chrome.tabs.onDetached.addListener(render);

    // Initial Render
    render();
});