/**
 * ImportFlowController - Shared toolkit for importers
 * Wraps the popup API and provides reusable execution methods.
 * Created by ImportManager and passed to importer.runFlow(controller).
 */
class ImportFlowController {
    constructor(popupApi) {
        this.popupApi = popupApi;
    }

    // ========================
    // Popup access
    // ========================

    setContent(html) {
        const content = this.popupApi.querySelector('#importContent');
        if (content) content.innerHTML = html;
    }

    querySelector(sel) {
        return this.popupApi.querySelector(sel);
    }

    getElement() {
        return this.popupApi.getElement();
    }

    close() {
        if (this.popupApi) {
            this.popupApi.close();
        }
    }

    // ========================
    // Data loading
    // ========================

    async loadCurrentVaultData() {
        await LocalDB.ensureInit();
        const folders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const items = await LocalDB.getAll(LocalDB.STORES.ITEMS);

        const decryptedFolders = await Promise.all(folders.map(async (f) => {
            const name = f.encrypted_name ? await CryptoAPI.decrypt(f.encrypted_name) : '';
            const icon = f.encrypted_icon ? await CryptoAPI.decrypt(f.encrypted_icon) : null;
            return { ...f, name, icon };
        }));

        const decryptedItems = await Promise.all(items.map(async (item) => {
            const data = item.encrypted_data
                ? await CryptoAPI.decryptObject(item.encrypted_data)
                : (item.decrypted_data || item.data || {});
            return { ...item, data };
        }));

        return {
            folders: decryptedFolders,
            items: decryptedItems
        };
    }

    // ========================
    // Import execution
    // ========================

    async importFolders(folderAnalysis, results, now, isCloudMode, idMap, allImportFolders) {
        const sortedNewFolders = BaseImporter.sortFoldersByDepth(folderAnalysis.new, allImportFolders);

        for (const folder of sortedNewFolders) {
            try {
                const name = folder.decrypted_name || '';
                if (!name) {
                    console.warn('[Import] Folder has empty name, skipping:', folder.id);
                    continue;
                }

                const isVault = folder.parent_folder_id === null || folder.parent_folder_id === undefined;
                if (isVault) {
                    await Vault.createVault(name, { id: folder.id, localOnly: true });
                    results.success.vaults++;
                } else {
                    const icon = folder.decrypted_icon || null;
                    const parentFolderId = idMap[String(folder.parent_folder_id)] || folder.parent_folder_id;
                    await Vault.createFolder(null, name, icon, parentFolderId, { id: folder.id, localOnly: true });
                    results.success.folders++;
                }
                console.log('[Import] Created folder:', folder.id, isVault ? '(vault)' : '');
            } catch (error) {
                console.error('[Import] Failed to create folder:', error);
                results.failed.push({ type: 'folder', id: folder.id, name: folder.decrypted_name, error: error.message });
            }
        }
    }

    async importItems(itemAnalysis, results, now, isCloudMode, idMap, onProgress) {
        const itemsToImport = itemAnalysis.new;
        const total = itemsToImport.length;
        let current = 0;

        for (const item of itemsToImport) {
            try {
                const data = item.decrypted_data || item.data;
                if (!data || typeof data !== 'object') {
                    results.failed.push({ type: 'item', id: item.id, name: ImportRenderer.getItemDisplayName(item), error: 'No valid data to import' });
                    current++;
                    if (onProgress) onProgress(current, total);
                    continue;
                }

                const folderId = idMap[String(item.folder_id)] || item.folder_id;
                await Vault.createItem(
                    item.item_type,
                    data,
                    folderId,
                    { id: item.id, localOnly: true }
                );
                console.log('[Import] Created item with original ID:', item.id, 'in folder:', folderId);
                results.success.items++;
            } catch (error) {
                console.error('[Import] Failed to import item:', item.id, error);
                results.failed.push({ type: 'item', id: item.id, name: ImportRenderer.getItemDisplayName(item), error: error.message });
            }
            current++;
            if (onProgress) onProgress(current, total);
        }
    }

