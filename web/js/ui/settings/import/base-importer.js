/**
 * BaseImporter - Shared static utilities for import system
 *
 * Architecture: A vault is a folder with parent_folder_id = null.
 * Not a base class - importers are standalone classes that call these static methods directly.
 */
class BaseImporter {

    /**
     * Analyze conflicts between import data and local data
     * @param {Object} importData - Decrypted import data { folders, items }
     * @param {Object} localData - Current vault data { folders, items }
     */
    static analyzeConflicts(importData, localData) {
        const analysis = {
            folders: { new: [], conflicts: [], unchanged: [], relocated: [] },
            items: { new: [], conflicts: [], unchanged: [], relocated: [] },
            skipped: { olderThanLocal: [], duplicates: [] },
            restoring: []
        };

        const localFolderMap = new Map(localData.folders.map(f => [f.id, f]));
        const localItemMap = new Map(localData.items.map(i => [i.id, i]));
        const localItemByContent = new Map(
            localData.items.map(i => [BaseImporter.itemContentKey(i), i])
        );

        // Analyze Folders (including vaults)
        for (const folder of importData.folders || []) {
            const local = localFolderMap.get(folder.id);
            const importName = folder.decrypted_name || '';

            if (local) {
                const localName = local.name || '';
                const localIcon = local.icon || '';
                const importIcon = folder.decrypted_icon || '';

                if (local.deleted_at) {
                    analysis.restoring.push({ type: 'folder', import: folder, local, updateContent: !(importName === localName && importIcon === localIcon) && !BaseImporter.isOlder(folder, local) });
                } else if (importName === localName && importIcon === localIcon) {
                    const sameLocation = String(folder.parent_folder_id || '') === String(local.parent_folder_id || '');
                    if (sameLocation) {
                        analysis.folders.unchanged.push({ import: folder, local });
                    } else {
                        analysis.folders.relocated.push({ import: folder, local });
                    }
                } else if (BaseImporter.isOlder(folder, local)) {
                    analysis.skipped.olderThanLocal.push({ type: 'folder', import: folder, local });
                } else {
                    analysis.folders.conflicts.push({ import: folder, local });
                }
            } else {
                analysis.folders.new.push(folder);
            }
        }

        // Analyze Items
        for (const item of importData.items || []) {
            const local = localItemMap.get(item.id);
            const importItemData = item.decrypted_data || item.data || {};

            if (local) {
                if (local.deleted_at) {
                    const sameContent = BaseImporter.isDataEqual(importItemData, local.data || {});
                    const updateContent = !sameContent && !BaseImporter.isOlder(item, local);
                    analysis.restoring.push({ type: 'item', import: item, local, updateContent });
                } else if (BaseImporter.isDataEqual(importItemData, local.data || {})) {
                    const sameLocation = String(item.folder_id) === String(local.folder_id);
                    if (sameLocation) {
                        analysis.items.unchanged.push({ import: item, local });
                    } else {
                        analysis.items.relocated.push({ import: item, local });
                    }
                } else if (BaseImporter.isOlder(item, local)) {
                    analysis.skipped.olderThanLocal.push({ type: 'item', import: item, local });
                } else {
                    analysis.items.conflicts.push({ import: item, local });
                }
            } else {
                const contentKey = BaseImporter.itemContentKey({ item_type: item.item_type, data: importItemData });
                const duplicate = localItemByContent.get(contentKey);

                if (duplicate) {
                    if (BaseImporter.isDataEqual(importItemData, duplicate.data || {})) {
                        analysis.skipped.duplicates.push({ type: 'item', import: item, local: duplicate });
                    } else {
                        analysis.items.conflicts.push({ import: item, local: duplicate });
                    }
                } else {
                    analysis.items.new.push(item);
                }
            }
        }

        return analysis;
    }

    static isOlder(importItem, localItem) {
        const importTime = importItem.updated_at ? new Date(importItem.updated_at).getTime() : 0;
        const localTime = localItem.updated_at ? new Date(localItem.updated_at).getTime() : 0;
        return importTime > 0 && localTime > 0 && importTime < localTime;
    }

    static itemContentKey(item) {
        const type = item.item_type || '';
        const data = item.data || item.decrypted_data || {};
        let key = type + ':';

        switch (type) {
            case 'password':
                key += (data.name || '') + ':' + (data.username || '') + ':' + (data.website_url || '');
                break;
            case 'totp':
                key += (data.issuer || '') + ':' + (data.label || '') + ':' + (data.secret || '');
                break;
            case 'note':
            case 'website':
                key += (data.label || '') + ':' + (data.content || '').substring(0, 100);
                break;
            case 'file':
                key += (data.name || '');
                break;
            default:
                key += JSON.stringify(data).substring(0, 150);
        }

        return key.toLowerCase().trim();
    }

    static isDataEqual(a, b) {
        if (a === b) return true;
        if (!a || !b) return false;

        try {
            const sortedStringify = (obj) => JSON.stringify(obj, Object.keys(obj).sort());
            return sortedStringify(a) === sortedStringify(b);
        } catch (e) {
            return JSON.stringify(a) === JSON.stringify(b);
        }
    }

    static sortFoldersByDepth(folders, allFolders) {
        const folderMap = new Map(allFolders.map(f => [f.id, f]));

        const getDepth = (folder) => {
            let depth = 0;
            let current = folder;
            while (current && current.parent_folder_id) {
                depth++;
                current = folderMap.get(current.parent_folder_id);
                if (depth > 100) break;
            }
            return depth;
        };

        return [...folders].sort((a, b) => getDepth(a) - getDepth(b));
    }
}
