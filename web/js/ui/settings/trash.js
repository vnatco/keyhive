/**
 * Trash Manager - Shared module for viewing and managing deleted items
 * Works identically for local and cloud modes
 */

const TrashManager = {
    popup: null,
    trashData: null,
    expandedContainers: new Set(),

    // Constants
    AUTO_DELETE_DAYS: 30,

    /**
     * Get display name for an item based on its type
     * @param {Object} item - The item with item_type and data
     * @returns {string}
     */
    getItemDisplayName(item) {
        const data = item.data || {};
        switch (item.item_type) {
            case 'password':
            case 'file':
                return data.name || 'Unnamed Item';
            case 'totp':
                return data.issuer || data.label || 'Unnamed TOTP';
            case 'note':
                return data.label || 'Unnamed Note';
            case 'website':
                return data.label || 'Unnamed Website';
            default:
                return data.name || data.label || 'Unnamed Item';
        }
    },

    /**
     * Show the trash popup
     */
    async show() {
        try {
            // Load trash contents
            this.trashData = await this.getTrashContents();
            this.expandedContainers.clear();

            // Create and show popup
            this.createPopup();
            this.bindEvents();
        } catch (error) {
            console.error('Failed to load trash:', error);
            Toast.error('Failed to load trash');
        }
    },

    /**
     * Get all trash contents (deleted + orphaned)
     * Vaults are root folders (parent_folder_id = null)
     */
    async getTrashContents() {
        await LocalDB.ensureInit();

        const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const allItems = await LocalDB.getAll(LocalDB.STORES.ITEMS);

        // Build lookup Maps (use String keys for consistent lookups)
        const folderMap = new Map(allFolders.map(f => [String(f.id), f]));

        // Vaults are root folders (parent_folder_id = null)
        const allVaults = allFolders.filter(f => f.parent_folder_id === null);
        const vaultMap = new Map(allVaults.map(v => [String(v.id), v]));

        // Helper: find which vault a folder belongs to by traversing up parent chain
        const findVaultForFolder = (folder) => {
            if (!folder) return null;
            if (folder.parent_folder_id === null) return folder;  // It's a vault
            let current = folder;
            while (current && current.parent_folder_id !== null) {
                current = folderMap.get(String(current.parent_folder_id));
            }
            return current || null;
        };

        // === EXPLICITLY DELETED ===

        // Deleted vaults (root folders that are deleted)
        const deletedVaults = allVaults.filter(v => v.deleted_at);

        // Deleted folders (non-vault, whose vault is NOT deleted)
        const deletedFolders = allFolders.filter(f => {
            if (!f.deleted_at || f.parent_folder_id === null) return false;
            const vault = findVaultForFolder(f);
            // Include if vault doesn't exist OR vault is not deleted
            return !vault || !vault.deleted_at;
        });

        // Deleted items (whose folder is NOT deleted and vault is NOT deleted)
        const deletedItems = allItems.filter(i => {
            if (!i.deleted_at) return false;
            const folder = folderMap.get(String(i.folder_id));
            if (!folder) return true; // Folder doesn't exist, show as deleted
            if (folder.deleted_at) return false; // Folder is deleted, item is implicit
            const vault = findVaultForFolder(folder);
            if (!vault) return true; // Vault doesn't exist
            if (vault.deleted_at) return false; // Vault is deleted, item is implicit
            return true;
        });

        // === ORPHANED (broken parent reference) ===

        // Folders whose parent chain doesn't lead to a vault
        const orphanedFolders = allFolders.filter(f => {
            if (f.deleted_at || f.parent_folder_id === null) return false;
            const vault = findVaultForFolder(f);
            return !vault;
        });

        // Items whose folder doesn't exist or is orphaned
        const orphanedItems = allItems.filter(i => {
            if (i.deleted_at) return false; // Already in deleted
            const folder = folderMap.get(String(i.folder_id));
            if (!folder) return true; // Folder doesn't exist
            if (folder.deleted_at) return false; // Folder is deleted (handled separately)
            const vault = findVaultForFolder(folder);
            if (!vault) return true; // Vault doesn't exist
            return false;
        });

        // Decrypt names for display
        const decryptedVaults = await this.decryptFolders(deletedVaults);
        const decryptedDeletedFolders = await this.decryptFolders(deletedFolders);
        const decryptedDeletedItems = await this.decryptItems(deletedItems);
        const decryptedOrphanedFolders = await this.decryptFolders(orphanedFolders);
        const decryptedOrphanedItems = await this.decryptItems(orphanedItems);

        // Get content counts for containers
        for (const vault of decryptedVaults) {
            const counts = this.getContainerCounts(vault.id, null, allFolders, allItems);
            vault._folderCount = counts.folders;
            vault._itemCount = counts.items;
        }

        for (const folder of decryptedDeletedFolders) {
            const counts = this.getContainerCounts(null, folder.id, allFolders, allItems);
            folder._folderCount = counts.folders;
            folder._itemCount = counts.items;
        }

        for (const folder of decryptedOrphanedFolders) {
            const counts = this.getContainerCounts(null, folder.id, allFolders, allItems);
            folder._folderCount = counts.folders;
            folder._itemCount = counts.items;
        }

        // Get path info for deleted items/folders and check if restorable
        for (const folder of decryptedDeletedFolders) {
            folder._path = await this.getFolderPath(folder, allFolders, allVaults);
            // Check if folder can be restored (parent exists and is not deleted, vault exists and is not deleted)
            const parent = folder.parent_folder_id ? folderMap.get(String(folder.parent_folder_id)) : null;
            const vault = findVaultForFolder(folder);
            // Folders directly under vault can always be restored if vault exists
            const parentOk = !parent || !parent.deleted_at || parent.parent_folder_id === null;
            folder._canRestore = parentOk && vault && !vault.deleted_at;
        }

        for (const item of decryptedDeletedItems) {
            item._path = await this.getItemPath(item, allFolders, allVaults);
            // Check if item can be restored (folder exists and is not deleted)
            const folder = folderMap.get(String(item.folder_id));
            const vault = folder ? findVaultForFolder(folder) : null;
            item._canRestore = folder && !folder.deleted_at && vault && !vault.deleted_at;
        }

        return {
            deletedVaults: decryptedVaults,
            deletedFolders: decryptedDeletedFolders,
            deletedItems: decryptedDeletedItems,
            orphanedFolders: decryptedOrphanedFolders,
            orphanedItems: decryptedOrphanedItems,
            // Raw data for operations
            _allFolders: allFolders,
            _allItems: allItems,
            _vaultMap: vaultMap,
            _folderMap: folderMap,
            _findVaultForFolder: findVaultForFolder
        };
    },

    /**
     * Count folders and items inside a container
     */
    getContainerCounts(vaultId, folderId, allFolders, allItems) {
        let folders = 0;
        let items = 0;

        if (vaultId) {
            // Count all non-vault folders and items in the vault
            // First, find all folders that belong to this vault by traversing
            const folderMap = new Map(allFolders.map(f => [String(f.id), f]));
            const belongsToVault = (folder) => {
                if (!folder) return false;
                if (folder.parent_folder_id === null) return String(folder.id) === String(vaultId);
                let current = folder;
                while (current && current.parent_folder_id !== null) {
                    current = folderMap.get(String(current.parent_folder_id));
                }
                return current && String(current.id) === String(vaultId);
            };

            folders = allFolders.filter(f => f.parent_folder_id !== null && belongsToVault(f)).length;
            items = allItems.filter(i => {
                const folder = folderMap.get(String(i.folder_id));
                return belongsToVault(folder);
            }).length;
        } else if (folderId) {
            // Count subfolders and items recursively
            const countRecursive = (parentId) => {
                const subfolders = allFolders.filter(f => String(f.parent_folder_id) === String(parentId) && f.parent_folder_id !== null);
                for (const sf of subfolders) {
                    folders++;
                    countRecursive(sf.id);
                }
                items += allItems.filter(i => String(i.folder_id) === String(parentId)).length;
            };
            countRecursive(folderId);
        }

        return { folders, items };
    },

    /**
     * Get path string for a folder (shows vault name)
     */
    async getFolderPath(folder, allFolders, allVaults) {
        // Find vault by traversing up parent chain
        const folderMap = new Map(allFolders.map(f => [String(f.id), f]));
        let current = folder;
        while (current && current.parent_folder_id !== null) {
            current = folderMap.get(String(current.parent_folder_id));
        }
        const vault = current;
        if (!vault) return 'Unknown Vault';

        let vaultName = vault.name;
        if (!vaultName && vault.encrypted_name) {
            try {
                vaultName = await CryptoAPI.decrypt(vault.encrypted_name);
            } catch (e) {
                vaultName = 'Encrypted Vault';
            }
        }

        return vaultName || 'Unknown Vault';
    },

    /**
     * Get path string for an item
     */
    async getItemPath(item, allFolders, allVaults) {
        // Use string comparison to handle potential type mismatches
        const folderMap = new Map(allFolders.map(f => [String(f.id), f]));
        const folder = folderMap.get(String(item.folder_id));
        if (!folder) return 'Unknown Location';

        // Find vault by traversing up parent chain
        let current = folder;
        while (current && current.parent_folder_id !== null) {
            current = folderMap.get(String(current.parent_folder_id));
        }
        const vault = current;
        if (!vault) return 'Unknown Vault';

        let vaultName = vault.name;
        if (!vaultName && vault.encrypted_name) {
            try {
                vaultName = await CryptoAPI.decrypt(vault.encrypted_name);
            } catch (e) {
                vaultName = 'Encrypted Vault';
            }
        }

        let folderName = folder.name;
        if (!folderName && folder.encrypted_name) {
            try {
                folderName = await CryptoAPI.decrypt(folder.encrypted_name);
            } catch (e) {
                folderName = 'Encrypted Folder';
            }
        }

        if (folder.parent_folder_id === null) {  // It's a vault
            return vaultName || 'Unknown';
        }

        return `${vaultName} > ${folderName}`;
    },

    /**
     * Decrypt folders for display
     */
    async decryptFolders(folders) {
        return Promise.all(folders.map(async (f) => {
            let name = f.name;
            let icon = f.icon;
            if (!name && f.encrypted_name) {
                try {
                    name = await CryptoAPI.decrypt(f.encrypted_name);
                } catch (e) {
                    name = 'Encrypted Folder';
                }
            }
            if (!icon && f.encrypted_icon) {
                try {
                    icon = await CryptoAPI.decrypt(f.encrypted_icon);
                } catch (e) {
                    icon = null;
                }
            }
            return { ...f, name: name || 'Unnamed Folder', icon };
        }));
    },

    /**
     * Decrypt items for display
     */
    async decryptItems(items) {
        return Promise.all(items.map(async (i) => {
            let data = i.data;
            if (!data && i.encrypted_data) {
                try {
                    data = await CryptoAPI.decryptObject(i.encrypted_data);
                } catch (e) {
                    console.warn('[Trash] Failed to decrypt item:', i.id, e);
                    data = { name: 'Encrypted Item' };
                }
            }
            return { ...i, data: data || { name: 'Unnamed Item' } };
        }));
    },

    /**
     * Create the trash popup
     */
    createPopup() {
        document.body.classList.add('popup-open');

        const { deletedVaults, deletedFolders, deletedItems, orphanedFolders, orphanedItems } = this.trashData;

        const hasDeleted = deletedVaults.length > 0 || deletedFolders.length > 0 || deletedItems.length > 0;
        const hasOrphaned = orphanedFolders.length > 0 || orphanedItems.length > 0;
        const isEmpty = !hasDeleted && !hasOrphaned;

        const totalCount = deletedVaults.length + deletedFolders.length + deletedItems.length +
                           orphanedFolders.length + orphanedItems.length;

        this.popup = document.createElement('div');
        this.popup.className = 'popup-overlay trash-popup';
        this.popup.innerHTML = `
            <div class="popup popup-lg">
                <div class="popup-header">
                    <h3 class="popup-title">Trash</h3>
                    <button class="popup-close" id="trashClose">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="popup-body trash-body">
                    ${isEmpty ? this.renderEmptyState() : `
                        <div class="alert alert-info">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <span>Items in trash are permanently deleted after ${this.AUTO_DELETE_DAYS} days.</span>
                        </div>

                        ${hasDeleted ? `
                            <div class="trash-section">
                                <div class="trash-section-header">
                                    <span class="trash-section-title">Deleted</span>
                                </div>
                                <div class="trash-list" id="trashDeletedList">
                                    ${this.renderDeletedItems()}
                                </div>
                            </div>
                        ` : ''}

                        ${hasOrphaned ? `
                            <div class="trash-section">
                                <div class="trash-section-header">
                                    <span class="trash-section-title">Orphaned</span>
                                    <span class="trash-section-hint">Parent no longer exists</span>
                                </div>
                                <div class="trash-list" id="trashOrphanedList">
                                    ${this.renderOrphanedItems()}
                                </div>
                            </div>
                        ` : ''}
                    `}
                </div>
                ${!isEmpty ? `
                    <div class="popup-footer">
                        <button class="btn btn-danger" id="emptyTrashBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Empty Trash (${totalCount})
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(this.popup);
        requestAnimationFrame(() => this.popup.classList.add('active'));
    },

    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="trash-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Trash is empty</span>
            </div>
        `;
    },

    /**
     * Render deleted items (vaults, folders, items)
     */
    renderDeletedItems() {
        const { deletedVaults, deletedFolders, deletedItems } = this.trashData;
        let html = '';

        // Deleted vaults
        for (const vault of deletedVaults) {
            html += this.renderDeletedVault(vault);
        }

        // Deleted folders
        for (const folder of deletedFolders) {
            html += this.renderDeletedFolder(folder);
        }

        // Deleted items
        for (const item of deletedItems) {
            html += this.renderDeletedItem(item);
        }

        return html;
    },

    /**
     * Render orphaned items
     */
    renderOrphanedItems() {
        const { orphanedFolders, orphanedItems } = this.trashData;
        let html = '';

        // Orphaned folders
        for (const folder of orphanedFolders) {
            html += this.renderOrphanedFolder(folder);
        }

        // Orphaned items
        for (const item of orphanedItems) {
            html += this.renderOrphanedItem(item);
        }

        return html;
    },

    /**
     * Render a deleted vault card
     */
    renderDeletedVault(vault) {
        const daysLeft = this.getDaysLeft(vault.deleted_at);
        const timeAgo = this.getTimeAgo(vault.deleted_at);
        const contentInfo = this.formatContentInfo(vault._folderCount, vault._itemCount);
        const isExpanded = this.expandedContainers.has(`vault-${vault.id}`);
        const hasContents = vault._folderCount > 0 || vault._itemCount > 0;

        return `
            <div class="trash-card" data-type="vault" data-id="${vault.id}">
                <div class="trash-card-toggle${hasContents ? '' : ' no-expand'}"${hasContents ? ` data-expand="vault-${vault.id}"` : ''}>
                    <div class="trash-card-header">
                        <span class="trash-type-icon trash-type-vault">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                        </span>
                        <span class="trash-card-name">${Utils.escapeHtml(vault.name)}</span>
                        ${hasContents ? `
                            <span class="trash-expand-icon${isExpanded ? ' expanded' : ''}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </span>
                        ` : ''}
                        <div class="trash-card-actions">
                            <button class="btn btn-secondary btn-sm" data-action="restore" data-type="vault" data-id="${vault.id}">Restore</button>
                            <button class="btn btn-ghost btn-sm btn-danger-text" data-action="delete" data-type="vault" data-id="${vault.id}">Delete</button>
                        </div>
                    </div>
                    <div class="trash-card-meta">
                        <span class="trash-card-time">Deleted ${timeAgo} (${daysLeft} days left)</span>
                        ${contentInfo ? `<span class="trash-card-contents">${contentInfo}</span>` : ''}
                    </div>
                </div>
                ${hasContents ? `
                    <div class="trash-card-expanded${isExpanded ? ' show' : ''}" id="expanded-vault-${vault.id}">
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Render a deleted folder card
     */
    renderDeletedFolder(folder) {
        const daysLeft = this.getDaysLeft(folder.deleted_at);
        const timeAgo = this.getTimeAgo(folder.deleted_at);
        const contentInfo = this.formatContentInfo(folder._folderCount, folder._itemCount);
        const isExpanded = this.expandedContainers.has(`folder-${folder.id}`);
        const hasContents = folder._folderCount > 0 || folder._itemCount > 0;
        const canRestore = folder._canRestore !== false;

        return `
            <div class="trash-card" data-type="folder" data-id="${folder.id}">
                <div class="trash-card-toggle${hasContents ? '' : ' no-expand'}"${hasContents ? ` data-expand="folder-${folder.id}"` : ''}>
                    <div class="trash-card-header">
                        <span class="trash-type-icon">
                            ${folder.icon ? Utils.escapeHtml(folder.icon) : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>`}
                        </span>
                        <span class="trash-card-name">${Utils.escapeHtml(folder.name)}</span>
                        ${hasContents ? `
                            <span class="trash-expand-icon${isExpanded ? ' expanded' : ''}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </span>
                        ` : ''}
                        <div class="trash-card-actions">
                            ${canRestore
                                ? `<button class="btn btn-secondary btn-sm" data-action="restore" data-type="folder" data-id="${folder.id}">Restore</button>`
                                : `<button class="btn btn-secondary btn-sm" data-action="move" data-type="folder" data-id="${folder.id}">Move</button>`
                            }
                            <button class="btn btn-ghost btn-sm btn-danger-text" data-action="delete" data-type="folder" data-id="${folder.id}">Delete</button>
                        </div>
                    </div>
                    <div class="trash-card-meta">
                        <span class="trash-card-path">in "${Utils.escapeHtml(folder._path)}"</span>
                        <span class="trash-card-time">Deleted ${timeAgo} (${daysLeft} days left)</span>
                        ${contentInfo ? `<span class="trash-card-contents">${contentInfo}</span>` : ''}
                    </div>
                </div>
                ${hasContents ? `
                    <div class="trash-card-expanded${isExpanded ? ' show' : ''}" id="expanded-folder-${folder.id}">
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Render a deleted item card
     */
    renderDeletedItem(item) {
        const daysLeft = this.getDaysLeft(item.deleted_at);
        const timeAgo = this.getTimeAgo(item.deleted_at);
        const icon = this.getItemIcon(item.item_type);
        const name = this.getItemDisplayName(item);
        const subtitle = this.getItemSubtitle(item);

        // Check if item can be restored (has valid folder)
        const canRestore = item._canRestore !== false;

        return `
            <div class="trash-card trash-card-item" data-type="item" data-id="${item.id}">
                <div class="trash-card-toggle no-expand">
                    <div class="trash-card-header">
                        <span class="trash-type-icon">${icon}</span>
                        <span class="trash-card-name">${Utils.escapeHtml(name)}</span>
                        <div class="trash-card-actions">
                            ${canRestore
                                ? `<button class="btn btn-secondary btn-sm" data-action="restore" data-type="item" data-id="${item.id}">Restore</button>`
                                : `<button class="btn btn-secondary btn-sm" data-action="move" data-type="item" data-id="${item.id}">Move</button>`
                            }
                            <button class="btn btn-ghost btn-sm btn-danger-text" data-action="delete" data-type="item" data-id="${item.id}">Delete</button>
                        </div>
                    </div>
                    <div class="trash-card-meta">
                        ${subtitle ? `<span class="trash-card-subtitle">${Utils.escapeHtml(subtitle)}</span>` : ''}
                        <span class="trash-card-path">in "${Utils.escapeHtml(item._path)}"</span>
                        <span class="trash-card-time">Deleted ${timeAgo} (${daysLeft} days left)</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render an orphaned folder card
     */
    renderOrphanedFolder(folder) {
        const contentInfo = this.formatContentInfo(folder._folderCount, folder._itemCount);
        const isExpanded = this.expandedContainers.has(`orphan-folder-${folder.id}`);
        const hasContents = folder._folderCount > 0 || folder._itemCount > 0;

        return `
            <div class="trash-card trash-card-orphan" data-type="orphan-folder" data-id="${folder.id}">
                <div class="trash-card-toggle${hasContents ? '' : ' no-expand'}"${hasContents ? ` data-expand="orphan-folder-${folder.id}"` : ''}>
                    <div class="trash-card-header">
                        <span class="trash-type-icon trash-type-orphan">
                            ${folder.icon ? Utils.escapeHtml(folder.icon) : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>`}
                        </span>
                        <span class="trash-card-name">${Utils.escapeHtml(folder.name)}</span>
                        ${hasContents ? `
                            <span class="trash-expand-icon${isExpanded ? ' expanded' : ''}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </span>
                        ` : ''}
                        <div class="trash-card-actions">
                            <button class="btn btn-secondary btn-sm" data-action="move" data-type="orphan-folder" data-id="${folder.id}">Move</button>
                            <button class="btn btn-ghost btn-sm btn-danger-text" data-action="delete" data-type="orphan-folder" data-id="${folder.id}">Delete</button>
                        </div>
                    </div>
                    <div class="trash-card-meta">
                        <span class="trash-card-orphan-reason">Vault no longer exists</span>
                        ${contentInfo ? `<span class="trash-card-contents">${contentInfo}</span>` : ''}
                    </div>
                </div>
                ${hasContents ? `
                    <div class="trash-card-expanded${isExpanded ? ' show' : ''}" id="expanded-orphan-folder-${folder.id}">
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Render an orphaned item card
     */
    renderOrphanedItem(item) {
        const icon = this.getItemIcon(item.item_type);
        const name = this.getItemDisplayName(item);
        const subtitle = this.getItemSubtitle(item);

        return `
            <div class="trash-card trash-card-orphan trash-card-item" data-type="orphan-item" data-id="${item.id}">
                <div class="trash-card-toggle no-expand">
                    <div class="trash-card-header">
                        <span class="trash-type-icon trash-type-orphan">${icon}</span>
                        <span class="trash-card-name">${Utils.escapeHtml(name)}</span>
                        <div class="trash-card-actions">
                            <button class="btn btn-secondary btn-sm" data-action="move" data-type="orphan-item" data-id="${item.id}">Move</button>
                            <button class="btn btn-ghost btn-sm btn-danger-text" data-action="delete" data-type="orphan-item" data-id="${item.id}">Delete</button>
                        </div>
                    </div>
                    <div class="trash-card-meta">
                        ${subtitle ? `<span class="trash-card-subtitle">${Utils.escapeHtml(subtitle)}</span>` : ''}
                        <span class="trash-card-orphan-reason">Folder no longer exists</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render contents of a deleted vault (for expanded view)
     * Vault IS a root folder, so we render its direct children
     */
    async renderVaultContents(vault) {
        const { _allFolders, _allItems } = this.trashData;

        // Vault IS the root folder, get direct children
        const subfolders = _allFolders.filter(f => String(f.parent_folder_id) === String(vault.id));

        // Get items directly in the vault (root folder)
        const items = _allItems.filter(i => String(i.folder_id) === String(vault.id));

        return await this.renderContentsTree(subfolders, items, _allFolders, _allItems, `vault-${vault.id}`);
    },

    /**
     * Render contents of a deleted folder (for expanded view)
     */
    async renderFolderContents(folder) {
        const { _allFolders, _allItems } = this.trashData;

        // Get subfolders (use String comparison for type safety)
        const subfolders = _allFolders.filter(f => String(f.parent_folder_id) === String(folder.id));

        // Get direct items (use String comparison for type safety)
        const items = _allItems.filter(i => String(i.folder_id) === String(folder.id));

        return await this.renderContentsTree(subfolders, items, _allFolders, _allItems, `folder-${folder.id}`);
    },

    /**
     * Render contents of an orphaned folder (for expanded view)
     */
    async renderOrphanFolderContents(folder) {
        const { _allFolders, _allItems } = this.trashData;

        // Get subfolders (use String comparison for type safety)
        const subfolders = _allFolders.filter(f => String(f.parent_folder_id) === String(folder.id));

        // Get direct items (use String comparison for type safety)
        const items = _allItems.filter(i => String(i.folder_id) === String(folder.id));

        return await this.renderContentsTree(subfolders, items, _allFolders, _allItems, `orphan-folder-${folder.id}`);
    },

    /**
     * Render a tree of folders and items for expanded view
     */
    async renderContentsTree(folders, items, allFolders, allItems, parentKey, decryptedMaps = null) {
        // Pre-decrypt all folders and items on first call, then pass maps down
        if (!decryptedMaps) {
            const decryptedFolders = await this.decryptFolders(allFolders);
            const decryptedItems = await this.decryptItems(allItems);
            decryptedMaps = {
                folders: new Map(decryptedFolders.map(f => [String(f.id), f])),
                items: new Map(decryptedItems.map(i => [String(i.id), i]))
            };
        }

        let html = '<div class="trash-contents-tree">';

        // Render folders first
        for (const folder of folders) {
            const f = decryptedMaps.folders.get(String(folder.id)) || folder;
            const subfolders = allFolders.filter(sf => String(sf.parent_folder_id) === String(folder.id));
            const subItems = allItems.filter(i => String(i.folder_id) === String(folder.id));
            const hasChildren = subfolders.length > 0 || subItems.length > 0;

            html += `
                <div class="trash-tree-node trash-tree-folder">
                    <div class="trash-tree-icon">
                        ${f.icon ? `<span class="folder-emoji">${Utils.escapeHtml(f.icon)}</span>` : `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                        `}
                    </div>
                    <span class="trash-tree-name">${Utils.escapeHtml(f.name)}</span>
                    <button class="btn btn-ghost btn-xs" data-action="move-child" data-type="folder" data-id="${folder.id}">Move</button>
                </div>
            `;

            // Recursively render children (indented) - pass decrypted maps
            if (hasChildren) {
                html += '<div class="trash-tree-children">';
                html += await this.renderContentsTree(subfolders, subItems, allFolders, allItems, `${parentKey}-${folder.id}`, decryptedMaps);
                html += '</div>';
            }
        }

        // Render items
        for (const item of items) {
            const i = decryptedMaps.items.get(String(item.id)) || item;
            const icon = this.getItemIcon(i.item_type);
            const name = this.getItemDisplayName(i);

            html += `
                <div class="trash-tree-node trash-tree-item">
                    <div class="trash-tree-icon">
                        <span class="item-emoji">${icon}</span>
                    </div>
                    <span class="trash-tree-name">${Utils.escapeHtml(name)}</span>
                    <button class="btn btn-ghost btn-xs" data-action="move-child" data-type="item" data-id="${item.id}">Move</button>
                </div>
            `;
        }

        html += '</div>';
        return html;
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Close button
        this.popup.querySelector('#trashClose')?.addEventListener('click', () => this.close());

        // Empty trash button
        this.popup.querySelector('#emptyTrashBtn')?.addEventListener('click', () => this.confirmEmptyTrash());

        // Delegated event handling for all actions
        this.popup.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const type = btn.dataset.type;
            const id = btn.dataset.id;

            switch (action) {
                case 'restore':
                    await this.handleRestore(type, id);
                    break;
                case 'delete':
                    await this.confirmDelete(type, id);
                    break;
                case 'move':
                case 'move-child':
                    await this.handleMove(type, id);
                    break;
            }
        });

        // Expand/collapse handlers
        this.popup.addEventListener('click', async (e) => {
            const expandTrigger = e.target.closest('[data-expand]');
            if (!expandTrigger) return;

            // Don't trigger if clicking action buttons
            if (e.target.closest('[data-action]')) return;

            const key = expandTrigger.dataset.expand;
            const expandedDiv = this.popup.querySelector(`#expanded-${key}`);
            const expandIcon = expandTrigger.querySelector('.trash-expand-icon') || expandTrigger;

            if (this.expandedContainers.has(key)) {
                // Collapse
                this.expandedContainers.delete(key);
                expandIcon.classList.remove('expanded');
                expandedDiv?.classList.remove('show');
            } else {
                // Expand
                this.expandedContainers.add(key);
                expandIcon.classList.add('expanded');

                // Load content if not already loaded
                if (expandedDiv && !expandedDiv.innerHTML.trim()) {
                    // Parse key: "vault-{id}", "folder-{id}", "orphan-folder-{id}"
                    // IDs may contain dashes, so we can't just split('-')
                    let content = '';

                    if (key.startsWith('vault-')) {
                        const id = key.substring('vault-'.length);
                        const vault = this.trashData.deletedVaults.find(v => String(v.id) === id);
                        if (vault) content = await this.renderVaultContents(vault);
                    } else if (key.startsWith('orphan-folder-')) {
                        const id = key.substring('orphan-folder-'.length);
                        const folder = this.trashData.orphanedFolders.find(f => String(f.id) === id);
                        if (folder) content = await this.renderOrphanFolderContents(folder);
                    } else if (key.startsWith('folder-')) {
                        const id = key.substring('folder-'.length);
                        const folder = this.trashData.deletedFolders.find(f => String(f.id) === id);
                        if (folder) content = await this.renderFolderContents(folder);
                    }

                    expandedDiv.innerHTML = content;
                }

                expandedDiv?.classList.add('show');
            }
        });
    },


    /**
     * Handle restore action
     */
    async handleRestore(type, id) {
        try {
            if (type === 'vault') {
                await this.restoreVault(id);
            } else if (type === 'folder') {
                await this.restoreFolder(id);
            } else if (type === 'item') {
                await this.restoreItem(id);
            }

            Toast.success('Restored successfully');
            await this.refresh();
        } catch (error) {
            console.error('Restore failed:', error);
            Toast.error(error.message || 'Failed to restore');
        }
    },

    /**
     * Handle move action
     */
    async handleMove(type, id) {
        // Open FolderBrowser to select destination
        FolderBrowser.show({
            title: 'Move to...',
            onSelect: async (folderId) => {
                try {
                    if (type === 'item' || type === 'orphan-item') {
                        await this.moveItem(id, folderId);
                    } else if (type === 'folder' || type === 'orphan-folder') {
                        await this.moveFolder(id, folderId);
                    }

                    Toast.success('Moved successfully');
                    await this.refresh();
                } catch (error) {
                    console.error('Move failed:', error);
                    Toast.error(error.message || 'Failed to move');
                }
            }
        });
    },

    /**
     * Confirm single item deletion
     */
    async confirmDelete(type, id) {
        // Get item name for confirmation
        let itemName = 'this item';
        let isContainer = false;

        if (type === 'vault') {
            const vault = this.trashData.deletedVaults.find(v => String(v.id) === String(id));
            itemName = vault?.name || 'this vault';
            isContainer = true;
        } else if (type === 'folder' || type === 'orphan-folder') {
            const folders = type === 'folder' ? this.trashData.deletedFolders : this.trashData.orphanedFolders;
            const folder = folders.find(f => String(f.id) === String(id));
            itemName = folder?.name || 'this folder';
            isContainer = folder?._itemCount > 0 || folder?._folderCount > 0;
        } else if (type === 'item' || type === 'orphan-item') {
            const items = type === 'item' ? this.trashData.deletedItems : this.trashData.orphanedItems;
            const item = items.find(i => String(i.id) === String(id));
            itemName = item ? this.getItemDisplayName(item) : 'this item';
        }

        const containerWarning = isContainer ? ' and all its contents' : '';

        Popup.open({
            title: 'Delete Forever',
            body: `
                <div class="alert alert-danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <div>
                        <strong>This action cannot be undone!</strong><br>
                        "${Utils.escapeHtml(itemName)}"${containerWarning} will be permanently deleted.
                    </div>
                </div>
                <label class="custom-checkbox" style="margin-top: var(--space-4);">
                    <input type="checkbox" id="deleteConfirmCheckbox">
                    <span class="checkmark"></span>
                    <span class="checkbox-text">I understand this is permanent</span>
                </label>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true },
                {
                    text: 'Delete Forever',
                    type: 'danger',
                    id: 'confirmDeleteBtn',
                    disabled: true,
                    onClick: async () => {
                        const checkbox = document.getElementById('deleteConfirmCheckbox');
                        if (!checkbox?.checked) {
                            Toast.error('Please confirm you understand');
                            return false;
                        }

                        try {
                            await this.permanentlyDelete(type, id);
                            Toast.success('Deleted permanently');
                            await this.refresh();
                            return true;
                        } catch (error) {
                            console.error('Delete failed:', error);
                            Toast.error(error.message || 'Failed to delete');
                            return false;
                        }
                    }
                }
            ],
            onOpen: (api) => {
                const checkbox = document.getElementById('deleteConfirmCheckbox');
                checkbox?.addEventListener('change', () => {
                    api.setButtonDisabled('confirmDeleteBtn', !checkbox.checked);
                });
            }
        });
    },

    /**
     * Confirm empty trash
     */
    confirmEmptyTrash() {
        const { deletedVaults, deletedFolders, deletedItems, orphanedFolders, orphanedItems } = this.trashData;

        const counts = [];
        if (deletedVaults.length > 0) {
            counts.push(`${deletedVaults.length} vault${deletedVaults.length > 1 ? 's' : ''}`);
        }
        if (deletedFolders.length + orphanedFolders.length > 0) {
            const total = deletedFolders.length + orphanedFolders.length;
            counts.push(`${total} folder${total > 1 ? 's' : ''}`);
        }
        if (deletedItems.length + orphanedItems.length > 0) {
            const total = deletedItems.length + orphanedItems.length;
            counts.push(`${total} item${total > 1 ? 's' : ''}`);
        }

        Popup.open({
            title: 'Empty Trash',
            body: `
                <div class="alert alert-danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <div>
                        <strong>This action cannot be undone!</strong><br>
                        You are about to permanently delete:
                        <ul style="margin: var(--space-2) 0 0 var(--space-4); padding: 0;">
                            ${counts.map(c => `<li>${c} (and all contents)</li>`).join('')}
                        </ul>
                    </div>
                </div>
                <label class="custom-checkbox" style="margin-top: var(--space-4);">
                    <input type="checkbox" id="emptyTrashCheckbox">
                    <span class="checkmark"></span>
                    <span class="checkbox-text">I understand this is permanent</span>
                </label>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true },
                {
                    text: 'Delete Forever',
                    type: 'danger',
                    id: 'confirmEmptyBtn',
                    disabled: true,
                    onClick: async () => {
                        const checkbox = document.getElementById('emptyTrashCheckbox');
                        if (!checkbox?.checked) {
                            Toast.error('Please confirm you understand');
                            return false;
                        }

                        try {
                            await this.emptyTrash();
                            Toast.success('Trash emptied');
                            await this.refresh();
                            return true;
                        } catch (error) {
                            console.error('Empty trash failed:', error);
                            Toast.error(error.message || 'Failed to empty trash');
                            return false;
                        }
                    }
                }
            ],
            onOpen: (api) => {
                const checkbox = document.getElementById('emptyTrashCheckbox');
                checkbox?.addEventListener('change', () => {
                    api.setButtonDisabled('confirmEmptyBtn', !checkbox.checked);
                });
            }
        });
    },

    // === RESTORE OPERATIONS ===

    /**
     * Restore a deleted vault (root folder)
     */
    async restoreVault(id, options = {}) {
        const vault = await LocalDB.get(LocalDB.STORES.FOLDERS, id);
        if (!vault) {
            throw new Error('Vault not found');
        }

        const now = DateUtils.now();
        vault.deleted_at = null;
        vault.updated_at = now;

        // 1. Update locally
        await LocalDB.put(LocalDB.STORES.FOLDERS, vault);

        // 2. If cloud mode, queue for sync
        if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
            await LocalDB.addPendingChange('folder', id, 'update', { deleted_at: null });

            // 3. If online AND not localOnly, sync now
            if (!options.localOnly && typeof Connectivity !== 'undefined' && Connectivity.isOnline()) {
                try {
                    await Vault.syncPendingChanges();
                } catch (e) {
                    console.warn('[Trash] Sync failed, will retry later:', e.message);
                }
            }
        }

        console.log('[Trash] Restored vault:', id);
        return true;
    },

    /**
     * Restore a deleted folder
     */
    async restoreFolder(id, options = {}) {
        const folder = await LocalDB.get(LocalDB.STORES.FOLDERS, id);
        if (!folder) {
            throw new Error('Folder not found');
        }

        // Check if parent folder is deleted (unless parent is a vault)
        if (folder.parent_folder_id) {
            const parent = await LocalDB.get(LocalDB.STORES.FOLDERS, folder.parent_folder_id);
            if (parent?.deleted_at && parent.parent_folder_id !== null) {
                throw new Error('Cannot restore - parent folder is in trash');
            }
        }

        // Find vault by traversing up parent chain
        const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const folderMap = new Map(allFolders.map(f => [String(f.id), f]));
        let current = folder;
        while (current && current.parent_folder_id !== null) {
            current = folderMap.get(String(current.parent_folder_id));
        }
        const vault = current;

        if (!vault) {
            throw new Error('Cannot restore - vault no longer exists');
        }
        if (vault.deleted_at) {
            throw new Error('Cannot restore - vault is in trash');
        }

        const now = DateUtils.now();
        folder.deleted_at = null;
        folder.updated_at = now;

        // 1. Update locally
        await LocalDB.put(LocalDB.STORES.FOLDERS, folder);

        // 2. If cloud mode, queue for sync
        if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
            await LocalDB.addPendingChange('folder', id, 'update', { deleted_at: null });

            // 3. If online AND not localOnly, sync now
            if (!options.localOnly && typeof Connectivity !== 'undefined' && Connectivity.isOnline()) {
                try {
                    await Vault.syncPendingChanges();
                } catch (e) {
                    console.warn('[Trash] Sync failed, will retry later:', e.message);
                }
            }
        }

        console.log('[Trash] Restored folder:', id);
        return true;
    },

    /**
     * Restore a deleted item
     */
    async restoreItem(id, options = {}) {
        const item = await LocalDB.get(LocalDB.STORES.ITEMS, id);
        if (!item) {
            throw new Error('Item not found');
        }

        // Check if item has a valid folder_id
        if (!item.folder_id) {
            throw new Error('Cannot restore - item has no folder. Use Move to place it in a folder first.');
        }

        // Check if folder exists and is not deleted
        const folder = await LocalDB.get(LocalDB.STORES.FOLDERS, item.folder_id);
        if (!folder) {
            throw new Error('Cannot restore - folder no longer exists. Use Move to place it in a different folder.');
        }
        if (folder.deleted_at) {
            throw new Error('Cannot restore - folder is in trash. Restore the folder first or use Move.');
        }

        // Find vault by traversing up parent chain
        const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const folderMap = new Map(allFolders.map(f => [String(f.id), f]));
        let current = folder;
        while (current && current.parent_folder_id !== null) {
            current = folderMap.get(String(current.parent_folder_id));
        }
        const vault = current;

        if (!vault) {
            throw new Error('Cannot restore - vault no longer exists');
        }
        if (vault.deleted_at) {
            throw new Error('Cannot restore - vault is in trash. Restore the vault first.');
        }

        const now = DateUtils.now();
        item.deleted_at = null;
        item.updated_at = now;

        // 1. Update locally
        await LocalDB.put(LocalDB.STORES.ITEMS, item);

        // 2. If cloud mode, queue for sync
        if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
            await LocalDB.addPendingChange('item', id, 'update', { deleted_at: null });

            // 3. If online AND not localOnly, sync now
            if (!options.localOnly && typeof Connectivity !== 'undefined' && Connectivity.isOnline()) {
                try {
                    await Vault.syncPendingChanges();
                } catch (e) {
                    console.warn('[Trash] Sync failed, will retry later:', e.message);
                }
            }
        }

        console.log('[Trash] Restored item:', id);
        return true;
    },

    // === MOVE OPERATIONS ===

    /**
     * Move an item to a new folder
     * Works for orphaned, implicitly deleted, or explicitly deleted items
     */
    async moveItem(itemId, targetFolderId) {
        const item = await LocalDB.get(LocalDB.STORES.ITEMS, itemId);
        if (!item) {
            throw new Error('Item not found');
        }

        // Validate target folder
        const targetFolder = await LocalDB.get(LocalDB.STORES.FOLDERS, targetFolderId);
        if (!targetFolder) {
            throw new Error('Target folder not found');
        }
        if (targetFolder.deleted_at) {
            throw new Error('Cannot move to a deleted folder');
        }

        // Find vault by traversing up parent chain
        const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const folderMap = new Map(allFolders.map(f => [String(f.id), f]));
        let current = targetFolder;
        while (current && current.parent_folder_id !== null) {
            current = folderMap.get(String(current.parent_folder_id));
        }
        const targetVault = current;

        if (!targetVault) {
            throw new Error('Target vault not found');
        }
        if (targetVault.deleted_at) {
            throw new Error('Cannot move to a deleted vault');
        }

        const now = DateUtils.now();

        // Update item
        item.folder_id = targetFolderId;
        item.deleted_at = null; // Clear if was explicitly deleted
        item.updated_at = now;

        // 1. Save to IndexedDB
        await LocalDB.put(LocalDB.STORES.ITEMS, item);

        // 2. If cloud mode, queue for sync
        if (LocalDB.getMode() !== 'local' && TempId.isReal(itemId)) {
            await LocalDB.addPendingChange('item', itemId, 'update', {
                folder_id: targetFolderId,
                deleted_at: null,
            });

            // 3. If online, sync now
            if (typeof Connectivity !== 'undefined' && Connectivity.isOnline()) {
                try {
                    await Vault.syncPendingChanges();
                } catch (e) {
                    console.warn('[Trash] Sync failed, will retry later:', e);
                }
            }
        }

        console.log('[Trash] Moved item:', itemId, 'to folder:', targetFolderId);
        return true;
    },

    /**
     * Move a folder to a new parent folder
     * Works for orphaned, implicitly deleted, or explicitly deleted folders
     */
    async moveFolder(folderId, targetFolderId) {
        const folder = await LocalDB.get(LocalDB.STORES.FOLDERS, folderId);
        if (!folder) {
            throw new Error('Folder not found');
        }

        // Can't move root folders (vaults)
        if (folder.parent_folder_id === null) {
            throw new Error('Cannot move a vault');
        }

        // Validate target folder
        const targetFolder = await LocalDB.get(LocalDB.STORES.FOLDERS, targetFolderId);
        if (!targetFolder) {
            throw new Error('Target folder not found');
        }
        if (targetFolder.deleted_at) {
            throw new Error('Cannot move to a deleted folder');
        }

        // Find target vault by traversing up parent chain
        const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const folderMap = new Map(allFolders.map(f => [String(f.id), f]));

        let current = targetFolder;
        while (current && current.parent_folder_id !== null) {
            current = folderMap.get(String(current.parent_folder_id));
        }
        const targetVault = current;

        if (!targetVault) {
            throw new Error('Target vault not found');
        }
        if (targetVault.deleted_at) {
            throw new Error('Cannot move to a deleted vault');
        }

        // Can't move folder into itself
        if (folderId === targetFolderId) {
            throw new Error('Cannot move folder into itself');
        }

        // Can't move folder into its own descendants
        const descendants = await this.getFolderDescendants(folderId);
        if (descendants.some(d => String(d.id) === String(targetFolderId))) {
            throw new Error('Cannot move folder into its own subfolder');
        }

        const now = DateUtils.now();

        // Update the folder
        folder.parent_folder_id = targetFolderId;
        folder.deleted_at = null; // Clear if was explicitly deleted
        folder.updated_at = now;

        // 1. Save folder to IndexedDB
        await LocalDB.put(LocalDB.STORES.FOLDERS, folder);

        // 2. If cloud mode, queue for sync
        if (LocalDB.getMode() !== 'local' && TempId.isReal(folderId)) {
            await LocalDB.addPendingChange('folder', folderId, 'update', {
                parent_folder_id: targetFolderId,
                deleted_at: null,
            });

            // 3. If online, sync now
            if (typeof Connectivity !== 'undefined' && Connectivity.isOnline()) {
                try {
                    await Vault.syncPendingChanges();
                } catch (e) {
                    console.warn('[Trash] Sync failed, will retry later:', e);
                }
            }
        }

        console.log('[Trash] Moved folder:', folderId, 'to parent:', targetFolderId);
        return true;
    },

    /**
     * Get all descendant folders of a folder
     */
    async getFolderDescendants(folderId) {
        const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const descendants = [];

        const collectDescendants = (parentId) => {
            const children = allFolders.filter(f => f.parent_folder_id === parentId);
            for (const child of children) {
                descendants.push(child);
                collectDescendants(child.id);
            }
        };

        collectDescendants(folderId);
        return descendants;
    },

    // === DELETE OPERATIONS ===

    /**
     * Permanently delete based on type - uses existing Vault methods
     */
    async permanentlyDelete(type, id) {
        switch (type) {
            case 'vault':
                await Vault.deleteVault(id);
                break;
            case 'folder':
            case 'orphan-folder':
                await Vault.deleteFolder(id);
                break;
            case 'item':
            case 'orphan-item':
                await Vault.deleteItem(id);
                break;
            default:
                throw new Error(`Unknown type: ${type}`);
        }
    },

    /**
     * Empty all trash (delete everything)
     */
    async emptyTrash() {
        const { deletedVaults, deletedFolders, deletedItems, orphanedFolders, orphanedItems } = this.trashData;

        // Delete all deleted vaults (cascades to their contents)
        for (const vault of deletedVaults) {
            await Vault.deleteVault(vault.id);
        }

        // Delete deleted folders (not in deleted vaults)
        for (const folder of deletedFolders) {
            await Vault.deleteFolder(folder.id);
        }

        // Delete deleted items
        for (const item of deletedItems) {
            await Vault.deleteItem(item.id);
        }

        // Delete orphaned folders
        for (const folder of orphanedFolders) {
            await Vault.deleteFolder(folder.id);
        }

        // Delete orphaned items
        for (const item of orphanedItems) {
            await Vault.deleteItem(item.id);
        }
    },

    // === AUTO-CLEANUP ===

    /**
     * Clean up items older than 30 days
     * Call this on app initialization
     */
    async cleanupOldTrash() {
        try {
            await LocalDB.ensureInit();

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.AUTO_DELETE_DAYS);
            const cutoffTime = cutoffDate.getTime();

            const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
            const allItems = await LocalDB.getAll(LocalDB.STORES.ITEMS);

            let deletedCount = 0;

            // Separate vaults (root folders) from regular folders
            const allVaults = allFolders.filter(f => f.parent_folder_id === null);

            // Delete old vaults
            const oldVaults = allVaults.filter(v =>
                v.deleted_at && new Date(v.deleted_at).getTime() < cutoffTime
            );
            for (const vault of oldVaults) {
                await Vault.deleteVault(vault.id);
                deletedCount++;
            }

            // Build helper to find vault for a folder
            const folderMap = new Map(allFolders.map(f => [String(f.id), f]));
            const findVaultForFolder = (folder) => {
                if (!folder) return null;
                if (folder.parent_folder_id === null) return folder;  // It's a vault
                let current = folder;
                while (current && current.parent_folder_id !== null) {
                    current = folderMap.get(String(current.parent_folder_id));
                }
                return current || null;
            };

            // Delete old folders (not in deleted vaults)
            const deletedVaultIds = new Set(oldVaults.map(v => String(v.id)));
            const oldFolders = allFolders.filter(f => {
                if (!f.deleted_at || f.parent_folder_id === null) return false;
                if (new Date(f.deleted_at).getTime() >= cutoffTime) return false;
                const vault = findVaultForFolder(f);
                // Include if vault doesn't exist or wasn't just deleted
                return !vault || !deletedVaultIds.has(String(vault.id));
            });
            for (const folder of oldFolders) {
                await Vault.deleteFolder(folder.id);
                deletedCount++;
            }

            // Delete old items (not in deleted folders)
            const deletedFolderIds = new Set(oldFolders.map(f => String(f.id)));
            const oldItems = allItems.filter(i => {
                if (!i.deleted_at) return false;
                if (new Date(i.deleted_at).getTime() >= cutoffTime) return false;
                // Skip if folder was just deleted
                return !deletedFolderIds.has(String(i.folder_id));
            });
            for (const item of oldItems) {
                await Vault.deleteItem(item.id);
                deletedCount++;
            }

            if (deletedCount > 0) {
                console.log(`[Trash] Auto-cleanup: deleted ${deletedCount} old items`);
            }
        } catch (error) {
            console.error('[Trash] Auto-cleanup failed:', error);
        }
    },

    // === CLOUD SYNC ===

    /**
     * Queue sync operation if in cloud mode
     */
    async syncIfCloud(store, id, operation) {
        if (LocalDB.getMode() === 'cloud') {
            await LocalDB.addPendingChange(store, id, operation);

            // Sync immediately if online
            if (typeof Connectivity !== 'undefined' && Connectivity.isOnline()) {
                try {
                    await Vault.syncPendingChanges();
                } catch (e) {
                    console.warn('Sync failed, will retry later:', e);
                }
            }
        }
    },

    // === HELPERS ===

    /**
     * Get item icon based on type
     */
    getItemIcon(type) {
        switch (type) {
            case 'password':
            case 'login': return '🔑';
            case 'note': return '📝';
            case 'card': return '💳';
            case 'identity': return '👤';
            case 'totp': return '🔐';
            case 'website': return '🌐';
            case 'file': return '📎';
            default: return '🔑';
        }
    },

    /**
     * Get subtitle for an item based on its type
     */
    getItemSubtitle(item) {
        const data = item.data || {};
        switch (item.item_type) {
            case 'password':
            case 'login':
                return data.username || data.website_url || '';
            case 'website':
                return data.website_url || data.url || '';
            case 'note':
                return '';
            case 'file':
                return data.file_name || '';
            default:
                return '';
        }
    },

    /**
     * Calculate days left before auto-deletion
     */
    getDaysLeft(deletedAt) {
        return DateUtils.daysRemaining(deletedAt, this.AUTO_DELETE_DAYS);
    },

    /**
     * Format time ago string
     */
    getTimeAgo(dateStr) {
        if (!dateStr) return 'unknown';
        return DateUtils.toRelative(dateStr);
    },

    /**
     * Format content info string
     */
    formatContentInfo(folderCount, itemCount) {
        const parts = [];
        if (folderCount > 0) {
            parts.push(`${folderCount} folder${folderCount !== 1 ? 's' : ''}`);
        }
        if (itemCount > 0) {
            parts.push(`${itemCount} item${itemCount !== 1 ? 's' : ''}`);
        }
        return parts.join(', ');
    },

    /**
     * Refresh the trash view - close and reopen for reliable update
     */
    async refresh() {
        // Remove current popup immediately (no animation)
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
        }
        document.body.classList.remove('popup-open');

        // Reload fresh data
        this.trashData = await this.getTrashContents();

        // Check if trash is now empty
        const hasContent = this.trashData.deletedVaults.length > 0 ||
                          this.trashData.deletedFolders.length > 0 ||
                          this.trashData.deletedItems.length > 0 ||
                          this.trashData.orphanedFolders.length > 0 ||
                          this.trashData.orphanedItems.length > 0;

        if (!hasContent) {
            Toast.success('Trash is empty');
            return;
        }

        // Reopen with fresh data
        this.createPopup();
        this.bindEvents();
    },

    /**
     * Get trash count for badge - lightweight, no decryption
     */
    async getTrashCount() {
        try {
            await LocalDB.ensureInit();

            const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
            const allItems = await LocalDB.getAll(LocalDB.STORES.ITEMS);

            // Build lookup map (use String keys for consistent lookups)
            const folderMap = new Map(allFolders.map(f => [String(f.id), f]));

            // Helper: find which vault a folder belongs to by traversing up parent chain
            const findVaultForFolder = (folder) => {
                if (!folder) return null;
                if (folder.parent_folder_id === null) return folder;  // It's a vault
                let current = folder;
                while (current && current.parent_folder_id !== null) {
                    current = folderMap.get(String(current.parent_folder_id));
                }
                return current || null;
            };

            // Count deleted vaults (root folders)
            const deletedVaultCount = allFolders.filter(f => f.parent_folder_id === null && f.deleted_at).length;

            // Count deleted folders (non-vault, whose vault is NOT deleted)
            const deletedFolderCount = allFolders.filter(f => {
                if (!f.deleted_at || f.parent_folder_id === null) return false;
                const vault = findVaultForFolder(f);
                return !vault || !vault.deleted_at;
            }).length;

            // Count deleted items (whose folder/vault is NOT deleted)
            const deletedItemCount = allItems.filter(i => {
                if (!i.deleted_at) return false;
                const folder = folderMap.get(String(i.folder_id));
                if (!folder) return true;
                if (folder.deleted_at) return false;
                const vault = findVaultForFolder(folder);
                if (!vault) return true;
                if (vault.deleted_at) return false;
                return true;
            }).length;

            // Count orphaned folders (vault doesn't exist)
            const orphanedFolderCount = allFolders.filter(f => {
                if (f.deleted_at || f.parent_folder_id === null) return false;
                const vault = findVaultForFolder(f);
                return !vault;
            }).length;

            // Count orphaned items (folder doesn't exist or folder's vault doesn't exist)
            const orphanedItemCount = allItems.filter(i => {
                if (i.deleted_at) return false;
                const folder = folderMap.get(String(i.folder_id));
                if (!folder) return true;
                if (folder.deleted_at) return false;
                const vault = findVaultForFolder(folder);
                if (!vault) return true;
                return false;
            }).length;

            return deletedVaultCount + deletedFolderCount + deletedItemCount +
                   orphanedFolderCount + orphanedItemCount;
        } catch (e) {
            return 0;
        }
    },

    /**
     * Close the popup
     */
    close() {
        if (!this.popup) return;

        this.popup.classList.remove('active');
        document.body.classList.remove('popup-open');

        setTimeout(() => {
            this.popup.remove();
            this.popup = null;
        }, 300);
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.TrashManager = TrashManager;
}
