/**
 * NextcloudPasswordsImporter - Import Nextcloud Passwords app exports
 *
 * Simplified flow: raw data stays immutable until import time.
 * No inject/reinject system. Vault ID resolved only at import.
 *
 * Nextcloud export format:
 * {
 *   "version": 3,
 *   "encrypted": false,
 *   "passwords": [...],
 *   "folders": [...],
 *   "tags": [...]
 * }
 */
class NextcloudPasswordsImporter {
    constructor() {
        this.requiresPassword = false;
        this.parsedData = null;

        // Flow state
        this.controller = null;
        this.targetVaultId = '__new__';
        this.decryptedImportData = null;
        this.currentVaultData = null;
    }

    parse(content) {
        try {
            const json = JSON.parse(content);

            if (!json.version || !Array.isArray(json.passwords)) {
                return { success: false, error: 'Invalid Nextcloud Passwords export format' };
            }

            if (json.encrypted === true) {
                return { success: false, error: 'Encrypted Nextcloud Passwords exports are not supported. Please export without encryption.' };
            }

            return { success: true, data: json };
        } catch (e) {
            return { success: false, error: 'Failed to parse JSON: ' + e.message };
        }
    }

    async verifyPassword() {
        return true;
    }

    /**
     * Decrypt (convert) Nextcloud data to KeyHive format.
     * Folders have parent_folder_id = temp_id or null (null = NC root).
     * Items have folder_id = temp_id or null (null = NC root).
     * Items have folder_id pointing to parent folder or vault.
     */
    async decryptAll() {
        const data = this.parsedData;
        const ncPasswords = data.passwords || [];
        const ncFolders = data.folders || [];
        const ncTags = data.tags || [];

        const NC_ROOT = '00000000-0000-0000-0000-000000000000';

        // Build tag ID -> label lookup
        const tagMap = new Map();
        for (const tag of ncTags) {
            if (tag.id && tag.label) {
                tagMap.set(tag.id, tag.label);
            }
        }

        // Map Nextcloud folder UUIDs to KeyHive temp IDs
        // NC root maps to null (= root level, vault ID assigned at import time)
        const folderIdMap = new Map();
        folderIdMap.set(NC_ROOT, null);
        for (const f of ncFolders) {
            folderIdMap.set(f.id, TempId.generate('folder'));
        }

        // Convert folders
        const folders = ncFolders.map(f => ({
            id: folderIdMap.get(f.id),
            parent_folder_id: folderIdMap.get(f.parent) ?? null, // null = root level
            decrypted_name: f.label || 'Unnamed Folder',
            decrypted_icon: null,
            sort_order: 0,
            updated_at: f.edited ? new Date(f.edited * 1000).toISOString() : null
        }));

        // Convert passwords to items
        const items = ncPasswords.map(pwd => {
            const customFields = [];
            if (Array.isArray(pwd.customFields)) {
                for (const cf of pwd.customFields) {
                    if (cf.type === 'file') continue;
                    customFields.push({
                        label: cf.label || '',
                        type: cf.type === 'secret' ? 'password' : 'text',
                        value: cf.value || ''
                    });
                }
            }

            let tags = '';
            if (Array.isArray(pwd.tags) && pwd.tags.length > 0) {
                tags = pwd.tags.map(id => tagMap.get(id)).filter(Boolean).join(', ');
            }

            const itemData = {
                name: pwd.label || 'Unnamed',
                username: pwd.username || '',
                password: pwd.password || '',
                website_url: pwd.url || '',
                notes: pwd.notes || '',
                tags
            };

            if (customFields.length > 0) {
                itemData.custom_fields = customFields;
            }

            return {
                id: TempId.generate('item'),
                folder_id: folderIdMap.get(pwd.folder) ?? null, // null = root level
                item_type: 'password',
                decrypted_data: itemData,
                sort_order: 0,
                updated_at: pwd.edited ? new Date(pwd.edited * 1000).toISOString() : null
            };
        });

        console.log('[NextcloudImport] Converted:', {
            folders: folders.length,
            items: items.length,
            foldersAtRoot: folders.filter(f => f.parent_folder_id === null).length,
            itemsAtRoot: items.filter(i => i.folder_id === null).length
        });

        return { folders, items };
    }

    // ========================
    // Flow control
    // ========================

    async runFlow(controller) {
        this.controller = controller;

        controller.setContent(`
            <div class="import-phase import-analyzing">
                <div class="import-loading">
                    <div class="spinner"></div>
                    <p>Processing import data...</p>
                </div>
            </div>
        `);

        try {
            this.decryptedImportData = await this.decryptAll();
            this.currentVaultData = await controller.loadCurrentVaultData();
            this.targetVaultId = '__new__';

            this._showAnalysisPhase();
        } catch (error) {
            console.error('Nextcloud import analysis error:', error);
            Toast.error('Failed to process import: ' + (error.message || 'Unknown error'));
            ImportManager.showPhase('file-select');
        }
    }

