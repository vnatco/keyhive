/**
 * Search Page Component
 * Global search across all vaults and folders
 * Reuses HomePage CSS classes - IDs prefixed with "search" to avoid conflicts
 */

const SearchPage = {
    searchQuery: '',
    currentFilter: 'all',
    sortBy: 'name',
    sortDirection: 'asc',
    items: [],
    folders: [],
    filteredItems: [],
    filteredFolders: [],
    totpTimer: null,
    _initialized: false,

    init() {
        if (this._initialized) return;
        this.render();
        this.bindEvents();
        this._initialized = true;
    },

    render() {
        const container = document.getElementById('searchPageContent');
        if (!container) return;

        const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';
        const filters = HomePage.filters.filter(f => !isLocalMode || f.id !== 'file');

        container.innerHTML = `
            <div class="home-search">
                <div class="home-search-input">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" id="searchPageInput" placeholder="Search all vaults..." autocomplete="off">
                </div>
                <button class="sort-btn" id="searchSortBtn" title="Sort options">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="4" y1="6" x2="16" y2="6"></line>
                        <line x1="4" y1="12" x2="12" y2="12"></line>
                        <line x1="4" y1="18" x2="8" y2="18"></line>
                        <polyline points="15 15 18 18 21 15"></polyline>
                        <line x1="18" y1="12" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div class="filter-container" id="searchFilterContainer">
                <div class="filter-chips" id="searchFilterChips">
                    ${filters.map(filter => `
                        <button class="filter-chip ${filter.id === this.currentFilter ? 'active' : ''}"
                                data-filter="${filter.id}">
                            ${HomePage.getFilterIcon(filter.icon)}
                            <span>${filter.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <section class="folders-section" id="searchFoldersSection" style="display: none;">
                <div class="section-header">
                    <h2 class="section-title">Folders</h2>
                </div>
                <div class="folders-grid" id="searchFoldersGrid"></div>
            </section>

            <section class="cards-section" id="searchCardsSection" style="display: none;">
                <div class="section-header">
                    <h2 class="section-title" id="searchCardsTitle">All Items</h2>
                </div>
                <div class="cards-list" id="searchCardsList"></div>
            </section>

            <div class="empty-state" id="searchEmptyState" style="display: none;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h3>No results found</h3>
                <p>Try a different search term</p>
            </div>
        `;
    },

    bindEvents() {
        const container = document.getElementById('searchPageContent');
        if (!container) return;

        // Search input
        const input = container.querySelector('#searchPageInput');
        input?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim().toLowerCase();
            this.performSearch();
        });

        // Filter chips
        container.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.setFilter(chip.dataset.filter);
            });
        });

        // Sort button
        container.querySelector('#searchSortBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showSortMenu(e.currentTarget);
        });
    },

    async show(query = '') {
        this.searchQuery = query;
        const input = document.getElementById('searchPageInput');
        if (input) input.value = query;

        await this.loadData();
        this.performSearch();

        // Notify sidebar
        window.dispatchEvent(new CustomEvent('searchpage', { detail: { active: true } }));
    },

    hide() {
        this.stopTotpTimer();
        window.dispatchEvent(new CustomEvent('searchpage', { detail: { active: false } }));
    },

    async loadData() {
        if (typeof Vault === 'undefined') {
            this.items = [];
            this.folders = [];
            return;
        }

        try {
            this.items = await Vault.getItems() || [];
            this.folders = await Vault.getFolders() || [];
        } catch (e) {
            console.error('SearchPage: Failed to load data', e);
            this.items = [];
            this.folders = [];
        }
    },

    performSearch() {
        let folders = this.folders;
        let items = this.items;

        // Apply search filter (min 2 chars)
        if (this.searchQuery && this.searchQuery.length >= 2) {
            folders = folders.filter(f => SearchUtils.matchFolder(f, this.searchQuery));
            items = items.filter(i => SearchUtils.matchItem(i, this.searchQuery));
        }

        // Update filter chips based on search-matched items (before type filter)
        this.updateFilterChips(items);

        // Apply type filter after updating chips
        if (this.currentFilter !== 'all') {
            items = items.filter(i => i.item_type === this.currentFilter);
        }

        this.filteredFolders = folders;
        this.filteredItems = items;

        this.renderFolders();
        this.renderCards();
    },

    setFilter(filter) {
        this.currentFilter = filter;

        const container = document.getElementById('searchPageContent');
        if (container) {
            container.querySelectorAll('.filter-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.filter === filter);
            });
        }

        const title = document.getElementById('searchCardsTitle');
        if (title) {
            const filterObj = HomePage.filters.find(f => f.id === filter);
            title.textContent = filter === 'all' ? 'All Items' : filterObj?.label || 'Items';
        }

        this.performSearch();
    },

    updateFilterChips(items) {
        const filterContainer = document.getElementById('searchFilterContainer');
        const filterChips = document.getElementById('searchFilterChips');
        if (!filterContainer || !filterChips) return;

        const typeCounts = {};
        items.forEach(item => {
            typeCounts[item.item_type] = (typeCounts[item.item_type] || 0) + 1;
        });

        const typesWithItems = Object.keys(typeCounts);

        if (typesWithItems.length <= 1) {
            filterContainer.style.display = 'none';
            this.currentFilter = 'all';
            return;
        }

        filterContainer.style.display = 'block';

        filterChips.querySelectorAll('.filter-chip').forEach(chip => {
            const filterId = chip.dataset.filter;
            if (filterId === 'all') {
                chip.style.display = 'inline-flex';
            } else {
                chip.style.display = typeCounts[filterId] > 0 ? 'inline-flex' : 'none';
            }
        });

        if (this.currentFilter !== 'all' && !typeCounts[this.currentFilter]) {
            this.setFilter('all');
        }
    },

    async renderFolders() {
        const grid = document.getElementById('searchFoldersGrid');
        const section = document.getElementById('searchFoldersSection');
        if (!grid || !section) return;

        const folders = this.filteredFolders;

        if (folders.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        const sortedFolders = this.sortFolders(folders);

        const counts = await Promise.all(
            sortedFolders.map(folder => HomePage.getRecursiveItemCount(folder.id))
        );

        grid.innerHTML = sortedFolders.map((folder, index) => {
            const name = folder.name || folder.decrypted_name || 'Folder';
            const itemCount = counts[index];
            const icon = folder.icon || folder.decrypted_icon || 'folder';

            return `
                <div class="folder-card" data-folder-id="${folder.id}">
                    <div class="folder-icon">
                        ${HomePage.getFolderIcon(icon)}
                    </div>
                    <div class="folder-info">
                        <span class="folder-name">${Utils.escapeHtml(name)}</span>
                        <span class="folder-count">${itemCount} items</span>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.folder-card').forEach(card => {
            card.addEventListener('click', () => {
                this.navigateToFolder(card.dataset.folderId);
            });
        });
    },

    renderCards() {
        const list = document.getElementById('searchCardsList');
        const section = document.getElementById('searchCardsSection');
        const emptyState = document.getElementById('searchEmptyState');
        if (!list) return;

        const items = this.filteredItems;

        if (items.length === 0 && this.filteredFolders.length === 0) {
            if (section) section.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (items.length === 0) {
            if (section) section.style.display = 'none';
            if (emptyState) emptyState.style.display = 'none';
            return;
        }

        if (section) section.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        const sortedItems = this.sortItems(items);

        list.innerHTML = sortedItems.map(item => HomePage.renderCard(item)).join('');

        this.initCardEvents();
    },

    initCardEvents() {
        const list = document.getElementById('searchCardsList');
        if (!list) return;

        list.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]');
                if (action) {
                    const actionType = action.dataset.action;
                    if (actionType === 'link') {
                        e.stopPropagation();
                        return;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                    this.handleCardAction(card.dataset.itemId, actionType, action);
                    return;
                }

                // Website card: open URL
                if (card.dataset.itemType === 'website') {
                    const url = Utils.sanitizeUrl(card.dataset.websiteUrl);
                    if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                    return;
                }

                // TOTP: not clickable
                if (card.dataset.itemType === 'totp') return;

                // File: preview
                if (card.dataset.itemType === 'file') {
                    const item = this.items.find(i => i.id === card.dataset.itemId);
                    if (item) HomePage.showFilePreview(item);
                    return;
                }

                // Open view page
                const item = this.items.find(i => i.id === card.dataset.itemId);
                if (item) {
                    window.dispatchEvent(new CustomEvent('viewitem', { detail: { item } }));
                }
            });
        });

        this.startTotpTimer();
        this.updateTotpCards();
    },

    async handleCardAction(itemId, action, btn) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        switch (action) {
            case 'copy':
                await HomePage.copyItemToClipboard(item);
                break;
            case 'edit':
                HomePage.editItem(item);
                break;
            case 'delete':
                await this.deleteItem(item);
                break;
            case 'menu':
                this.showCardMenu(item, btn);
                break;
            case 'download':
                await HomePage.downloadFile(item);
                break;
            case 'open-link':
                HomePage.openWebsiteLink(item);
                break;
        }
    },

    async deleteItem(item) {
        const data = item.data || item.decrypted_data || {};
        const confirmed = await Popup.confirm({
            title: 'Delete Item',
            message: `Are you sure you want to delete "${data.name || data.label || 'this item'}"?`,
            confirmText: 'Delete',
            danger: true
        });

        if (confirmed) {
            try {
                if (typeof Vault !== 'undefined') {
                    await Vault.softDeleteItem(item.id);
                } else {
                    await ApiClient.deleteItem(item.id);
                }
                this.items = this.items.filter(i => i.id !== item.id);
                this.performSearch();
                Toast.success('Item deleted');
            } catch (error) {
                Toast.error('Failed to delete item');
            }
        }
    },

    showCardMenu(item, btn) {
        if (DropdownManager.isOpen('search-card-menu')) {
            DropdownManager.close('search-card-menu');
            return;
        }

        const hideView = item.item_type === 'totp' || item.item_type === 'file' || item.item_type === 'website';
        const viewButton = hideView ? '' : `
            <button class="card-action-item" data-action="view">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>View</span>
            </button>
        `;

        const menu = document.createElement('div');
        menu.className = 'card-action-menu';
        menu.innerHTML = `
            ${viewButton}
            <button class="card-action-item" data-action="edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Edit</span>
            </button>
            <button class="card-action-item card-action-danger" data-action="delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Delete</span>
            </button>
        `;

        document.body.appendChild(menu);

        if (btn) {
            const btnRect = btn.getBoundingClientRect();
            const menuHeight = menu.offsetHeight || 120;
            const spaceBelow = window.innerHeight - btnRect.bottom;
            const spaceAbove = btnRect.top;

            menu.style.position = 'fixed';
            menu.style.right = (window.innerWidth - btnRect.right) + 'px';

            if (spaceBelow < menuHeight + 8 && spaceAbove > spaceBelow) {
                menu.style.bottom = (window.innerHeight - btnRect.top + 4) + 'px';
                menu.style.top = 'auto';
            } else {
                menu.style.top = (btnRect.bottom + 4) + 'px';
                menu.style.bottom = 'auto';
            }
        }

        requestAnimationFrame(() => menu.classList.add('open'));

        DropdownManager.open('search-card-menu', {
            element: menu,
            trigger: btn,
            onClose: () => {
                menu.classList.remove('open');
                setTimeout(() => menu.remove(), 150);
            }
        });

        menu.querySelectorAll('.card-action-item').forEach(menuItem => {
            menuItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = menuItem.dataset.action;
                DropdownManager.close('search-card-menu');

                switch (action) {
                    case 'view':
                        window.dispatchEvent(new CustomEvent('viewitem', { detail: { item } }));
                        break;
                    case 'edit':
                        HomePage.editItem(item);
                        break;
                    case 'delete':
                        await this.deleteItem(item);
                        break;
                }
            });
        });
    },

    async navigateToFolder(folderId) {
        if (typeof Vault === 'undefined') return;

        try {
            const folder = await Vault.getFolder(folderId);
            if (!folder) return;

            // Walk up to find vault (parent_folder_id === null)
            let current = folder;
            while (current && current.parent_folder_id !== null) {
                current = await Vault.getFolder(current.parent_folder_id);
            }

            if (current) {
                Vault.setCurrentVault(current);
                HomePage.currentVault = current;
            }

            App.showView('home');
            HomePage.navigateToFolder(folderId);
        } catch (e) {
            console.error('SearchPage: navigateToFolder error', e);
        }
    },

    showSortMenu(btn) {
        if (DropdownManager.isOpen('search-sort-menu')) {
            DropdownManager.close('search-sort-menu');
            return;
        }

        const menu = document.createElement('div');
        menu.className = 'sort-menu';

        const showDirection = true;

        menu.innerHTML = `
            <div class="sort-menu-section">
                <span class="sort-menu-label">Order by</span>
                <button class="sort-menu-item ${this.sortBy === 'name' ? 'active' : ''}" data-sort="name">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 19h16M4 15h12M4 11h16M4 7h8"></path>
                    </svg>
                    <span>Name</span>
                    ${this.sortBy === 'name' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </button>
                <button class="sort-menu-item ${this.sortBy === 'modified' ? 'active' : ''}" data-sort="modified">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Modified</span>
                    ${this.sortBy === 'modified' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </button>
            </div>
            <div class="sort-menu-divider"></div>
            <div class="sort-menu-section">
                <button class="sort-menu-item ${this.sortDirection === 'asc' ? 'active' : ''}" data-direction="asc">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                    <span>Ascending</span>
                    ${this.sortDirection === 'asc' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </button>
                <button class="sort-menu-item ${this.sortDirection === 'desc' ? 'active' : ''}" data-direction="desc">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    <span>Descending</span>
                    ${this.sortDirection === 'desc' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </button>
            </div>
        `;

        const btnRect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (btnRect.bottom + 4) + 'px';
        menu.style.right = (window.innerWidth - btnRect.right) + 'px';

        document.body.appendChild(menu);
        requestAnimationFrame(() => menu.classList.add('open'));

        DropdownManager.open('search-sort-menu', {
            element: menu,
            trigger: btn,
            onClose: () => {
                menu.classList.remove('open');
                setTimeout(() => menu.remove(), 150);
            }
        });

        menu.querySelectorAll('[data-sort]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sortBy = item.dataset.sort;
                DropdownManager.close('search-sort-menu');
                this.renderFolders();
                this.renderCards();
            });
        });

        menu.querySelectorAll('[data-direction]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sortDirection = item.dataset.direction;
                DropdownManager.close('search-sort-menu');
                this.renderFolders();
                this.renderCards();
            });
        });
    },

    sortItems(items) {
        const sorted = [...items].sort((a, b) => {
            const dataA = a.data || a.decrypted_data || {};
            const dataB = b.data || b.decrypted_data || {};

            if (this.sortBy === 'name') {
                const nameA = (dataA.name || dataA.label || dataA.issuer || '').toLowerCase();
                const nameB = (dataB.name || dataB.label || dataB.issuer || '').toLowerCase();
                return nameA.localeCompare(nameB);
            } else if (this.sortBy === 'modified') {
                const dateA = new Date(a.updated_at || a.created_at || 0);
                const dateB = new Date(b.updated_at || b.created_at || 0);
                return dateA - dateB;
            }
            return 0;
        });

        return this.sortDirection === 'desc' ? sorted.reverse() : sorted;
    },

    sortFolders(folders) {
        const sorted = [...folders].sort((a, b) => {
            if (this.sortBy === 'name') {
                const nameA = (a.name || a.decrypted_name || '').toLowerCase();
                const nameB = (b.name || b.decrypted_name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            } else if (this.sortBy === 'modified') {
                const dateA = new Date(a.updated_at || a.created_at || 0);
                const dateB = new Date(b.updated_at || b.created_at || 0);
                return dateA - dateB;
            }
            return 0;
        });

        return this.sortDirection === 'desc' ? sorted.reverse() : sorted;
    },

    startTotpTimer() {
        this.stopTotpTimer();
        this.totpTimer = setInterval(() => {
            this.updateTotpCards();
        }, 1000);
    },

    stopTotpTimer() {
        if (this.totpTimer) {
            clearInterval(this.totpTimer);
            this.totpTimer = null;
        }
    },

    async updateTotpCards() {
        const container = document.getElementById('searchCardsList');
        if (!container) return;

        const totpCards = container.querySelectorAll('.totp-card');
        for (const card of totpCards) {
            const secret = SecretStore.get(card.dataset.totpSecretId);
            const period = parseInt(card.dataset.totpPeriod) || 30;
            const digits = parseInt(card.dataset.totpDigits) || 6;
            const algorithm = card.dataset.totpAlgorithm || 'SHA1';

            if (!secret) continue;

            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = period - (now % period);
            const isExpiring = timeRemaining <= 5;

            let code = '------';
            if (typeof TOTPGenerator !== 'undefined') {
                try {
                    code = await TOTPGenerator.generate(secret, { algorithm, digits, period });
                } catch (e) { /* ignore */ }
            }

            const formattedCode = code.length === 6 ?
                code.substring(0, 3) + ' ' + code.substring(3) : code;

            const codeEl = card.querySelector('.totp-code');
            const timeEl = card.querySelector('.totp-time');
            const progressEl = card.querySelector('.totp-ring-progress');

            if (codeEl) {
                codeEl.textContent = formattedCode;
                codeEl.classList.toggle('blink', isExpiring);
            }
            if (timeEl) timeEl.textContent = timeRemaining;
            if (progressEl) progressEl.setAttribute('stroke-dasharray', `${(timeRemaining / period) * 100}, 100`);
            card.classList.toggle('expiring', isExpiring);
        }

        // Inline TOTPs in password cards
        const inlineTotps = container.querySelectorAll('.card-inline-totp');
        for (const inlineTotp of inlineTotps) {
            const secret = SecretStore.get(inlineTotp.dataset.totpSecretId);
            const period = parseInt(inlineTotp.dataset.totpPeriod) || 30;
            const digits = parseInt(inlineTotp.dataset.totpDigits) || 6;
            const algorithm = inlineTotp.dataset.totpAlgorithm || 'SHA1';

            if (!secret) continue;

            let code = '------';
            if (typeof TOTPGenerator !== 'undefined') {
                try {
                    code = await TOTPGenerator.generate(secret, { algorithm, digits, period });
                } catch (e) { /* ignore */ }
            }

            const formattedCode = code.length === 6 ?
                code.substring(0, 3) + ' ' + code.substring(3) : code;

            const codeEl = inlineTotp.querySelector('.inline-totp-code');
            if (codeEl) {
                const now = Math.floor(Date.now() / 1000);
                const timeRemaining = period - (now % period);
                codeEl.textContent = formattedCode;
                codeEl.classList.toggle('blink', timeRemaining <= 5);
            }
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchPage;
}
