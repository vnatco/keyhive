/**
 * Local Database (IndexedDB) for Offline Storage
 *
 * Stores encrypted vault data locally for offline access.
 * Works across: Electron, Capacitor (iOS/Android), PWA, Cordova
 *
 * Data is stored encrypted (same format as server) - requires master password to decrypt.
 * Zero-knowledge model is maintained - if device is stolen, data is still encrypted.
 */

const LocalDB = {
    db: null,
    DB_VERSION: 4,  // Bumped: removed is_root (vaults identified by parent_folder_id IS NULL)

    // Dynamic database configuration
    _mode: null,        // 'local' or 'cloud'
    _userId: null,      // User ID for cloud mode
    _dbName: null,      // Computed database name

    // Store names
    STORES: {
        FOLDERS: 'folders',
        ITEMS: 'items',
        USER_DATA: 'user_data',  // Renamed from sync_meta - stores user profile, settings, etc.
        PENDING_CHANGES: 'pending_changes'
    },

    /**
     * Set which database to use
     * @param {string} mode - 'local' or 'cloud'
     * @param {string|null} userId - User ID (required for cloud mode)
     */
    setDatabase(mode, userId = null) {
        if (mode !== 'local' && mode !== 'cloud') {
            throw new Error('Invalid mode. Must be "local" or "cloud"');
        }
        if (mode === 'cloud' && !userId) {
            throw new Error('User ID required for cloud mode');
        }

        // Close existing database if switching
        if (this.db && (this._mode !== mode || this._userId !== userId)) {
            this.closeDatabase();
        }

        this._mode = mode;
        this._userId = userId;
        this._dbName = mode === 'local' ? 'keyhive_local' : `keyhive_cloud_${userId}`;

        console.log(`[LocalDB] Database set to: ${this._dbName}`);
    },

    /**
     * Setup database from localStorage settings
     * @returns {boolean} - true if database was configured, false if no mode set
     */
    setupFromStorage() {
        const mode = localStorage.getItem('keyhive_mode');
        const userId = localStorage.getItem('keyhive_user_id');

        if (!mode) {
            console.log('[LocalDB] No mode configured in localStorage');
            return false;
        }

        if (mode === 'cloud' && !userId) {
            console.warn('[LocalDB] Cloud mode but no user ID - cannot configure');
            return false;
        }

        this.setDatabase(mode, userId);
        return true;
    },

    /**
     * Save mode to localStorage
     * @param {string} mode - 'local' or 'cloud'
     * @param {string|null} userId - User ID (for cloud mode)
     */
    saveMode(mode, userId = null) {
        localStorage.setItem('keyhive_mode', mode);
        if (mode === 'cloud' && userId) {
            localStorage.setItem('keyhive_user_id', userId);
        } else {
            localStorage.removeItem('keyhive_user_id');
        }
        console.log(`[LocalDB] Mode saved: ${mode}` + (userId ? ` (user: ${userId})` : ''));
    },

    /**
     * Clear mode from localStorage (used on logout for cloud mode)
     */
    clearMode() {
        localStorage.removeItem('keyhive_mode');
        localStorage.removeItem('keyhive_user_id');
        console.log('[LocalDB] Mode cleared from localStorage');
    },

    /**
     * Check if mode is configured
     * @returns {boolean}
     */
    hasMode() {
        return !!localStorage.getItem('keyhive_mode');
    },

    /**
     * Get stored mode
     * @returns {{mode: string|null, userId: string|null}}
     */
    getStoredMode() {
        return {
            mode: localStorage.getItem('keyhive_mode'),
            userId: localStorage.getItem('keyhive_user_id')
        };
    },

    /**
     * Get current database name
     * @returns {string|null}
     */
    getDatabaseName() {
        return this._dbName;
    },

    /**
     * Get current mode
     * @returns {string|null}
     */
    getMode() {
        return this._mode;
    },

    /**
     * Close current database connection
     */
    closeDatabase() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('[LocalDB] Database closed');
        }
    },

    /**
     * Delete a specific cloud user's database
     * Used when token expires/invalid to clean up that user's cached data
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async deleteCloudUserDatabase(userId) {
        const dbName = `keyhive_cloud_${userId}`;

        // Close if this is the current database
        if (this._dbName === dbName && this.db) {
            this.closeDatabase();
            this._mode = null;
            this._userId = null;
            this._dbName = null;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => {
                console.log(`[LocalDB] Cloud user database deleted: ${dbName}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                console.warn(`[LocalDB] Database deletion blocked: ${dbName}`);
                resolve(); // Resolve anyway, will be deleted when connections close
            };
        });
    },

    /**
     * Initialize the database
     * Must call setDatabase() before init()
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (!this._dbName) {
            throw new Error('Database not configured. Call setDatabase() first.');
        }

        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this._dbName, this.DB_VERSION);

            request.onerror = () => {
                console.error('[LocalDB] Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log(`[LocalDB] Database opened: ${this._dbName} (mode: ${this._mode})`);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                console.log(`[LocalDB] Upgrading database schema from v${oldVersion} to v${this.DB_VERSION}...`);

                // Folders store (vaults are folders with parent_folder_id = null)
                if (!db.objectStoreNames.contains(this.STORES.FOLDERS)) {
                    const folderStore = db.createObjectStore(this.STORES.FOLDERS, { keyPath: 'id' });
                    folderStore.createIndex('parent_folder_id', 'parent_folder_id', { unique: false });
                    folderStore.createIndex('sort_order', 'sort_order', { unique: false });
                    folderStore.createIndex('is_default', 'is_default', { unique: false });
                }

                // Items store (passwords, websites, notes, totp, files)
                if (!db.objectStoreNames.contains(this.STORES.ITEMS)) {
                    const itemStore = db.createObjectStore(this.STORES.ITEMS, { keyPath: 'id' });
                    itemStore.createIndex('folder_id', 'folder_id', { unique: false });
                    itemStore.createIndex('item_type', 'item_type', { unique: false });
                    itemStore.createIndex('sort_order', 'sort_order', { unique: false });
                }

                // User data store (user profile, settings, offline auth, etc.)
                if (!db.objectStoreNames.contains(this.STORES.USER_DATA)) {
                    db.createObjectStore(this.STORES.USER_DATA, { keyPath: 'key' });
                }

                // Pending changes queue (changes made offline)
                if (!db.objectStoreNames.contains(this.STORES.PENDING_CHANGES)) {
                    const pendingStore = db.createObjectStore(this.STORES.PENDING_CHANGES, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    pendingStore.createIndex('entity_type', 'entity_type', { unique: false });
                    pendingStore.createIndex('entity_id', 'entity_id', { unique: false });
                    pendingStore.createIndex('created_at', 'created_at', { unique: false });
                }

                console.log('[LocalDB] Database schema ready');
            };
        });
    },

    /**
     * Ensure database is initialized
     */
    async ensureInit() {
        if (!this.db) {
            await this.init();
        }
    },

    // ===========================================
    // Generic CRUD Operations
    // ===========================================

    /**
     * Get a single record by ID
     * @param {string} storeName
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async get(storeName, id) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all records from a store
     * @param {string} storeName
     * @returns {Promise<Array>}
     */
    async getAll(storeName) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get records by index
     * @param {string} storeName
     * @param {string} indexName
     * @param {*} value
     * @returns {Promise<Array>}
     */
    async getByIndex(storeName, indexName, value) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Put (insert or update) a record
     * @param {string} storeName
     * @param {Object} data
     * @returns {Promise<string>} - The key of the record
     */
    async put(storeName, data) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Put multiple records in a single transaction
     * @param {string} storeName
     * @param {Array} items
     * @returns {Promise<void>}
     */
    async putMany(storeName, items) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);

            for (const item of items) {
                store.put(item);
            }
        });
    },

    /**
     * Delete a record by ID
     * @param {string} storeName
     * @param {string} id
     * @returns {Promise<void>}
     */
    async delete(storeName, id) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            store.delete(id);

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * Clear all records from a store
     * @param {string} storeName
     * @returns {Promise<void>}
     */
    async clear(storeName) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // ===========================================
    // Vault Operations (Vaults = Root Folders)
    // Vaults are folders with parent_folder_id = null
    // ===========================================

    /**
     * Get all vaults (root folders)
     * @returns {Promise<Array>}
     */
    async getVaults() {
        const folders = await this.getAll(this.STORES.FOLDERS);
        return folders
            .filter(f => f.parent_folder_id === null && !f.deleted_at)
            .sort((a, b) => {
                // Default vault first, then by sort_order
                if (a.is_default && !b.is_default) return -1;
                if (!a.is_default && b.is_default) return 1;
                return (a.sort_order || 0) - (b.sort_order || 0);
            });
    },

    /**
     * Get a single vault by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getVault(id) {
        const folder = await this.get(this.STORES.FOLDERS, id);
        if (folder && folder.parent_folder_id === null) {
            return folder;
        }
        return null;
    },

    /**
     * Get the default vault (is_default = true)
     * Falls back to first vault if none marked as default
     * @returns {Promise<Object|null>}
     */
    async getDefaultVault() {
        const vaults = await this.getVaults();
        return vaults.find(v => v.is_default) || vaults[0] || null;
    },

    /**
     * Save a vault (root folder)
     * @param {Object} vault
     * @returns {Promise<string>}
     */
    async saveVault(vault) {
        // Ensure vault has correct root folder properties
        const vaultData = {
            ...vault,
            parent_folder_id: null,
            _localUpdatedAt: DateUtils.now()
        };
        return this.put(this.STORES.FOLDERS, vaultData);
    },

    /**
     * Save multiple vaults
     * @param {Array} vaults
     * @returns {Promise<void>}
     */
    async saveVaults(vaults) {
        const withTimestamp = vaults.map(v => ({
            ...v,
            parent_folder_id: null,
            _localUpdatedAt: DateUtils.now()
        }));
        return this.putMany(this.STORES.FOLDERS, withTimestamp);
    },

    /**
     * Soft delete a vault
     * @param {string} id
     * @returns {Promise<void>}
     */
    async softDeleteVault(id) {
        const vault = await this.getVault(id);
        if (vault) {
            vault.deleted_at = DateUtils.now();
            vault._localUpdatedAt = DateUtils.now();
            return this.put(this.STORES.FOLDERS, vault);
        }
    },

    /**
     * Hard delete a vault
     * @param {string} id
     * @returns {Promise<void>}
     */
    async hardDeleteVault(id) {
        return this.delete(this.STORES.FOLDERS, id);
    },

    /**
     * Get all non-root folders within a vault
     * @param {string} vaultId - The vault (root folder) ID
     * @returns {Promise<Array>}
     */
    async getFoldersByVault(vaultId) {
        const folders = await this.getAll(this.STORES.FOLDERS);
        // Get all folders that belong to this vault's hierarchy
        // For now, get direct children (folders with parent_folder_id = vaultId)
        // and recursively find nested folders
        const result = [];
        const findChildren = (parentId) => {
            const children = folders.filter(f =>
                f.parent_folder_id === parentId &&
                f.parent_folder_id !== null &&  // Exclude vaults (which have null parent)
                !f.deleted_at
            );
            for (const child of children) {
                result.push(child);
                findChildren(child.id);
            }
        };
        findChildren(vaultId);
        return result.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },

    /**
     * Get items in a vault (including items in subfolders)
     * @param {string} vaultId - The vault (root folder) ID
     * @returns {Promise<Array>}
     */
    async getItemsByVault(vaultId) {
        // Get all folder IDs in this vault (vault itself + subfolders)
        const folderIds = [vaultId];
        const subfolders = await this.getFoldersByVault(vaultId);
        folderIds.push(...subfolders.map(f => f.id));

        // Get all items in these folders
        const allItems = await this.getItems();
        return allItems.filter(item =>
            folderIds.includes(item.folder_id) ||
            item.folder_id === vaultId
        );
    },

    // ===========================================
    // Folder Operations
    // ===========================================

    async getFolders() {
        const all = await this.getAll(this.STORES.FOLDERS);
        return all.filter(f => !f.deleted_at);
    },

    async getFolder(id) {
        return this.get(this.STORES.FOLDERS, id);
    },

    async saveFolder(folder) {
        return this.put(this.STORES.FOLDERS, {
            ...folder,
            _localUpdatedAt: DateUtils.now()
        });
    },

    async saveFolders(folders) {
        const withTimestamp = folders.map(f => ({
            ...f,
            _localUpdatedAt: DateUtils.now()
        }));
        return this.putMany(this.STORES.FOLDERS, withTimestamp);
    },

    async softDeleteFolder(id) {
        const folder = await this.get(this.STORES.FOLDERS, id);
        if (folder) {
            folder.deleted_at = DateUtils.now();
            folder._localUpdatedAt = DateUtils.now();
            return this.put(this.STORES.FOLDERS, folder);
        }
    },

    async hardDeleteFolder(id) {
        return this.delete(this.STORES.FOLDERS, id);
    },

    // ===========================================
    // Item Operations
    // ===========================================

    async getItems() {
        const all = await this.getAll(this.STORES.ITEMS);
        return all.filter(i => !i.deleted_at);
    },

    async getItemsByFolder(folderId) {
        const all = await this.getByIndex(this.STORES.ITEMS, 'folder_id', folderId);
        return all.filter(i => !i.deleted_at);
    },

    async getItemsByType(itemType) {
        const all = await this.getByIndex(this.STORES.ITEMS, 'item_type', itemType);
        return all.filter(i => !i.deleted_at);
    },

    async getItem(id) {
        return this.get(this.STORES.ITEMS, id);
    },

    async saveItem(item) {
        return this.put(this.STORES.ITEMS, {
            ...item,
            _localUpdatedAt: DateUtils.now()
        });
    },

    async saveItems(items) {
        const withTimestamp = items.map(i => ({
            ...i,
            _localUpdatedAt: DateUtils.now()
        }));
        return this.putMany(this.STORES.ITEMS, withTimestamp);
    },

    async softDeleteItem(id) {
        const item = await this.get(this.STORES.ITEMS, id);
        if (item) {
            item.deleted_at = DateUtils.now();
            item._localUpdatedAt = DateUtils.now();
            return this.put(this.STORES.ITEMS, item);
        }
    },

    async hardDeleteItem(id) {
        return this.delete(this.STORES.ITEMS, id);
    },

    // ===========================================
    // Advanced Query Methods
    // ===========================================

    /**
     * Get subfolders (non-root children of a parent folder)
     * @param {string} parentFolderId
     * @returns {Promise<Array>}
     */
    async getSubfolders(parentFolderId) {
        const all = await this.getByIndex(this.STORES.FOLDERS, 'parent_folder_id', parentFolderId);
        return all
            .filter(f => f.parent_folder_id !== null && !f.deleted_at)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },

    /**
     * Get items in a folder, sorted by sort_order
     * @param {string} folderId
     * @returns {Promise<Array>}
     */
    async getItemsInFolderSorted(folderId) {
        const items = await this.getItemsByFolder(folderId);
        return items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },

    /**
     * Get all items sorted by sort_order
     * @returns {Promise<Array>}
     */
    async getItemsSorted() {
        const items = await this.getItems();
        return items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },

    /**
     * Get all file items
     * @returns {Promise<Array>}
     */
    async getFileItems() {
        return this.getItemsByType('file');
    },

    /**
     * Get folder's full path (breadcrumb)
     * @param {string} folderId
     * @returns {Promise<Array>} - Array of folders from root to target
     */
    async getBreadcrumb(folderId) {
        const breadcrumb = [];
        let currentId = folderId;

        while (currentId) {
            const folder = await this.getFolder(currentId);
            if (!folder || folder.parent_folder_id === null) break;  // Stop at vault (root)

            breadcrumb.unshift(folder);
            currentId = folder.parent_folder_id;
        }

        return breadcrumb;
    },

    // ===========================================
    // Sync Metadata Operations
    // ===========================================

    /**
     * Get user data value by key
     * @param {string} key
     * @returns {Promise<*>}
     */
    async getUserDataValue(key) {
        const record = await this.get(this.STORES.USER_DATA, key);
        return record ? record.value : null;
    },

    /**
     * Set user data value by key
     * @param {string} key
     * @param {*} value
     * @returns {Promise<void>}
     */
    async setUserDataValue(key, value) {
        return this.put(this.STORES.USER_DATA, { key, value });
    },

    /**
     * Get last sync version
     * @returns {Promise<number>}
     */
    async getLastSyncVersion() {
        return (await this.getUserDataValue('lastSyncVersion')) || 0;
    },

    /**
     * Set last sync version
     * @param {number} version
     * @returns {Promise<void>}
     */
    async setLastSyncVersion(version) {
        return this.setUserDataValue('lastSyncVersion', version);
    },

    /**
     * Get last sync timestamp
     * @returns {Promise<string|null>}
     */
    async getLastSyncTime() {
        return this.getUserDataValue('lastSyncTime');
    },

    /**
     * Set last sync timestamp
     * @returns {Promise<void>}
     */
    async setLastSyncTime() {
        return this.setUserDataValue('lastSyncTime', DateUtils.now());
    },

    // ===========================================
    // Offline Authentication Data
    // ===========================================

    /**
     * Save salt and KDF params for offline unlock
     * @param {string} salt - Base64 encoded salt
     * @param {Object} kdf - KDF parameters {memory, iterations, parallelism}
     * @returns {Promise<void>}
     */
    async saveOfflineAuth(salt, kdf) {
        await this.setUserDataValue('offline_salt', salt);
        await this.setUserDataValue('offline_kdf', kdf);
        console.log('[LocalDB] Saved offline auth data');
    },

    /**
     * Get salt and KDF params for offline unlock
     * @returns {Promise<{salt: string, kdf: Object}|null>}
     */
    async getOfflineAuth() {
        const salt = await this.getUserDataValue('offline_salt');
        const kdf = await this.getUserDataValue('offline_kdf');

        if (salt) {
            return { salt, kdf: kdf || null };
        }
        return null;
    },

    /**
     * Check if offline auth data exists (user has unlocked before)
     * @returns {Promise<boolean>}
     */
    async hasOfflineAuth() {
        const salt = await this.getUserDataValue('offline_salt');
        return !!salt;
    },

    /**
     * Clear offline auth data (on logout)
     * @returns {Promise<void>}
     */
    async clearOfflineAuth() {
        await this.delete(this.STORES.USER_DATA, 'offline_salt');
        await this.delete(this.STORES.USER_DATA, 'offline_kdf');
        console.log('[LocalDB] Cleared offline auth data');
    },

    // ===========================================
    // Re-encryption Backup (for crash recovery)
    // ===========================================

    /**
     * Save re-encryption backup before starting re-encryption
     * This allows recovery if re-encryption fails mid-way
     * @param {Object} backup - { status, old_salt, old_kdf, new_salt, new_kdf, started_at }
     */
    async saveReencryptionBackup(backup) {
        await this.setUserDataValue('reencryption_backup', backup);
        console.log('[LocalDB] Saved re-encryption backup');
    },

    /**
     * Get re-encryption backup (if exists)
     * @returns {Promise<Object|null>}
     */
    async getReencryptionBackup() {
        return this.getUserDataValue('reencryption_backup');
    },

    /**
     * Clear re-encryption backup (after successful completion)
     */
    async clearReencryptionBackup() {
        await this.delete(this.STORES.USER_DATA, 'reencryption_backup');
        console.log('[LocalDB] Cleared re-encryption backup');
    },

    /**
     * Check if there's an incomplete re-encryption
     * @returns {Promise<boolean>}
     */
    async hasIncompleteReencryption() {
        const backup = await this.getReencryptionBackup();
        return backup?.status === 'in_progress';
    },

    /**
     * Atomically save re-encrypted data + new salt/kdf in a single IndexedDB transaction.
     * If the app crashes mid-write, everything rolls back — no partial state.
     * @param {Array} mergedItems - Full item records with re-encrypted encrypted_data
     * @param {Array} mergedFolders - Full folder records with re-encrypted encrypted_name/icon
     * @param {string} newSalt - New salt for key derivation
     * @param {Object} newKdf - New KDF parameters
     * @returns {Promise<void>}
     */
    async saveReencryptionAtomically(mergedItems, mergedFolders, newSalt, newKdf) {
        await this.ensureInit();
        const now = DateUtils.now();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(
                [this.STORES.ITEMS, this.STORES.FOLDERS, this.STORES.USER_DATA],
                'readwrite'
            );

            tx.oncomplete = () => {
                console.log('[LocalDB] Atomic re-encryption save complete');
                resolve();
            };
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error('Atomic re-encryption save aborted'));

            const itemStore = tx.objectStore(this.STORES.ITEMS);
            const folderStore = tx.objectStore(this.STORES.FOLDERS);
            const userDataStore = tx.objectStore(this.STORES.USER_DATA);

            // Write all items
            for (const item of mergedItems) {
                itemStore.put({ ...item, _localUpdatedAt: now });
            }

            // Write all folders
            for (const folder of mergedFolders) {
                folderStore.put({ ...folder, _localUpdatedAt: now });
            }

            // Write new salt and KDF
            userDataStore.put({ key: 'offline_salt', value: newSalt });
            userDataStore.put({ key: 'offline_kdf', value: newKdf });
        });
    },

    // ===========================================
    // User Profile (Name, Email, etc.)
    // ===========================================

    /**
     * Save user name to IndexedDB
     * @param {string} name - User display name
     * @returns {Promise<void>}
     */
    async saveUserName(name) {
        await this.setUserDataValue('user_name', name);
        console.log('[LocalDB] Saved user name:', name);
    },

    /**
     * Get user name from IndexedDB
     * @returns {Promise<string|null>}
     */
    async getUserName() {
        return await this.getUserDataValue('user_name');
    },

    /**
     * Save user avatar to IndexedDB (base64 encoded)
     * @param {string} avatarBase64 - Base64 encoded avatar image
     * @returns {Promise<void>}
     */
    async saveUserAvatar(avatarBase64) {
        await this.setUserDataValue('user_avatar', avatarBase64);
        console.log('[LocalDB] Saved user avatar');
    },

    /**
     * Get user avatar from IndexedDB
     * @returns {Promise<string|null>} - Base64 encoded avatar or null
     */
    async getUserAvatar() {
        return await this.getUserDataValue('user_avatar');
    },

    /**
     * Delete user avatar from IndexedDB
     * @returns {Promise<void>}
     */
    async deleteUserAvatar() {
        await this.delete(this.STORES.USER_DATA, 'user_avatar');
        console.log('[LocalDB] Deleted user avatar');
    },

    // ===========================================
    // Pending Changes Queue (Offline Changes)
    // ===========================================

    /**
     * Add a pending change to the queue
     * @param {string} entityType - 'vault', 'folder', or 'item'
     * @param {string} entityId
     * @param {string} action - 'create', 'update', or 'delete'
     * @param {Object} data - The entity data (for create/update)
     * @returns {Promise<number>} - The pending change ID
     */
    async addPendingChange(entityType, entityId, action, data = null) {
        // For updates, check if there's already a pending change for this entity
        const existing = await this.getPendingChangeForEntity(entityType, entityId);

        if (existing) {
            // If already has a create, keep it as create with new data
            if (existing.action === 'create' && action === 'update') {
                return this.put(this.STORES.PENDING_CHANGES, {
                    ...existing,
                    data,
                    updated_at: DateUtils.now()
                });
            }
            // If already has create and now deleting, remove the pending change entirely
            if (existing.action === 'create' && action === 'delete') {
                await this.delete(this.STORES.PENDING_CHANGES, existing.id);
                return null;
            }
            // Otherwise update the existing pending change
            return this.put(this.STORES.PENDING_CHANGES, {
                ...existing,
                action,
                data,
                updated_at: DateUtils.now()
            });
        }

        // Add new pending change
        return this.put(this.STORES.PENDING_CHANGES, {
            entity_type: entityType,
            entity_id: entityId,
            action,
            data,
            created_at: DateUtils.now()
        });
    },

    /**
     * Get all pending changes
     * @returns {Promise<Array>}
     */
    async getPendingChanges() {
        return this.getAll(this.STORES.PENDING_CHANGES);
    },

    /**
     * Get pending change for a specific entity
     * @param {string} entityType
     * @param {string} entityId
     * @returns {Promise<Object|null>}
     */
    async getPendingChangeForEntity(entityType, entityId) {
        const changes = await this.getByIndex(this.STORES.PENDING_CHANGES, 'entity_id', entityId);
        return changes.find(c => c.entity_type === entityType) || null;
    },

    /**
     * Check if there are pending changes
     * @returns {Promise<boolean>}
     */
    async hasPendingChanges() {
        const changes = await this.getPendingChanges();
        return changes.length > 0;
    },

    /**
     * Get pending changes count
     * @returns {Promise<number>}
     */
    async getPendingChangesCount() {
        const changes = await this.getPendingChanges();
        return changes.length;
    },

    /**
     * Remove a pending change
     * @param {number} id
     * @returns {Promise<void>}
     */
    async removePendingChange(id) {
        return this.delete(this.STORES.PENDING_CHANGES, id);
    },

    /**
     * Clear all pending changes (after successful sync)
     * @returns {Promise<void>}
     */
    async clearPendingChanges() {
        return this.clear(this.STORES.PENDING_CHANGES);
    },

    /**
     * Add an order change to pending queue
     * @param {string} entityType - 'vault', 'folder', or 'item'
     * @param {string} entityId
     * @param {number} sortOrder
     * @returns {Promise<number>}
     */
    async addPendingOrderChange(entityType, entityId, sortOrder) {
        // Check for existing pending change for this entity
        const existing = await this.getPendingChangeForEntity(entityType, entityId);

        if (existing) {
            // Update the data with new sort_order
            const data = existing.data || {};
            data.sort_order = sortOrder;

            return this.put(this.STORES.PENDING_CHANGES, {
                ...existing,
                data,
                has_order_change: true,
                updated_at: DateUtils.now()
            });
        }

        // Add new order-only pending change
        return this.put(this.STORES.PENDING_CHANGES, {
            entity_type: entityType,
            entity_id: entityId,
            action: 'order',
            data: { sort_order: sortOrder },
            has_order_change: true,
            created_at: DateUtils.now()
        });
    },

    /**
     * Get pending changes grouped and sorted for proper sync order
     * Order: creates (vaults → folders → items) → updates → order changes → deletes (items → folders → vaults)
     * @returns {Promise<Object>} - { creates: [...], updates: [...], orders: [...], deletes: [...] }
     */
    async getPendingChangesSorted() {
        const changes = await this.getPendingChanges();

        // Entity type priority for creates (sync parent entities first)
        // Vaults are root-level containers, so they come first
        const createPriority = { vault: 0, folder: 1, item: 2 };
        // Reverse for deletes (delete children first)
        const deletePriority = { item: 0, folder: 1, vault: 2 };

        const creates = changes
            .filter(c => c.action === 'create')
            .sort((a, b) => (createPriority[a.entity_type] ?? 99) - (createPriority[b.entity_type] ?? 99));

        const updates = changes
            .filter(c => c.action === 'update');

        const orders = changes
            .filter(c => c.action === 'order');

        const deletes = changes
            .filter(c => c.action === 'delete')
            .sort((a, b) => (deletePriority[a.entity_type] ?? 99) - (deletePriority[b.entity_type] ?? 99));

        return { creates, updates, orders, deletes };
    },

    // ===========================================
    // Bulk Operations
    // ===========================================

    /**
     * Save all vault data (used for initial sync)
     * @param {Object} vaultData - { folders, items }
     * @returns {Promise<void>}
     */
    async saveVaultData(vaultData) {
        await this.ensureInit();

        // Clear existing data
        await this.clear(this.STORES.FOLDERS);
        await this.clear(this.STORES.ITEMS);

        // Save new data
        // Folders include vaults (root folders with parent_folder_id = null)
        if (vaultData.folders?.length) {
            await this.saveFolders(vaultData.folders);
        }
        if (vaultData.items?.length) {
            await this.saveItems(vaultData.items);
        }

        // Update sync time
        await this.setLastSyncTime();

        // Count vaults for logging
        const vaultCount = vaultData.folders?.filter(f => f.parent_folder_id === null)?.length || 0;

        console.log('[LocalDB] Vault data saved:', {
            vaults: vaultCount,
            folders: vaultData.folders?.length || 0,
            items: vaultData.items?.length || 0
        });
    },

    /**
     * Load all vault data
     * @returns {Promise<Object>} - { folders, items, vaults }
     */
    async loadVaultData() {
        await this.ensureInit();

        const [folders, items, vaults] = await Promise.all([
            this.getFolders(),
            this.getItems(),
            this.getVaults()
        ]);

        console.log('[LocalDB] Vault data loaded:', {
            vaults: vaults.length,
            folders: folders.length,
            items: items.length
        });

        return { folders, items, vaults };
    },

    /**
     * Check if local database has data
     * Checks for vaults (root folders)
     * @returns {Promise<boolean>}
     */
    async hasData() {
        const vaults = await this.getVaults();
        return vaults.length > 0;
    },

    // ===========================================
    // Database Management
    // ===========================================

    /**
     * Clear all data (used on logout)
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.ensureInit();
        await Promise.all([
            this.clear(this.STORES.FOLDERS),
            this.clear(this.STORES.ITEMS),
            this.clear(this.STORES.USER_DATA),
            this.clear(this.STORES.PENDING_CHANGES)
        ]);
        console.log('[LocalDB] All data cleared');
    },

    /**
     * Delete the current database
     * @returns {Promise<void>}
     */
    async deleteDatabase() {
        if (!this._dbName) {
            console.warn('[LocalDB] No database configured to delete');
            return;
        }

        const dbName = this._dbName;

        if (this.db) {
            this.db.close();
            this.db = null;
        }

        // Reset state
        this._mode = null;
        this._userId = null;
        this._dbName = null;

        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => {
                console.log(`[LocalDB] Database deleted: ${dbName}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                console.warn(`[LocalDB] Database deletion blocked: ${dbName}`);
                resolve();
            };
        });
    },

    /**
     * Get database storage estimate
     * @returns {Promise<Object>} - { usage, quota }
     */
    async getStorageEstimate() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                usageMB: (estimate.usage / 1024 / 1024).toFixed(2),
                quotaMB: (estimate.quota / 1024 / 1024).toFixed(2)
            };
        }
        return null;
    },

    /**
     * Check if local database exists and has data
     * Used to warn users before they switch to cloud mode
     * @returns {Promise<boolean>}
     */
    async checkLocalDatabaseHasData() {
        // Save current state
        const currentMode = this._mode;
        const currentUserId = this._userId;
        const currentDb = this.db;

        try {
            // Temporarily switch to local database
            this._mode = 'local';
            this._userId = null;
            this._dbName = 'keyhive_local';
            this.db = null;

            // Try to open and check
            await this.init();
            const hasData = await this.hasData();

            // Close local database
            this.closeDatabase();

            return hasData;
        } catch (e) {
            // Database doesn't exist or error
            return false;
        } finally {
            // Restore previous state
            this._mode = currentMode;
            this._userId = currentUserId;
            this._dbName = currentMode === 'local'
                ? 'keyhive_local'
                : (currentUserId ? `keyhive_cloud_${currentUserId}` : null);
            this.db = currentDb;
        }
    },

    /**
     * List all KeyHive databases
     * @returns {Promise<Array<string>>}
     */
    async listDatabases() {
        if (indexedDB.databases) {
            const databases = await indexedDB.databases();
            return databases
                .map(db => db.name)
                .filter(name => name && name.startsWith('keyhive_'));
        }
        // Fallback for browsers that don't support indexedDB.databases()
        return [];
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalDB;
}