    async updateConflictingItems(analysis, results, now, isCloudMode) {
        const updatedAt = DateUtils.now();

        for (const conflict of analysis.folders.conflicts) {
            try {
                const { import: importFolder, local } = conflict;
                const isVault = local.parent_folder_id === null || local.parent_folder_id === undefined;
                const existing = isVault
                    ? await LocalDB.getVault(local.id)
                    : await LocalDB.getFolder(local.id);
                if (!existing) continue;

                const encryptedName = await CryptoAPI.encrypt(importFolder.decrypted_name || '');
                const encryptedIcon = importFolder.decrypted_icon
                    ? await CryptoAPI.encrypt(importFolder.decrypted_icon)
                    : existing.encrypted_icon;
                const updated = { ...existing, updated_at: updatedAt, encrypted_name: encryptedName, encrypted_icon: encryptedIcon };

                if (isVault) {
                    await LocalDB.saveVault(updated);
                } else {
                    await LocalDB.saveFolder(updated);
                }

                if (isCloudMode && TempId.isReal(local.id)) {
                    await LocalDB.addPendingChange('folder', local.id, 'update', {
                        parent_folder_id: existing.parent_folder_id,
                        encrypted_name: encryptedName,
                        encrypted_icon: encryptedIcon,
                        sort_order: existing.sort_order || 0
                    });
                }
                results.success.folders++;
                console.log('[Import] Updated conflicting folder:', local.id, isVault ? '(vault)' : '');
            } catch (error) {
                console.error('[Import] Failed to update folder:', error);
                results.failed.push({ type: 'folder', id: conflict.local?.id, name: conflict.import?.decrypted_name, error: error.message });
            }
        }

        for (const conflict of analysis.items.conflicts) {
            try {
                const { import: importItem, local } = conflict;
                const existing = await LocalDB.getItem(local.id);
                if (!existing) continue;

                const data = importItem.decrypted_data || importItem.data;
                if (!data || typeof data !== 'object') continue;

                const encryptedData = await CryptoAPI.encryptObject(data);
                const updated = { ...existing, updated_at: updatedAt, encrypted_data: encryptedData };
                await LocalDB.saveItem(updated);

                if (isCloudMode && TempId.isReal(local.id)) {
                    await LocalDB.addPendingChange('item', local.id, 'update', {
                        item_type: existing.item_type,
                        folder_id: existing.folder_id,
                        encrypted_data: encryptedData,
                        sort_order: existing.sort_order || 0
                    });
                }
                results.success.items++;
                console.log('[Import] Updated conflicting item:', local.id);
            } catch (error) {
                console.error('[Import] Failed to update item:', error);
                results.failed.push({ type: 'item', id: conflict.local?.id, name: ImportRenderer.getItemDisplayName(conflict.import), error: error.message });
            }
        }
    }

    async restoreSoftDeletedItems(restoringItems, results, now, isCloudMode) {
        for (const r of restoringItems) {
            try {
                const { type, import: importItem, local, updateContent } = r;
                const updatedAt = DateUtils.now();

                if (type === 'folder') {
                    const isVault = local.parent_folder_id === null || local.parent_folder_id === undefined;
                    const existing = isVault
                        ? await LocalDB.getVault(local.id)
                        : await LocalDB.getFolder(local.id);
                    if (!existing) continue;

                    const encryptedName = updateContent
                        ? await CryptoAPI.encrypt(importItem.decrypted_name || '')
                        : existing.encrypted_name;
                    const encryptedIcon = updateContent && importItem.decrypted_icon
                        ? await CryptoAPI.encrypt(importItem.decrypted_icon)
                        : existing.encrypted_icon;
                    const updated = { ...existing, deleted_at: null, updated_at: updatedAt, encrypted_name: encryptedName, encrypted_icon: encryptedIcon };

                    if (isVault) {
                        await LocalDB.saveVault(updated);
                    } else {
                        await LocalDB.saveFolder(updated);
                    }

                    if (isCloudMode && TempId.isReal(local.id)) {
                        await LocalDB.addPendingChange('folder', local.id, 'create', {
                            parent_folder_id: existing.parent_folder_id,
                            encrypted_name: encryptedName,
                            encrypted_icon: encryptedIcon,
                            sort_order: existing.sort_order || 0
                        });
                    }
                    results.success.folders++;
                    console.log('[Import] Restored folder:', local.id, isVault ? '(vault)' : '', updateContent ? '(with content update)' : '');

                } else if (type === 'item') {
                    const existing = await LocalDB.getItem(local.id);
                    if (!existing) continue;

                    const encryptedData = updateContent
                        ? await CryptoAPI.encryptObject(importItem.decrypted_data || importItem.data)
                        : existing.encrypted_data;
                    const updated = { ...existing, deleted_at: null, updated_at: updatedAt, encrypted_data: encryptedData };
                    await LocalDB.saveItem(updated);

                    if (isCloudMode && TempId.isReal(local.id)) {
                        await LocalDB.addPendingChange('item', local.id, 'create', {
                            item_type: existing.item_type,
                            folder_id: existing.folder_id,
                            encrypted_data: encryptedData,
                            sort_order: existing.sort_order || 0
                        });
                    }
                    results.success.items++;
                    console.log('[Import] Restored item:', local.id, updateContent ? '(with content update)' : '');
                }
            } catch (error) {
                console.error('[Import] Failed to restore:', r.type, r.local?.id, error);
                results.failed.push({
                    type: r.type,
                    id: r.local?.id,
                    name: r.import?.decrypted_name || r.import?.decrypted_data?.name || 'Unknown',
                    error: error.message
                });
            }
        }
    }