    _showAnalysisPhase() {
        const data = this.decryptedImportData;
        const totalItems = data.folders.length + data.items.length;
        const buttonText = totalItems > 0 ? `Import ${totalItems} Items` : 'Nothing to Import';

        // Build tree options - no analysis, everything is "new"
        // targetRootFolderId = null because raw data uses null for root-level items
        const treeOptions = {
            showVaults: false,
            isCleanMode: false,
            targetRootFolderId: null,
            targetVaultId: this.targetVaultId,
            previewVaultId: '__nc_preview__',
            vaults: this.currentVaultData.folders.filter(f => f.parent_folder_id === null),
            newVaultName: this.controller.getNewVaultName()
        };

        let html = '<div class="import-phase import-analysis">';

        // For Nextcloud, render a simple summary + vault selector + flat tree
        // We pass null analysis to renderImportTree so it shows everything as "New"
        html += ImportRenderer.renderImportTree(data, null, treeOptions);
        html += ImportRenderer.renderActionButtons(buttonText, totalItems === 0);
        html += '</div>';

        this.controller.setContent(html);
        this._bindAnalysisEvents();
    }

    _bindAnalysisEvents() {
        const cancelBtn = this.controller.querySelector('#importCancelBtn');
        const startBtn = this.controller.querySelector('#importStartBtn');

        cancelBtn.addEventListener('click', () => ImportManager.close());

        // Vault selector dropdown
        const popupEl = this.controller.getElement();
        const vaultDropdown = popupEl.querySelector('#importVaultDropdown');
        if (vaultDropdown) {
            const trigger = vaultDropdown.querySelector('.dropdown-trigger');
            const items = vaultDropdown.querySelectorAll('.dropdown-item');

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                vaultDropdown.classList.toggle('open');
            });

            items.forEach(item => {
                item.addEventListener('click', () => {
                    const newVaultId = item.dataset.vaultId;
                    if (String(newVaultId) !== String(this.targetVaultId)) {
                        this.targetVaultId = newVaultId;
                        // Just re-render - data stays untouched
                        this._showAnalysisPhase();
                    }
                    vaultDropdown.classList.remove('open');
                });
            });

            document.addEventListener('click', (e) => {
                if (!vaultDropdown.contains(e.target)) {
                    vaultDropdown.classList.remove('open');
                }
            });
        }

        startBtn.addEventListener('click', () => this._executeImport());
    }

    async _executeImport() {
        this.controller.showProgressPhase();
        this.controller.lockApp();

        const results = { success: { folders: 0, items: 0, vaults: 0 }, failed: [] };

        try {
            const isCloudMode = LocalDB.getMode() !== 'local';
            let vaultId;

            // Step 1: Resolve vault ID
            if (this.targetVaultId === '__new__') {
                this.controller.showProgress(5, 'Creating new vault...');
                const vaultName = this.controller.getNewVaultName();
                const { vault } = await this.controller.createNewVault(vaultName);
                vaultId = vault.id;
                results.success.vaults++;
            } else {
                vaultId = this.targetVaultId;
            }

            this.controller.showProgress(15, 'Preparing folders...');

            // Step 2: Set vault ID on root-level folders and items
            // This is the ONLY time we modify the data
            const data = this.decryptedImportData;

            for (const folder of data.folders) {
                if (folder.parent_folder_id === null) {
                    folder.parent_folder_id = vaultId;
                }
            }

            for (const item of data.items) {
                if (item.folder_id === null) {
                    item.folder_id = vaultId;
                }
            }

            // Step 3: Import folders (sorted by depth)
            this.controller.showProgress(25, 'Importing folders...');
            const sortedFolders = BaseImporter.sortFoldersByDepth(data.folders, data.folders);
            for (const folder of sortedFolders) {
                try {
                    await Vault.createFolder(
                        null,
                        folder.decrypted_name,
                        folder.decrypted_icon,
                        folder.parent_folder_id,
                        { id: folder.id, localOnly: true }
                    );
                    results.success.folders++;
                } catch (error) {
                    console.error('[Import] Failed to create folder:', error);
                    results.failed.push({ type: 'folder', id: folder.id, name: folder.decrypted_name, error: error.message });
                }
            }
            this.controller.showProgress(45, 'Folders imported');

            // Step 4: Import items
            this.controller.showProgress(50, 'Importing items...');
            const totalItems = data.items.length;
            let current = 0;
            for (const item of data.items) {
                try {
                    const itemData = item.decrypted_data || item.data;
                    if (!itemData || typeof itemData !== 'object') {
                        results.failed.push({ type: 'item', id: item.id, name: 'Unknown', error: 'No valid data' });
                        current++;
                        continue;
                    }

                    await Vault.createItem(
                        item.item_type,
                        itemData,
                        item.folder_id,
                        { id: item.id, localOnly: true }
                    );
                    results.success.items++;
                } catch (error) {
                    console.error('[Import] Failed to import item:', error);
                    results.failed.push({ type: 'item', id: item.id, name: ImportRenderer.getItemDisplayName(item), error: error.message });
                }
                current++;
                const pct = 50 + Math.round((current / totalItems) * 40);
                this.controller.showProgress(pct, `Importing item ${current}/${totalItems}...`);
            }

            App.unlock();

            // Step 5: Sync
            if (isCloudMode) {
                this.controller.showProgress(92, 'Syncing to server...');
                const syncSuccess = await this.controller.syncToServer();
                this.controller.showProgress(100, syncSuccess ? 'Synced to server!' : 'Saved locally');
            } else {
                this.controller.showProgress(100, 'Complete!');
            }

            await new Promise(r => setTimeout(r, 500));
        } catch (error) {
            console.error('Nextcloud import error:', error);
            results.failed.push({ type: 'general', error: error.message });
            App.unlock();
        } finally {
            if (typeof UILock !== 'undefined') UILock.unlock();
        }

        this.controller.showResultsPhase(results);
    }
}
