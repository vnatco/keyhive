/**
 * KeyHiveV1Importer - Import KeyHive v1 encrypted exports
 *
 * Format: vaults are folders with parent_folder_id = null
 */
class KeyHiveV1Importer {
    constructor() {
        this.requiresPassword = true;
        this.parsedData = null;
        this.importPassword = null;
        this.useSamePassword = false;
        this.salt = null;
        this.kdf = null;

        // Flow state
        this.controller = null;
        this.importMode = 'merge';
        this.mergeDefaultVaults = false;
        this.defaultVaultMergeInfo = null;
        this.originalImportIds = null;
        this.updateConflictItems = true;
        this.restoreDeletedItems = false;
        this.importOrphanedItemsFlag = false;
        this.hasRestorableItems = false;
        this.hasConflictItems = false;
        this.hasOrphanedItems = false;
        this.analysis = null;
        this.decryptedImportData = null;
        this.currentVaultData = null;
    }

    parse(content) {
        try {
            const json = JSON.parse(content);

            if (!json.version || json.version !== 1) {
                return { success: false, error: 'Unsupported export version' };
            }

            if (!json.salt || !json.kdf || !json.data) {
                return { success: false, error: 'Invalid export file format' };
            }

            this.salt = json.salt;
            this.kdf = json.kdf;

            return {
                success: true,
                data: {
                    version: json.version,
                    salt: json.salt,
                    kdf: json.kdf,
                    exportDate: json.exportDate,
                    skippedFiles: json.skippedFiles || 0,
                    folders: json.data.folders || [],
                    items: json.data.items || []
                }
            };
        } catch (e) {
            console.error('Parse error:', e);
            return { success: false, error: 'Failed to parse JSON file' };
        }
    }

    getSampleEncryptedItem(data) {
        if (data.items && data.items.length > 0) {
            const item = data.items.find(i => i.encrypted_data);
            if (item) return { type: 'item', data: item.encrypted_data };
        }
        if (data.folders && data.folders.length > 0) {
            const folder = data.folders.find(f => f.encrypted_name);
            if (folder) return { type: 'folder', data: folder.encrypted_name };
        }
        return null;
    }

    async verifyPassword() {
        if (this.useSamePassword) return true;

        const data = this.parsedData;
        const sample = this.getSampleEncryptedItem(data);
        if (!sample) return true;

        try {
            const testItems = [{ id: 'test', encrypted_data: sample.data }];
            if (sample.type === 'folder') {
                testItems[0] = { id: 'test', encrypted_name: sample.data };
            }
            const result = await CryptoAPI.importDecrypt(testItems, this.importPassword, data.salt, data.kdf);
            return result.items && result.items.length > 0 && !result.errors;
        } catch (e) {
            console.error('Password verification error:', e);
            return false;
        }
    }

    async decryptAll() {
        const data = this.parsedData;
        if (this.useSamePassword) return this.decryptWithCurrentKey(data);

        const allItems = [];
        for (const folder of data.folders) {
            allItems.push({ _type: 'folder', id: folder.id, ...folder });
        }
        for (const item of data.items) {
            allItems.push({ _type: 'item', id: item.id, ...item });
        }

        const result = await CryptoAPI.importDecrypt(allItems, this.importPassword, data.salt, data.kdf);
        if (result.errors && result.errors.length > 0) {
            console.warn('Some items failed to decrypt:', result.errors);
        }

        const folders = [];
        const items = [];

        for (const item of result.items) {
            if (item._type === 'folder') {
                folders.push({
                    id: item.id, parent_folder_id: item.parent_folder_id,
                    is_default: item.is_default, sort_order: item.sort_order,
                    created_at: item.created_at, updated_at: item.updated_at,
                    decrypted_name: item.decrypted_name, decrypted_icon: item.decrypted_icon
                });
            } else if (item._type === 'item') {
                items.push({
                    id: item.id, item_type: item.item_type, folder_id: item.folder_id,
                    is_favorite: item.is_favorite, sort_order: item.sort_order,
                    created_at: item.created_at, updated_at: item.updated_at,
                    decrypted_data: item.decrypted_data || item.data
                });
            }
        }

        return { folders, items };
    }

