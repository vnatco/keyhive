/**
 * Folder Browser Popup
 * Allows selecting a destination folder for moving items/folders
 */

const FolderBrowser = {
    popup: null,
    currentVaultId: null,
    currentFolderId: null,  // The folder we're currently viewing
    sourceFolderId: null,   // The folder where the item/folder originally is
    excludeFolderIds: [],
    onSelect: null,
    vaults: [],
    folders: [],
    breadcrumb: [],
    isVaultDropdownOpen: false,

    /**
     * Show the folder browser popup
     * @param {Object} options
     * @param {string} options.currentFolderId - Current folder ID where item is located
     * @param {Array} options.excludeFolderIds - Folder IDs to exclude (can't move into these)
     * @param {string} options.title - Popup title
     * @param {Function} options.onSelect - Callback when folder is selected (receives folderId)
     */
    async show(options = {}) {
        this.sourceFolderId = options.currentFolderId || null;
        this.currentFolderId = options.currentFolderId || null;
        this.excludeFolderIds = options.excludeFolderIds || [];
        this.onSelect = options.onSelect || null;
        const title = options.title || 'Select Destination';

        // Load vaults and folders
        await this.loadData();

        // Find current vault based on current folder
        if (this.currentFolderId) {
            const currentFolder = this.folders.find(f => f.id === this.currentFolderId);
            if (currentFolder) {
                this.currentVaultId = this.findVaultIdForFolder(currentFolder);
            }
        }

        // Default to first vault if not set
        if (!this.currentVaultId && this.vaults.length > 0) {
            this.currentVaultId = this.vaults[0].id;
        }

        // Create popup
        this.createPopup(title);
        this.bindEvents();

        // Navigate to the current folder (show its contents)
        await this.navigateToFolder(this.currentFolderId);
    },

    /**
     * Load vaults and folders from Vault
     * Note: We need ALL folders including root folders for navigation
     */
    async loadData() {
        const allVaults = await Vault.getVaults();
        // Filter out soft-deleted vaults
        this.vaults = allVaults.filter(p => !p.deleted_at);

        // Get all folders including root folders (Vault.getFolders() excludes roots)
        const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        // Filter out soft-deleted folders BEFORE decrypting
        const activeFolders = allFolders.filter(f => !f.deleted_at);

        this.folders = await Promise.all(
            activeFolders.map(async (folder) => {
                try {
                    return await Vault._decryptFolder(folder);
                } catch (e) {
                    console.error('Failed to decrypt folder:', folder.id, e);
                    return { ...folder, name: 'Encrypted Folder' };
                }
            })
        );
    },

    /**
     * Get current vault
     */
    getCurrentVault() {
        return this.vaults.find(p => p.id === this.currentVaultId);
    },

    /**
     * Create the popup HTML
     */
    createPopup(title) {
        document.body.classList.add('popup-open');

        const currentVault = this.getCurrentVault();

        this.popup = document.createElement('div');
        this.popup.className = 'popup-overlay folder-browser-popup';
        this.popup.innerHTML = `
            <div class="popup">
                <div class="popup-header">
                    <h3 class="popup-title">${Utils.escapeHtml(title)}</h3>
                    <button class="popup-close" id="folderBrowserClose">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="popup-body folder-browser-body">
                    <!-- Vault Selector (custom dropdown) -->
                    <div class="folder-browser-vault">
                        <button class="folder-browser-vault-btn" id="folderBrowserVaultBtn">
                            <span class="folder-browser-vault-name" id="folderBrowserVaultName">
                                ${Utils.escapeHtml(currentVault?.name || 'Select Vault')}
                            </span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div class="folder-browser-vault-dropdown" id="folderBrowserVaultDropdown">
                            ${this.vaults.map(p => `
                                <button class="folder-browser-vault-item ${p.id === this.currentVaultId ? 'active' : ''}" data-vault-id="${p.id}">
                                    ${Utils.escapeHtml(p.name)}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Breadcrumb Navigation -->
                    <div class="folder-browser-nav" id="folderBrowserNav">
                        <div class="folder-browser-breadcrumb" id="folderBrowserBreadcrumb">
                            <button class="breadcrumb-item breadcrumb-root" id="folderBrowserRoot">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                                </svg>
                            </button>
                            <div class="breadcrumb-path" id="folderBrowserPath"></div>
                        </div>
                    </div>

                    <!-- Folder List -->
                    <div class="folder-browser-list" id="folderBrowserList">
                        <!-- Folders will be rendered here -->
                    </div>
                </div>
                <div class="popup-footer">
                    <button class="btn btn-secondary" id="folderBrowserCancel">Cancel</button>
                    <button class="btn btn-primary" id="folderBrowserConfirm">
                        <span class="btn-text">Move Here</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.popup);
        requestAnimationFrame(() => this.popup.classList.add('active'));
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Close button
        this.popup.querySelector('#folderBrowserClose')?.addEventListener('click', () => this.close());
        this.popup.querySelector('#folderBrowserCancel')?.addEventListener('click', () => this.close());

        // Vault dropdown toggle
        this.popup.querySelector('#folderBrowserVaultBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleVaultDropdown();
        });

        // Vault selection
        this.popup.querySelectorAll('.folder-browser-vault-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const vaultId =item.dataset.vaultId;
                await this.selectVault(vaultId);
                this.closeVaultDropdown();
            });
        });

        // Root button
        this.popup.querySelector('#folderBrowserRoot')?.addEventListener('click', async () => {
            await this.navigateToRoot();
        });

        // Confirm button
        this.popup.querySelector('#folderBrowserConfirm')?.addEventListener('click', () => {
            this.confirmSelection();
        });

        // Click outside to close vault dropdown (NOT the popup itself)
        this.popup.addEventListener('click', (e) => {
            if (!e.target.closest('.folder-browser-vault')) {
                this.closeVaultDropdown();
            }
            // DO NOT close popup on overlay click - user explicitly requested this behavior
        });
    },

    /**
     * Toggle vault dropdown
     */
    toggleVaultDropdown() {
        const dropdown = this.popup.querySelector('#folderBrowserVaultDropdown');
        const btn = this.popup.querySelector('#folderBrowserVaultBtn');

        if (this.isVaultDropdownOpen) {
            this.closeVaultDropdown();
        } else {
            dropdown.classList.add('open');
            btn.classList.add('open');
            this.isVaultDropdownOpen = true;
        }
    },

    /**
     * Close vault dropdown
     */
    closeVaultDropdown() {
        const dropdown = this.popup.querySelector('#folderBrowserVaultDropdown');
        const btn = this.popup.querySelector('#folderBrowserVaultBtn');

        dropdown?.classList.remove('open');
        btn?.classList.remove('open');
        this.isVaultDropdownOpen = false;
    },

    /**
     * Select a vault
     */
    async selectVault(vaultId) {
        this.currentVaultId = vaultId;

        // Update button text
        const vault = this.vaults.find(v => v.id === vaultId);
        const nameEl = this.popup.querySelector('#folderBrowserVaultName');
        if (nameEl && vault) {
            nameEl.textContent = vault.name;
        }

        // Update active state in dropdown
        this.popup.querySelectorAll('.folder-browser-vault-item').forEach(item => {
            item.classList.toggle('active', item.dataset.vaultId === vaultId);
        });

        // Navigate to root of selected vault
        await this.navigateToRoot();
    },

    /**
     * Find the vault ID for a given folder by traversing up the parent chain
     */
    findVaultIdForFolder(folder) {
        if (!folder) return null;
        if (folder.parent_folder_id === null) return folder.id;  // It's a vault

        // Traverse up the parent chain
        let current = folder;
        while (current && current.parent_folder_id !== null) {
            current = this.folders.find(f => f.id === current.parent_folder_id);
        }
        return current?.id || null;
    },

    /**
     * Navigate to root folder of current vault
     * Since vaults ARE root folders, currentVaultId IS the root folder ID
     */
    async navigateToRoot() {
        if (this.currentVaultId) {
            this.currentFolderId = this.currentVaultId;
            this.breadcrumb = [];
            this.renderFolders();
            this.renderBreadcrumb();
        }
    },

    /**
     * Navigate to a specific folder
     */
    async navigateToFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder) {
            // Fallback to root
            await this.navigateToRoot();
            return;
        }

        this.currentFolderId = folderId;

        // Build breadcrumb (exclude vault/root)
        this.breadcrumb = [];
        let current = folder;

        // If current folder is not a vault, add it and its ancestors
        if (current.parent_folder_id !== null) {
            while (current && current.parent_folder_id !== null) {
                this.breadcrumb.unshift(current);
                current = this.folders.find(f => f.id === current.parent_folder_id);
            }
        }

        this.renderFolders();
        this.renderBreadcrumb();
    },

    /**
     * Render the folder list
     */
    renderFolders() {
        const list = this.popup.querySelector('#folderBrowserList');
        if (!list) return;

        // Get subfolders of current folder
        // Convert excludeFolderIds to strings for consistent comparison
        const excludeSet = new Set(this.excludeFolderIds.map(id => String(id)));

        const subfolders = this.folders.filter(f =>
            String(f.parent_folder_id) === String(this.currentFolderId) &&
            f.parent_folder_id !== null &&  // Exclude vaults
            !excludeSet.has(String(f.id))
        ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        if (subfolders.length === 0) {
            list.innerHTML = `
                <div class="folder-browser-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>No subfolders</span>
                </div>
            `;
            return;
        }

        list.innerHTML = subfolders.map(folder => `
            <div class="folder-browser-item" data-folder-id="${folder.id}">
                <div class="folder-browser-item-icon">
                    ${folder.icon ? `<span class="folder-emoji">${Utils.escapeHtml(folder.icon)}</span>` : `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                    `}
                </div>
                <span class="folder-browser-item-name">${Utils.escapeHtml(folder.name)}</span>
                <svg class="folder-browser-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        `).join('');

        // Bind folder clicks
        list.querySelectorAll('.folder-browser-item').forEach(item => {
            item.addEventListener('click', () => {
                const folderId = item.dataset.folderId;
                this.navigateToFolder(folderId);
            });
        });
    },

    /**
     * Render the breadcrumb
     */
    renderBreadcrumb() {
        const navEl = this.popup.querySelector('#folderBrowserNav');
        const pathEl = this.popup.querySelector('#folderBrowserPath');
        const rootBtn = this.popup.querySelector('#folderBrowserRoot');
        if (!navEl || !pathEl || !rootBtn) return;

        // Hide nav when at root (empty breadcrumb)
        if (this.breadcrumb.length === 0) {
            navEl.style.display = 'none';
            return;
        }

        navEl.style.display = 'block';

        // Update root button state
        rootBtn.classList.toggle('active', this.breadcrumb.length === 0);

        // Render breadcrumb path
        pathEl.innerHTML = this.breadcrumb.map((crumb, index) => `
            <span class="breadcrumb-separator">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </span>
            <button class="breadcrumb-item ${index === this.breadcrumb.length - 1 ? 'active' : ''}"
                    data-folder-id="${crumb.id}">
                ${Utils.escapeHtml(crumb.name)}
            </button>
        `).join('');

        // Bind breadcrumb clicks
        pathEl.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const folderId = item.dataset.folderId;
                this.navigateToFolder(folderId);
            });
        });
    },

    /**
     * Confirm the current selection
     */
    confirmSelection() {
        if (this.onSelect && this.currentFolderId) {
            this.onSelect(this.currentFolderId);
        }
        this.close();
    },

    /**
     * Close the popup
     */
    close() {
        if (!this.popup) return;

        this.popup.classList.remove('active');
        document.body.classList.remove('popup-open');
        this.isVaultDropdownOpen = false;

        setTimeout(() => {
            this.popup.remove();
            this.popup = null;
        }, 300);
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.FolderBrowser = FolderBrowser;
}
