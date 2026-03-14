/**
 * Home Page Component
 * - Vault selector and Add button
 * - Filter chips (Show all, Passwords, 2FAs, Files, Notes, Websites)
 * - Folders grid
 * - Cards list
 */

const HomePage = {
    currentFilter: 'all',
    currentFolder: null,  // null = root of current vault
    currentVault: null,
    searchQuery: '',
    items: [],
    folders: [],
    breadcrumb: [],
    _allItems: [],  // Cache of all items for linked item lookups
    isVaultDropdownOpen: false,
    isAddMenuOpen: false,
    totpTimer: null,

    // Drag and drop state for cards
    dragState: {
        isDragging: false,
        draggedCard: null,
        draggedItemId: null,
        placeholder: null,
        startY: 0,
        currentY: 0,
        startIndex: 0,
        longPressTimer: null,
        scrollInterval: null
    },

    // Drag and drop state for folders
    folderDragState: {
        isDragging: false,
        draggedFolder: null,
        draggedFolderId: null,
        placeholder: null,
        startX: 0,
        startY: 0,
        longPressTimer: null,
        scrollInterval: null,
        globalListenersBound: false,
        justDragged: false
    },

    filters: [
        { id: 'all', label: 'Show all', icon: 'grid' },
        { id: 'password', label: 'Passwords', icon: 'key' },
        { id: 'totp', label: '2FAs', icon: 'clock' },
        { id: 'file', label: 'Files', icon: 'file' },
        { id: 'note', label: 'Notes', icon: 'file-text' },
        { id: 'website', label: 'Websites', icon: 'globe' }
    ],

    // Sort state
    sortBy: 'custom',      // 'custom', 'name', 'modified'
    sortDirection: 'asc',  // 'asc', 'desc'

    // Select mode state
    isSelectMode: false,
    selectedFolderIds: [],
    selectedItemIds: [],

    /**
     * Initialize the home page
     */
    init() {
        this.render();
        this.bindEvents();
        this.loadData();
    },

    /**
     * Render the home page HTML
     * Note: Uses cached currentVault - actual data loaded by loadData()
     */
    render() {
        // Use cached current vault if available, otherwise use placeholder
        const currentVault = this.currentVault || null;
        const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';

        const pageHTML = `
            <!-- Home Header: Vault Selector + Add Button (same style as sidebar) -->
            <div class="home-header">
                <div class="sidebar-vault">
                    <button class="vault-selector" id="homeVaultSelector">
                        <div class="vault-info">
                            <span class="vault-label">Current Vault</span>
                            <span class="vault-name" id="homeVaultName">${Utils.escapeHtml(currentVault?.name || 'My Vault')}</span>
                        </div>
                        <svg class="vault-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <div class="vault-dropdown" id="homeVaultDropdown">
                        <div class="vault-dropdown-header">
                            <span>Vaults</span>
                            <button class="vault-manage-btn" id="homeManageVaultsBtn" title="Manage Vaults">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="vault-list" id="homeVaultList">
                            <!-- Vaults will be rendered by renderVaultList -->
                        </div>
                        <button class="add-vault-btn" id="homeAddVaultBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            <span>Add Vault</span>
                        </button>
                    </div>
                </div>
                <div class="sidebar-add">
                    <div class="add-btn-container" id="homeAddBtnContainer">
                        <button class="btn btn-primary btn-add-new" id="homeAddItemBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add New
                        </button>
                        <div class="add-menu" id="homeAddMenu">
                            <button class="add-menu-item" data-type="folder">
                                <div class="add-menu-icon folder">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                </div>
                                <span>Folder</span>
                            </button>
                            <button class="add-menu-item" data-type="password">
                                <div class="add-menu-icon password">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </div>
                                <span>Password</span>
                            </button>
                            <button class="add-menu-item" data-type="totp">
                                <div class="add-menu-icon totp">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                </div>
                                <span>2FA Code</span>
                            </button>
                            <button class="add-menu-item" data-type="website">
                                <div class="add-menu-icon website">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="2" y1="12" x2="22" y2="12"></line>
                                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                    </svg>
                                </div>
                                <span>Website</span>
                            </button>
                            <button class="add-menu-item" data-type="note">
                                <div class="add-menu-icon note">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                    </svg>
                                </div>
                                <span>Secure Note</span>
                            </button>
                            ${!isLocalMode ? `<button class="add-menu-item" data-type="file">
                                <div class="add-menu-icon file">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                        <polyline points="13 2 13 9 20 9"></polyline>
                                    </svg>
                                </div>
                                <span>File</span>
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Search Bar -->
            <div class="home-search">
                <div class="home-search-input">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" id="homeSearchInput" placeholder="Search your vaults..." autocomplete="off">
                </div>
                <button class="sort-btn" id="sortBtn" title="Sort options">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="4" y1="6" x2="16" y2="6"></line>
                        <line x1="4" y1="12" x2="12" y2="12"></line>
                        <line x1="4" y1="18" x2="8" y2="18"></line>
                        <polyline points="15 15 18 18 21 15"></polyline>
                        <line x1="18" y1="12" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <!-- Folder Navigation (shown when inside a folder) -->
            <div class="folder-navigation" id="folderNavigation" style="display: none;">
                <div class="breadcrumb">
                    <button class="breadcrumb-item breadcrumb-root" id="breadcrumbRoot">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        </svg>
                        <span>Root</span>
                    </button>
                    <div class="breadcrumb-path" id="breadcrumbPath"></div>
                </div>
            </div>

            <!-- Filter Chips -->
            <div class="filter-container" id="filterContainer">
                <div class="filter-chips" id="filterChips">
                    ${this.filters.filter(f => !isLocalMode || f.id !== 'file').map(filter => `
                        <button class="filter-chip ${filter.id === this.currentFilter ? 'active' : ''}"
                                data-filter="${filter.id}">
                            ${this.getFilterIcon(filter.icon)}
                            <span>${filter.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Select Mode Controls (hidden by default) -->
            <div class="select-controls" id="selectControls" style="display: none;">
                <div class="select-controls-left">
                    <label class="custom-checkbox select-checkbox" id="selectAllFolders">
                        <input type="checkbox">
                        <span class="checkmark"></span>
                    </label>
                    <span class="select-count" id="selectFoldersCount">0 folders</span>

                    <label class="custom-checkbox select-checkbox" id="selectAllItems">
                        <input type="checkbox">
                        <span class="checkmark"></span>
                    </label>
                    <span class="select-count" id="selectItemsCount">0 items</span>
                </div>
                <div class="select-controls-right">
                    <button class="btn btn-secondary btn-sm" id="selectMoveBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 9l-3 3 3 3"></path>
                            <path d="M9 5l3-3 3 3"></path>
                            <path d="M15 19l3 3 3-3"></path>
                            <path d="M19 9l3 3-3 3"></path>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <line x1="12" y1="2" x2="12" y2="22"></line>
                        </svg>
                        <span>Move</span>
                    </button>
                    <button class="btn btn-danger btn-sm" id="selectDeleteBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Delete</span>
                    </button>
                    <button class="btn-icon select-close-btn" id="selectCloseBtn" title="Exit Select Mode">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Folders Section -->
            <section class="folders-section" id="foldersSection">
                <div class="section-header">
                    <h2 class="section-title">Folders</h2>
                    <button class="btn-icon" id="addFolderBtn" title="Add Folder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
                <div class="folders-grid" id="foldersGrid">
                    <!-- Folders will be loaded here -->
                </div>
            </section>

            <!-- Cards Section -->
            <section class="cards-section" id="cardsSection">
                <div class="section-header">
                    <h2 class="section-title" id="cardsTitle">All Items</h2>
                    <span class="section-count" id="cardsCount">0</span>
                </div>
                <div class="cards-list" id="cardsList">
                    <!-- Cards will be loaded here -->
                </div>
            </section>

            <!-- Empty State -->
            <div class="empty-state" id="emptyState" style="display: none;">
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <h3 class="empty-title">No items yet</h3>
                <p class="empty-text">Tap the + button to add your first password</p>
            </div>
        `;

        // Render into the designated page content container
        const container = document.getElementById('homePageContent');
        if (container) {
            container.innerHTML = pageHTML;
        }
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Vault selector toggle
        document.getElementById('homeVaultSelector')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleVaultDropdown();
        });

        // Add vault button in dropdown
        document.getElementById('homeAddVaultBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeVaultDropdown();
            this.showAddVaultPopup();
        });

        // Manage vaults button
        document.getElementById('homeManageVaultsBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeVaultDropdown();
            this.showManageVaultsPopup();
        });

        // Add button toggle
        document.getElementById('homeAddItemBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleAddMenu();
        });

        // Add menu items
        document.querySelectorAll('#homeAddMenu .add-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = item.dataset.type;

                // Block file uploads when offline
                if (type === 'file' && typeof Vault !== 'undefined' && Vault.isOffline()) {
                    Toast.warning('Cannot upload files while offline');
                    return;
                }

                this.closeAddMenu();

                if (type === 'folder') {
                    this.showAddFolderPopup();
                } else {
                    this.showAddItemPage(type);
                }
            });
        });

        // Filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.setFilter(chip.dataset.filter);
            });
        });

        // Add folder button (in folders section)
        document.getElementById('addFolderBtn')?.addEventListener('click', () => {
            this.showAddFolderPopup();
        });

        // Home search input
        const homeSearchInput = document.getElementById('homeSearchInput');
        homeSearchInput?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim().toLowerCase();
            this.renderFolders();
            this.renderCards();
        });

        // Enter key on home search opens global search page
        homeSearchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim().toLowerCase();
                if (query.length >= 2) {
                    App.showView('search', { query });
                }
            }
        });

        // Auto-focus search input when typing on home page
        document.addEventListener('keydown', (e) => {
            const input = document.getElementById('homeSearchInput');
            if (!input || document.activeElement === input) return;
            // Skip if typing in another input/textarea, or using modifier keys
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            // Skip non-printable keys
            if (e.key.length !== 1) return;
            // Skip if a popup is open
            if (document.querySelector('.popup-overlay.active')) return;
            input.focus();
        });

        // Sort button
        document.getElementById('sortBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showSortMenu(e.currentTarget);
        });

        // Breadcrumb root button
        document.getElementById('breadcrumbRoot')?.addEventListener('click', () => {
            this.navigateToRoot();
        });

        // Listen for search events from other components
        window.addEventListener('vaultsearch', (e) => {
            this.searchQuery = e.detail.query;
            this.renderFolders();
            this.renderCards();
        });

        // Listen for vault changes
        window.addEventListener('vaultselected', (e) => {
            this.currentVault = e.detail.vault;
            this.updateVaultDisplay();
            this.loadData();
        });

        // Listen for vault updates
        window.addEventListener('vaultupdate', () => {
            this.loadData();
        });
    },

    /**
     * Toggle vault dropdown
     */
    toggleVaultDropdown() {
        const dropdown = document.getElementById('homeVaultDropdown');
        const selector = document.getElementById('homeVaultSelector');

        if (this.isVaultDropdownOpen) {
            DropdownManager.close('vault-dropdown');
        } else {
            // Register with DropdownManager (closes all others first)
            DropdownManager.open('vault-dropdown', {
                element: dropdown,
                trigger: selector,
                onClose: () => {
                    this.isVaultDropdownOpen = false;
                    dropdown?.classList.remove('open');
                    selector?.classList.remove('active');
                }
            });

            this.isVaultDropdownOpen = true;
            dropdown?.classList.add('open');
            selector?.classList.add('active');
            this.renderVaultList();
        }
    },

    /**
     * Close vault dropdown
     */
    closeVaultDropdown() {
        DropdownManager.close('vault-dropdown');
    },

    /**
     * Render vault list in dropdown
     */
    async renderVaultList() {
        const vaultList =document.getElementById('homeVaultList');
        if (!vaultList) return;

        const vaults =typeof Vault !== 'undefined' ? await Vault.getVaults() : [];

        if (vaults.length === 0) {
            vaultList.innerHTML = '<div class="vault-empty">No vaults yet</div>';
            return;
        }

        // Sort vaults by sort_order
        const sortedVaults = [...vaults].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        vaultList.innerHTML = sortedVaults.map(vault => {
            const isActive = this.currentVault && vault.id === this.currentVault.id;
            const name = vault.name || 'Untitled Vault';
            return `
                <button class="vault-item ${isActive ? 'active' : ''}" data-vault-id="${vault.id}">
                    <span class="vault-item-name">${Utils.escapeHtml(name)}</span>
                    <svg class="vault-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </button>
            `;
        }).join('');

        // Bind click handlers
        vaultList.querySelectorAll('.vault-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const vaultId =item.dataset.vaultId;
                this.selectVault(vaultId);
            });
        });
    },

    /**
     * Select a vault
     */
    async selectVault(vaultId) {
        // Exit select mode when switching vaults
        if (this.isSelectMode) this.exitSelectMode();

        const vaults = typeof Vault !== 'undefined' ? await Vault.getVaults() : [];
        const vault = vaults.find(v => v.id === vaultId);

        if (vault) {
            this.currentVault = vault;
            this.currentFolder = null; // Navigate to root of new vault
            this.closeVaultDropdown();

            // Update Vault
            if (typeof Vault !== 'undefined') {
                Vault.setCurrentVault(vault);
                Vault.setCurrentFolder(null); // Reset to root
            }

            // Update display
            this.updateVaultDisplay();

            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('vaultselected', {
                detail: { vault }
            }));

            // Reload data for new vault
            this.loadData();
        }
    },

    /**
     * Update vault display in selector
     */
    updateVaultDisplay() {
        const nameEl = document.getElementById('homeVaultName');
        if (nameEl && this.currentVault) {
            nameEl.textContent = this.currentVault.name || 'My Vault';
        }
    },

    /**
     * Toggle add menu
     */
    toggleAddMenu() {
        const menu = document.getElementById('homeAddMenu');
        const trigger = document.getElementById('homeAddItemBtn');

        if (this.isAddMenuOpen) {
            DropdownManager.close('add-menu');
        } else {
            // Register with DropdownManager (closes all others first)
            DropdownManager.open('add-menu', {
                element: menu,
                trigger: trigger,
                onClose: () => {
                    this.isAddMenuOpen = false;
                    menu?.classList.remove('open');
                }
            });

            this.isAddMenuOpen = true;
            menu?.classList.add('open');
        }
    },

    /**
     * Close add menu
     */
    closeAddMenu() {
        DropdownManager.close('add-menu');
    },

    /**
     * Show add vault popup
     * @param {Object} options - Optional settings
     * @param {Function} options.onClose - Callback to run when popup closes (regardless of outcome)
     */
    showAddVaultPopup(options = {}) {
        const popup = Popup.open({
            title: 'New Vault',
            body: `
                <div class="form-group">
                    <label class="form-label" for="newVaultName">Vault Name</label>
                    <input type="text" class="form-input" id="newVaultName" placeholder="Enter vault name" autocomplete="off">
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                { text: 'Create', type: 'primary', id: 'createBtn', onClick: async () => {
                    const name = popup.querySelector('#newVaultName').value.trim();
                    if (!name) {
                        Toast.error('Please enter a vault name');
                        return false;
                    }

                    popup.setButtonLoading('createBtn', true);

                    try {
                        let vault;
                        if (typeof Vault !== 'undefined') {
                            vault = await Vault.createVault(name);
                        }

                        if (vault) {
                            this.selectVault(vault.id);
                            this.render();
                            this.bindEvents();
                            this.loadData();
                            Toast.success('Vault created');
                        }
                        return true; // Close popup
                    } catch (error) {
                        console.error('Failed to create vault:', error);
                        Toast.error('Failed to create vault');
                        popup.setButtonLoading('createBtn', false);
                        return false; // Keep popup open
                    }
                }}
            ],
            onOpen: (api) => {
                const input = api.querySelector('#newVaultName');
                input.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter') {
                        const name = input.value.trim();
                        if (!name) {
                            Toast.error('Please enter a vault name');
                            return;
                        }

                        api.setButtonLoading('createBtn', true);

                        try {
                            let vault;
                            if (typeof Vault !== 'undefined') {
                                vault = await Vault.createVault(name);
                            }

                            if (vault) {
                                this.selectVault(vault.id);
                                this.render();
                                this.bindEvents();
                                this.loadData();
                                Toast.success('Vault created');
                            }
                            api.forceClose();
                        } catch (error) {
                            console.error('Failed to create vault:', error);
                            Toast.error('Failed to create vault');
                            api.setButtonLoading('createBtn', false);
                        }
                    }
                });
            },
            onClose: options.onClose
        });
    },

    /**
     * Show manage vaults popup
     */
    async showManageVaultsPopup() {
        const self = this;
        const vaults =typeof Vault !== 'undefined' ? await Vault.getVaults() : [];
        let popupApi = null;

        popupApi = Popup.open({
            title: 'Manage Vaults',
            body: `
                <div class="manage-vaults-list" id="manageVaultsList">
                    ${vaults.length === 0 ? '<div class="manage-vaults-empty">No vaults yet</div>' : ''}
                </div>
            `,
            compact: false,
            buttons: [
                {
                    text: 'Add Vault',
                    type: 'primary',
                    id: 'addBtn',
                    onClick: () => {
                        // Show add vault popup with callback to re-open manage vaults
                        setTimeout(() => {
                            self.showAddVaultPopup({
                                onClose: () => {
                                    // Re-open manage vaults popup after add vault closes
                                    self.showManageVaultsPopup();
                                }
                            });
                        }, 100);
                        return true; // Close current popup
                    }
                }
            ],
            onOpen: (api) => {
                // Render vaults list
                self.renderManageVaultsList(vaults, () => api.close());
            }
        });

        // Add the icon to the button after popup is created
        const addBtn = popupApi.getElement().querySelector('#addBtn');
        if (addBtn) {
            addBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 6px;">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Vault
            `;
        }
    },

    /**
     * Render vaults list in manage popup
     */
    renderManageVaultsList(vaults, closePopup) {
        const listEl = document.getElementById('manageVaultsList');
        if (!listEl) return;

        if (vaults.length === 0) {
            listEl.innerHTML = '<div class="manage-vaults-empty">No vaults yet</div>';
            return;
        }

        // Sort vaults by sort_order (respect user's custom order)
        const sortedVaults = [...vaults].sort((a, b) => {
            return (a.sort_order || 0) - (b.sort_order || 0);
        });

        listEl.innerHTML = sortedVaults.map(vault => `
            <div class="manage-vault-item${vault.is_default ? ' is-default' : ''}" data-vault-id="${vault.id}" draggable="true">
                <div class="manage-vault-drag-handle" title="Drag to reorder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="8" y1="6" x2="16" y2="6"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                        <line x1="8" y1="18" x2="16" y2="18"></line>
                    </svg>
                </div>
                <div class="manage-vault-name">
                    <span class="manage-vault-text">${Utils.escapeHtml(vault.name || 'Untitled Vault')}</span>
                    ${vault.is_default ? '<span class="manage-vault-badge">Default</span>' : ''}
                    <input type="text" class="manage-vault-input" value="${Utils.escapeHtml(vault.name || '')}" style="display: none;" autocomplete="off">
                </div>
                <div class="manage-vault-actions">
                    <button class="manage-vault-btn manage-vault-edit" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="manage-vault-btn manage-vault-save" title="Save" style="display: none;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <button class="manage-vault-btn manage-vault-cancel" title="Cancel" style="display: none;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <button class="manage-vault-btn manage-vault-delete${vault.is_default ? ' disabled' : ''}" title="${vault.is_default ? 'Cannot delete default vault' : 'Delete'}"${vault.is_default ? ' disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Setup drag and drop
        this.setupVaultDragAndDrop(listEl, sortedVaults, closePopup);

        // Bind actions
        listEl.querySelectorAll('.manage-vault-item').forEach(item => {
            const vaultId = item.dataset.vaultId;
            const vault = vaults.find(v => v.id === vaultId);
            const textEl = item.querySelector('.manage-vault-text');
            const badgeEl = item.querySelector('.manage-vault-badge');
            const inputEl = item.querySelector('.manage-vault-input');
            const editBtn = item.querySelector('.manage-vault-edit');
            const saveBtn = item.querySelector('.manage-vault-save');
            const cancelBtn = item.querySelector('.manage-vault-cancel');
            const deleteBtn = item.querySelector('.manage-vault-delete');

            const enterEditMode = () => {
                textEl.style.display = 'none';
                if (badgeEl) badgeEl.style.display = 'none';
                inputEl.style.display = 'block';
                editBtn.style.display = 'none';
                saveBtn.style.display = 'flex';
                cancelBtn.style.display = 'flex';
                deleteBtn.style.display = 'none';
                inputEl.focus();
                inputEl.select();
            };

            const exitEditMode = () => {
                textEl.style.display = 'block';
                if (badgeEl) badgeEl.style.display = '';
                inputEl.style.display = 'none';
                editBtn.style.display = 'flex';
                saveBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
                deleteBtn.style.display = 'flex';
                inputEl.value = vault.name || '';
            };

            let isSaving = false;
            let isDeleting = false;

            const saveVault = async () => {
                if (isSaving) return;

                const newName = inputEl.value.trim();
                if (!newName) {
                    Toast.error('Vault name cannot be empty');
                    return;
                }

                isSaving = true;
                saveBtn.disabled = true;

                try {
                    await Vault.updateVault(vaultId, newName);
                    vault.name = newName;
                    textEl.textContent = newName;
                    exitEditMode();
                    this.updateVaultDisplay();
                    this.renderVaultList();
                    Toast.success('Vault renamed');
                } catch (error) {
                    console.error('Failed to rename vault:', error);
                    Toast.error('Failed to rename vault');
                } finally {
                    isSaving = false;
                    saveBtn.disabled = false;
                }
            };

            editBtn.addEventListener('click', enterEditMode);
            cancelBtn.addEventListener('click', exitEditMode);
            saveBtn.addEventListener('click', saveVault);

            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveVault();
                if (e.key === 'Escape') exitEditMode();
            });

            deleteBtn.addEventListener('click', async () => {
                if (isDeleting || vault.is_default) return;

                const confirmed = await this.showConfirmPopup(
                    'Delete Vault',
                    `Are you sure you want to delete "${vault.name}"?`
                );
                if (!confirmed) return;

                isDeleting = true;
                deleteBtn.disabled = true;

                try {
                    await Vault.softDeleteVault(vaultId);

                    // Get updated vaults list
                    const remainingVaults = await Vault.getVaults();

                    // If we deleted the current vault, switch to another
                    if (this.currentVault && this.currentVault.id === vaultId) {
                        if (remainingVaults.length > 0) {
                            this.currentVault = remainingVaults[0];
                            Vault.setCurrentVault(remainingVaults[0]);
                        } else {
                            this.currentVault = null;
                        }
                    }

                    // Re-render manage popup list
                    this.renderManageVaultsList(remainingVaults, closePopup);

                    // Update display and reload data
                    this.updateVaultDisplay();
                    await this.loadData();
                    this.renderCards();

                    Toast.success('Vault deleted');
                } catch (error) {
                    console.error('Failed to delete vault:', error);
                    Toast.error('Failed to delete vault');
                    isDeleting = false;
                    deleteBtn.disabled = false;
                }
            });
        });
    },

    /**
     * Setup drag and drop for vault reordering
     */
    setupVaultDragAndDrop(listEl, vaults, closePopup) {
        // Store drag state
        const state = {
            dragging: false,
            item: null,
            placeholder: null,
            offsetY: 0,
            clone: null
        };

        // Cleanup function
        const cleanup = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };

        const startDrag = (item, clientY) => {
            if (state.dragging) return;
            // Disable drag while offline
            if (typeof Vault !== 'undefined' && Vault.isOffline()) return;

            const rect = item.getBoundingClientRect();
            state.dragging = true;
            state.item = item;
            state.offsetY = clientY - rect.top;

            // Create placeholder
            state.placeholder = document.createElement('div');
            state.placeholder.className = 'manage-vault-placeholder';
            state.placeholder.style.height = rect.height + 'px';

            // Create a clone for dragging (append to body to avoid popup clipping)
            state.clone = item.cloneNode(true);
            state.clone.classList.add('dragging');
            state.clone.style.position = 'fixed';
            state.clone.style.top = rect.top + 'px';
            state.clone.style.left = rect.left + 'px';
            state.clone.style.width = rect.width + 'px';
            state.clone.style.height = rect.height + 'px';
            state.clone.style.zIndex = '10000';
            state.clone.style.pointerEvents = 'none';
            state.clone.style.margin = '0';
            state.clone.style.background = 'var(--color-bg-secondary)';
            document.body.appendChild(state.clone);

            // Hide original and insert placeholder
            item.style.display = 'none';
            item.parentNode.insertBefore(state.placeholder, item);

            // Add dragging class to list
            listEl.classList.add('is-dragging');
            document.body.style.userSelect = 'none';
        };

        const moveDrag = (clientY) => {
            if (!state.dragging || !state.clone || !state.placeholder) return;

            // Move clone
            const newTop = clientY - state.offsetY;
            state.clone.style.top = newTop + 'px';

            // Get all visible items (exclude hidden original and placeholder)
            const items = Array.from(listEl.querySelectorAll('.manage-vault-item'))
                .filter(i => i !== state.item && i.style.display !== 'none');

            // Find insertion point
            let insertBefore = null;
            for (const otherItem of items) {
                const rect = otherItem.getBoundingClientRect();
                if (clientY < rect.top + rect.height / 2) {
                    insertBefore = otherItem;
                    break;
                }
            }

            // Move placeholder and hidden original together
            if (insertBefore) {
                listEl.insertBefore(state.placeholder, insertBefore);
                listEl.insertBefore(state.item, insertBefore);
            } else {
                // Put at end
                listEl.appendChild(state.placeholder);
                listEl.appendChild(state.item);
            }
        };

        const endDrag = async () => {
            if (!state.dragging) return;
            state.dragging = false;

            // Show original item
            if (state.item) {
                state.item.style.display = '';
            }

            // Remove placeholder
            if (state.placeholder && state.placeholder.parentNode) {
                state.placeholder.parentNode.removeChild(state.placeholder);
            }

            // Remove clone
            if (state.clone && state.clone.parentNode) {
                state.clone.parentNode.removeChild(state.clone);
            }

            // Reset
            listEl.classList.remove('is-dragging');
            document.body.style.userSelect = '';

            // Save order
            await this.saveVaultsOrder(listEl);

            state.item = null;
            state.placeholder = null;
            state.clone = null;
        };

        const onMouseMove = (e) => {
            if (state.dragging) {
                e.preventDefault();
                moveDrag(e.clientY);
            }
        };

        const onMouseUp = () => {
            if (state.dragging) {
                endDrag();
            }
        };

        const onTouchMove = (e) => {
            if (state.dragging) {
                e.preventDefault();
                moveDrag(e.touches[0].clientY);
            }
        };

        const onTouchEnd = () => {
            if (state.dragging) {
                endDrag();
            }
        };

        // Bind to handles
        listEl.querySelectorAll('.manage-vault-item').forEach(item => {
            const handle = item.querySelector('.manage-vault-drag-handle');
            if (!handle) return;

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startDrag(item, e.clientY);
            });

            handle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                startDrag(item, e.touches[0].clientY);
            }, { passive: false });
        });

        // Global listeners
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);

        // Cleanup on popup close
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.removedNodes) {
                    if (node.contains && node.contains(listEl)) {
                        cleanup();
                        observer.disconnect();
                        return;
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },

    /**
     * Save new vaults order after drag
     */
    async saveVaultsOrder(listEl) {
        const items = Array.from(listEl.querySelectorAll('.manage-vault-item'));
        const newOrder = items.map((item, index) => ({
            id: item.dataset.vaultId,
            sort_order: index
        }));

        try {
            if (typeof Vault !== 'undefined' && Vault.updateVaultsOrder) {
                await Vault.updateVaultsOrder(newOrder);
                this.renderVaultList();
            }
        } catch (error) {
            console.error('Failed to save vaults order:', error);
            Toast.error('Failed to save order');
        }
    },

    /**
     * Load data from vault
     */
    async loadData() {
        try {
            // Get current vault
            if (typeof Vault !== 'undefined') {
                const currentVault = Vault.getCurrentVault();
                if (currentVault) {
                    this.currentVault = currentVault;
                } else {
                    // Try to get default or first vault
                    const defaultVault = await Vault.getDefaultVault();
                    if (defaultVault) {
                        this.currentVault = defaultVault;
                        Vault.setCurrentVault(defaultVault);
                    } else {
                        const allVaults = await Vault.getVaults();
                        if (allVaults.length > 0) {
                            this.currentVault = allVaults[0];
                            Vault.setCurrentVault(allVaults[0]);
                        }
                    }
                }
            }

            // Update vault display
            this.updateVaultDisplay();

            if (!this.currentVault) {
                this.folders = [];
                this.items = [];
                this._allItems = [];
                this.renderEmptyState();
                return;
            }

            // Get root folder for current vault
            const rootFolder = typeof Vault !== 'undefined' ? await Vault.getRootFolder(this.currentVault.id) : null;
            const currentFolderId = this.currentFolder?.id || rootFolder?.id;

            if (typeof Vault !== 'undefined' && Vault.getItems) {
                // Get subfolders of current folder
                this.folders = await Vault.getSubfolders(currentFolderId) || [];
                // Get items in current folder
                this.items = await Vault.getItemsInFolder(currentFolderId) || [];
                // Update breadcrumb
                this.breadcrumb = this.currentFolder ? await Vault.getBreadcrumb(this.currentFolder.id) : [];
                // Cache all items for linked item lookups (e.g., password cards with linked TOTP)
                this._allItems = await Vault.getItems() || [];
            } else {
                // Fallback - only try API if not in local/offline mode
                const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';
                const isOffline = typeof Vault !== 'undefined' && Vault.isOffline();

                if (!isLocalMode && !isOffline) {
                    try {
                        const [foldersRes, itemsRes] = await Promise.all([
                            ApiClient.getFolders(),
                            ApiClient.getItems()
                        ]);

                        this.folders = foldersRes?.success ? (foldersRes.data.folders || []) : [];
                        this.items = itemsRes?.success ? (itemsRes.data.items || []) : [];
                        this._allItems = this.items; // Use same items as cache
                        this.breadcrumb = [];
                    } catch (apiError) {
                        console.warn('API not available, using empty data:', apiError.message);
                        this.folders = [];
                        this.items = [];
                        this._allItems = [];
                        this.breadcrumb = [];
                    }
                } else {
                    // Local/offline mode without Vault - use empty data
                    this.folders = [];
                    this.items = [];
                    this._allItems = [];
                    this.breadcrumb = [];
                }
            }

            this.renderBreadcrumb();
            this.renderFolders();
            this.renderCards();
        } catch (error) {
            console.error('Failed to load vault data:', error);
            this.folders = [];
            this.items = [];
            this.renderEmptyState();
        }
    },

    /**
     * Navigate to root folder
     */
    navigateToRoot() {
        // Exit select mode when navigating
        if (this.isSelectMode) this.exitSelectMode();

        this.currentFolder = null;
        this.currentFilter = 'all';

        // Sync with Vault
        if (typeof Vault !== 'undefined') {
            Vault.setCurrentFolder(null);
        }

        this.loadData();
    },

    /**
     * Navigate to a specific folder
     */
    async navigateToFolder(folderId) {
        // Exit select mode when navigating
        if (this.isSelectMode) this.exitSelectMode();

        const folder = typeof Vault !== 'undefined' ? await Vault.getFolder(folderId) : null;
        this.currentFolder = folder;
        this.currentFilter = 'all';

        // Sync with Vault
        if (typeof Vault !== 'undefined') {
            Vault.setCurrentFolder(folder);
        }

        await this.loadData();
    },

    /**
     * Navigate to parent folder (go back one level)
     */
    navigateToParent() {
        if (!this.currentFolder) {
            return; // Already at root
        }

        // Get non-vault breadcrumb items
        const nonRootBreadcrumb = this.breadcrumb.filter(crumb => !crumb.is_vault);

        if (nonRootBreadcrumb.length > 1) {
            // Go to the parent folder (second to last non-root item)
            const parentIndex = nonRootBreadcrumb.length - 2;
            const parentFolder = nonRootBreadcrumb[parentIndex];
            this.navigateToFolder(parentFolder.id);
        } else {
            // Parent is root folder, go to root view
            this.navigateToRoot();
        }
    },

    /**
     * Render breadcrumb
     */
    renderBreadcrumb() {
        const navigation = document.getElementById('folderNavigation');
        const pathEl = document.getElementById('breadcrumbPath');

        if (!navigation || !pathEl) return;

        // Hide navigation if at root (no current folder or empty breadcrumb)
        if (!this.currentFolder) {
            navigation.style.display = 'none';
            return;
        }

        navigation.style.display = 'flex';

        // Filter out vault from breadcrumb display (it's represented by the home icon)
        const displayBreadcrumb = this.breadcrumb.filter(crumb => !crumb.is_vault);

        pathEl.innerHTML = displayBreadcrumb.map((crumb, index) => `
            <span class="breadcrumb-separator">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </span>
            <button class="breadcrumb-item ${index === displayBreadcrumb.length - 1 ? 'active' : ''}"
                    data-folder-id="${crumb.id}">
                ${Utils.escapeHtml(crumb.name)}
            </button>
        `).join('');

        // Bind breadcrumb clicks
        pathEl.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const folderId = item.dataset.folderId;
                if (folderId) {
                    this.navigateToFolder(folderId);
                }
            });
        });
    },

    /**
     * Set current filter
     * @param {string} filter
     */
    setFilter(filter) {
        this.currentFilter = filter;
        this.currentFolder = null;

        // Update filter chips UI
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.filter === filter);
        });

        // Update section title
        const title = document.getElementById('cardsTitle');
        if (title) {
            const filterObj = this.filters.find(f => f.id === filter);
            title.textContent = filter === 'all' ? 'All Items' : filterObj?.label || 'Items';
        }

        this.renderCards();
    },

    /**
     * Set current folder (called when clicking a folder card)
     * @param {Object} folder
     */
    setFolder(folder) {
        this.navigateToFolder(folder.id);
    },

    /**
     * Render folders grid
     */
    async renderFolders() {
        const grid = document.getElementById('foldersGrid');
        const section = document.getElementById('foldersSection');

        if (!grid || !section) return;

        let folders = this.folders;

        // Apply search filter to folders (minimum 2 characters)
        if (this.searchQuery && this.searchQuery.length >= 2) {
            folders = folders.filter(f => SearchUtils.matchFolder(f, this.searchQuery));
        }

        if (folders.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        // Sort folders
        const sortedFolders = this.sortFolders(folders);

        // Get recursive item counts for all folders in parallel
        const counts = await Promise.all(
            sortedFolders.map(folder => this.getRecursiveItemCount(folder.id))
        );

        grid.innerHTML = sortedFolders.map((folder, index) => {
            const name = folder.name || folder.decrypted_name || 'Folder';
            const itemCount = counts[index];
            const icon = folder.icon || folder.decrypted_icon || 'folder';

            return `
                <div class="folder-card" data-folder-id="${folder.id}">
                    <div class="folder-icon">
                        ${this.getFolderIcon(icon)}
                    </div>
                    <div class="folder-info">
                        <span class="folder-name">${Utils.escapeHtml(name)}</span>
                        <span class="folder-count">${itemCount} items</span>
                    </div>
                    <button class="folder-menu-btn" data-folder-id="${folder.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // Bind folder click events and drag events
        grid.querySelectorAll('.folder-card').forEach(card => {
            // Click event
            card.addEventListener('click', (e) => {
                // Handle select mode
                if (this.isSelectMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleSelection('folder', card.dataset.folderId);
                    return;
                }

                // Ignore if just finished dragging
                if (this.folderDragState.justDragged) {
                    this.folderDragState.justDragged = false;
                    return;
                }

                if (e.target.closest('.folder-menu-btn')) {
                    e.stopPropagation();
                    this.showFolderMenu(e.target.closest('.folder-menu-btn'), card.dataset.folderId);
                    return;
                }
                const folder = this.folders.find(f => f.id === card.dataset.folderId);
                if (folder) {
                    this.setFolder(folder);
                }
            });

            // Drag events - mouse
            card.addEventListener('mousedown', (e) => this.handleFolderDragStart(e, card));

            // Drag events - touch (long press)
            card.addEventListener('touchstart', (e) => this.handleFolderTouchStart(e, card), { passive: false });
            card.addEventListener('touchmove', (e) => this.handleFolderTouchMove(e), { passive: false });
            card.addEventListener('touchend', (e) => this.handleFolderTouchEnd(e));
        });

        // Global mouse events for folder drag (bind once)
        if (!this.folderDragState.globalListenersBound) {
            this.folderDragState.globalListenersBound = true;
            document.addEventListener('mousemove', (e) => this.handleFolderDragMove(e));
            document.addEventListener('mouseup', (e) => this.handleFolderDragEnd(e));
        }
    },

    /**
     * Show folder action menu
     * @param {HTMLElement} btn - The menu button element
     * @param {string} folderId
     */
    showFolderMenu(btn, folderId) {
        // Toggle - if already open, just close it
        if (DropdownManager.isOpen('folder-menu')) {
            DropdownManager.close('folder-menu');
            return;
        }

        const folder = this.folders.find(f => f.id === folderId);
        if (!folder) return;

        // Create dropdown menu
        const menu = document.createElement('div');
        menu.className = 'folder-action-menu';
        menu.id = 'folderActionMenu';
        menu.innerHTML = `
            <button class="folder-action-item" data-action="edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Edit</span>
            </button>
            <button class="folder-action-item" data-action="move">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 9l-3 3 3 3"></path>
                    <path d="M9 5l3-3 3 3"></path>
                    <path d="M15 19l3 3 3-3"></path>
                    <path d="M19 9l3 3-3 3"></path>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <line x1="12" y1="2" x2="12" y2="22"></line>
                </svg>
                <span>Move</span>
            </button>
            <button class="folder-action-item" data-action="select">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <span>Select</span>
            </button>
            <button class="folder-action-item folder-action-danger" data-action="delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Delete</span>
            </button>
        `;

        // Position the menu
        const btnRect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (btnRect.bottom + 4) + 'px';
        menu.style.right = (window.innerWidth - btnRect.right) + 'px';

        document.body.appendChild(menu);
        requestAnimationFrame(() => menu.classList.add('open'));

        // Register with DropdownManager (closes all others first)
        DropdownManager.open('folder-menu', {
            element: menu,
            trigger: btn,
            onClose: () => {
                menu.classList.remove('open');
                setTimeout(() => menu.remove(), 150);
            }
        });

        // Bind actions
        menu.querySelectorAll('.folder-action-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = item.dataset.action;

                this.closeFolderMenu();

                switch (action) {
                    case 'edit':
                        this.editFolder(folder);
                        break;
                    case 'move':
                        this.showMoveFolderPopup(folder);
                        break;
                    case 'select':
                        this.enterSelectMode('folder', folder.id);
                        break;
                    case 'delete':
                        this.deleteFolder(folder);
                        break;
                }
            });
        });
    },

    /**
     * Close folder action menu
     */
    closeFolderMenu() {
        DropdownManager.close('folder-menu');
    },

    /**
     * Edit folder (rename)
     */
    async editFolder(folder) {
        const newName = await Popup.prompt({
            title: 'Rename Folder',
            label: 'Folder Name',
            value: folder.name || folder.decrypted_name || '',
            placeholder: 'Enter folder name',
            confirmText: 'Save',
            cancelText: 'Cancel'
        });

        if (newName !== null && newName.trim()) {
            try {
                await Vault.updateFolder(folder.id, newName.trim());
                // Update local data
                const idx = this.folders.findIndex(f => f.id === folder.id);
                if (idx !== -1) {
                    this.folders[idx].name = newName.trim();
                }
                this.renderFolders();
                Toast.success('Folder renamed');
            } catch (error) {
                console.error('Failed to rename folder:', error);
                Toast.error('Failed to rename folder');
            }
        }
    },

    /**
     * Delete folder (soft-delete)
     */
    async deleteFolder(folder, fromSelectMode = false) {
        const folderName = folder.name || folder.decrypted_name || 'this folder';

        const confirmed = await this.showConfirmPopup(
            'Delete Folder',
            `Are you sure you want to delete "${folderName}"?`
        );

        if (!confirmed) return;

        try {
            await Vault.softDeleteFolder(folder.id);

            if (fromSelectMode) {
                this.exitSelectMode();
            }

            this.folders = this.folders.filter(f => f.id !== folder.id);
            this.renderFolders();
            Toast.success('Folder deleted');
        } catch (error) {
            console.error('Failed to delete folder:', error);
            Toast.error('Failed to delete folder');
        }
    },

    /**
     * Check if folder tree is empty (no items in folder or any subfolder)
     */
    async isFolderTreeEmpty(folderId) {
        if (typeof Vault === 'undefined') return true;

        // Get items in this folder from Vault (includes all items, not just current view)
        const itemsInFolder = await Vault.getItemsInFolder(folderId);
        if (itemsInFolder && itemsInFolder.length > 0) {
            return false;
        }

        // Get subfolders
        const subfolders = await Vault.getSubfolders(folderId) || [];

        // Check each subfolder recursively
        for (const subfolder of subfolders) {
            const subEmpty = await this.isFolderTreeEmpty(subfolder.id);
            if (!subEmpty) {
                return false;
            }
        }

        return true;
    },

    /**
     * Get recursive item count for a folder (includes items in all subfolders)
     */
    async getRecursiveItemCount(folderId) {
        if (typeof Vault === 'undefined') return 0;

        let count = 0;

        // Count items in this folder
        const itemsInFolder = await Vault.getItemsInFolder(folderId);
        if (itemsInFolder) {
            count += itemsInFolder.length;
        }

        // Get subfolders and count recursively
        const subfolders = await Vault.getSubfolders(folderId) || [];
        for (const subfolder of subfolders) {
            count += await this.getRecursiveItemCount(subfolder.id);
        }

        return count;
    },

    /**
     * Render cards list
     */
    renderCards() {
        const list = document.getElementById('cardsList');
        const countEl = document.getElementById('cardsCount');
        const emptyState = document.getElementById('emptyState');
        const section = document.getElementById('cardsSection');
        const filterContainer = document.querySelector('.filter-container');

        if (!list) return;

        // Use pre-loaded items from loadData() - already filtered by current folder
        const itemsInFolder = this.items;

        // Update filter chips visibility
        this.updateFilterChips(itemsInFolder);

        // Filter items
        let filteredItems = itemsInFolder;

        // Apply type filter
        if (this.currentFilter !== 'all') {
            filteredItems = filteredItems.filter(i => i.item_type === this.currentFilter);
        }

        // Apply search filter - search across multiple fields (minimum 2 characters)
        if (this.searchQuery && this.searchQuery.length >= 2) {
            filteredItems = filteredItems.filter(item => SearchUtils.matchItem(item, this.searchQuery));
        }

        // Update count
        if (countEl) {
            countEl.textContent = filteredItems.length;
        }

        // Show empty state or cards
        if (filteredItems.length === 0) {
            if (section) section.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (section) section.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        // Sort items
        const sortedItems = this.sortItems(filteredItems);

        // Render cards
        list.innerHTML = sortedItems.map(item => this.renderCard(item)).join('');

        // Initialize card click events
        this.initCardEvents();
    },

    /**
     * Update filter chips visibility based on items in current folder
     * @param {Array} items - Items in current folder
     */
    updateFilterChips(items) {
        const filterContainer = document.querySelector('.filter-container');
        const filterChips = document.getElementById('filterChips');

        if (!filterContainer || !filterChips) return;

        // Count items by type
        const typeCounts = {};
        items.forEach(item => {
            const type = item.item_type;
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        // Get unique types that have items
        const typesWithItems = Object.keys(typeCounts);

        // Hide filter container if 0 or 1 type
        if (typesWithItems.length <= 1) {
            filterContainer.style.display = 'none';
            // Reset to 'all' filter if hidden
            this.currentFilter = 'all';
            return;
        }

        // Show filter container
        filterContainer.style.display = 'block';

        // Update each filter chip visibility
        filterChips.querySelectorAll('.filter-chip').forEach(chip => {
            const filterId = chip.dataset.filter;

            if (filterId === 'all') {
                // Always show "Show all" when filters are visible
                chip.style.display = 'inline-flex';
            } else {
                // Show chip only if it has items
                const hasItems = typeCounts[filterId] > 0;
                chip.style.display = hasItems ? 'inline-flex' : 'none';
            }
        });

        // If current filter has no items, reset to 'all'
        if (this.currentFilter !== 'all' && !typeCounts[this.currentFilter]) {
            this.setFilter('all');
        }
    },

    /**
     * Render a single card
     * @param {Object} item
     * @returns {string}
     */
    renderCard(item) {
        const data = item.data || item.decrypted_data || {};
        const type = item.item_type;

        switch (type) {
            case 'password':
                return this.renderPasswordCard(item, data);
            case 'totp':
                return this.renderTotpCard(item, data);
            case 'note':
                return this.renderNoteCard(item, data);
            case 'website':
                return this.renderWebsiteCard(item, data);
            case 'file':
                return this.renderFileCard(item, data);
            default:
                return this.renderDefaultCard(item, data, type);
        }
    },

    /**
     * Render password card
     */
    renderPasswordCard(item, data) {
        const name = data.name || 'Untitled';
        const username = data.username || '';
        const website = data.website || '';
        const customIcon = data.custom_icon || null;
        const attachedTotp = data.attached_totp || null;

        // Build subtitle with username and/or website
        let subtitleParts = [];
        if (username) {
            subtitleParts.push(`<span class="card-username">${Utils.escapeHtml(username)}</span>`);
        }
        if (website) {
            subtitleParts.push(`<a href="${Utils.escapeHtml(Utils.sanitizeUrl(website))}" class="card-website-link" target="_blank" rel="noopener" data-action="link">${Utils.escapeHtml(this.formatUrl(website))}</a>`);
        }

        // Render icon - custom or default
        const safeIcon = Utils.sanitizeImageSrc(customIcon);
        const iconHtml = safeIcon
            ? `<img src="${safeIcon}" alt="" class="card-icon-image">`
            : Utils.getCardIcon('password');

        // Check for attached TOTP (embedded in password data)
        let inlineTotpHtml = '';
        if (attachedTotp) {
            const secret = attachedTotp.secret || '';
            const period = attachedTotp.period || 30;
            const digits = attachedTotp.digits || 6;
            const algorithm = attachedTotp.algorithm || 'SHA1';

            if (secret) {
                const _sid = SecretStore.store(secret);
                inlineTotpHtml = `<span class="card-inline-totp" data-totp-secret-id="${_sid}" data-totp-period="${Utils.escapeHtml(String(period))}" data-totp-digits="${Utils.escapeHtml(String(digits))}" data-totp-algorithm="${Utils.escapeHtml(algorithm)}"><span class="inline-totp-code">--- ---</span></span>`;
            }
        }

        return `
            <div class="card" data-item-id="${item.id}" data-item-type="password">
                <div class="card-icon password ${customIcon ? 'has-custom-icon' : ''}">
                    ${iconHtml}
                </div>
                <div class="card-info">
                    <span class="card-name">${Utils.escapeHtml(name)}</span>
                    ${subtitleParts.length > 0 || inlineTotpHtml ? `<span class="card-subtitle">${subtitleParts.join(' <span class="card-separator">•</span> ')}${inlineTotpHtml}</span>` : ''}
                </div>
                <div class="card-actions">
                    <button class="card-action-btn card-copy" data-action="copy" title="Copy Password">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    ${this.getCardMenuButton()}
                </div>
            </div>
        `;
    },

    /**
     * Render TOTP card with live countdown
     */
    renderTotpCard(item, data) {
        const issuer = data.issuer || '';
        const label = data.label || '';
        const secret = data.secret || '';
        const period = data.period || 30;
        const digits = data.digits || 6;
        const algorithm = data.algorithm || 'SHA1';

        // Calculate time remaining
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = period - (now % period);
        const isExpiring = timeRemaining <= 5;

        // Build subtitle (issuer first, then account/label)
        let subtitle = '';
        if (issuer && label) {
            subtitle = `${issuer} • ${label}`;
        } else {
            subtitle = issuer || label || '';
        }

        // Render with placeholder - code will be updated by updateTotpCards()
        const _sid = SecretStore.store(secret);
        return `
            <div class="card totp-card ${isExpiring ? 'expiring' : ''}" data-item-id="${item.id}" data-item-type="totp" data-totp-secret-id="${_sid}" data-totp-period="${Utils.escapeHtml(String(period))}" data-totp-digits="${Utils.escapeHtml(String(digits))}" data-totp-algorithm="${Utils.escapeHtml(algorithm)}">
                <div class="card-icon totp">
                    <div class="totp-countdown">
                        <svg viewBox="0 0 36 36" class="totp-ring">
                            <path class="totp-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="totp-ring-progress" stroke-dasharray="${(timeRemaining / period) * 100}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <span class="totp-time">${timeRemaining}</span>
                    </div>
                </div>
                <div class="card-info">
                    <span class="card-name totp-code ${isExpiring ? 'blink' : ''}">--- ---</span>
                    ${subtitle ? `<span class="card-subtitle">${Utils.escapeHtml(subtitle)}</span>` : ''}
                </div>
                <div class="card-actions">
                    <button class="card-action-btn card-copy" data-action="copy" title="Copy Code">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    ${this.getCardMenuButton()}
                </div>
            </div>
        `;
    },

    /**
     * Render note card
     */
    renderNoteCard(item, data) {
        const label = data.label || 'Untitled Note';
        const content = data.content || '';
        // Show preview of content (first 50 chars)
        const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;

        return `
            <div class="card" data-item-id="${item.id}" data-item-type="note">
                <div class="card-icon note">
                    ${Utils.getCardIcon('note')}
                </div>
                <div class="card-info">
                    <span class="card-name">${Utils.escapeHtml(label)}</span>
                    ${preview ? `<span class="card-subtitle card-preview">${Utils.escapeHtml(preview)}</span>` : ''}
                </div>
                <div class="card-actions">
                    <button class="card-action-btn card-copy" data-action="copy" title="Copy Note">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    ${this.getCardMenuButton()}
                </div>
            </div>
        `;
    },

    /**
     * Render website card
     */
    renderWebsiteCard(item, data) {
        const label = data.label || 'Untitled Website';
        const website = data.content || '';
        const customIcon = data.custom_icon || null;

        // Render icon - custom or default
        const safeIcon = Utils.sanitizeImageSrc(customIcon);
        const iconHtml = safeIcon
            ? `<img src="${safeIcon}" alt="" class="card-icon-image">`
            : Utils.getCardIcon('website');

        return `
            <div class="card" data-item-id="${item.id}" data-item-type="website" data-website-url="${Utils.escapeHtml(website)}">
                <div class="card-icon website ${customIcon ? 'has-custom-icon' : ''}">
                    ${iconHtml}
                </div>
                <div class="card-info">
                    <span class="card-name">${Utils.escapeHtml(label)}</span>
                    ${website ? `<span class="card-subtitle">${Utils.escapeHtml(this.formatUrl(website))}</span>` : ''}
                </div>
                <div class="card-actions">
                    <button class="card-action-btn" data-action="open-link" title="Open Website">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </button>
                    ${this.getCardMenuButton()}
                </div>
            </div>
        `;
    },

    /**
     * Render file card
     */
    renderFileCard(item, data) {
        const name = data.name || 'Untitled File';
        const size = Utils.formatFileSize(data.size);
        const fileType = Utils.escapeHtml(this.getFileTypeLabel(data.mime_type, data.original_name));
        const subtitle = fileType ? `${fileType} • ${size}` : size;

        return `
            <div class="card" data-item-id="${item.id}" data-item-type="file">
                <div class="card-icon file">
                    ${Utils.getCardIcon('file')}
                </div>
                <div class="card-info">
                    <span class="card-name">${Utils.escapeHtml(name)}</span>
                    <span class="card-subtitle">${subtitle}</span>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn" data-action="download" title="Download">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                    ${this.getCardMenuButton()}
                </div>
            </div>
        `;
    },

    /**
     * Get human-readable file type label
     * @param {string} mimeType
     * @param {string} originalName
     * @returns {string}
     */
    getFileTypeLabel(mimeType, originalName) {
        // Common MIME type mappings
        const mimeLabels = {
            // Images
            'image/jpeg': 'JPEG',
            'image/jpg': 'JPEG',
            'image/png': 'PNG',
            'image/gif': 'GIF',
            'image/webp': 'WebP',
            'image/svg+xml': 'SVG',
            'image/bmp': 'BMP',
            'image/ico': 'ICO',
            'image/x-icon': 'ICO',
            // Documents
            'application/pdf': 'PDF',
            'application/msword': 'Word',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
            'application/vnd.ms-excel': 'Excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
            'application/vnd.ms-powerpoint': 'PowerPoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
            // Archives
            'application/zip': 'ZIP',
            'application/x-rar-compressed': 'RAR',
            'application/x-7z-compressed': '7Z',
            'application/gzip': 'GZIP',
            'application/x-tar': 'TAR',
            // Code/Text
            'text/plain': 'Text',
            'text/html': 'HTML',
            'text/css': 'CSS',
            'text/javascript': 'JavaScript',
            'application/javascript': 'JavaScript',
            'application/json': 'JSON',
            'application/xml': 'XML',
            'text/xml': 'XML',
            'text/markdown': 'Markdown',
            // Media
            'audio/mpeg': 'MP3',
            'audio/wav': 'WAV',
            'audio/ogg': 'OGG',
            'video/mp4': 'MP4',
            'video/webm': 'WebM',
            'video/quicktime': 'MOV',
            // Other
            'application/octet-stream': null // Generic binary, use extension
        };

        // Check MIME type first
        if (mimeType && mimeLabels[mimeType] !== undefined) {
            if (mimeLabels[mimeType] !== null) {
                return mimeLabels[mimeType];
            }
        }

        // Fall back to MIME type category
        if (mimeType) {
            if (mimeType.startsWith('image/')) return 'Image';
            if (mimeType.startsWith('video/')) return 'Video';
            if (mimeType.startsWith('audio/')) return 'Audio';
            if (mimeType.startsWith('text/')) return 'Text';
        }

        // Fall back to file extension
        if (originalName) {
            const ext = originalName.split('.').pop()?.toUpperCase();
            if (ext && ext.length <= 5) {
                return ext;
            }
        }

        return '';
    },

    /**
     * Render default card (fallback)
     */
    renderDefaultCard(item, data, type) {
        const name = data.name || data.label || 'Untitled';

        return `
            <div class="card" data-item-id="${item.id}" data-item-type="${Utils.escapeHtml(type)}">
                <div class="card-icon ${Utils.escapeHtml(type)}">
                    ${Utils.getCardIcon(type)}
                </div>
                <div class="card-info">
                    <span class="card-name">${Utils.escapeHtml(name)}</span>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn card-copy" data-action="copy" title="Copy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    ${this.getCardMenuButton()}
                </div>
            </div>
        `;
    },

    /**
     * Format URL for display (remove protocol)
     */
    formatUrl(url) {
        if (!url) return '';
        return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    },

    /**
     * Initialize card click events
     */
    initCardEvents() {
        const cards = document.querySelectorAll('.card');

        cards.forEach(card => {
            // Click event
            card.addEventListener('click', (e) => {
                // Handle select mode
                if (this.isSelectMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleSelection('item', card.dataset.itemId);
                    return;
                }

                // Ignore if we just finished dragging
                if (this.dragState.justDragged) {
                    this.dragState.justDragged = false;
                    return;
                }

                const action = e.target.closest('[data-action]');
                if (action) {
                    const actionType = action.dataset.action;
                    // Allow links to work normally
                    if (actionType === 'link') {
                        e.stopPropagation();
                        return; // Let the default link behavior happen
                    }
                    e.stopPropagation();
                    e.preventDefault();
                    this.handleCardAction(card.dataset.itemId, actionType, action);
                    return;
                }

                // Website card: open URL in new tab
                if (card.dataset.itemType === 'website') {
                    const url = Utils.sanitizeUrl(card.dataset.websiteUrl);
                    if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                        return;
                    }
                }

                // TOTP card: not clickable (no view page)
                if (card.dataset.itemType === 'totp') {
                    return;
                }

                // File card: show preview instead of view page
                if (card.dataset.itemType === 'file') {
                    const item = this.items.find(i => i.id === card.dataset.itemId);
                    if (item) {
                        this.showFilePreview(item);
                    }
                    return;
                }

                // Open card in VIEW mode
                this.openCard(card.dataset.itemId);
            });

            // Drag events - mouse
            card.addEventListener('mousedown', (e) => this.handleDragStart(e, card));

            // Drag events - touch (long press)
            card.addEventListener('touchstart', (e) => this.handleTouchStart(e, card), { passive: false });
            card.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            card.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        });

        // Global mouse events for drag (bind once)
        if (!this.dragState.globalListenersBound) {
            this.dragState.globalListenersBound = true;
            document.addEventListener('mousemove', (e) => this.handleDragMove(e));
            document.addEventListener('mouseup', (e) => this.handleDragEnd(e));
        }

        // Start TOTP timer and update immediately
        this.startTotpTimer();
        this.updateTotpCards(); // Initial update
    },

    /**
     * Handle touch start (for long press drag)
     */
    handleTouchStart(e, card) {
        // Only allow drag in custom sort mode
        if (!this.isDragEnabled()) return;

        // Don't start drag if touching action buttons
        if (e.target.closest('[data-action]') || e.target.closest('.card-actions')) {
            return;
        }

        const touch = e.touches[0];
        this.dragState.startY = touch.clientY;
        this.dragState.startX = touch.clientX;

        // Long press to initiate drag (300ms)
        this.dragState.longPressTimer = setTimeout(() => {
            this.startDrag(card, touch.clientY);
            // Haptic feedback on mobile if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 300);
    },

    /**
     * Handle touch move
     */
    handleTouchMove(e) {
        const touch = e.touches[0];

        // Cancel long press if moved too much before drag started
        if (!this.dragState.isDragging && this.dragState.longPressTimer) {
            const dx = Math.abs(touch.clientX - this.dragState.startX);
            const dy = Math.abs(touch.clientY - this.dragState.startY);
            if (dx > 10 || dy > 10) {
                clearTimeout(this.dragState.longPressTimer);
                this.dragState.longPressTimer = null;
            }
        }

        if (this.dragState.isDragging) {
            e.preventDefault();
            this.moveDrag(touch.clientY);
        }
    },

    /**
     * Handle touch end
     */
    handleTouchEnd(e) {
        // Clear long press timer
        if (this.dragState.longPressTimer) {
            clearTimeout(this.dragState.longPressTimer);
            this.dragState.longPressTimer = null;
        }

        if (this.dragState.isDragging) {
            this.endDrag();
        }
    },

    /**
     * Handle drag start (mouse)
     */
    handleDragStart(e, card) {
        // Only allow drag in custom sort mode
        if (!this.isDragEnabled()) return;

        // Only left click
        if (e.button !== 0) return;

        // Don't start drag if clicking action buttons
        if (e.target.closest('[data-action]') || e.target.closest('.card-actions')) {
            return;
        }

        this.dragState.startY = e.clientY;
        this.dragState.startX = e.clientX;
        this.dragState.pendingCard = card;

        // We'll start actual drag after moving a bit (to distinguish from click)
    },

    /**
     * Handle drag move (mouse)
     */
    handleDragMove(e) {
        // Check if we should start dragging (mouse moved enough)
        if (this.dragState.pendingCard && !this.dragState.isDragging) {
            const dy = Math.abs(e.clientY - this.dragState.startY);
            if (dy > 5) {
                this.startDrag(this.dragState.pendingCard, e.clientY);
                this.dragState.pendingCard = null;
            }
            return;
        }

        if (this.dragState.isDragging) {
            e.preventDefault();
            this.moveDrag(e.clientY);
        }
    },

    /**
     * Handle drag end (mouse)
     */
    handleDragEnd(e) {
        this.dragState.pendingCard = null;

        if (this.dragState.isDragging) {
            this.endDrag();
        }
    },

    /**
     * Start dragging a card
     */
    startDrag(card, clientY) {
        const list = document.getElementById('cardsList');
        if (!list) return;

        const cards = Array.from(list.querySelectorAll('.card'));
        const cardIndex = cards.indexOf(card);
        if (cardIndex === -1) return;

        this.dragState.isDragging = true;
        this.dragState.draggedCard = card;
        this.dragState.draggedItemId = card.dataset.itemId;
        this.dragState.startIndex = cardIndex;
        this.dragState.currentY = clientY;

        // Get card dimensions
        const rect = card.getBoundingClientRect();
        this.dragState.cardHeight = rect.height;
        this.dragState.cardTop = rect.top;
        this.dragState.offsetY = clientY - rect.top;

        // Create placeholder
        this.dragState.placeholder = document.createElement('div');
        this.dragState.placeholder.className = 'card-placeholder';
        this.dragState.placeholder.style.height = rect.height + 'px';

        // Style the dragged card
        card.classList.add('dragging');
        card.style.width = rect.width + 'px';
        card.style.height = rect.height + 'px';
        card.style.position = 'fixed';
        card.style.top = rect.top + 'px';
        card.style.left = rect.left + 'px';
        card.style.zIndex = '9999';
        card.style.pointerEvents = 'none';

        // Insert placeholder
        card.parentNode.insertBefore(this.dragState.placeholder, card);

        // Add dragging class to list
        list.classList.add('is-dragging');

        // Prevent text selection
        document.body.style.userSelect = 'none';
    },

    /**
     * Move dragged card
     */
    moveDrag(clientY) {
        if (!this.dragState.isDragging || !this.dragState.draggedCard) return;

        const card = this.dragState.draggedCard;
        const placeholder = this.dragState.placeholder;
        const list = document.getElementById('cardsList');

        // Move card visually
        const newTop = clientY - this.dragState.offsetY;
        card.style.top = newTop + 'px';

        // Auto-scroll when near edges
        this.handleAutoScroll(clientY);

        // Find where to insert placeholder
        const cards = Array.from(list.querySelectorAll('.card:not(.dragging)'));
        let insertBefore = null;

        for (const otherCard of cards) {
            const rect = otherCard.getBoundingClientRect();
            const cardMiddle = rect.top + rect.height / 2;

            if (clientY < cardMiddle) {
                insertBefore = otherCard;
                break;
            }
        }

        // Move placeholder
        if (insertBefore) {
            if (placeholder.nextSibling !== insertBefore) {
                list.insertBefore(placeholder, insertBefore);
            }
        } else {
            // Insert at end (but before dragged card)
            const lastCard = cards[cards.length - 1];
            if (lastCard && placeholder !== lastCard.nextSibling) {
                list.insertBefore(placeholder, lastCard.nextSibling);
            }
        }
    },

    /**
     * Handle auto-scroll when dragging near edges
     */
    handleAutoScroll(clientY) {
        const scrollThreshold = 80;
        const scrollSpeed = 10;
        const container = document.querySelector('.page-content') || document.documentElement;
        const rect = container.getBoundingClientRect ? container.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };

        // Clear existing scroll interval
        if (this.dragState.scrollInterval) {
            clearInterval(this.dragState.scrollInterval);
            this.dragState.scrollInterval = null;
        }

        // Scroll up
        if (clientY < rect.top + scrollThreshold) {
            this.dragState.scrollInterval = setInterval(() => {
                container.scrollTop -= scrollSpeed;
            }, 16);
        }
        // Scroll down
        else if (clientY > rect.bottom - scrollThreshold) {
            this.dragState.scrollInterval = setInterval(() => {
                container.scrollTop += scrollSpeed;
            }, 16);
        }
    },

    /**
     * End drag operation
     */
    endDrag() {
        if (!this.dragState.isDragging) return;

        // Clear auto-scroll
        if (this.dragState.scrollInterval) {
            clearInterval(this.dragState.scrollInterval);
            this.dragState.scrollInterval = null;
        }

        const card = this.dragState.draggedCard;
        const placeholder = this.dragState.placeholder;
        const list = document.getElementById('cardsList');

        if (card && placeholder && list) {
            // Get new position
            const cards = Array.from(list.querySelectorAll('.card:not(.dragging)'));
            const placeholderIndex = Array.from(list.children).indexOf(placeholder);

            // Reset card styles
            card.classList.remove('dragging');
            card.style.position = '';
            card.style.top = '';
            card.style.left = '';
            card.style.width = '';
            card.style.height = '';
            card.style.zIndex = '';
            card.style.pointerEvents = '';

            // Insert card at placeholder position
            list.insertBefore(card, placeholder);

            // Remove placeholder
            placeholder.remove();

            // Remove dragging class from list
            list.classList.remove('is-dragging');

            // Calculate new order and save
            this.saveNewOrder();

            // Set flag to prevent click from firing
            this.dragState.justDragged = true;
            // Clear justDragged flag after a short delay
            setTimeout(() => {
                this.dragState.justDragged = false;
            }, 300);
        }

        // Reset drag state
        this.dragState.isDragging = false;
        this.dragState.draggedCard = null;
        this.dragState.draggedItemId = null;
        this.dragState.placeholder = null;

        // Re-enable text selection
        document.body.style.userSelect = '';
    },

    /**
     * Save new card order after drag
     */
    async saveNewOrder() {
        const list = document.getElementById('cardsList');
        if (!list) return;

        const cards = Array.from(list.querySelectorAll('.card'));
        const newOrder = cards.map((card, index) => ({
            id: card.dataset.itemId,
            sort_order: index
        }));

        // Update local items array order
        const orderMap = new Map(newOrder.map(item => [item.id, item.sort_order]));
        this.items.sort((a, b) => {
            const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : 999;
            const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : 999;
            return orderA - orderB;
        });

        // Save to vault
        try {
            if (typeof Vault !== 'undefined' && Vault.updateItemsOrder) {
                await Vault.updateItemsOrder(newOrder);
            }
        } catch (error) {
            console.error('Failed to save new order:', error);
            Toast.error('Failed to save order');
        }
    },

    // ==========================================
    // Folder Drag and Drop
    // ==========================================

    /**
     * Handle folder touch start (for long press drag)
     */
    handleFolderTouchStart(e, folder) {
        // Only allow drag in custom sort mode
        if (!this.isDragEnabled()) return;

        if (e.target.closest('.folder-menu-btn')) return;

        const touch = e.touches[0];
        this.folderDragState.startY = touch.clientY;
        this.folderDragState.startX = touch.clientX;

        this.folderDragState.longPressTimer = setTimeout(() => {
            this.startFolderDrag(folder, touch.clientX, touch.clientY);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 300);
    },

    /**
     * Handle folder touch move
     */
    handleFolderTouchMove(e) {
        const touch = e.touches[0];

        if (!this.folderDragState.isDragging && this.folderDragState.longPressTimer) {
            const dx = Math.abs(touch.clientX - this.folderDragState.startX);
            const dy = Math.abs(touch.clientY - this.folderDragState.startY);
            if (dx > 10 || dy > 10) {
                clearTimeout(this.folderDragState.longPressTimer);
                this.folderDragState.longPressTimer = null;
            }
        }

        if (this.folderDragState.isDragging) {
            e.preventDefault();
            this.moveFolderDrag(touch.clientX, touch.clientY);
        }
    },

    /**
     * Handle folder touch end
     */
    handleFolderTouchEnd(e) {
        if (this.folderDragState.longPressTimer) {
            clearTimeout(this.folderDragState.longPressTimer);
            this.folderDragState.longPressTimer = null;
        }

        if (this.folderDragState.isDragging) {
            this.endFolderDrag();
        }
    },

    /**
     * Handle folder drag start (mouse)
     */
    handleFolderDragStart(e, folder) {
        // Only allow drag in custom sort mode
        if (!this.isDragEnabled()) return;

        if (e.button !== 0) return;
        if (e.target.closest('.folder-menu-btn')) return;

        this.folderDragState.startX = e.clientX;
        this.folderDragState.startY = e.clientY;
        this.folderDragState.pendingFolder = folder;
    },

    /**
     * Handle folder drag move (mouse)
     */
    handleFolderDragMove(e) {
        if (this.folderDragState.pendingFolder && !this.folderDragState.isDragging) {
            const dx = Math.abs(e.clientX - this.folderDragState.startX);
            const dy = Math.abs(e.clientY - this.folderDragState.startY);
            if (dx > 5 || dy > 5) {
                this.startFolderDrag(this.folderDragState.pendingFolder, e.clientX, e.clientY);
                this.folderDragState.pendingFolder = null;
            }
            return;
        }

        if (this.folderDragState.isDragging) {
            e.preventDefault();
            this.moveFolderDrag(e.clientX, e.clientY);
        }
    },

    /**
     * Handle folder drag end (mouse)
     */
    handleFolderDragEnd(e) {
        this.folderDragState.pendingFolder = null;
        if (this.folderDragState.isDragging) {
            this.endFolderDrag();
        }
    },

    /**
     * Start dragging a folder
     */
    startFolderDrag(folderEl, clientX, clientY) {
        const grid = document.getElementById('foldersGrid');
        if (!grid) return;

        const folders = Array.from(grid.querySelectorAll('.folder-card'));
        const folderIndex = folders.indexOf(folderEl);
        if (folderIndex === -1) return;

        this.folderDragState.isDragging = true;
        this.folderDragState.draggedFolder = folderEl;
        this.folderDragState.draggedFolderId = folderEl.dataset.folderId;

        const rect = folderEl.getBoundingClientRect();
        this.folderDragState.offsetX = clientX - rect.left;
        this.folderDragState.offsetY = clientY - rect.top;

        // Create placeholder
        this.folderDragState.placeholder = document.createElement('div');
        this.folderDragState.placeholder.className = 'folder-placeholder';
        this.folderDragState.placeholder.style.width = rect.width + 'px';
        this.folderDragState.placeholder.style.height = rect.height + 'px';

        // Style dragged folder
        folderEl.classList.add('dragging');
        folderEl.style.width = rect.width + 'px';
        folderEl.style.height = rect.height + 'px';
        folderEl.style.position = 'fixed';
        folderEl.style.top = rect.top + 'px';
        folderEl.style.left = rect.left + 'px';
        folderEl.style.zIndex = '9999';
        folderEl.style.pointerEvents = 'none';

        folderEl.parentNode.insertBefore(this.folderDragState.placeholder, folderEl);
        grid.classList.add('is-dragging');
        document.body.style.userSelect = 'none';
    },

    /**
     * Move dragged folder
     */
    moveFolderDrag(clientX, clientY) {
        if (!this.folderDragState.isDragging || !this.folderDragState.draggedFolder) return;

        const folder = this.folderDragState.draggedFolder;
        const placeholder = this.folderDragState.placeholder;
        const grid = document.getElementById('foldersGrid');

        // Move the dragged folder with cursor
        folder.style.top = (clientY - this.folderDragState.offsetY) + 'px';
        folder.style.left = (clientX - this.folderDragState.offsetX) + 'px';

        const folders = Array.from(grid.querySelectorAll('.folder-card:not(.dragging)'));
        if (folders.length === 0) return;

        // Get positions of all folders
        const positions = folders.map(f => {
            const rect = f.getBoundingClientRect();
            return {
                element: f,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2
            };
        });

        // Find the best insertion point
        let insertBefore = null;

        // First, find folders on the same row as cursor (within vertical bounds)
        const sameRowFolders = positions
            .filter(p => clientY >= p.top - 10 && clientY <= p.bottom + 10)
            .sort((a, b) => a.left - b.left); // Sort by X position (left to right)

        if (sameRowFolders.length > 0) {
            // On the same row - find by horizontal position
            for (const pos of sameRowFolders) {
                if (clientX < pos.centerX) {
                    insertBefore = pos.element;
                    break;
                }
            }
            // If cursor is after all folders on this row, insertBefore stays null (append)
        } else {
            // Not on any row - find the first folder that starts below cursor
            for (const pos of positions) {
                if (pos.top > clientY) {
                    insertBefore = pos.element;
                    break;
                }
            }
        }

        // Move placeholder
        if (insertBefore) {
            if (placeholder.nextSibling !== insertBefore) {
                grid.insertBefore(placeholder, insertBefore);
            }
        } else {
            // Append to end
            if (placeholder !== grid.lastElementChild) {
                grid.appendChild(placeholder);
            }
        }
    },

    /**
     * End folder drag
     */
    endFolderDrag() {
        if (!this.folderDragState.isDragging) return;

        if (this.folderDragState.scrollInterval) {
            clearInterval(this.folderDragState.scrollInterval);
            this.folderDragState.scrollInterval = null;
        }

        const folder = this.folderDragState.draggedFolder;
        const placeholder = this.folderDragState.placeholder;
        const grid = document.getElementById('foldersGrid');

        if (folder && placeholder && grid) {
            folder.classList.remove('dragging');
            folder.style.position = '';
            folder.style.top = '';
            folder.style.left = '';
            folder.style.width = '';
            folder.style.height = '';
            folder.style.zIndex = '';
            folder.style.pointerEvents = '';

            grid.insertBefore(folder, placeholder);
            placeholder.remove();
            grid.classList.remove('is-dragging');

            this.saveFolderOrder();
            this.folderDragState.justDragged = true;
            // Clear justDragged flag after a short delay
            setTimeout(() => {
                this.folderDragState.justDragged = false;
            }, 300);
        }

        this.folderDragState.isDragging = false;
        this.folderDragState.draggedFolder = null;
        this.folderDragState.draggedFolderId = null;
        this.folderDragState.placeholder = null;
        document.body.style.userSelect = '';
    },

    /**
     * Save folder order after drag
     */
    async saveFolderOrder() {
        const grid = document.getElementById('foldersGrid');
        if (!grid) return;

        const folderCards = Array.from(grid.querySelectorAll('.folder-card'));
        const newOrder = folderCards.map((card, index) => ({
            id: card.dataset.folderId,
            sort_order: index
        }));

        // Update local folders array order
        const orderMap = new Map(newOrder.map(item => [item.id, item.sort_order]));
        this.folders.sort((a, b) => {
            const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : 999;
            const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : 999;
            return orderA - orderB;
        });

        try {
            if (typeof Vault !== 'undefined' && Vault.updateFoldersOrder) {
                await Vault.updateFoldersOrder(newOrder);
            }
        } catch (error) {
            console.error('Failed to save folder order:', error);
            Toast.error('Failed to save order');
        }
    },

    /**
     * Start TOTP countdown timer
     */
    startTotpTimer() {
        // Clear any existing timer
        if (this.totpTimer) {
            clearInterval(this.totpTimer);
        }

        // Update every second
        this.totpTimer = setInterval(() => {
            this.updateTotpCards();
        }, 1000);
    },

    /**
     * Stop TOTP countdown timer
     */
    stopTotpTimer() {
        if (this.totpTimer) {
            clearInterval(this.totpTimer);
            this.totpTimer = null;
        }
    },

    /**
     * Update all TOTP cards with current codes and countdown
     */
    async updateTotpCards() {
        const totpCards = document.querySelectorAll('.totp-card');

        for (const card of totpCards) {
            const secret = SecretStore.get(card.dataset.totpSecretId);
            const period = parseInt(card.dataset.totpPeriod) || 30;
            const digits = parseInt(card.dataset.totpDigits) || 6;
            const algorithm = card.dataset.totpAlgorithm || 'SHA1';

            if (!secret) continue;

            // Calculate time remaining
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = period - (now % period);
            const isExpiring = timeRemaining <= 5;

            // Generate code (async)
            let code = '------';
            if (typeof TOTPGenerator !== 'undefined') {
                try {
                    code = await TOTPGenerator.generate(secret, { algorithm, digits, period });
                } catch (e) {
                    console.error('TOTP generation error:', e);
                }
            }

            // Format code with space
            const formattedCode = code.length === 6 ?
                code.substring(0, 3) + ' ' + code.substring(3) : code;

            // Update the card
            const codeEl = card.querySelector('.totp-code');
            const timeEl = card.querySelector('.totp-time');
            const progressEl = card.querySelector('.totp-ring-progress');

            if (codeEl) {
                codeEl.textContent = formattedCode;
                codeEl.classList.toggle('blink', isExpiring);
            }

            if (timeEl) {
                timeEl.textContent = timeRemaining;
            }

            if (progressEl) {
                progressEl.setAttribute('stroke-dasharray', `${(timeRemaining / period) * 100}, 100`);
            }

            // Toggle expiring class on card
            card.classList.toggle('expiring', isExpiring);
        }

        // Update inline TOTP codes in password cards
        const inlineTotps = document.querySelectorAll('.card-inline-totp');

        for (const inlineTotp of inlineTotps) {
            const secret = SecretStore.get(inlineTotp.dataset.totpSecretId);
            const period = parseInt(inlineTotp.dataset.totpPeriod) || 30;
            const digits = parseInt(inlineTotp.dataset.totpDigits) || 6;
            const algorithm = inlineTotp.dataset.totpAlgorithm || 'SHA1';

            if (!secret) continue;

            // Calculate time remaining
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = period - (now % period);
            const isExpiring = timeRemaining <= 5;

            // Generate code (async)
            let code = '------';
            if (typeof TOTPGenerator !== 'undefined') {
                try {
                    code = await TOTPGenerator.generate(secret, { algorithm, digits, period });
                } catch (e) {
                    console.error('TOTP generation error:', e);
                }
            }

            // Format code with space
            const formattedCode = code.length === 6 ?
                code.substring(0, 3) + ' ' + code.substring(3) : code;

            // Update the inline code
            const codeEl = inlineTotp.querySelector('.inline-totp-code');
            if (codeEl) {
                codeEl.textContent = formattedCode;
                codeEl.classList.toggle('blink', isExpiring);
            }
        }
    },

    /**
     * Handle card action
     * @param {string} itemId
     * @param {string} action
     * @param {HTMLElement} btn - optional button element for menu positioning
     */
    async handleCardAction(itemId, action, btn) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        switch (action) {
            case 'copy':
                await this.copyItemToClipboard(item);
                break;
            case 'edit':
                this.editItem(item);
                break;
            case 'delete':
                this.deleteItem(item);
                break;
            case 'favorite':
                this.toggleFavorite(item);
                break;
            case 'menu':
                this.showCardMenu(item, btn);
                break;
            case 'download':
                await this.downloadFile(item);
                break;
            case 'open-link':
                this.openWebsiteLink(item);
                break;
        }
    },

    /**
     * Open website link in new tab
     * @param {Object} item
     */
    openWebsiteLink(item) {
        const data = item.data || item.decrypted_data || {};
        const raw = data.content || '';

        if (raw) {
            const url = Utils.sanitizeUrl(raw);
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        }
    },

    /**
     * Copy item data to clipboard
     * @param {Object} item
     */
    async copyItemToClipboard(item) {
        const data = item.data || item.decrypted_data || {};
        let textToCopy = '';

        switch (item.item_type) {
            case 'password':
                textToCopy = data.password || '';
                break;
            case 'totp':
                // Generate current TOTP code (async)
                if (typeof TOTPGenerator !== 'undefined' && data.secret) {
                    try {
                        textToCopy = await TOTPGenerator.generate(data.secret, {
                            algorithm: data.algorithm,
                            digits: data.digits,
                            period: data.period
                        });
                    } catch (e) {
                        console.error('TOTP generation error:', e);
                    }
                }
                break;
            case 'note':
                textToCopy = data.content || '';
                break;
            case 'website':
                textToCopy = data.content || '';
                break;
        }

        if (textToCopy) {
            const success = await Clipboard.copy(textToCopy, true);
            if (success) {
                Toast.success('Copied to clipboard');
            } else {
                Toast.error('Failed to copy');
            }
        }
    },

    /**
     * Open card in VIEW mode
     * @param {string} itemId
     */
    openCard(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            // Dispatch event to open VIEW mode (not edit mode)
            window.dispatchEvent(new CustomEvent('viewitem', { detail: { item } }));
        }
    },

    /**
     * Edit item
     * @param {Object} item
     */
    editItem(item) {
        // For file items, show a simple name-edit popup instead of full edit page
        if (item.item_type === 'file') {
            this.showEditFileNamePopup(item);
            return;
        }
        window.dispatchEvent(new CustomEvent('edititem', { detail: { item } }));
    },

    /**
     * Show popup to edit file name
     * @param {Object} item
     */
    showEditFileNamePopup(item) {
        const data = item.data || item.decrypted_data || {};
        const currentName = data.name || '';

        const save = async (api) => {
            const newName = api.querySelector('#fileNameInput').value.trim();
            if (!newName) {
                Toast.error('Name is required');
                return false;
            }

            try {
                const updatedData = { ...data, name: newName };
                await Vault.updateItem(item.id, updatedData, item.folder_id);

                item.data = updatedData;
                item.decrypted_data = updatedData;

                this.renderCards();
                Toast.success('File renamed');
                return true;
            } catch (error) {
                console.error('Failed to rename file:', error);
                Toast.error('Failed to rename file');
                return false;
            }
        };

        const popup = Popup.open({
            title: 'Edit File Name',
            body: `
                <div class="form-group">
                    <label class="form-label" for="fileNameInput">Name</label>
                    <input type="text" class="form-input" id="fileNameInput" value="${Utils.escapeHtml(currentName)}" placeholder="File name" autocomplete="off">
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                { text: 'Save', type: 'primary', id: 'saveBtn', onClick: () => save(popup) }
            ],
            onOpen: (api) => {
                const input = api.querySelector('#fileNameInput');
                input.select();
                input.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter') {
                        if (await save(api)) {
                            api.forceClose();
                        }
                    }
                });
            }
        });
    },

    /**
     * Show file preview popup
     * @param {Object} item
     */
    async showFilePreview(item) {
        const data = item.data || item.decrypted_data || {};
        const mimeType = data.mime_type || '';
        const originalName = data.original_name || data.name || 'file';
        const fileSize = data.size || 0;

        // Max preview size: 5MB
        const maxPreviewSize = 5 * 1024 * 1024;

        // Determine if file is previewable
        const isImage = mimeType.startsWith('image/');
        const isPdf = mimeType === 'application/pdf';
        const isAudio = mimeType.startsWith('audio/');
        const isText = mimeType.startsWith('text/') ||
                       mimeType === 'application/json' ||
                       mimeType === 'application/javascript' ||
                       mimeType === 'application/xml';

        const canPreview = (isImage || isPdf || isAudio || isText) && fileSize <= maxPreviewSize;

        // Create popup
        const popup = document.createElement('div');
        popup.className = 'popup-overlay';

        if (!canPreview) {
            // Show message that preview is not available
            let reason = 'Preview not available for this file type.';
            if (fileSize > maxPreviewSize) {
                reason = 'File is too large to preview (max 5MB).';
            }

            popup.innerHTML = `
                <div class="popup file-preview-popup">
                    <div class="popup-header">
                        <h3 class="popup-title">${Utils.escapeHtml(data.name || originalName)}</h3>
                        <button class="popup-close" id="popupClose">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="popup-body file-preview-body">
                        <div class="file-preview-unavailable">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <p>${reason}</p>
                            <p class="file-preview-info">${Utils.escapeHtml(originalName)} (${Utils.formatFileSize(fileSize)})</p>
                        </div>
                    </div>
                    <div class="popup-footer">
                        <button class="btn btn-primary" id="downloadBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(popup);
            requestAnimationFrame(() => popup.classList.add('active'));

            const close = () => {
                popup.classList.remove('active');
                setTimeout(() => popup.remove(), 300);
            };

            document.getElementById('popupClose').addEventListener('click', close);
            document.getElementById('downloadBtn').addEventListener('click', () => {
                this.downloadFile(item);
                close();
            });
                        return;
        }

        // Show loading state
        const sizeClass = isAudio ? 'file-preview-popup-medium' : 'file-preview-popup-large';
        popup.innerHTML = `
            <div class="popup file-preview-popup ${sizeClass}">
                <div class="popup-header">
                    <h3 class="popup-title">${Utils.escapeHtml(data.name || originalName)}</h3>
                    <button class="popup-close" id="popupClose">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="popup-body file-preview-body">
                    <div class="file-preview-loading">
                        <div class="spinner"></div>
                        <p>Loading preview...</p>
                    </div>
                </div>
                <div class="popup-footer">
                    <button class="btn btn-primary" id="downloadBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        requestAnimationFrame(() => popup.classList.add('active'));

        const close = () => {
            popup.classList.remove('active');
            // Revoke any object URLs (audio, pdf) before removing
            const audio = popup.querySelector('audio[src]');
            if (audio) URL.revokeObjectURL(audio.src);
            const iframe = popup.querySelector('iframe[src]');
            if (iframe) URL.revokeObjectURL(iframe.src);
            setTimeout(() => popup.remove(), 300);
        };

        document.getElementById('popupClose').addEventListener('click', close);
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadFile(item);
        });

        // Load and display preview
        try {
            const result = await Vault.downloadFile(item.id);
            if (!result || !result.content) {
                throw new Error('File content not available');
            }

            const previewBody = popup.querySelector('.file-preview-body');

            if (isImage) {
                const blob = new Blob([result.content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                previewBody.innerHTML = `
                    <div class="file-preview-image">
                        <img src="${url}" alt="${Utils.escapeHtml(originalName)}" onload="window.URL.revokeObjectURL(this.src)">
                    </div>
                `;
            } else if (isPdf) {
                const blob = new Blob([result.content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                previewBody.innerHTML = `
                    <div class="file-preview-pdf">
                        <iframe src="${url}" type="application/pdf"></iframe>
                    </div>
                `;
            } else if (isAudio) {
                const blob = new Blob([result.content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                previewBody.innerHTML = `
                    <div class="file-preview-audio">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                        </svg>
                        <audio controls src="${url}" preload="metadata"></audio>
                    </div>
                `;
            } else if (isText) {
                const decoder = new TextDecoder('utf-8');
                const text = decoder.decode(result.content);
                // Limit text preview to 50000 characters
                const displayText = text.length > 50000 ? text.substring(0, 50000) + '\n\n... (truncated)' : text;
                previewBody.innerHTML = `
                    <div class="file-preview-text">
                        <pre>${Utils.escapeHtml(displayText)}</pre>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load preview:', error);
            const previewBody = popup.querySelector('.file-preview-body');
            previewBody.innerHTML = `
                <div class="file-preview-unavailable">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <p>Failed to load preview</p>
                </div>
            `;
        }
    },

    /**
     * Delete item
     * @param {Object} item
     */
    async deleteItem(item) {
        const data = item.data || item.decrypted_data || {};
        const confirmed = await this.showConfirmPopup(
            'Delete Item',
            `Are you sure you want to delete "${data.name || data.label || 'this item'}"?`
        );

        if (confirmed) {
            try {
                if (typeof Vault !== 'undefined') {
                    await Vault.softDeleteItem(item.id);
                } else {
                    // Only use API if not in local mode
                    const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';
                    if (isLocalMode) {
                        throw new Error('Cannot delete items without Vault in local mode');
                    }
                    await ApiClient.deleteItem(item.id);
                }
                this.items = this.items.filter(i => i.id !== item.id);
                this.renderCards();
                Toast.success('Item deleted');
            } catch (error) {
                Toast.error('Failed to delete item');
            }
        }
    },

    /**
     * Toggle favorite status
     * @param {Object} item
     */
    async toggleFavorite(item) {
        // For now, just show a toast. Implement favorite functionality later
        Toast.info('Favorites coming soon');
    },

    /**
     * Download file for file type items
     * @param {Object} item
     */
    async downloadFile(item) {
        if (item.item_type !== 'file') {
            Toast.error('Item is not a file');
            return;
        }

        try {
            const result = await Vault.downloadFile(item.id);

            // Get filename with proper extension
            const data = item.data || item.decrypted_data || {};
            const originalName = result.metadata?.original_name || data.original_name;
            const filename = this.getDownloadFilename(data.name, originalName);
            const mimeType = result.metadata?.mime_type || data.mime_type || 'application/octet-stream';

            // Create blob and trigger download
            const blob = new Blob([result.content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Toast.success('File downloaded');
        } catch (error) {
            console.error('Download error:', error);
            Toast.error('Download failed');
        }
    },

    /**
     * Get download filename with proper extension
     * @param {string} name - User-defined name
     * @param {string} originalName - Original filename with extension
     * @returns {string}
     */
    getDownloadFilename(name, originalName) {
        const extMatch = originalName?.match(/\.[^/.]+$/);
        const extension = extMatch ? extMatch[0] : '';
        const baseName = name || originalName || 'download';

        if (extension && !baseName.toLowerCase().endsWith(extension.toLowerCase())) {
            return baseName + extension;
        }
        return baseName;
    },

    /**
     * Get card menu button HTML
     * @returns {string}
     */
    getCardMenuButton() {
        return `
            <button class="card-action-btn card-menu-btn" data-action="menu" title="More options">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="12" cy="5" r="1"></circle>
                    <circle cx="12" cy="19" r="1"></circle>
                </svg>
            </button>
        `;
    },

    /**
     * Show card action menu
     * @param {Object} item
     * @param {HTMLElement} btn - optional button element for positioning
     */
    showCardMenu(item, btn) {
        // Toggle - if already open, just close it
        if (DropdownManager.isOpen('card-menu')) {
            DropdownManager.close('card-menu');
            return;
        }

        // Build menu items - exclude View for TOTP, File, and Website cards
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

        // Duplicate only for password and note cards
        const showDuplicate = item.item_type === 'password' || item.item_type === 'note';
        const duplicateButton = showDuplicate ? `
            <button class="card-action-item" data-action="duplicate">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Duplicate</span>
            </button>
        ` : '';

        // Move button (not for file items in offline mode)
        const canMove = !(item.item_type === 'file' && Vault.isOffline());
        const moveButton = canMove ? `
            <button class="card-action-item" data-action="move">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 9l-3 3 3 3"></path>
                    <path d="M9 5l3-3 3 3"></path>
                    <path d="M15 19l3 3 3-3"></path>
                    <path d="M19 9l3 3-3 3"></path>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <line x1="12" y1="2" x2="12" y2="22"></line>
                </svg>
                <span>Move</span>
            </button>
        ` : '';

        // Create dropdown menu
        const menu = document.createElement('div');
        menu.className = 'card-action-menu';
        menu.id = 'cardActionMenu';
        menu.innerHTML = `
            ${viewButton}
            <button class="card-action-item" data-action="edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Edit</span>
            </button>
            ${duplicateButton}
            ${moveButton}
            <button class="card-action-item" data-action="select">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <span>Select</span>
            </button>
            <button class="card-action-item card-action-danger" data-action="delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Delete</span>
            </button>
        `;

        // Position the menu
        document.body.appendChild(menu);

        if (btn) {
            const btnRect = btn.getBoundingClientRect();
            const menuHeight = menu.offsetHeight || 180; // Approximate height if not yet rendered
            const spaceBelow = window.innerHeight - btnRect.bottom;
            const spaceAbove = btnRect.top;

            menu.style.position = 'fixed';
            menu.style.right = (window.innerWidth - btnRect.right) + 'px';

            // Check if menu would overflow at bottom
            if (spaceBelow < menuHeight + 8 && spaceAbove > spaceBelow) {
                // Position above the button
                menu.style.bottom = (window.innerHeight - btnRect.top + 4) + 'px';
                menu.style.top = 'auto';
            } else {
                // Position below the button
                menu.style.top = (btnRect.bottom + 4) + 'px';
                menu.style.bottom = 'auto';
            }
        }

        requestAnimationFrame(() => menu.classList.add('open'));

        // Register with DropdownManager (closes all others first)
        DropdownManager.open('card-menu', {
            element: menu,
            trigger: btn,
            onClose: () => {
                menu.classList.remove('open');
                setTimeout(() => menu.remove(), 150);
            }
        });

        // Bind actions
        menu.querySelectorAll('.card-action-item').forEach(menuItem => {
            menuItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = menuItem.dataset.action;

                this.closeCardMenu();

                switch (action) {
                    case 'view':
                        this.openCard(item.id);
                        break;
                    case 'edit':
                        this.editItem(item);
                        break;
                    case 'duplicate':
                        await this.duplicateItem(item);
                        break;
                    case 'move':
                        await this.showMoveItemPopup(item);
                        break;
                    case 'select':
                        this.enterSelectMode('item', item.id);
                        break;
                    case 'delete':
                        await this.deleteItemWithConfirm(item);
                        break;
                }
            });
        });
    },

    /**
     * Close card action menu
     */
    closeCardMenu() {
        DropdownManager.close('card-menu');
    },

    /**
     * Show sort menu
     * @param {HTMLElement} btn - The sort button element
     */
    showSortMenu(btn) {
        // Toggle - if already open, just close it
        if (DropdownManager.isOpen('sort-menu')) {
            DropdownManager.close('sort-menu');
            return;
        }

        // Create dropdown menu
        const menu = document.createElement('div');
        menu.className = 'sort-menu';
        menu.id = 'sortMenu';

        const showDirection = this.sortBy !== 'custom';

        menu.innerHTML = `
            <div class="sort-menu-section">
                <span class="sort-menu-label">Order by</span>
                <button class="sort-menu-item ${this.sortBy === 'custom' ? 'active' : ''}" data-sort="custom">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <span>Custom</span>
                    ${this.sortBy === 'custom' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </button>
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
            <div class="sort-menu-divider" id="sortDirectionDivider" style="display: ${showDirection ? 'block' : 'none'}"></div>
            <div class="sort-menu-section" id="sortDirectionSection" style="display: ${showDirection ? 'block' : 'none'}">
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

        // Position the menu
        const btnRect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (btnRect.bottom + 4) + 'px';
        menu.style.right = (window.innerWidth - btnRect.right) + 'px';

        document.body.appendChild(menu);
        requestAnimationFrame(() => menu.classList.add('open'));

        // Register with DropdownManager (closes all others first)
        DropdownManager.open('sort-menu', {
            element: menu,
            trigger: btn,
            onClose: () => {
                menu.classList.remove('open');
                setTimeout(() => menu.remove(), 150);
            }
        });

        // Bind sort option clicks
        menu.querySelectorAll('[data-sort]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const sortBy = item.dataset.sort;
                this.setSortBy(sortBy);
                this.closeSortMenu();
            });
        });

        // Bind direction option clicks
        menu.querySelectorAll('[data-direction]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const direction = item.dataset.direction;
                this.setSortDirection(direction);
                this.closeSortMenu();
            });
        });
    },

    /**
     * Close sort menu
     */
    closeSortMenu() {
        DropdownManager.close('sort-menu');
    },

    /**
     * Set sort by option
     * @param {string} sortBy - 'custom', 'name', or 'modified'
     */
    setSortBy(sortBy) {
        this.sortBy = sortBy;
        this.renderFolders();
        this.renderCards();
    },

    /**
     * Set sort direction
     * @param {string} direction - 'asc' or 'desc'
     */
    setSortDirection(direction) {
        this.sortDirection = direction;
        this.renderFolders();
        this.renderCards();
    },

    /**
     * Sort items array
     * @param {Array} items
     * @returns {Array}
     */
    sortItems(items) {
        if (this.sortBy === 'custom') {
            // Custom order - use sort_order field
            return [...items].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        }

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

        if (this.sortDirection === 'desc') {
            sorted.reverse();
        }

        return sorted;
    },

    /**
     * Sort folders array
     * @param {Array} folders
     * @returns {Array}
     */
    sortFolders(folders) {
        if (this.sortBy === 'custom') {
            // Custom order - use sort_order field
            return [...folders].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        }

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

        if (this.sortDirection === 'desc') {
            sorted.reverse();
        }

        return sorted;
    },

    /**
     * Check if drag reordering is enabled
     * @returns {boolean}
     */
    isDragEnabled() {
        // Disable drag while cloud mode is temporarily offline (can't sync order changes)
        // Local mode always allows drag (saves to IndexedDB, no server sync needed)
        if (typeof Vault !== 'undefined' && Vault.isOffline() && LocalDB.getMode() !== 'local') {
            return false;
        }
        return this.sortBy === 'custom';
    },

    /**
     * Duplicate an item
     * @param {Object} item
     */
    async duplicateItem(item) {
        try {
            const data = item.data || item.decrypted_data || {};

            // Create a copy of the data with modified name
            const duplicatedData = { ...data };
            if (duplicatedData.name) {
                duplicatedData.name = duplicatedData.name + ' (Copy)';
            } else if (duplicatedData.label) {
                duplicatedData.label = duplicatedData.label + ' (Copy)';
            }

            // Open edit page with the duplicated data
            window.dispatchEvent(new CustomEvent('additem', {
                detail: {
                    type: item.item_type,
                    folderId: item.folder_id,
                    prefillData: duplicatedData
                }
            }));
        } catch (error) {
            console.error('Failed to duplicate item:', error);
            Toast.error('Failed to duplicate item');
        }
    },

    /**
     * Delete item with confirmation popup (soft-delete)
     * @param {Object} item
     * @param {boolean} fromSelectMode - If true, exit select mode after successful delete
     */
    async deleteItemWithConfirm(item, fromSelectMode = false) {
        const data = item.data || item.decrypted_data || {};
        const name = item.item_type === 'totp'
            ? (data.issuer || data.label || 'this item')
            : (data.name || data.label || 'this item');

        const confirmed = await this.showConfirmPopup(
            'Delete Item',
            `Are you sure you want to delete "${name}"?`
        );

        if (!confirmed) return;

        try {
            if (typeof Vault !== 'undefined') {
                await Vault.softDeleteItem(item.id);
            } else {
                const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';
                if (isLocalMode) {
                    throw new Error('Cannot delete items without Vault in local mode');
                }
                await ApiClient.deleteItem(item.id);
            }

            if (fromSelectMode) {
                this.exitSelectMode();
            }

            this.items = this.items.filter(i => i.id !== item.id);
            this.renderCards();
            Toast.success('Item deleted');
        } catch (error) {
            Toast.error('Failed to delete item');
        }
    },

    /**
     * Show move item popup
     * @param {Object} item
     */
    async showMoveItemPopup(item) {
        if (typeof FolderBrowser === 'undefined') {
            Toast.error('Folder browser not available');
            return;
        }

        const data = item.data || item.decrypted_data || {};
        // For TOTP items, use issuer; for others, use name/label
        const name = item.item_type === 'totp'
            ? (data.issuer || data.label || 'this item')
            : (data.name || data.label || 'this item');

        FolderBrowser.show({
            currentFolderId: item.folder_id,
            excludeFolderIds: [],
            title: `Move "${name}"`,
            onSelect: async (targetFolderId) => {
                if (targetFolderId === item.folder_id) {
                    Toast.info('Item is already in this folder');
                    return;
                }

                try {
                    await Vault.moveItem(item.id, targetFolderId);

                    // Reload data to reflect the move (items are filtered by current folder)
                    await this.loadData();

                    Toast.success('Item moved successfully');
                } catch (error) {
                    console.error('Failed to move item:', error);
                    Toast.error(error.message || 'Failed to move item');
                }
            }
        });
    },

    /**
     * Show move folder popup
     * @param {Object} folder
     */
    async showMoveFolderPopup(folder) {
        if (typeof FolderBrowser === 'undefined') {
            Toast.error('Folder browser not available');
            return;
        }

        // Exclude the folder itself - descendants are automatically unreachable
        // because you can't navigate into a hidden folder
        FolderBrowser.show({
            currentFolderId: folder.parent_folder_id,
            excludeFolderIds: [folder.id],
            title: `Move "${folder.name}"`,
            onSelect: async (targetFolderId) => {
                if (targetFolderId === folder.parent_folder_id) {
                    Toast.info('Folder is already in this location');
                    return;
                }

                try {
                    await Vault.moveFolder(folder.id, targetFolderId);

                    // Reload data to reflect the move (folders are filtered by current location)
                    await this.loadData();

                    Toast.success('Folder moved successfully');
                } catch (error) {
                    console.error('Failed to move folder:', error);
                    Toast.error(error.message || 'Failed to move folder');
                }
            }
        });
    },

    // =========================================
    // Select Mode Functions
    // =========================================

    /**
     * Enter select mode with an initial selection
     * @param {string} type - 'folder' or 'item'
     * @param {string} id - The folder or item ID to select
     */
    enterSelectMode(type, id) {
        this.isSelectMode = true;
        this.selectedFolderIds = [];
        this.selectedItemIds = [];

        // Add initial selection
        if (type === 'folder') {
            this.selectedFolderIds.push(id);
        } else if (type === 'item') {
            this.selectedItemIds.push(id);
        }

        // Add body class
        document.body.classList.add('select-mode');

        // Show select controls, hide filter container
        const filterContainer = document.getElementById('filterContainer');
        const selectControls = document.getElementById('selectControls');

        if (filterContainer) filterContainer.style.display = 'none';
        if (selectControls) selectControls.style.display = 'flex';

        // Bind select mode events
        this.bindSelectModeEvents();

        // Update UI
        this.updateSelectControls();
        this.updateSelectedVisuals();
    },

    /**
     * Exit select mode
     */
    exitSelectMode() {
        this.isSelectMode = false;
        this.selectedFolderIds = [];
        this.selectedItemIds = [];

        // Remove body class
        document.body.classList.remove('select-mode');

        // Hide select controls, show filter container
        const filterContainer = document.getElementById('filterContainer');
        const selectControls = document.getElementById('selectControls');

        if (selectControls) selectControls.style.display = 'none';
        if (filterContainer) filterContainer.style.display = '';

        // Remove selected visuals
        document.querySelectorAll('.folder-card.selected, .card.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Unbind select mode events
        this.unbindSelectModeEvents();
    },

    /**
     * Bind select mode events (select controls only - folder/item clicks handled in their own handlers)
     */
    bindSelectModeEvents() {
        // Store bound handlers for later removal
        this._selectModeHandlers = {
            selectAllFolders: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSelectAllFolders();
            },
            selectAllItems: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSelectAllItems();
            },
            move: () => this.moveSelected(),
            delete: () => this.deleteSelected(),
            close: () => this.exitSelectMode()
        };

        // Bind to select controls
        document.getElementById('selectAllFolders')?.addEventListener('click', this._selectModeHandlers.selectAllFolders);
        document.getElementById('selectAllItems')?.addEventListener('click', this._selectModeHandlers.selectAllItems);
        document.getElementById('selectMoveBtn')?.addEventListener('click', this._selectModeHandlers.move);
        document.getElementById('selectDeleteBtn')?.addEventListener('click', this._selectModeHandlers.delete);
        document.getElementById('selectCloseBtn')?.addEventListener('click', this._selectModeHandlers.close);
    },

    /**
     * Unbind select mode events
     */
    unbindSelectModeEvents() {
        if (!this._selectModeHandlers) return;

        document.getElementById('selectAllFolders')?.removeEventListener('click', this._selectModeHandlers.selectAllFolders);
        document.getElementById('selectAllItems')?.removeEventListener('click', this._selectModeHandlers.selectAllItems);
        document.getElementById('selectMoveBtn')?.removeEventListener('click', this._selectModeHandlers.move);
        document.getElementById('selectDeleteBtn')?.removeEventListener('click', this._selectModeHandlers.delete);
        document.getElementById('selectCloseBtn')?.removeEventListener('click', this._selectModeHandlers.close);

        this._selectModeHandlers = null;
    },

    /**
     * Toggle selection of a folder or item
     * @param {string} type - 'folder' or 'item'
     * @param {string} id - The ID to toggle
     */
    toggleSelection(type, id) {
        const array = type === 'folder' ? this.selectedFolderIds : this.selectedItemIds;
        const index = array.indexOf(id);

        if (index === -1) {
            // Add to selection
            array.push(id);
        } else {
            // Remove from selection
            array.splice(index, 1);

            // Check if we should exit select mode (nothing selected)
            if (this.selectedFolderIds.length === 0 && this.selectedItemIds.length === 0) {
                this.exitSelectMode();
                return;
            }
        }

        this.updateSelectControls();
        this.updateSelectedVisuals();
    },

    /**
     * Update the select controls UI (checkboxes and counts)
     */
    updateSelectControls() {
        const foldersCheckbox = document.getElementById('selectAllFolders');
        const itemsCheckbox = document.getElementById('selectAllItems');
        const foldersCount = document.getElementById('selectFoldersCount');
        const itemsCount = document.getElementById('selectItemsCount');

        // Get counts
        const totalFolders = this.folders.length;
        const selectedFolders = this.selectedFolderIds.length;
        const totalItems = this.items.length;
        const selectedItems = this.selectedItemIds.length;

        // Show/hide folder controls based on selection
        if (foldersCheckbox) {
            if (selectedFolders === 0) {
                foldersCheckbox.style.display = 'none';
            } else {
                foldersCheckbox.style.display = '';
                const checkbox = foldersCheckbox.querySelector('input');
                foldersCheckbox.classList.remove('partial');

                if (selectedFolders === totalFolders && totalFolders > 0) {
                    checkbox.checked = true;
                } else {
                    checkbox.checked = false;
                    foldersCheckbox.classList.add('partial');
                }
            }
        }
        if (foldersCount) {
            foldersCount.style.display = selectedFolders === 0 ? 'none' : '';
            foldersCount.textContent = `${selectedFolders} folder${selectedFolders !== 1 ? 's' : ''}`;
        }

        // Show/hide item controls based on selection
        if (itemsCheckbox) {
            if (selectedItems === 0) {
                itemsCheckbox.style.display = 'none';
            } else {
                itemsCheckbox.style.display = '';
                const checkbox = itemsCheckbox.querySelector('input');
                itemsCheckbox.classList.remove('partial');

                if (selectedItems === totalItems && totalItems > 0) {
                    checkbox.checked = true;
                } else {
                    checkbox.checked = false;
                    itemsCheckbox.classList.add('partial');
                }
            }
        }
        if (itemsCount) {
            itemsCount.style.display = selectedItems === 0 ? 'none' : '';
            itemsCount.textContent = `${selectedItems} item${selectedItems !== 1 ? 's' : ''}`;
        }
    },

    /**
     * Update visual selected state on folders and items
     */
    updateSelectedVisuals() {
        // Update folders
        document.querySelectorAll('.folder-card').forEach(card => {
            const folderId = card.dataset.folderId;
            card.classList.toggle('selected', this.selectedFolderIds.includes(folderId));
        });

        // Update items
        document.querySelectorAll('.card[data-item-id]').forEach(card => {
            const itemId = card.dataset.itemId;
            card.classList.toggle('selected', this.selectedItemIds.includes(itemId));
        });
    },

    /**
     * Toggle select all folders
     */
    toggleSelectAllFolders() {
        const totalFolders = this.folders.length;
        const selectedFolders = this.selectedFolderIds.length;

        if (selectedFolders === totalFolders && totalFolders > 0) {
            // All selected, deselect all
            this.selectedFolderIds = [];
        } else {
            // Select all
            this.selectedFolderIds = this.folders.map(f => f.id);
        }

        // Check if we should exit select mode
        if (this.selectedFolderIds.length === 0 && this.selectedItemIds.length === 0) {
            this.exitSelectMode();
            return;
        }

        this.updateSelectControls();
        this.updateSelectedVisuals();
    },

    /**
     * Toggle select all items
     */
    toggleSelectAllItems() {
        const totalItems = this.items.length;
        const selectedItems = this.selectedItemIds.length;

        if (selectedItems === totalItems && totalItems > 0) {
            // All selected, deselect all
            this.selectedItemIds = [];
        } else {
            // Select all
            this.selectedItemIds = this.items.map(i => i.id);
        }

        // Check if we should exit select mode
        if (this.selectedFolderIds.length === 0 && this.selectedItemIds.length === 0) {
            this.exitSelectMode();
            return;
        }

        this.updateSelectControls();
        this.updateSelectedVisuals();
    },

    /**
     * Move selected folders and items
     */
    async moveSelected() {
        const totalSelected = this.selectedFolderIds.length + this.selectedItemIds.length;
        if (totalSelected === 0) {
            Toast.info('Nothing selected');
            return;
        }

        // Can't move if only folders are selected and some are ancestors of others
        // For now, we'll just move to a target folder

        FolderBrowser.show({
            currentFolderId: this.currentFolder?.id || null,
            excludeFolderIds: [...this.selectedFolderIds], // Can't move folders into themselves
            title: `Move ${totalSelected} item${totalSelected !== 1 ? 's' : ''}`,
            onSelect: async (targetFolderId) => {
                try {
                    let movedCount = 0;

                    // Move items first
                    for (const itemId of this.selectedItemIds) {
                        const item = this.items.find(i => i.id === itemId);
                        if (item && item.folder_id !== targetFolderId) {
                            await Vault.moveItem(itemId, targetFolderId);
                            movedCount++;

                            // Update local data
                            const itemIndex = this.items.findIndex(i => i.id === itemId);
                            if (itemIndex !== -1) {
                                this.items[itemIndex].folder_id = targetFolderId;
                            }
                        }
                    }

                    // Move folders
                    for (const folderId of this.selectedFolderIds) {
                        const folder = this.folders.find(f => f.id === folderId);
                        if (folder && folder.parent_folder_id !== targetFolderId) {
                            await Vault.moveFolder(folderId, targetFolderId);
                            movedCount++;

                            // Update local data
                            const folderIndex = this.folders.findIndex(f => f.id === folderId);
                            if (folderIndex !== -1) {
                                this.folders[folderIndex].parent_folder_id = targetFolderId;
                            }
                        }
                    }

                    // Exit select mode first
                    this.exitSelectMode();

                    if (movedCount > 0) {
                        Toast.success(`Moved ${movedCount} item${movedCount !== 1 ? 's' : ''}`);

                        // Refresh current view
                        this.loadData();
                    } else {
                        Toast.info('Items are already in this folder');
                    }
                } catch (error) {
                    console.error('Failed to move selected items:', error);
                    Toast.error(error.message || 'Failed to move items');
                }
            }
        });
    },

    /**
     * Delete selected folders and items (soft-delete)
     */
    async deleteSelected() {
        const folderCount = this.selectedFolderIds.length;
        const itemCount = this.selectedItemIds.length;
        const totalSelected = folderCount + itemCount;

        if (totalSelected === 0) {
            Toast.info('Nothing selected');
            return;
        }

        // If only one item selected, use single item delete popup
        if (itemCount === 1 && folderCount === 0) {
            const item = this.items.find(i => i.id === this.selectedItemIds[0]);
            if (item) {
                await this.deleteItemWithConfirm(item, true);
                return;
            }
        }

        // If only one folder selected, use single folder delete popup
        if (folderCount === 1 && itemCount === 0) {
            const folder = this.folders.find(f => f.id === this.selectedFolderIds[0]);
            if (folder) {
                await this.deleteFolder(folder, true);
                return;
            }
        }

        // Build message
        let message = 'Are you sure you want to delete ';
        const parts = [];
        if (itemCount > 0) {
            parts.push(`${itemCount} item${itemCount !== 1 ? 's' : ''}`);
        }
        if (folderCount > 0) {
            parts.push(`${folderCount} folder${folderCount !== 1 ? 's' : ''}`);
        }
        message += parts.join(' and ') + '?';

        const confirmed = await this.showConfirmPopup('Delete Selected', message);

        if (!confirmed) return;

        try {
            let deletedCount = 0;

            // Delete items (localOnly to batch sync)
            for (const itemId of this.selectedItemIds) {
                await Vault.softDeleteItem(itemId, { localOnly: true });
                deletedCount++;
            }

            // Delete all selected folders (soft-delete, localOnly to batch sync)
            for (const folderId of this.selectedFolderIds) {
                await Vault.softDeleteFolder(folderId, { localOnly: true });
                deletedCount++;
            }

            // Sync once after all deletes
            await Vault.syncPendingChanges();

            // Exit select mode first
            this.exitSelectMode();

            Toast.success(`Deleted ${deletedCount} item${deletedCount !== 1 ? 's' : ''}`);

            // Refresh current view
            this.loadData();
        } catch (error) {
            console.error('Failed to delete selected items:', error);
            Toast.error(error.message || 'Failed to delete items');
        }
    },

    /**
     * Show add item page
     * @param {string} type
     */
    showAddItemPage(type) {
        // Pass current folder ID (null if at root - AddEditPage will use root folder)
        window.dispatchEvent(new CustomEvent('additem', {
            detail: {
                type,
                folderId: this.currentFolder?.id || null
            }
        }));
    },

    /**
     * Show add folder popup
     */
    showAddFolderPopup() {
        const createFolder = async (api) => {
            const name = api.querySelector('#folderNameInput').value.trim();
            if (!name) {
                Toast.error('Please enter a folder name');
                return false;
            }

            try {
                if (typeof Vault !== 'undefined' && this.currentVault) {
                    const vaultId = this.currentVault.id;

                    let parentFolderId = this.currentFolder?.id || null;
                    if (!parentFolderId) {
                        const rootFolder = await Vault.getRootFolder(vaultId);
                        parentFolderId = rootFolder?.id || null;
                    }

                    const folder = await Vault.createFolder(vaultId, name, null, parentFolderId);
                    this.folders.push(folder);
                }
                this.renderFolders();
                Toast.success('Folder created');
                return true;
            } catch (error) {
                console.error('Failed to create folder:', error);
                Toast.error('Failed to create folder');
                return false;
            }
        };

        const popup = Popup.open({
            title: 'New Folder',
            body: `
                <div class="form-group">
                    <label class="form-label" for="folderNameInput">Folder Name</label>
                    <input type="text" class="form-input" id="folderNameInput" placeholder="Enter folder name" autocomplete="off">
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                { text: 'Create', type: 'primary', id: 'createBtn', onClick: () => createFolder(popup) }
            ],
            onOpen: (api) => {
                const input = api.querySelector('#folderNameInput');
                input.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter') {
                        if (await createFolder(api)) {
                            api.forceClose();
                        }
                    }
                });
            }
        });
    },

    /**
     * Show confirm popup
     * @param {string} title
     * @param {string} message
     * @returns {Promise<boolean>}
     */
    showConfirmPopup(title, message) {
        return Popup.confirm({
            title,
            message,
            confirmText: 'Delete',
            danger: true,
            popupClass: 'popup-confirm-delete'
        });
    },

    /**
     * Render empty state
     */
    renderEmptyState() {
        const section = document.getElementById('cardsSection');
        const emptyState = document.getElementById('emptyState');
        const foldersSection = document.getElementById('foldersSection');
        const filterContainer = document.querySelector('.filter-container');

        if (section) section.style.display = 'none';
        if (foldersSection) foldersSection.style.display = 'none';
        if (filterContainer) filterContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
    },

    /**
     * Get filter icon SVG
     * @param {string} iconName
     * @returns {string}
     */
    getFilterIcon(iconName) {
        const icons = {
            grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
            key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>',
            clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
            file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>',
            'file-text': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
            globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>'
        };
        return icons[iconName] || icons.grid;
    },

    /**
     * Get folder icon SVG
     * @param {string} icon
     * @returns {string}
     */
    getFolderIcon(icon) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HomePage;
}
