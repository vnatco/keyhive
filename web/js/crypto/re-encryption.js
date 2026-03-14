/**
 * Re-Encryption Service (Canonical Data Layer)
 *
 * Handles secure re-encryption of vault data when:
 * 1. Changing master password (same KDF, new password)
 * 2. Changing KDF settings (same password, new KDF)
 *
 * SAFETY GUARANTEES:
 * - Backup saved to IndexedDB before re-encryption starts
 * - For cloud mode: If sync fails, tries to restore old key first;
 *   falls back to delete-DB + logout only if restore fails
 * - Merge-on-write: only encrypted fields are merged into existing records
 * - All crypto happens in the Web Worker via CryptoAPI.reEncryptWithNewKey()
 * - Files are re-encrypted one by one with progress tracking
 *
 * UI layer lives in SettingsBase.performReEncryption() (base.js)
 */

const ReEncryption = {
    // Progress tracking
    _onProgress: null,
    _aborted: false,

    /**
     * Main re-encryption entry point
     * Called by both master password change and KDF change
     *
     * @param {Object} options
     * @param {string} options.oldPassword - Current master password
     * @param {string} options.newPassword - New master password (same as old for KDF change)
     * @param {Object} options.oldKdf - Current KDF settings { memory, iterations, parallelism }
     * @param {Object} options.newKdf - New KDF settings (same as old for password change)
     * @param {string} options.mode - 'password_change' or 'kdf_change' (caller decides, no guessing)
     * @param {Function} options.onProgress - Progress callback (stage, percent, message)
     * @param {boolean} options.skipPasswordVerification - Skip old password verification (for recovery flow)
     * @returns {Promise<{success: boolean, newSalt?: string, newKdf?: Object, error?: string}>}
     */
    async reEncrypt({ oldPassword, newPassword, oldKdf, newKdf, mode, onProgress, skipPasswordVerification = false }) {
        this._onProgress = onProgress || (() => {});
        this._aborted = false;

        const isLocalMode = App?.state?.isLocalMode ||
                           localStorage.getItem('keyhive_mode') === 'local';

        // CRITICAL: Set re-encryption lock to block ALL sync/refresh operations
        if (typeof App !== 'undefined') {
            App.lock('reencryption');
        }

        try {
            // Step 1: Check prerequisites
            this._progress('checking', 0, 'Checking prerequisites...');

            if (!isLocalMode) {
                // Cloud mode: Must be online
                const isOnline = typeof Connectivity !== 'undefined'
                    ? Connectivity.isOnline()
                    : navigator.onLine;

                if (!isOnline) {
                    if (typeof App !== 'undefined') App.unlock();
                    return {
                        success: false,
                        error: 'You must be online to change encryption settings for cloud storage. Please connect to the internet and try again.'
                    };
                }
            }

            // Verify old password (skip for recovery flow where key is already loaded)
            if (!skipPasswordVerification) {
                this._progress('checking', 10, 'Verifying current password...');
                const isValid = await CryptoAPI.verifyMasterPassword(oldPassword);
                if (!isValid) {
                    if (typeof App !== 'undefined') App.unlock();
                    return { success: false, error: 'Current password is incorrect' };
                }
            } else {
                // For recovery, just verify vault is unlocked
                const isUnlocked = await CryptoAPI.isUnlocked();
                if (!isUnlocked) {
                    if (typeof App !== 'undefined') App.unlock();
                    return { success: false, error: 'Vault is not unlocked' };
                }
            }

            // Step 2: Get all data from IndexedDB
            this._progress('loading', 15, 'Loading vault data...');
            const vaultData = await this._loadAllData();

            if (this._aborted) {
                if (typeof App !== 'undefined') App.unlock();
                return { success: false, error: 'Operation cancelled' };
            }

            // Step 3: Download and decrypt files BEFORE key switch (cloud only)
            let decryptedFiles = [];
            const fileItems = vaultData.items.filter(i => i.item_type === 'file');

            if (!isLocalMode && fileItems.length > 0) {
                this._progress('files', 20, `Downloading ${fileItems.length} files...`);
                decryptedFiles = await this._downloadAndDecryptFiles(fileItems);
            }

            if (this._aborted) {
                if (typeof App !== 'undefined') App.unlock();
                return { success: false, error: 'Operation cancelled' };
            }

            // Step 4: Generate new salt and save backup
            this._progress('preparing', 35, 'Preparing new encryption...');
            const newSalt = await CryptoAPI.generateSalt();

            // CRITICAL: Save backup before re-encryption (allows recovery if anything fails)
            if (typeof LocalDB !== 'undefined') {
                const currentAuth = await LocalDB.getOfflineAuth();
                await LocalDB.saveReencryptionBackup({
                    status: 'in_progress',
                    old_salt: currentAuth?.salt,
                    old_kdf: currentAuth?.kdf || oldKdf,
                    new_salt: newSalt,
                    new_kdf: newKdf,
                    started_at: DateUtils.now()
                });
            }

            // Step 5: Re-encrypt everything in memory (this switches the key!)
            this._progress('encrypting', 40, 'Re-encrypting vault data...');
            const reEncryptedData = await this._reEncryptAllData(
                vaultData,
                newPassword,
                newSalt,
                newKdf
            );

            if (this._aborted) {
                if (typeof App !== 'undefined') App.unlock();
                return { success: false, error: 'Operation cancelled' };
            }

            // Step 6: Re-encrypt files with new key
            let reEncryptedFiles = [];
            if (decryptedFiles.length > 0) {
                this._progress('encrypting', 50, 'Re-encrypting files...');
                reEncryptedFiles = await this._reEncryptDecryptedFiles(decryptedFiles);
            }

            // Step 7: Merge re-encrypted data into IndexedDB
            this._progress('saving', 60, 'Saving re-encrypted data...');
            await this._saveToIndexedDB(reEncryptedData, newSalt, newKdf);

            // Step 8: For cloud mode, sync to server
            if (!isLocalMode) {
                this._progress('syncing', 70, 'Syncing with server...');

                try {
                    // Check online status again
                    const stillOnline = typeof Connectivity !== 'undefined'
                        ? Connectivity.isOnline()
                        : navigator.onLine;

                    if (!stillOnline) {
                        throw new Error('Lost connection during sync');
                    }

                    // Sync vault data to server (mode decides endpoint)
                    await this._syncToServer(newSalt, newKdf, reEncryptedData, mode);

                    // Upload re-encrypted files
                    if (reEncryptedFiles.length > 0) {
                        this._progress('uploading', 80, `Uploading ${reEncryptedFiles.length} files...`);
                        await this._uploadReEncryptedFiles(reEncryptedFiles);
                    }

                } catch (syncError) {
                    console.error('[ReEncryption] Sync failed:', syncError);

                    // CRITICAL: Local data is already re-encrypted but server sync failed
                    // Try to restore old key first, then fall back to nuclear option
                    this._progress('recovering', 0, 'Sync failed, recovering...');

                    await this._recoverFromSyncFailure(oldPassword);

                    return {
                        success: false,
                        error: 'Sync failed. For your safety, you have been logged out. Please log in again with your OLD password. Your server data is intact.'
                    };
                }
            }

            // Step 9: Finalize
            this._progress('finalizing', 95, 'Finalizing...');

            // Clear backup - re-encryption completed successfully
            if (typeof LocalDB !== 'undefined') {
                await LocalDB.clearReencryptionBackup();
            }

            this._progress('complete', 100, 'Re-encryption complete!');

            // Clear re-encryption lock and resume sync
            if (typeof App !== 'undefined') {
                App.unlock();
            }

            return { success: true, newSalt, newKdf };

        } catch (error) {
            console.error('[ReEncryption] Error:', error);

            // Clear re-encryption lock and resume sync
            if (typeof App !== 'undefined') {
                App.unlock();
            }

            return {
                success: false,
                error: error.message || 'Re-encryption failed'
            };
        }
    },

    /**
     * Abort ongoing re-encryption (best effort)
     */
    abort() {
        this._aborted = true;
    },

    /**
     * Report progress
     */
    _progress(stage, percent, message) {
        console.log(`[ReEncryption] ${stage}: ${percent}% - ${message}`);
        if (this._onProgress) {
            this._onProgress(stage, percent, message);
        }
    },

    /**
     * Load all data from IndexedDB
     */
    async _loadAllData() {
        const folders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const items = await LocalDB.getAll(LocalDB.STORES.ITEMS);

        return { folders, items };
    },

    /**
     * Re-encrypt all vault data
     * This happens in the crypto worker to keep keys secure
     */
    async _reEncryptAllData(vaultData, newPassword, newSalt, newKdf) {
        const { folders, items } = vaultData;

        // Prepare items for re-encryption
        // Items have: encrypted_data
        // Folders (including vaults) have: encrypted_name, encrypted_icon

        const allEncrypted = [];

        // Add items
        for (const item of items) {
            if (item.encrypted_data) {
                allEncrypted.push({
                    _type: 'item',
                    id: item.id,
                    encrypted_data: item.encrypted_data,
                    original: item
                });
            }
        }

        // Add folders (including vaults which are root folders)
        for (const folder of folders) {
            if (folder.encrypted_name || folder.encrypted_icon) {
                allEncrypted.push({
                    _type: 'folder',
                    id: folder.id,
                    encrypted_name: folder.encrypted_name,
                    encrypted_icon: folder.encrypted_icon,
                    original: folder
                });
            }
        }

        // Call crypto worker to re-encrypt everything
        const result = await CryptoAPI.reEncryptWithNewKey(
            allEncrypted,
            newPassword,
            newSalt,
            newKdf
        );

        // Map results back - only need re-encrypted fields (merge happens in _saveToIndexedDB)
        const reEncryptedFolders = [];
        const reEncryptedItems = [];

        for (const item of result.items) {
            const original = allEncrypted.find(e => e.id === item.id);
            if (!original) continue;

            switch (original._type) {
                case 'item':
                    reEncryptedItems.push({
                        id: item.id,
                        encrypted_data: item.encrypted_data
                    });
                    break;
                case 'folder':
                    reEncryptedFolders.push({
                        id: item.id,
                        encrypted_name: item.encrypted_name,
                        encrypted_icon: item.encrypted_icon
                    });
                    break;
            }
        }

        return {
            folders: reEncryptedFolders,
            items: reEncryptedItems,
            newSalt: newSalt,
            verificationHash: result.verificationHash
        };
    },

    /**
     * Save re-encrypted data to IndexedDB using merge-on-write
     * Only updates encrypted fields in existing records, preserving metadata
     */
    async _saveToIndexedDB(data, newSalt, newKdf) {
        const { folders, items } = data;

        // Get existing records from IndexedDB
        const existingItems = await LocalDB.getAll(LocalDB.STORES.ITEMS);
        const existingFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);

        // Create lookup maps for re-encrypted data
        const reEncryptedItemsMap = new Map(items.map(i => [i.id, i]));
        const reEncryptedFoldersMap = new Map(folders.map(f => [f.id, f]));

        // Merge re-encrypted fields into existing items
        const mergedItems = existingItems.map(item => {
            const reEnc = reEncryptedItemsMap.get(item.id);
            return reEnc ? { ...item, encrypted_data: reEnc.encrypted_data } : item;
        });

        const mergedFolders = existingFolders.map(folder => {
            const reEnc = reEncryptedFoldersMap.get(folder.id);
            return reEnc ? { ...folder, encrypted_name: reEnc.encrypted_name, encrypted_icon: reEnc.encrypted_icon } : folder;
        });

        // Save merged data to IndexedDB
        if (mergedItems.length > 0) {
            await LocalDB.saveItems(mergedItems);
        }
        if (mergedFolders.length > 0) {
            await LocalDB.saveFolders(mergedFolders);
        }

        // Update auth (salt/kdf)
        await LocalDB.saveOfflineAuth(newSalt, newKdf);
    },

    /**
     * Sync re-encrypted data to server (cloud mode only)
     * Uses mode to pick the correct API endpoint
     */
    async _syncToServer(newSalt, newKdf, data, mode) {
        // data.items = [{id, encrypted_data}, ...] (all items including file metadata)
        // data.folders = [{id, encrypted_name, encrypted_icon}, ...] (includes vaults)
        // File *content* is re-encrypted and uploaded separately via _uploadReEncryptedFiles
        const { items, folders } = data;

        let response;

        if (mode === 'kdf_change') {
            response = await ApiClient.changeKdf(newSalt, newKdf, items, folders);
        } else {
            // password_change
            response = await ApiClient.changeMaster(newSalt, items, folders);
        }

        if (!response.success) {
            throw new Error(response.message || 'Server sync failed');
        }

        return response;
    },

    /**
     * Recover from sync failure (cloud mode)
     * First tries to restore old key from server, then falls back to delete-DB + logout
     */
    async _recoverFromSyncFailure(oldPassword) {
        try {
            // First: try to restore old key from server (server still has old salt)
            if (oldPassword) {
                try {
                    const saltResponse = await ApiClient.getSalt();
                    if (saltResponse.success && saltResponse.data?.salt) {
                        await CryptoAPI.deriveKey(oldPassword, saltResponse.data.salt, saltResponse.data.kdf);
                        console.log('[ReEncryption] Restored old key from server');
                        // Old key restored - caller will show error, user can retry
                        return;
                    }
                } catch (restoreError) {
                    console.error('[ReEncryption] Failed to restore old key:', restoreError);
                }
            }

            // Fallback: Delete local IndexedDB and logout
            await LocalDB.deleteDatabase();
            LocalDB.clearMode();

            // Lock crypto
            if (typeof CryptoAPI !== 'undefined') {
                await CryptoAPI.lock();
            }

            // Reset app state
            if (typeof App !== 'undefined') {
                App.state = {
                    isAuthenticated: false,
                    isUnlocked: false,
                    isLocalMode: false,
                    user: null
                };
            }

            // Clear vault
            if (typeof Vault !== 'undefined') {
                Vault.reset();
            }

        } catch (e) {
            console.error('[ReEncryption] Recovery cleanup failed:', e);
        }
    },

    /**
     * Download and decrypt all files BEFORE key switch
     * This must be called while the OLD key is still active in the worker
     */
    async _downloadAndDecryptFiles(fileItems) {
        const decryptedFiles = [];
        const total = fileItems.length;

        for (let i = 0; i < fileItems.length; i++) {
            if (this._aborted) {
                throw new Error('Operation cancelled');
            }

            const item = fileItems[i];
            this._progress('files', 20 + Math.floor((i / total) * 15),
                `Downloading file ${i + 1}/${total}...`);

            try {
                // Download encrypted file
                const downloadResponse = await ApiClient.downloadFile(item.id);
                if (!downloadResponse.success) {
                    console.warn(`[ReEncryption] Failed to download file ${item.id}, skipping`);
                    continue;
                }

                // Get encrypted content
                const encryptedBase64 = downloadResponse.data?.encrypted_content ||
                                        downloadResponse.data?.content;

                if (!encryptedBase64) {
                    console.warn(`[ReEncryption] No content for file ${item.id}, skipping`);
                    continue;
                }

                // Decrypt with current (OLD) key
                const decryptedData = await CryptoAPI.decryptFile(encryptedBase64);

                decryptedFiles.push({
                    id: item.id,
                    decryptedData: decryptedData
                });

            } catch (e) {
                console.error(`[ReEncryption] Failed to download/decrypt file ${item.id}:`, e);
                // Continue with other files
            }
        }

        return decryptedFiles;
    },

    /**
     * Re-encrypt decrypted files with the NEW key
     * This must be called AFTER the key switch
     */
    async _reEncryptDecryptedFiles(decryptedFiles) {
        const reEncryptedFiles = [];

        for (const file of decryptedFiles) {
            if (this._aborted) {
                throw new Error('Operation cancelled');
            }

            try {
                // Re-encrypt with NEW key
                const reEncryptedData = await CryptoAPI.encryptFile(file.decryptedData);

                reEncryptedFiles.push({
                    id: file.id,
                    encryptedData: reEncryptedData
                });

            } catch (e) {
                console.error(`[ReEncryption] Failed to re-encrypt file ${file.id}:`, e);
                // Continue with other files
            }
        }

        return reEncryptedFiles;
    },

    /**
     * Upload re-encrypted files to server
     */
    async _uploadReEncryptedFiles(reEncryptedFiles) {
        const total = reEncryptedFiles.length;

        for (let i = 0; i < reEncryptedFiles.length; i++) {
            if (this._aborted) {
                throw new Error('Operation cancelled');
            }

            const file = reEncryptedFiles[i];
            this._progress('uploading', 80 + Math.floor((i / total) * 15),
                `Uploading file ${i + 1}/${total}...`);

            try {
                const response = await ApiClient.updateFileContent(file.id, file.encryptedData);
                if (!response.success) {
                    console.warn(`[ReEncryption] Failed to upload file ${file.id}`);
                }
            } catch (e) {
                console.error(`[ReEncryption] Failed to upload file ${file.id}:`, e);
                // Continue with other files
            }
        }
    }
};
