/**
 * Vault Manager - IndexedDB First Architecture
 *
 * All data is read from and written to IndexedDB.
 * For cloud mode, changes are synced to the API after saving locally.
 * This ensures consistent behavior for both local and cloud modes.
 */

const Vault = {
    // State flags
    isUnlocked: false,
    _offlineMode: false,  // true = local-only mode (no API calls)
    _isSyncing: false,    // true = sync in progress (prevents concurrent syncs)
    _keyVerified: false,  // true after first successful decryption (distinguishes wrong password from corruption)
    _lastSync: null,

    // Currently selected vault/folder (decrypted, for UI convenience)
    // Note: A vault IS a root folder (parent_folder_id = null)
    _currentVault: null,
    _currentFolderId: null,

    /**
     * Check if currently in offline/local mode
     * @returns {boolean}
     */
    isOffline() {
        return this._offlineMode;
    },

    /**
     * Set offline mode
     * @param {boolean} offline
     */
    setOfflineMode(offline) {
        const wasOffline = this._offlineMode;
        this._offlineMode = offline;

        if (offline && !wasOffline) {
            console.log('[Vault] Entering offline mode');
            window.dispatchEvent(new CustomEvent('vaultoffline'));
        } else if (!offline && wasOffline) {
            console.log('[Vault] Exiting offline mode');
        }
    },

    // ===========================================
    // Initialization
    // ===========================================

    /**
     * Initialize vault
     * For cloud mode: pulls from API and saves to IndexedDB
     * For local mode: just verifies IndexedDB has data
     * @returns {Promise<void>}
     */
    async init() {
        if (!await KeyDerivation.isUnlocked()) {
            throw new Error('Vault is locked');
        }

        // Ensure LocalDB is initialized
        if (typeof LocalDB === 'undefined' || !LocalDB.getDatabaseName()) {
            throw new Error('LocalDB not configured');
        }
        await LocalDB.init();

        // Check if we're in local-only mode or cloud mode
        const isLocalMode = this._offlineMode || LocalDB.getMode() === 'local';

        if (isLocalMode) {
            // Local mode: check if we have data (new users won't yet)
            const hasData = await LocalDB.hasData();
            this.setOfflineMode(true);
            this.isUnlocked = true;
            this._lastSync = await LocalDB.getLastSyncTime();
            if (hasData) {
                console.log('[Vault] Initialized from LocalDB (local mode)');
            } else {
                console.log('[Vault] New local vault - will create default vault');
            }
        } else {
            // Cloud mode: try to sync from server
            const isOnline = typeof Connectivity !== 'undefined'
                ? Connectivity.isOnline()
                : navigator.onLine;

            if (isOnline) {
                try {
                    await this._syncFromServer();
                    this.setOfflineMode(false);
                    console.log('[Vault] Initialized from server');
                } catch (error) {
                    console.warn('[Vault] Server sync failed, using cached data:', error.message);
                    const hasData = await LocalDB.hasData();
                    if (!hasData) {
                        throw new Error('No cached data available. Please connect to the internet.');
                    }
                    this.setOfflineMode(true);
                }
            } else {
                // Offline: use cached data
                const hasData = await LocalDB.hasData();
                if (!hasData) {
                    throw new Error('No cached data available. Please connect to the internet.');
                }
                this.setOfflineMode(true);
                console.log('[Vault] Initialized from cache (offline)');
            }
        }

        this.isUnlocked = true;
        this._keyVerified = false;
        this._lastSync = await LocalDB.getLastSyncTime();

        // Verify the key by decrypting the default vault — this MUST succeed.
        // If it fails, the master password is wrong (not corruption).
        let defaultVault = await this.getDefaultVault();
        if (!defaultVault) {
            // No default vault exists - create one
            const userName = (typeof App !== 'undefined' && App.state?.user?.name) || 'Personal';
            const vaultName = userName + "'s Vault";
            console.log('[Vault] No default vault found, creating one:', vaultName);
            defaultVault = await this.createVault(vaultName);
        }
        this._currentVault = defaultVault;
    },

    /**
     * Sync data from server to IndexedDB
     * @private
     */
    async _syncFromServer() {
        // CRITICAL: Never sync during locked operations
        if (typeof App !== 'undefined' && App.isLocked()) {
            console.log('[Vault] Sync from server blocked - ' + (App.getLockReason() || 'operation') + ' in progress');
            return;
        }

        // CRITICAL: Don't overwrite IndexedDB if there's an incomplete re-encryption.
        // IndexedDB may have new-key data that the server doesn't have yet.
        if (typeof LocalDB !== 'undefined' && await LocalDB.hasIncompleteReencryption()) {
            console.warn('[Vault] Sync from server blocked - incomplete re-encryption detected');
            return;
        }

        const response = await ApiClient.fullSync();

        if (!response.success) {
            throw new Error(response.message || 'Failed to sync vault');
        }

        // Save server data to IndexedDB (already encrypted)
        // Folders include vaults (parent_folder_id = null) with is_default field
        const folders = (response.data.folders || []).map(f => ({
            id: f.id,
            parent_folder_id: f.parent_folder_id,
            encrypted_name: f.encrypted_name,
            encrypted_icon: f.encrypted_icon,
            is_default: f.is_default,  // For vaults (root folders)
            sort_order: f.sort_order,
            created_at: f.created_at,
            updated_at: f.updated_at,
            deleted_at: f.deleted_at,
        }));

        const items = (response.data.items || []).map(item => ({
            id: item.id,
            item_type: item.item_type,
            folder_id: item.folder_id,
            encrypted_data: item.encrypted_data,
            version: item.version,
            sort_order: item.sort_order,
            created_at: item.created_at,
            updated_at: item.updated_at,
            deleted_at: item.deleted_at,
        }));

        await LocalDB.saveVaultData({ folders, items });
        this._lastSync = response.data.server_time;

        // Count vaults for logging
        const vaultCount = folders.filter(f => f.parent_folder_id === null).length;

        console.log('[Vault] Synced from server:', {
            vaults: vaultCount,
            folders: folders.length,
            items: items.length
        });
    },

    // ===========================================
    // Encryption Helpers
    // ===========================================

    /**
     * Decrypt a single field
     * @param {string} encrypted
     * @returns {Promise<string>}
     */
    async decryptField(encrypted) {
        if (!encrypted) return '';
        return await Encryption.decrypt(encrypted);
    },

    /**
     * Encrypt a single field
     * @param {string} value
     * @returns {Promise<string>}
     */
    async encryptField(value) {
        return await Encryption.encrypt(value);
    },

    /**
     * Decrypt a folder object
     * Note: Root folders (vaults) now have encrypted names too
     * @param {Object} encryptedFolder
     * @returns {Promise<Object>}
     */
    async _decryptFolder(encryptedFolder) {
        // Skip decryption for deleted folders
        if (encryptedFolder.deleted_at) {
            return {
                ...encryptedFolder,
                name: '[Deleted]',
                icon: null,
            };
        }
        try {
            const result = {
                ...encryptedFolder,
                name: encryptedFolder.encrypted_name ? await this.decryptField(encryptedFolder.encrypted_name) : '',
                icon: encryptedFolder.encrypted_icon ? await this.decryptField(encryptedFolder.encrypted_icon) : null,
            };
            // First successful decryption confirms the key is correct
            if (!this._keyVerified) this._keyVerified = true;
            return result;
        } catch (e) {
            // If key hasn't been verified yet, this is a wrong password — let it throw
            if (!this._keyVerified) throw e;
            console.error(`[Vault] Failed to decrypt folder ${encryptedFolder.id}:`, e.message);
            return {
                ...encryptedFolder,
                name: '[Corrupted]',
                icon: null,
                _corrupted: true,
            };
        }
    },

    /**
     * Decrypt an item object
     * @param {Object} encryptedItem
     * @returns {Promise<Object>}
     */
    async _decryptItem(encryptedItem) {
        // Skip decryption for deleted items
        if (encryptedItem.deleted_at) {
            return {
                id: encryptedItem.id,
                item_type: encryptedItem.item_type,
                folder_id: encryptedItem.folder_id,
                version: encryptedItem.version,
                sort_order: encryptedItem.sort_order,
                created_at: encryptedItem.created_at,
                updated_at: encryptedItem.updated_at,
                deleted_at: encryptedItem.deleted_at,
                data: { name: '[Deleted]' },
            };
        }

        try {
            const data = encryptedItem.encrypted_data
                ? await Encryption.decryptObject(encryptedItem.encrypted_data)
                : encryptedItem.data || {};

            if (!this._keyVerified) this._keyVerified = true;
            return {
                id: encryptedItem.id,
                item_type: encryptedItem.item_type,
                folder_id: encryptedItem.folder_id,
                version: encryptedItem.version,
                sort_order: encryptedItem.sort_order,
                created_at: encryptedItem.created_at,
                updated_at: encryptedItem.updated_at,
                data,
            };
        } catch (e) {
            if (!this._keyVerified) throw e;
            console.error(`[Vault] Failed to decrypt item ${encryptedItem.id}:`, e.message);
            return {
                id: encryptedItem.id,
                item_type: encryptedItem.item_type,
                folder_id: encryptedItem.folder_id,
                version: encryptedItem.version,
                sort_order: encryptedItem.sort_order,
                created_at: encryptedItem.created_at,
                updated_at: encryptedItem.updated_at,
                data: { name: '[Corrupted]' },
                _corrupted: true,
            };
        }
    },

    // ===========================================
    // Vaults - Read Operations
    // A vault IS a root folder (parent_folder_id = null)
    // ===========================================

    /**
     * Get all vaults (decrypted)
     * Vaults are folders with parent_folder_id = null
     * @returns {Promise<Array>}
     */
    async getVaults() {
        const encryptedVaults = await LocalDB.getVaults();
        return Promise.all(encryptedVaults.map(v => this._decryptFolder(v)));
    },

    /**
     * Get a single vault by ID (decrypted)
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getVault(id) {
        const encrypted = await LocalDB.getVault(id);
        if (!encrypted) return null;
        return this._decryptFolder(encrypted);
    },

    /**
     * Get default vault (decrypted)
     * @returns {Promise<Object|null>}
     */
    async getDefaultVault() {
        const encrypted = await LocalDB.getDefaultVault();
        if (!encrypted) return null;
        return this._decryptFolder(encrypted);
    },

    /**
     * Get current vault
     * @returns {Object|null}
     */
    getCurrentVault() {
        return this._currentVault;
    },

    /**
     * Set current vault
     * @param {Object} vault - Decrypted vault (root folder) object
     */
    setCurrentVault(vault) {
        this._currentVault = vault;
        this._currentFolderId = null;
        window.dispatchEvent(new CustomEvent('vaultchange', { detail: { vault } }));
    },

    // ===========================================
    // Vaults - Write Operations
    // A vault IS a root folder (parent_folder_id = null)
    // ===========================================

    /**
     * Create a new vault (root folder)
     * First vault is automatically set as default
     * @param {string} name
     * @param {Object} options - Optional: { id, localOnly }
     * @returns {Promise<Object>}
     */
    async createVault(name, options = {}) {
        const encryptedName = await this.encryptField(name);
        const now = DateUtils.now();
        const existingVaults = await LocalDB.getVaults();
        const sortOrder = existingVaults.length;

        // Use provided ID or generate new one
        const vaultId = options.id || TempId.generate();

        // A vault is a folder with parent_folder_id = null
        // First vault is automatically default
        const vault = {
            id: vaultId,
            parent_folder_id: null,
            encrypted_name: encryptedName,
            encrypted_icon: null,
            is_default: existingVaults.length === 0,
            sort_order: sortOrder,
            created_at: now,
            updated_at: now,
        };

        // 1. Always save to IndexedDB first
        await LocalDB.saveVault(vault);

        // 2. If cloud mode, queue for sync (as a folder with parent_folder_id = null)
        if (LocalDB.getMode() !== 'local') {
            await LocalDB.addPendingChange('folder', vaultId, 'create', {
                parent_folder_id: null,
                encrypted_name: encryptedName,
                encrypted_icon: null,
                is_default: vault.is_default,
                sort_order: sortOrder,
            });

            // 3. If online AND not localOnly, sync now
            if (!this._offlineMode && !options.localOnly) {
                await this.syncPendingChanges();
            }
        }

        console.log('[Vault] Created vault:', vaultId);
        return this._decryptFolder(vault);
    },

    /**
     * Update a vault
     * @param {string} id
     * @param {string} name
     * @param {boolean|null} isDefault
     * @returns {Promise<Object>}
     */
    async updateVault(id, name, isDefault = null) {
        const encryptedName = await this.encryptField(name);
        const now = DateUtils.now();

        // Get existing vault
        const existing = await LocalDB.getVault(id);
        if (!existing) {
            throw new Error('Vault not found');
        }

        const updated = {
            ...existing,
            encrypted_name: encryptedName,
            updated_at: now,
        };
        if (isDefault !== null) {
            updated.is_default = isDefault;
        }

        // 1. Always save to IndexedDB first
        await LocalDB.saveVault(updated);

        // 2. If cloud mode, queue for sync
        if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
            await LocalDB.addPendingChange('folder', id, 'update', {
                encrypted_name: encryptedName,
                is_default: isDefault,
            });

            // 3. If online, sync now
            if (!this._offlineMode) {
                await this.syncPendingChanges();
            }
        }

        // Update current vault if it's the one being edited
        if (this._currentVault?.id === id) {
            this._currentVault = await this._decryptFolder(updated);
        }

        console.log('[Vault] Updated vault:', id);
        return this._decryptFolder(updated);
    },

    /**
     * Permanently delete a vault and all its contents
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteVault(id) {
        // Lock to prevent sync interference
        if (typeof App !== 'undefined') App.lock('delete');

        try {
            // Check if this is the default vault
            const vault = await LocalDB.getVault(id);
            if (vault?.is_default) {
                throw new Error('Cannot delete default vault');
            }

            // Hard delete: cascade delete all children (folders and items in this vault)
            const folders = await LocalDB.getFoldersByVault(id);
            const allItems = [];

            // Get items in vault root
            const rootItems = await LocalDB.getItemsByFolder(id);
            allItems.push(...rootItems);

            // Get items in subfolders
            for (const folder of folders) {
                const items = await LocalDB.getItemsByFolder(folder.id);
                allItems.push(...items);
            }

            // Delete all items
            for (const item of allItems) {
                await LocalDB.hardDeleteItem(item.id);
            }

            // Delete all subfolders
            for (const folder of folders) {
                await LocalDB.hardDeleteFolder(folder.id);
            }

            // Delete the vault itself
            await LocalDB.hardDeleteVault(id);

            console.log('[Vault] Deleted vault and contents:', id, {
                folders: folders.length,
                items: allItems.length
            });

            // 2. Cloud mode: sync to server or queue
            if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
                if (!this._offlineMode) {
                    // Online: call API (vault is deleted via folder endpoint)
                    try {
                        const response = await ApiClient.deleteVault(id);
                        if (!response.success) {
                            console.warn('[Vault] API delete vault failed:', response.message);
                        }
                    } catch (e) {
                        // 404 = already deleted on server, which is fine
                        if (!e.message?.toLowerCase().includes('not found')) {
                            console.warn('[Vault] API delete vault failed:', e.message);
                        }
                    }
                } else {
                    // Offline: queue pending change
                    await LocalDB.addPendingChange('folder', id, 'delete');
                }
            }

            // Reset current vault if deleted
            if (this._currentVault?.id === id) {
                this._currentVault = await this.getDefaultVault();
            }

            return true;
        } finally {
            if (typeof App !== 'undefined') App.unlock();
        }
    },

    /**
     * Soft delete a vault (set deleted_at timestamp)
     * Children remain but won't display since parent vault is deleted
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async softDeleteVault(id, options = {}) {
        // Lock to prevent sync interference
        if (typeof App !== 'undefined') App.lock('delete');

        let shouldSync = false;
        try {
            const vault = await LocalDB.getVault(id);
            if (!vault) {
                throw new Error('Vault not found');
            }

            if (vault.is_default) {
                throw new Error('Cannot delete default vault');
            }

            const now = DateUtils.now();
            vault.deleted_at = now;
            vault.updated_at = now;

            // 1. Always save to IndexedDB first
            await LocalDB.saveVault(vault);

            // 2. If cloud mode, queue for sync
            if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
                await LocalDB.addPendingChange('folder', id, 'update', { deleted_at: now });
                shouldSync = !this._offlineMode && !options.localOnly;
            }

            // Reset current vault if deleted
            if (this._currentVault?.id === id) {
                this._currentVault = await this.getDefaultVault();
            }

            console.log('[Vault] Soft deleted vault:', id);
        } finally {
            if (typeof App !== 'undefined') App.unlock();
        }

        // 3. Sync after unlock to avoid blocking ourselves
        if (shouldSync) {
            await this.syncPendingChanges();
        }

        return true;
    },

    /**
     * Update vaults sort order
     * @param {Array} orderData - Array of {id, sort_order}
     * @returns {Promise<boolean>}
     */
    async updateVaultsOrder(orderData) {
        // Batch update IndexedDB - get all vaults at once
        const allVaults = await LocalDB.getVaults();
        const orderMap = new Map(orderData.map(o => [o.id, o.sort_order]));
        const updatedVaults = [];

        for (const vault of allVaults) {
            if (orderMap.has(vault.id)) {
                vault.sort_order = orderMap.get(vault.id);
                updatedVaults.push(vault);
            }
        }

        if (updatedVaults.length > 0) {
            await LocalDB.saveVaults(updatedVaults);
        }

        // For cloud mode: sync to API or queue
        if (!this._offlineMode) {
            const response = await ApiClient.updateVaultsOrder(orderData);
            if (!response.success) {
                throw new Error(response.message);
            }
        } else if (LocalDB.getMode() !== 'local') {
            // Queue a single batch order change for sync
            const realIds = orderData.filter(o => TempId.isReal(o.id));
            if (realIds.length > 0) {
                await LocalDB.addPendingChange('vault_order', 'batch', 'order', {
                    items: realIds
                });
            }
        }

        console.log('[Vault] Updated vaults order');
        return true;
    },

    // ===========================================
    // Folders - Read Operations
    // ===========================================

    /**
     * Get folders (decrypted), optionally filtered by vault or parent
     * @param {string|null} vaultId - Vault ID to get folders from (null = all folders)
     * @param {string|null} parentFolderId - Parent folder ID to filter by
     * @returns {Promise<Array>}
     */
    async getFolders(vaultId = null, parentFolderId = null) {
        let folders;

        if (vaultId) {
            // Get non-root folders within a vault
            folders = await LocalDB.getFoldersByVault(vaultId);
        } else {
            folders = await LocalDB.getFolders();
            folders.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        }

        // Filter by parent folder
        if (parentFolderId !== undefined && parentFolderId !== null) {
            folders = folders.filter(f => f.parent_folder_id === parentFolderId);
        }

        // Exclude root folders (vaults) - they're retrieved via getVaults()
        folders = folders.filter(f => f.parent_folder_id !== null);

        // Decrypt
        return Promise.all(folders.map(f => this._decryptFolder(f)));
    },

    /**
     * Get a single folder by ID (decrypted)
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getFolder(id) {
        const encrypted = await LocalDB.getFolder(id);
        if (!encrypted) return null;
        return this._decryptFolder(encrypted);
    },

    /**
     * Get root folder for a vault (alias for getVault)
     * Vault IS a folder with parent_folder_id = null, so this just returns the vault itself
     * @param {string} vaultId
     * @returns {Promise<Object|null>}
     */
    async getRootFolder(vaultId) {
        return this.getVault(vaultId);
    },

    /**
     * Get or fetch root folder for a vault (alias for getVault with fetch fallback)
     * Vault IS a folder with parent_folder_id = null, so this returns the vault itself
     * @param {string} vaultId
     * @returns {Promise<Object>}
     */
    async getOrFetchRootFolder(vaultId) {
        let vault = await this.getVault(vaultId);
        if (vault) {
            return vault;
        }

        // Vault doesn't exist locally, try to fetch from API
        if (!this._offlineMode) {
            try {
                const response = await ApiClient.getVault(vaultId);
                if (response.success && response.data.vault) {
                    const serverVault = response.data.vault;
                    await LocalDB.saveVault(serverVault);
                    return this._decryptFolder(serverVault);
                }
            } catch (e) {
                console.warn('[Vault] Could not fetch vault from API:', e.message);
            }
        }

        throw new Error('Vault not found');
    },

    /**
     * Get subfolders of a folder (decrypted)
     * @param {string} parentFolderId
     * @returns {Promise<Array>}
     */
    async getSubfolders(parentFolderId) {
        const folders = await LocalDB.getSubfolders(parentFolderId);
        return Promise.all(folders.map(f => this._decryptFolder(f)));
    },

    /**
     * Get current folder ID
     * @returns {string|null}
     */
    getCurrentFolderId() {
        return this._currentFolderId;
    },

    /**
     * Get current folder (decrypted)
     * @returns {Promise<Object|null>}
     */
    async getCurrentFolder() {
        if (!this._currentFolderId) return null;
        return this.getFolder(this._currentFolderId);
    },

    /**
     * Set current folder
     * @param {Object|null} folder - Decrypted folder object or null
     */
    setCurrentFolder(folder) {
        this._currentFolderId = folder?.id || null;
        window.dispatchEvent(new CustomEvent('folderchange', { detail: { folder } }));
    },

    /**
     * Navigate to folder
     * @param {string|null} folderId
     * @returns {Promise<Object|null>}
     */
    async navigateToFolder(folderId) {
        const folder = folderId ? await this.getFolder(folderId) : null;
        this.setCurrentFolder(folder);
        return folder;
    },

    /**
     * Get folder breadcrumb (path from root)
     * @param {string} folderId
     * @returns {Promise<Array>}
     */
    async getBreadcrumb(folderId) {
        const breadcrumb = await LocalDB.getBreadcrumb(folderId);
        return Promise.all(breadcrumb.map(async f => ({
            id: f.id,
            name: f.parent_folder_id === null ? 'Root' : await this.decryptField(f.encrypted_name),
            is_vault: f.parent_folder_id === null,
        })));
    },

    // ===========================================
    // Folders - Write Operations
    // ===========================================

    /**
     * Create a new folder
     * @param {string} vaultId - Vault ID (or parent folder ID for nested folders)
     * @param {string} name
     * @param {string|null} icon
     * @param {string|null} parentFolderId - Parent folder ID (defaults to vault root)
     * @param {Object} options - Optional: { id, localOnly }
     * @returns {Promise<Object>}
     */
    async createFolder(vaultId, name, icon = null, parentFolderId = null, options = {}) {
        // If no parent specified, use the vault itself as parent (vault IS the root)
        if (!parentFolderId) {
            parentFolderId = vaultId;
        }

        const encryptedName = await this.encryptField(name);
        const encryptedIcon = icon ? await this.encryptField(icon) : null;
        const now = DateUtils.now();

        // Count existing folders at this level for sort_order
        const siblings = await LocalDB.getSubfolders(parentFolderId);
        const sortOrder = siblings.length;

        // Use provided ID or generate new one
        const folderId = options.id || TempId.generate();

        // 1. Always save to IndexedDB first
        const folder = {
            id: folderId,
            parent_folder_id: parentFolderId,
            encrypted_name: encryptedName,
            encrypted_icon: encryptedIcon,
            sort_order: sortOrder,
            created_at: now,
            updated_at: now,
        };
        await LocalDB.saveFolder(folder);

        // 2. If cloud mode, queue for sync
        if (LocalDB.getMode() !== 'local') {
            await LocalDB.addPendingChange('folder', folderId, 'create', {
                parent_folder_id: parentFolderId,
                encrypted_name: encryptedName,
                encrypted_icon: encryptedIcon,
                sort_order: sortOrder,
            });

            // 3. If online AND not localOnly, sync now
            if (!this._offlineMode && !options.localOnly) {
                await this.syncPendingChanges();
            }
        }

        console.log('[Vault] Created folder:', folderId);
        return this._decryptFolder(folder);
    },

    /**
     * Update a folder
     * @param {string} id
     * @param {string} name
     * @param {string|null} icon
     * @returns {Promise<Object>}
     */
    async updateFolder(id, name, icon = null) {
        const encryptedName = await this.encryptField(name);
        const encryptedIcon = icon ? await this.encryptField(icon) : null;
        const now = DateUtils.now();

        const existing = await LocalDB.getFolder(id);
        if (!existing) {
            throw new Error('Folder not found');
        }

        const updated = {
            ...existing,
            encrypted_name: encryptedName,
            encrypted_icon: encryptedIcon,
            updated_at: now,
        };

        // 1. Always save to IndexedDB first
        await LocalDB.saveFolder(updated);

        // 2. If cloud mode, queue for sync
        if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
            await LocalDB.addPendingChange('folder', id, 'update', {
                encrypted_name: encryptedName,
                encrypted_icon: encryptedIcon,
            });

            // 3. If online, sync now
            if (!this._offlineMode) {
                await this.syncPendingChanges();
            }
        }

        console.log('[Vault] Updated folder:', id);
        return this._decryptFolder(updated);
    },

    /**
     * Permanently delete a folder and all its contents
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteFolder(id) {
        // Lock to prevent sync interference
        if (typeof App !== 'undefined') App.lock('delete');

        try {
            // Hard delete: cascade delete all children
            const foldersToDelete = await this._collectFoldersRecursive(id);
            const itemsToDelete = [];
            for (const folderId of foldersToDelete) {
                const items = await LocalDB.getItemsByFolder(folderId);
                itemsToDelete.push(...items);
            }
            for (const item of itemsToDelete) {
                await LocalDB.hardDeleteItem(item.id);
            }
            for (const folderId of [...foldersToDelete].reverse()) {
                await LocalDB.hardDeleteFolder(folderId);
            }
            console.log('[Vault] Deleted folder and contents:', id, {
                folders: foldersToDelete.length,
                items: itemsToDelete.length
            });

            // 2. Cloud mode: sync to server or queue
            if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
                if (!this._offlineMode) {
                    // Online: call API
                    try {
                        const response = await ApiClient.deleteFolder(id);
                        if (!response.success) {
                            console.warn('[Vault] API delete folder failed:', response.message);
                        }
                    } catch (e) {
                        // 404 = already deleted on server, which is fine
                        if (!e.message?.toLowerCase().includes('not found')) {
                            console.warn('[Vault] API delete folder failed:', e.message);
                        }
                    }
                } else {
                    // Offline: queue pending change
                    await LocalDB.addPendingChange('folder', id, 'delete');
                }
            }

            // Reset current folder if deleted
            if (this._currentFolderId === id) {
                this._currentFolderId = null;
            }

            return true;
        } finally {
            if (typeof App !== 'undefined') App.unlock();
        }
    },

    /**
     * Soft delete a folder (set deleted_at timestamp)
     * Children remain but won't display since parent is deleted
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async softDeleteFolder(id, options = {}) {
        // Lock to prevent sync interference
        if (typeof App !== 'undefined') App.lock('delete');

        let shouldSync = false;
        try {
            const folder = await LocalDB.getFolder(id);
            if (!folder) {
                throw new Error('Folder not found');
            }

            const now = DateUtils.now();
            folder.deleted_at = now;
            folder.updated_at = now;

            // 1. Always save to IndexedDB first
            await LocalDB.saveFolder(folder);

            // 2. If cloud mode, queue for sync
            if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
                await LocalDB.addPendingChange('folder', id, 'update', { deleted_at: now });
                shouldSync = !this._offlineMode && !options.localOnly;
            }

            // Reset current folder if deleted
            if (this._currentFolderId === id) {
                this._currentFolderId = null;
            }

            console.log('[Vault] Soft deleted folder:', id);
        } finally {
            if (typeof App !== 'undefined') App.unlock();
        }

        // 3. Sync after unlock to avoid blocking ourselves
        if (shouldSync) {
            await this.syncPendingChanges();
        }

        return true;
    },

    /**
     * Recursively collect folder and all its subfolders
     * @param {string} folderId
     * @returns {Promise<string[]>} Array of folder IDs (parent first, then children)
     */
    async _collectFoldersRecursive(folderId) {
        const result = [folderId];
        const subfolders = await LocalDB.getSubfolders(folderId);

        for (const subfolder of subfolders) {
            const childFolders = await this._collectFoldersRecursive(subfolder.id);
            result.push(...childFolders);
        }

        return result;
    },

    /**
     * Update folders sort order
     * @param {Array} orderData - Array of {id, sort_order}
     * @returns {Promise<boolean>}
     */
    async updateFoldersOrder(orderData) {
        // Batch update IndexedDB - get all folders at once
        const allFolders = await LocalDB.getFolders();
        const orderMap = new Map(orderData.map(o => [o.id, o.sort_order]));
        const updatedFolders = [];

        for (const folder of allFolders) {
            if (orderMap.has(folder.id)) {
                folder.sort_order = orderMap.get(folder.id);
                updatedFolders.push(folder);
            }
        }

        if (updatedFolders.length > 0) {
            await LocalDB.saveFolders(updatedFolders);
        }

        // For cloud mode: sync to API or queue
        if (!this._offlineMode) {
            const response = await ApiClient.updateFoldersOrder(orderData);
            if (!response.success) {
                throw new Error(response.message);
            }
        } else if (LocalDB.getMode() !== 'local') {
            // Queue a single batch order change for sync
            const realIds = orderData.filter(o => TempId.isReal(o.id));
            if (realIds.length > 0) {
                await LocalDB.addPendingChange('folder_order', 'batch', 'order', {
                    items: realIds
                });
            }
        }

        console.log('[Vault] Updated folders order');
        return true;
    },

    // ===========================================
    // Items - Read Operations
    // ===========================================

    /**
     * Get items (decrypted), optionally filtered
     * @param {string|null} folderId
     * @param {string|null} type
     * @returns {Promise<Array>}
     */
    async getItems(folderId = null, type = null) {
        let items;

        if (folderId) {
            items = await LocalDB.getItemsInFolderSorted(folderId);
        } else {
            items = await LocalDB.getItemsSorted();
        }

        if (type) {
            items = items.filter(i => i.item_type === type);
        }

        return Promise.all(items.map(i => this._decryptItem(i)));
    },

    /**
     * Get items in a specific folder (decrypted)
     * @param {string} folderId
     * @returns {Promise<Array>}
     */
    async getItemsInFolder(folderId) {
        const items = await LocalDB.getItemsInFolderSorted(folderId);
        return Promise.all(items.map(i => this._decryptItem(i)));
    },

    /**
     * Get a single item by ID (decrypted)
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getItem(id) {
        const encrypted = await LocalDB.getItem(id);
        if (!encrypted) return null;
        return this._decryptItem(encrypted);
    },

    /**
     * Get all file items (decrypted)
     * @returns {Promise<Array>}
     */
    async getFileItems() {
        const items = await LocalDB.getFileItems();
        return Promise.all(items.map(i => this._decryptItem(i)));
    },

    /**
     * Search items by query
     * @param {string} query
     * @returns {Promise<Array>}
     */
    async search(query) {
        if (!query) return [];

        const lowerQuery = query.toLowerCase();
        const allItems = await this.getItems();

        return allItems.filter(item => {
            const data = item.data;

            if (data.name && data.name.toLowerCase().includes(lowerQuery)) return true;
            if (data.label && data.label.toLowerCase().includes(lowerQuery)) return true;
            if (data.username && data.username.toLowerCase().includes(lowerQuery)) return true;
            if (data.issuer && data.issuer.toLowerCase().includes(lowerQuery)) return true;
            if (data.content && data.content.toLowerCase().includes(lowerQuery)) return true;
            if (data.tags && data.tags.some(t => t.toLowerCase().includes(lowerQuery))) return true;

            return false;
        });
    },

    // ===========================================
    // Items - Write Operations
    // ===========================================

    /**
     * Create a new item
     * @param {string} type - password, totp, website, note, file
     * @param {Object} data - Item data
     * @param {string|null} folderId
     * @param {Object} options - Optional: { id, localOnly }
     * @returns {Promise<Object>}
     */
    async createItem(type, data, folderId = null, options = {}) {
        // Files require online mode (file content must be uploaded)
        if (type === 'file' && (this._offlineMode || LocalDB.getMode() === 'local')) {
            throw new Error('Cannot create file items in offline/local mode');
        }

        const encryptedData = await Encryption.encryptObject(data);
        const now = DateUtils.now();

        // Count existing items for sort_order
        const existingItems = folderId
            ? await LocalDB.getItemsByFolder(folderId)
            : await LocalDB.getItems();
        const sortOrder = existingItems.length;

        // Use provided ID or generate new one
        const itemId = options.id || TempId.generate();

        // 1. Always save to IndexedDB first
        const item = {
            id: itemId,
            item_type: type,
            folder_id: folderId,
            encrypted_data: encryptedData,
            version: 1,
            sort_order: sortOrder,
            created_at: now,
            updated_at: now,
        };
        await LocalDB.saveItem(item);

        // 2. If cloud mode, queue for sync
        if (LocalDB.getMode() !== 'local') {
            await LocalDB.addPendingChange('item', itemId, 'create', {
                item_type: type,
                encrypted_data: encryptedData,
                folder_id: folderId,
                sort_order: sortOrder,
            });

            // 3. If online AND not localOnly, sync now
            if (!this._offlineMode && !options.localOnly) {
                await this.syncPendingChanges();
            }
        }

        console.log('[Vault] Created item:', itemId);
        return this._decryptItem(item);
    },

    /**
     * Update an item
     * @param {string} id
     * @param {Object} data
     * @param {string|undefined} folderId
     * @returns {Promise<Object>}
     */
    async updateItem(id, data, folderId = undefined) {
        const existing = await LocalDB.getItem(id);
        if (!existing) {
            throw new Error('Item not found');
        }

        // Files not editable in offline/local mode
        if (existing.item_type === 'file' && (this._offlineMode || LocalDB.getMode() === 'local')) {
            throw new Error('Cannot edit file items in offline/local mode');
        }

        const encryptedData = await Encryption.encryptObject(data);
        const now = DateUtils.now();

        const updated = {
            ...existing,
            encrypted_data: encryptedData,
            updated_at: now,
        };
        if (folderId !== undefined) {
            updated.folder_id = folderId;
        }

        // 1. Always save to IndexedDB first
        await LocalDB.saveItem(updated);

        // 2. If cloud mode, queue for sync (only for real IDs - temp IDs already have create pending)
        if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
            await LocalDB.addPendingChange('item', id, 'update', {
                encrypted_data: encryptedData,
                folder_id: folderId,
            });

            // 3. If online, sync now
            if (!this._offlineMode) {
                await this.syncPendingChanges();
            }
        }

        console.log('[Vault] Updated item:', id);
        return this._decryptItem(updated);
    },

    /**
     * Move an item to a different folder
     * @param {string} id - Item ID
     * @param {string} targetFolderId - Target folder ID
     * @returns {Promise<Object>}
     */
    async moveItem(id, targetFolderId) {
        const existing = await LocalDB.getItem(id);
        if (!existing) {
            throw new Error('Item not found');
        }

        // Files not movable in offline/local mode
        if (existing.item_type === 'file' && (this._offlineMode || LocalDB.getMode() === 'local')) {
            throw new Error('Cannot move file items in offline/local mode');
        }

        const now = DateUtils.now();
        const updated = {
            ...existing,
            folder_id: targetFolderId,
            updated_at: now,
        };

        // 1. Always save to IndexedDB first
        await LocalDB.saveItem(updated);

        // 2. If cloud mode, queue for sync (only for real IDs)
        if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
            await LocalDB.addPendingChange('item', id, 'update', {
                folder_id: targetFolderId,
            });

            // 3. If online, sync now
            if (!this._offlineMode) {
                await this.syncPendingChanges();
            }
        }

        console.log('[Vault] Moved item:', id, 'to folder:', targetFolderId);
        return this._decryptItem(updated);
    },

    /**
     * Move a folder to a different parent folder
     * @param {string} id - Folder ID
     * @param {string} targetParentId - Target parent folder ID
     * @returns {Promise<Object>}
     */
    async moveFolder(id, targetParentId) {
        const existing = await LocalDB.getFolder(id);
        if (!existing) {
            throw new Error('Folder not found');
        }

        // Can't move root folders (vaults)
        if (existing.parent_folder_id === null) {
            throw new Error('Cannot move vault');
        }

        // Can't move folder into itself or its descendants
        const descendants = await this.getFolderDescendants(id);
        if (targetParentId === id || descendants.some(d => d.id === targetParentId)) {
            throw new Error('Cannot move folder into itself or its descendants');
        }

        const now = DateUtils.now();
        const updated = {
            ...existing,
            parent_folder_id: targetParentId,
            updated_at: now,
        };

        // 1. Always save to IndexedDB first
        await LocalDB.saveFolder(updated);

        // 2. If cloud mode, queue for sync (only for real IDs)
        if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
            await LocalDB.addPendingChange('folder', id, 'update', {
                parent_folder_id: targetParentId,
            });

            // 3. If online, sync now
            if (!this._offlineMode) {
                await this.syncPendingChanges();
            }
        }

        console.log('[Vault] Moved folder:', id, 'to parent:', targetParentId);
        return this._decryptFolder(updated);
    },

    /**
     * Get all descendant folders of a folder
     * @param {string} folderId
     * @returns {Promise<Array>}
     */
    async getFolderDescendants(folderId) {
        const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const descendants = [];
        const queue = [folderId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            const children = allFolders.filter(f => f.parent_folder_id === currentId);
            for (const child of children) {
                descendants.push(child);
                queue.push(child.id);
            }
        }

        return descendants;
    },

    /**
     * Permanently delete an item
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteItem(id) {
        // Lock to prevent sync interference
        if (typeof App !== 'undefined') App.lock('delete');

        try {
            // 1. Delete from IndexedDB
            await LocalDB.hardDeleteItem(id);

            // 2. Cloud mode: sync to server or queue
            if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
                if (!this._offlineMode) {
                    // Online: call API
                    try {
                        const response = await ApiClient.deleteItem(id);
                        if (!response.success) {
                            console.warn('[Vault] API delete item failed:', response.message);
                        }
                    } catch (e) {
                        // 404 = already deleted on server, which is fine
                        if (!e.message?.toLowerCase().includes('not found')) {
                            console.warn('[Vault] API delete item failed:', e.message);
                        }
                    }
                } else {
                    // Offline: queue pending change
                    await LocalDB.addPendingChange('item', id, 'delete');
                }
            }

            console.log('[Vault] Deleted item:', id);
            return true;
        } finally {
            if (typeof App !== 'undefined') App.unlock();
        }
    },

    /**
     * Soft delete an item (set deleted_at timestamp)
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async softDeleteItem(id, options = {}) {
        // Lock to prevent sync interference
        if (typeof App !== 'undefined') App.lock('delete');

        let shouldSync = false;
        try {
            const item = await LocalDB.getItem(id);
            if (!item) {
                throw new Error('Item not found');
            }

            const now = DateUtils.now();
            item.deleted_at = now;
            item.updated_at = now;

            // 1. Always save to IndexedDB first
            await LocalDB.saveItem(item);

            // 2. If cloud mode, queue for sync
            if (LocalDB.getMode() !== 'local' && TempId.isReal(id)) {
                await LocalDB.addPendingChange('item', id, 'update', { deleted_at: now });
                shouldSync = !this._offlineMode && !options.localOnly;
            }

            console.log('[Vault] Soft deleted item:', id);
        } finally {
            if (typeof App !== 'undefined') App.unlock();
        }

        // 3. Sync after unlock to avoid blocking ourselves
        if (shouldSync) {
            await this.syncPendingChanges();
        }

        return true;
    },

    /**
     * Update items sort order
     * @param {Array} orderData - Array of {id, sort_order}
     * @returns {Promise<boolean>}
     */
    async updateItemsOrder(orderData) {
        // Batch update IndexedDB - get all items at once
        const allItems = await LocalDB.getItems();
        const orderMap = new Map(orderData.map(o => [o.id, o.sort_order]));
        const updatedItems = [];

        for (const item of allItems) {
            if (orderMap.has(item.id)) {
                item.sort_order = orderMap.get(item.id);
                updatedItems.push(item);
            }
        }

        if (updatedItems.length > 0) {
            await LocalDB.saveItems(updatedItems);
        }

        // For cloud mode: sync to API or queue
        if (!this._offlineMode) {
            const response = await ApiClient.updateItemsOrder(orderData);
            if (!response.success) {
                throw new Error(response.message);
            }
        } else if (LocalDB.getMode() !== 'local') {
            // Queue a single batch order change for sync
            const realIds = orderData.filter(o => TempId.isReal(o.id));
            if (realIds.length > 0) {
                await LocalDB.addPendingChange('item_order', 'batch', 'order', {
                    items: realIds
                });
            }
        }

        console.log('[Vault] Updated items order');
        return true;
    },

    // ===========================================
    // File Storage
    // ===========================================

    /**
     * Upload file content
     * @param {string} itemId
     * @param {ArrayBuffer} fileContent
     * @returns {Promise<Object>}
     */
    async uploadFile(itemId, fileContent) {
        if (this._offlineMode) {
            throw new Error('File uploads not supported in local mode');
        }

        const encryptedContent = await Encryption.encryptFile(fileContent);
        const response = await ApiClient.uploadFile(itemId, encryptedContent, fileContent.byteLength);

        if (!response.success) {
            throw new Error(response.message || 'Failed to upload file');
        }

        return response.data;
    },

    /**
     * Download and decrypt file
     * @param {string} itemId
     * @returns {Promise<Object>}
     */
    async downloadFile(itemId) {
        if (this._offlineMode) {
            throw new Error('File downloads not supported in local mode');
        }

        const response = await ApiClient.downloadFile(itemId);
        if (!response.success) {
            throw new Error(response.message || 'Failed to download file');
        }

        const decryptedContent = await Encryption.decryptFile(response.data.encrypted_content);
        let metadata = {};
        if (response.data.encrypted_data) {
            metadata = await Encryption.decryptObject(response.data.encrypted_data);
        }

        return {
            content: decryptedContent,
            metadata,
            fileSize: response.data.file_size,
        };
    },

    /**
     * Delete file content
     * @param {string} itemId
     * @returns {Promise<boolean>}
     */
    async deleteFile(itemId) {
        if (this._offlineMode) {
            throw new Error('File operations not supported in local mode');
        }

        const response = await ApiClient.deleteFile(itemId);
        if (!response.success) {
            throw new Error(response.message || 'Failed to delete file');
        }

        return true;
    },

    /**
     * Get storage usage
     * @returns {Promise<Object>}
     */
    async getStorageUsage() {
        if (this._offlineMode) {
            return { used_bytes: 0, max_bytes: 0, file_count: 0 };
        }

        const response = await ApiClient.getStorageUsage();
        if (!response.success) {
            throw new Error(response.message || 'Failed to get storage usage');
        }

        return response.data;
    },

    // ===========================================
    // Sync & State Management
    // ===========================================

    /**
     * Check for pending changes
     * @returns {Promise<boolean>}
     */
    async hasPendingChanges() {
        if (typeof LocalDB === 'undefined') return false;
        return LocalDB.hasPendingChanges();
    },

    /**
     * Get pending changes count
     * @returns {Promise<number>}
     */
    async getPendingChangesCount() {
        if (typeof LocalDB === 'undefined') return 0;
        return LocalDB.getPendingChangesCount();
    },

    /**
     * Sync pending changes to server
     * Sync order: creates (vaults/folders → items) → updates → order changes → deletes (items → folders/vaults)
     * @returns {Promise<Object>}
     */
    async syncPendingChanges() {
        // Prevent concurrent syncs
        if (this._isSyncing) {
            console.log('[Vault] Sync already in progress, skipping');
            return { success: true, synced: 0, failed: 0, conflicts: 0 };
        }

        // CRITICAL: Never sync during locked operations
        if (typeof App !== 'undefined' && App.isLocked()) {
            console.log('[Vault] Sync blocked - ' + (App.getLockReason() || 'operation') + ' in progress');
            return { success: true, synced: 0, failed: 0, conflicts: 0 };
        }

        if (this._offlineMode || LocalDB.getMode() === 'local') {
            return { success: true, synced: 0, failed: 0, conflicts: 0 };
        }

        this._isSyncing = true;

        try {
            const { creates, updates, orders, deletes } = await LocalDB.getPendingChangesSorted();
            const totalChanges = creates.length + updates.length + orders.length + deletes.length;

            if (totalChanges === 0) {
                return { success: true, synced: 0, failed: 0, conflicts: 0 };
            }

            console.log('[Vault] Syncing pending changes:', {
                creates: creates.length,
                updates: updates.length,
                orders: orders.length,
                deletes: deletes.length
            });

            let synced = 0, failed = 0, conflicts = 0;

            // Step 1: Sync creates (vaults/folders first, then items)
            // IDs are permanent UUIDs - server accepts client-provided IDs
            for (const change of creates) {
                try {
                    await this._syncCreate(change);
                    synced++;
                    await LocalDB.removePendingChange(change.id);
                    console.log('[Vault] Synced create:', change.entity_type, change.entity_id);
                } catch (e) {
                    // If item already exists, it was synced before - remove stale pending change
                    if (e.message && e.message.includes('already exists')) {
                        console.log('[Vault] Already exists, removing stale pending change:', change.entity_type, change.entity_id);
                        await LocalDB.removePendingChange(change.id);
                        synced++;
                    } else {
                        console.error('[Vault] Create sync failed:', change, e);
                        failed++;
                    }
                }
            }

            // Step 2: Sync updates
            for (const change of updates) {
                try {
                    await this._syncUpdate(change);
                    synced++;
                    await LocalDB.removePendingChange(change.id);
                } catch (e) {
                    console.error('[Vault] Update sync failed:', change, e);
                    failed++;
                }
            }

            // Step 3: Sync order changes (batch by entity type)
            const ordersByType = { vault: [], folder: [], item: [] };
            for (const change of orders) {
                // Handle batch order changes (entity_type='folder_order', data.items=[...])
                if (change.entity_type.endsWith('_order') && change.data?.items) {
                    const type = change.entity_type.replace('_order', '');
                    for (const orderItem of change.data.items) {
                        if (ordersByType[type]) {
                            ordersByType[type].push({
                                id: orderItem.id,
                                sort_order: orderItem.sort_order
                            });
                        }
                    }
                }
                // Handle individual order changes (entity_type='folder', data.sort_order=N)
                else if (change.data?.sort_order !== undefined) {
                    const type = change.entity_type;
                    if (ordersByType[type]) {
                        ordersByType[type].push({
                            id: change.entity_id,
                            sort_order: change.data.sort_order
                        });
                    }
                }
                await LocalDB.removePendingChange(change.id);
            }

            // Batch sync orders
            if (ordersByType.vault.length > 0) {
                try {
                    await ApiClient.updateVaultsOrder(ordersByType.vault);
                    synced++;
                } catch (e) {
                    console.error('[Vault] Vault order sync failed:', e);
                    failed++;
                }
            }
            if (ordersByType.folder.length > 0) {
                try {
                    await ApiClient.updateFoldersOrder(ordersByType.folder);
                    synced++;
                } catch (e) {
                    console.error('[Vault] Folder order sync failed:', e);
                    failed++;
                }
            }
            if (ordersByType.item.length > 0) {
                try {
                    await ApiClient.updateItemsOrder(ordersByType.item);
                    synced++;
                } catch (e) {
                    console.error('[Vault] Item order sync failed:', e);
                    failed++;
                }
            }

            // Step 4: Sync deletes (items first, then folders/vaults)
            for (const change of deletes) {
                try {
                    await this._syncDelete(change.entity_type, change.entity_id, change.data);
                    synced++;
                    await LocalDB.removePendingChange(change.id);
                } catch (e) {
                    console.error('[Vault] Delete sync failed:', change, e);
                    failed++;
                }
            }

            console.log('[Vault] Sync complete:', { synced, failed, conflicts });
            return { success: failed === 0, synced, failed, conflicts };
        } finally {
            this._isSyncing = false;
        }
    },

    /**
     * Sync a create change
     * @private
     */
    async _syncCreate(change) {
        const { entity_type, entity_id, data } = change;

        switch (entity_type) {
            case 'folder': {
                // Get local record for timestamps
                const localFolder = await LocalDB.getFolder(entity_id);
                // createFolder handles both vaults (parent_folder_id = null) and subfolders
                const response = await ApiClient.createFolder(
                    data.parent_folder_id,
                    data.encrypted_name,
                    data.encrypted_icon,
                    data.sort_order,
                    entity_id,
                    localFolder?.created_at,
                    localFolder?.updated_at
                );
                if (!response.success) throw new Error(response.message);
                return;
            }

            case 'item': {
                // Get local record for timestamps
                const localItem = await LocalDB.getItem(entity_id);
                const response = await ApiClient.createItem(
                    data.item_type,
                    data.encrypted_data,
                    data.folder_id,
                    data.sort_order,
                    entity_id,
                    localItem?.created_at,
                    localItem?.updated_at
                );
                if (!response.success) throw new Error(response.message);
                return;
            }

            default:
                throw new Error(`Unknown entity type: ${entity_type}`);
        }
    },

    /**
     * Sync an update change
     * @private
     */
    async _syncUpdate(change) {
        const { entity_type, entity_id, data } = change;

        switch (entity_type) {
            case 'folder': {
                // Get local record for updated_at
                const localFolder = await LocalDB.getFolder(entity_id);
                // updateFolder handles both vaults and subfolders
                const response = await ApiClient.updateFolder(
                    entity_id,
                    data.encrypted_name,
                    data.encrypted_icon,
                    data.parent_folder_id,
                    data.deleted_at, // null = restore, timestamp = soft delete
                    localFolder?.updated_at,
                    data.is_default // For vaults only
                );
                if (!response.success) throw new Error(response.message);
                break;
            }

            case 'item': {
                // Get local record for item_type and updated_at
                const localItem = await LocalDB.getItem(entity_id);
                const response = await ApiClient.updateItem(
                    entity_id,
                    data.encrypted_data,
                    data.folder_id,
                    null, // sortOrder
                    localItem?.item_type,
                    data.deleted_at, // null = restore, timestamp = soft delete
                    localItem?.updated_at
                );
                if (!response.success) throw new Error(response.message);
                break;
            }
        }
    },

    /**
     * Sync a delete change (delete is always permanent)
     * @private
     */
    async _syncDelete(entityType, entityId, data) {
        switch (entityType) {
            case 'folder': {
                // deleteFolder handles both vaults and subfolders
                const response = await ApiClient.deleteFolder(entityId);
                if (!response.success) throw new Error(response.message);
                break;
            }

            case 'item': {
                const response = await ApiClient.deleteItem(entityId);
                if (!response.success) throw new Error(response.message);
                break;
            }
        }
    },

    /**
     * Force refresh from server
     * @returns {Promise<void>}
     */
    async forceRefresh() {
        if (this._offlineMode || LocalDB.getMode() === 'local') {
            console.log('[Vault] Force refresh skipped - local mode');
            return;
        }

        if (!await KeyDerivation.isUnlocked()) {
            throw new Error('Vault is locked');
        }

        await this._syncFromServer();
        console.log('[Vault] Force refreshed from server');
    },

    /**
     * Reset vault state (clears all in-memory vault data)
     */
    reset() {
        this._currentVault = null;
        this._currentFolderId = null;
        this._lastSync = null;
        this._offlineMode = false;
        this._keyVerified = false;
        this.isUnlocked = false;
    },

    /**
     * Lock vault (reset + clear crypto keys)
     */
    async lock() {
        this.reset();
        if (typeof SecretStore !== 'undefined') SecretStore.clear();
        await KeyDerivation.lock();
    },

    /**
     * Get last sync timestamp
     * @returns {string|null}
     */
    getLastSync() {
        return this._lastSync;
    },

    /**
     * Clear all local data
     */
    async clearLocalData() {
        if (typeof LocalDB !== 'undefined') {
            await LocalDB.clearAll();
        }
    },
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Vault;
}