    async decryptWithCurrentKey(data) {
        const folders = await Promise.all(data.folders.map(async (f) => {
            const name = f.encrypted_name ? await CryptoAPI.decrypt(f.encrypted_name) : '';
            const icon = f.encrypted_icon ? await CryptoAPI.decrypt(f.encrypted_icon) : null;
            return {
                id: f.id, parent_folder_id: f.parent_folder_id,
                is_default: f.is_default, sort_order: f.sort_order,
                created_at: f.created_at, updated_at: f.updated_at,
                decrypted_name: name, decrypted_icon: icon
            };
        }));

        const items = await Promise.all(data.items.map(async (item) => {
            const itemData = item.encrypted_data
                ? await CryptoAPI.decryptObject(item.encrypted_data)
                : (item.decrypted_data || item.data || {});
            return {
                id: item.id, item_type: item.item_type, folder_id: item.folder_id,
                is_favorite: item.is_favorite, sort_order: item.sort_order,
                created_at: item.created_at, updated_at: item.updated_at,
                decrypted_data: itemData
            };
        }));

        return { folders, items };
    }

    // ========================
    // Flow control
    // ========================

    async runFlow(controller) {
        this.controller = controller;

        const currentPasswordWorks = await this._tryCurrentPassword();
        if (currentPasswordWorks) {
            await this._performAnalysis();
        } else {
            this._showPasswordPhase();
        }
    }

    async _tryCurrentPassword() {
        if (!this.requiresPassword) return true;
        try {
            const data = this.parsedData;
            const sampleItem = this.getSampleEncryptedItem(data);
            if (!sampleItem) return false;

            const offlineAuth = await LocalDB.getOfflineAuth();
            if (!offlineAuth) return false;

            if (data.salt === offlineAuth.salt) {
                this.useSamePassword = true;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error trying current password:', error);
            return false;
        }
    }

    _showPasswordPhase() {
        this.controller.setContent(ImportRenderer.renderPasswordPhase());
        this._bindPasswordEvents();
    }

    _bindPasswordEvents() {
        const passwordInput = this.controller.querySelector('#importPassword');
        const toggleBtn = this.controller.querySelector('#toggleImportPassword');
        const backBtn = this.controller.querySelector('#importBackBtn');
        const decryptBtn = this.controller.querySelector('#importDecryptBtn');

        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            toggleBtn.querySelector('.icon-show').style.display = isPassword ? 'none' : '';
            toggleBtn.querySelector('.icon-hide').style.display = isPassword ? '' : 'none';
        });

        backBtn.addEventListener('click', () => ImportManager.showPhase('file-select'));

        decryptBtn.addEventListener('click', async () => {
            const password = passwordInput.value;
            if (!password) {
                Toast.error('Please enter the export password');
                return;
            }

            decryptBtn.disabled = true;
            decryptBtn.querySelector('.btn-text').style.display = 'none';
            decryptBtn.querySelector('.btn-loading').style.display = 'inline-flex';

            try {
                this.importPassword = password;
                const verified = await this.verifyPassword();
                if (!verified) {
                    Toast.error('Incorrect password');
                    decryptBtn.disabled = false;
                    decryptBtn.querySelector('.btn-text').style.display = '';
                    decryptBtn.querySelector('.btn-loading').style.display = 'none';
                    return;
                }
                await this._performAnalysis();
            } catch (error) {
                console.error('Decrypt error:', error);
                Toast.error('Failed to decrypt: ' + (error.message || 'Unknown error'));
                decryptBtn.disabled = false;
                decryptBtn.querySelector('.btn-text').style.display = '';
                decryptBtn.querySelector('.btn-loading').style.display = 'none';
            }
        });