    async importOrphanedItems(orphanedItems, results, now, isCloudMode) {
        if (orphanedItems.length === 0) return;

        const vaults = await LocalDB.getVaults();
        const defaultVault = vaults.find(v => v.is_default) || vaults[0];
        if (!defaultVault) {
            console.error('[Import] No default vault found');
            return;
        }

        const date = new Date();
        const folderName = `Import ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} - ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

        const importFolder = await Vault.createFolder(
            defaultVault.id,
            folderName,
            null,
            defaultVault.id,
            { localOnly: true }
        );

        console.log('[Import] Created import folder for orphans:', importFolder.id, folderName);
        results.success.folders++;

        for (const item of orphanedItems) {
            try {
                const data = item.decrypted_data || item.data;
                if (!data || typeof data !== 'object') continue;

                await Vault.createItem(
                    item.item_type,
                    data,
                    importFolder.id,
                    { localOnly: true }
                );
                results.success.items++;
                console.log('[Import] Imported orphaned item:', ImportRenderer.getItemDisplayName(item));
            } catch (error) {
                console.error('[Import] Failed to import orphaned item:', error);
                results.failed.push({ type: 'item', id: item.id, name: ImportRenderer.getItemDisplayName(item), error: error.message });
            }
        }
    }

    buildConflictIdMap(analysis) {
        const idMap = {};

        for (const unchanged of analysis.folders.unchanged) {
            const importId = unchanged.import?.id || unchanged.id;
            const localId = unchanged.local?.id || unchanged.id;
            idMap[String(importId)] = String(localId);
        }
        for (const conflict of analysis.folders.conflicts) {
            idMap[String(conflict.import.id)] = String(conflict.local.id);
        }

        return idMap;
    }

    async syncToServer() {
        if (typeof Connectivity !== 'undefined' && !Connectivity.isOnline()) {
            console.log('[Import] Offline - skipping sync, will sync when online');
            return false;
        }

        if (typeof Vault !== 'undefined' && Vault.syncPendingChanges) {
            try {
                console.log('[Import] Syncing imported data to server...');
                const result = await Vault.syncPendingChanges();
                console.log('[Import] Sync completed:', result);
                return true;
            } catch (err) {
                console.error('[Import] Post-import sync error:', err);
                Toast.warning('Import saved locally. Will sync to server when possible.');
                return false;
            }
        }
        return false;
    }

    // ========================
    // Phase helpers
    // ========================

    showProgressPhase() {
        this.setContent(ImportRenderer.renderProgressPhase());
    }

    showProgress(percent, message) {
        const fill = this.popupApi.querySelector('#importProgressFill');
        const step = this.popupApi.querySelector('#importProgressStep');
        if (fill) fill.style.width = `${percent}%`;
        if (step) step.textContent = message;
    }

    showResultsPhase(results) {
        this.setContent(ImportRenderer.renderResultsPhase(results));

        const doneBtn = this.popupApi.querySelector('#importDoneBtn');
        if (doneBtn) {
            doneBtn.addEventListener('click', async () => {
                this.close();
                if (typeof HomePage !== 'undefined') {
                    await HomePage.loadData();
                }
            });
        }
    }

    lockApp() {
        App.lock('import');
        if (typeof UILock !== 'undefined') {
            UILock.lock('Import is in progress. Leaving now may corrupt your data!');
        }
    }

    unlockApp() {
        App.unlock();
        if (typeof UILock !== 'undefined') {
            UILock.unlock();
        }
    }

    /**
     * Create a new vault for import
     * @param {string} name - Vault name
     * @returns {Object} { vault, rootFolder }
     */
    async createNewVault(name) {
        const newVault = await Vault.createVault(name, { localOnly: true });
        return {
            vault: newVault,
            rootFolder: newVault
        };
    }

    /**
     * Generate default name for new import vault
     */
    getNewVaultName() {
        const d = new Date();
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `Import on ${dateStr} ${timeStr}`;
    }
}