        passwordInput.focus();
    }

    async _performAnalysis() {
        this.controller.setContent(`
            <div class="import-phase import-analyzing">
                <div class="import-loading">
                    <div class="spinner"></div>
                    <p>Analyzing import data...</p>
                </div>
            </div>
        `);

        try {
            const decryptedData = await this.decryptAll();
            const currentData = await this.controller.loadCurrentVaultData();

            this.decryptedImportData = decryptedData;
            this.currentVaultData = currentData;

            this.defaultVaultMergeInfo = this._detectDefaultVaultMerge(decryptedData, currentData);
            this.mergeDefaultVaults = this.defaultVaultMergeInfo?.namesMatch || false;
            this.originalImportIds = null;

            if (this.mergeDefaultVaults && this.defaultVaultMergeInfo) {
                this._applyDefaultVaultMerge(true);
            }

            this.analysis = BaseImporter.analyzeConflicts(decryptedData, currentData);

            this.hasRestorableItems = this.analysis.restoring.length > 0;
            this.restoreDeletedItems = false;

            const totalConflicts = this.analysis.folders.conflicts.length +
                                   this.analysis.items.conflicts.length;
            this.hasConflictItems = totalConflicts > 0;
            this.updateConflictItems = true;

            this.hasOrphanedItems = ImportRenderer.getOrphanedItems(this.decryptedImportData, null).length > 0;
            this.importOrphanedItemsFlag = false;

            this._showAnalysisPhase();
        } catch (error) {
            console.error('Analysis error:', error);
            Toast.error('Failed to analyze import: ' + (error.message || 'Unknown error'));
            ImportManager.showPhase('file-select');
        }
    }

    _showAnalysisPhase() {
        const a = this.analysis;
        const orphanedCount = ImportRenderer.getOrphanedItems(this.decryptedImportData, null).length;
        const newCount = a.folders.new.length + a.items.new.length;
        const conflictCount = a.folders.conflicts.length + a.items.conflicts.length;
        const restoringCount = a.restoring.length;

        const hasConflicts = conflictCount > 0;
        const hasOrphans = orphanedCount > 0;
        const hasNewItems = newCount > 0;
        const hasRestorableItems = restoringCount > 0;
        const hasAnythingToImport = hasNewItems || hasConflicts || hasOrphans || hasRestorableItems;

        let buttonText = 'Import';
        if (hasNewItems) {
            buttonText = `Import ${newCount} New Item${newCount !== 1 ? 's' : ''}`;
        }

        const treeOptions = {
            showVaults: true,
            isCleanMode: this.importMode === 'clean',
            updateConflictItems: this.updateConflictItems,
            restoreDeletedItems: this.restoreDeletedItems,
            mergeDefaultVaults: this.mergeDefaultVaults,
            mergeInfo: this.defaultVaultMergeInfo,
            originalImportIds: this.originalImportIds,
            hasRestorableItems: this.hasRestorableItems
        };

        let html = '<div class="import-phase import-analysis">';
        html += ImportRenderer.renderImportTree(this.decryptedImportData, this.analysis, treeOptions);

        if ((hasConflicts || hasOrphans) && this.importMode === 'merge') {
            html += ImportRenderer.renderConflicts(this.analysis, {
                updateConflictItems: this.updateConflictItems,
                importOrphanedItems: this.importOrphanedItemsFlag,
                orphanedCount
            });
        }

        html += ImportRenderer.renderNothingAlert(!hasAnythingToImport);
        html += ImportRenderer.renderActionButtons(buttonText, !hasAnythingToImport);
        html += '</div>';

        this.controller.setContent(html);
        this._bindAnalysisEvents();
    }

    _bindAnalysisEvents() {
        const cancelBtn = this.controller.querySelector('#importCancelBtn');
        const startBtn = this.controller.querySelector('#importStartBtn');
        const updateConflictsCheckbox = this.controller.querySelector('#updateConflictsCheckbox');
        const importOrphanedCheckbox = this.controller.querySelector('#importOrphanedCheckbox');
        const mergeCheckbox = this.controller.querySelector('#mergeDefaultVaultsCheckbox');
        const restoreCheckbox = this.controller.querySelector('#restoreDeletedCheckbox');

        cancelBtn.addEventListener('click', () => ImportManager.close());

        const popupEl = this.controller.getElement();
        const modeTabs = popupEl.querySelectorAll('.import-mode-tab');
        modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.importMode = tab.dataset.mode;
                this._showAnalysisPhase();
            });
        });

        const nothingAlert = this.controller.querySelector('#nothingToImportAlert');
        const updateButtonText = () => {
            const { text, disabled } = this._getButtonText(updateConflictsCheckbox, importOrphanedCheckbox, restoreCheckbox);
            startBtn.textContent = text;
            startBtn.disabled = disabled;
            if (nothingAlert) nothingAlert.style.display = disabled ? '' : 'none';
        };

        if (mergeCheckbox) {
            mergeCheckbox.addEventListener('change', () => {
                this.mergeDefaultVaults = mergeCheckbox.checked;
                this._applyDefaultVaultMerge(this.mergeDefaultVaults);
                this.analysis = BaseImporter.analyzeConflicts(this.decryptedImportData, this.currentVaultData);
                this.hasRestorableItems = this.analysis.restoring.length > 0;
                this._showAnalysisPhase();
            });
        }

        if (restoreCheckbox) {
            restoreCheckbox.addEventListener('change', () => {
                this.restoreDeletedItems = restoreCheckbox.checked;
                this._showAnalysisPhase();
            });
        }

        if (updateConflictsCheckbox) {
            updateConflictsCheckbox.addEventListener('change', () => {
                this.updateConflictItems = updateConflictsCheckbox.checked;
                this._showAnalysisPhase();
            });
        }

        if (importOrphanedCheckbox) {
            importOrphanedCheckbox.addEventListener('change', () => {
                this.importOrphanedItemsFlag = importOrphanedCheckbox.checked;
                updateButtonText();
            });
        }

        updateButtonText();

        startBtn.addEventListener('click', () => this._executeImport());
    }

    _getButtonText(updateConflictsCheckbox, importOrphanedCheckbox, restoreCheckbox) {
        if (this.importMode === 'clean') {
            const data = this.decryptedImportData;
            const total = data.folders.length + data.items.length;
            return total > 0
                ? { text: `Import ${total} Items as New`, disabled: false }
                : { text: 'Nothing to Import', disabled: true };
        }

        const a = this.analysis;
        const newCount = a.folders.new.length + a.items.new.length;
        const conflictCount = a.folders.conflicts.length + a.items.conflicts.length;
        const orphanedCount = ImportRenderer.getOrphanedItems(this.decryptedImportData, null).length;
        const restoringCount = a.restoring.length;

        const includeConflicts = updateConflictsCheckbox?.checked || false;
        const includeOrphaned = importOrphanedCheckbox?.checked || false;
        const includeRestoring = restoreCheckbox?.checked || false;

        const total = newCount +
                      (includeConflicts ? conflictCount : 0) +
                      (includeOrphaned ? orphanedCount : 0) +
                      (includeRestoring ? restoringCount : 0);

        return total > 0
            ? { text: `Import ${total} Item${total !== 1 ? 's' : ''}`, disabled: false }
            : { text: 'Nothing to Import', disabled: true };
    }

    async _executeImport() {
        if (this.importMode === 'clean') {
            await this._executeCleanImport();
            return;
        }

        this.controller.showProgressPhase();
        this.controller.lockApp();

        const results = { success: { folders: 0, items: 0, vaults: 0 }, failed: [] };

        try {
            const a = this.analysis;
            const now = DateUtils.now();
            const isCloudMode = LocalDB.getMode() !== 'local';
            const idMap = this.controller.buildConflictIdMap(a);

            this.controller.showProgress(5, 'Importing folders...');
            await this.controller.importFolders(a.folders, results, now, isCloudMode, idMap, this.decryptedImportData.folders);
            this.controller.showProgress(40, 'Folders imported');

            this.controller.showProgress(45, 'Importing items...');
            await this.controller.importItems(a.items, results, now, isCloudMode, idMap, (current, total) => {
                const percent = 45 + Math.round((current / total) * 25);
                this.controller.showProgress(percent, `Importing item ${current}/${total}...`);
            });
            this.controller.showProgress(70, 'Items imported');

            if (this.updateConflictItems) {
                this.controller.showProgress(72, 'Updating conflicting items...');
                await this.controller.updateConflictingItems(a, results, now, isCloudMode);
                this.controller.showProgress(78, 'Conflicts updated');
            }

            if (this.importOrphanedItemsFlag) {
                this.controller.showProgress(78, 'Importing orphaned items...');
                const orphanedItems = ImportRenderer.getOrphanedItems(this.decryptedImportData, null);
                await this.controller.importOrphanedItems(orphanedItems, results, now, isCloudMode);
                this.controller.showProgress(82, 'Orphaned items imported');
            }

            if (this.restoreDeletedItems && a.restoring.length > 0) {
                this.controller.showProgress(82, 'Restoring deleted items...');
                await this.controller.restoreSoftDeletedItems(a.restoring, results, now, isCloudMode);
                this.controller.showProgress(88, 'Deleted items restored');
            }

            this.controller.showProgress(90, 'Finalizing...');
            App.unlock();

            if (isCloudMode) {
                this.controller.showProgress(92, 'Syncing to server...');
                const syncSuccess = await this.controller.syncToServer();
                this.controller.showProgress(100, syncSuccess ? 'Synced to server!' : 'Saved locally');
            } else {
                this.controller.showProgress(100, 'Complete!');
            }

            await new Promise(r => setTimeout(r, 500));
        } catch (error) {
            console.error('Import error:', error);
            results.failed.push({ type: 'general', error: error.message });
            App.unlock();
        } finally {
            if (typeof UILock !== 'undefined') UILock.unlock();
        }

        this.controller.showResultsPhase(results);
    }

    async _executeCleanImport() {
        this.controller.showProgressPhase();
        this.controller.lockApp();

        const results = { success: { folders: 0, items: 0, vaults: 0 }, failed: [] };

        try {
            const isCloudMode = LocalDB.getMode() !== 'local';

            this.controller.showProgress(5, 'Preparing data...');
            this._prepareCleanImportData();

            const data = this.decryptedImportData;

            this.controller.showProgress(10, 'Importing folders...');
            const sortedFolders = BaseImporter.sortFoldersByDepth(data.folders, data.folders);
            for (const folder of sortedFolders) {
                try {
                    const isVault = folder.parent_folder_id === null || folder.parent_folder_id === undefined;
                    if (isVault) {
                        await Vault.createVault(folder.decrypted_name, { id: folder.id, localOnly: true });
                        results.success.vaults++;
                    } else {
                        await Vault.createFolder(null, folder.decrypted_name, folder.decrypted_icon, folder.parent_folder_id, { id: folder.id, localOnly: true });
                        results.success.folders++;
                    }
                } catch (error) {
                    console.error('[Import] Failed to create folder:', error);
                    results.failed.push({ type: 'folder', id: folder.id, name: folder.decrypted_name, error: error.message });
                }
            }
            this.controller.showProgress(55, 'Folders imported');

            this.controller.showProgress(60, 'Importing items...');
            const totalItems = data.items.length;
            let current = 0;
            for (const item of data.items) {
                try {
                    await Vault.createItem(item.item_type, item.decrypted_data || item.data, item.folder_id, { id: item.id, localOnly: true });
                    results.success.items++;
                } catch (error) {
                    console.error('[Import] Failed to import item:', error);
                    const itemName = (item.decrypted_data || item.data)?.name || 'Unknown';
                    results.failed.push({ type: 'item', id: item.id, name: itemName, error: error.message });
                }
                current++;
                const pct = 60 + Math.round((current / totalItems) * 30);
                this.controller.showProgress(pct, `Importing item ${current}/${totalItems}...`);
            }

            App.unlock();

            if (isCloudMode) {
                this.controller.showProgress(92, 'Syncing to server...');
                const ok = await this.controller.syncToServer();
                this.controller.showProgress(100, ok ? 'Synced!' : 'Saved locally');
            } else {
                this.controller.showProgress(100, 'Complete!');
            }

            await new Promise(r => setTimeout(r, 500));
        } catch (error) {
            console.error('Clean import error:', error);
            results.failed.push({ type: 'general', error: error.message });
            App.unlock();
        } finally {
            if (typeof UILock !== 'undefined') UILock.unlock();
        }

        this.controller.showResultsPhase(results);
    }

    _prepareCleanImportData() {
        const data = this.decryptedImportData;
        const folderIdMap = new Map();

        // Generate new IDs for all folders (vaults + sub-folders)
        for (const folder of data.folders) {
            folderIdMap.set(String(folder.id), TempId.generate('folder'));
        }

        // Update folder IDs and parent references
        for (const folder of data.folders) {
            const newId = folderIdMap.get(String(folder.id));
            folder.id = newId;
            folder.is_default = false;
            if (folder.parent_folder_id) {
                folder.parent_folder_id = folderIdMap.get(String(folder.parent_folder_id)) || folder.parent_folder_id;
            }
        }

        // Update item folder references
        for (const item of data.items) {
            item.id = TempId.generate('item');
            item.folder_id = folderIdMap.get(String(item.folder_id)) || item.folder_id;
        }
    }

    // ========================
    // Default vault merge
    // ========================

    _detectDefaultVaultMerge(importData, currentData) {
        // Find local default vault (folder with parent_folder_id === null and is_default)
        const localVault = currentData.folders.find(f =>
            f.parent_folder_id === null &&
            (f.is_default === true || f.is_default === 1) && !f.deleted_at
        );
        if (!localVault) return null;

        // Find import default vault
        const importVault = importData.folders.find(f =>
            (f.parent_folder_id === null || f.parent_folder_id === undefined) &&
            (f.is_default === true || f.is_default === 1 || f.is_default === '1')
        );
        if (!importVault) return null;

        // Same ID = no merge needed
        if (String(importVault.id) === String(localVault.id)) return null;

        const localName = (localVault.name || '').toLowerCase().trim();
        const importName = (importVault.decrypted_name || '').toLowerCase().trim();
        const namesMatch = localName === importName && localName !== '';

        return { localVault, importVault, namesMatch };
    }

    _applyDefaultVaultMerge(merge) {
        if (!this.defaultVaultMergeInfo) return;

        const { localVault, importVault } = this.defaultVaultMergeInfo;
        const data = this.decryptedImportData;

        if (merge) {
            this.originalImportIds = { vaultId: importVault.id };

            // Remap import vault folder to local vault ID
            importVault.id = localVault.id;

            for (const folder of data.folders) {
                if (String(folder.parent_folder_id) === String(this.originalImportIds.vaultId)) {
                    folder.parent_folder_id = localVault.id;
                }
            }

            for (const item of data.items) {
                if (String(item.folder_id) === String(this.originalImportIds.vaultId)) {
                    item.folder_id = localVault.id;
                }
            }
        } else if (this.originalImportIds) {
            const oldId = this.originalImportIds.vaultId;

            importVault.id = oldId;

            for (const folder of data.folders) {
                if (String(folder.parent_folder_id) === String(localVault.id)) {
                    folder.parent_folder_id = oldId;
                }
            }

            for (const item of data.items) {
                if (String(item.folder_id) === String(localVault.id)) {
                    item.folder_id = oldId;
                }
            }

            this.originalImportIds = null;
        }
    }
}
