/**
 * ImportRenderer - Pure HTML rendering functions for import UI
 * All methods are static, take data as parameters, return HTML strings.
 * No state, no DOM manipulation.
 */
const ImportRenderer = {
    /**
     * Render progress phase HTML
     */
    renderProgressPhase() {
        return `
            <div class="import-phase import-progress">
                <div class="import-progress-content">
                    <div class="import-progress-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </div>
                    <h3 class="import-progress-title">Importing Data</h3>
                    <div class="import-progress-warning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>DO NOT CLOSE THIS WINDOW</span>
                    </div>
                    <div class="import-progress-bar-container">
                        <div class="import-progress-bar">
                            <div class="import-progress-fill" id="importProgressFill" style="width: 0%"></div>
                        </div>
                    </div>
                    <p class="import-progress-step" id="importProgressStep">Preparing...</p>
                </div>
            </div>
        `;
    },

    /**
     * Render results phase HTML
     * @param {Object} results - { success: { vaults, folders, items }, failed: [] }
     */
    renderResultsPhase(results) {
        const r = results;
        const hasFailed = r.failed.length > 0;

        return `
            <div class="import-phase import-results">
                <div class="import-results-icon ${hasFailed ? 'import-results-partial' : 'import-results-success'}">
                    ${hasFailed ? `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    ` : `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    `}
                </div>
                <h3 class="import-results-title">${hasFailed ? 'Import Completed with Errors' : 'Import Successful!'}</h3>

                <div class="import-results-summary">
                    <div class="import-result-item">
                        <span class="import-result-label">Vaults</span>
                        <span class="import-result-value">${r.success.vaults || 0}</span>
                    </div>
                    <div class="import-result-item">
                        <span class="import-result-label">Folders</span>
                        <span class="import-result-value">${r.success.folders}</span>
                    </div>
                    <div class="import-result-item">
                        <span class="import-result-label">Items</span>
                        <span class="import-result-value">${r.success.items}</span>
                    </div>
                </div>

                ${hasFailed ? `
                <div class="import-errors">
                    <h4>Failed Items (${r.failed.length})</h4>
                    <ul class="import-error-list">
                        ${r.failed.map(f => `
                            <li class="import-error-item">
                                <span class="import-error-type">${f.type}</span>
                                <span class="import-error-name">${Utils.escapeHtml(f.name || f.id)}</span>
                                <span class="import-error-msg">${Utils.escapeHtml(f.error)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}

                <div class="import-actions">
                    <button class="btn btn-primary" id="importDoneBtn">Done</button>
                </div>
            </div>
        `;
    },

    /**
     * Render password entry phase HTML
     */
    renderPasswordPhase() {
        return `
            <div class="import-phase import-password">
                <div class="alert alert-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <div>
                        This export file is encrypted with a different password.
                        Please enter the password used when creating this export.
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="importPassword">Export Password</label>
                    <div class="input-with-toggle">
                        <input type="password" class="form-input" id="importPassword" placeholder="Enter export password" autocomplete="off">
                        <button type="button" class="input-toggle-btn" id="toggleImportPassword">
                            <svg class="icon-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <svg class="icon-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="import-actions">
                    <button class="btn btn-secondary" id="importBackBtn">Back</button>
                    <button class="btn btn-primary" id="importDecryptBtn">
                        <span class="btn-text">Decrypt</span>
                        <span class="btn-loading" style="display: none;">
                            <span class="spinner-inline"></span>
                            Decrypting...
                        </span>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render conflict checkboxes
     * @param {Object} analysis - Analysis result from BaseImporter
     * @param {Object} opts - { updateConflictItems, importOrphanedItems, orphanedCount }
     */
    renderConflicts(analysis, opts) {
        const conflictCount = analysis.folders.conflicts.length +
                              analysis.items.conflicts.length;
        const orphanedCount = opts.orphanedCount || 0;

        let html = '';

        if (conflictCount > 0) {
            html += '<div class="import-merge-option">';
            html += `<label class="custom-checkbox custom-checkbox--on-surface">`;
            html += `<input type="checkbox" id="updateConflictsCheckbox" ${opts.updateConflictItems ? 'checked' : ''}>`;
            html += `<span class="checkmark"></span>`;
            html += `<span class="checkbox-text">Update ${conflictCount} item${conflictCount !== 1 ? 's' : ''} with newer content</span>`;
            html += `</label>`;
            html += `<p class="import-merge-hint">`;
            html += `These items exist in your vault but the import has newer versions. Check to update them with the imported content.`;
            html += `</p>`;
            html += '</div>';
        }

        if (orphanedCount > 0) {
            html += '<div class="import-merge-option">';
            html += `<label class="custom-checkbox custom-checkbox--on-surface">`;
            html += `<input type="checkbox" id="importOrphanedCheckbox" ${opts.importOrphanedItems ? 'checked' : ''}>`;
            html += `<span class="checkmark"></span>`;
            html += `<span class="checkbox-text">Import ${orphanedCount} orphaned item${orphanedCount !== 1 ? 's' : ''}</span>`;
            html += `</label>`;
            html += `<p class="import-merge-hint">`;
            html += `These items have missing folder references. Check to import them into a new folder in your default vault.`;
            html += `</p>`;
            html += '</div>';
        }

        return html;
    },

    /**
     * Render import mode tabs (merge/clean)
     * @param {string} mode - 'merge' or 'clean'
     * @param {boolean} show - Whether to show tabs at all
     */
    renderImportModeTabs(mode, show) {
        if (!show) return '';

        return `
            <div class="import-mode-tabs">
                <button class="import-mode-tab ${mode === 'clean' ? 'active' : ''}" data-mode="clean">
                    Clean Import
                </button>
                <button class="import-mode-tab ${mode === 'merge' ? 'active' : ''}" data-mode="merge">
                    Merge Import
                </button>
            </div>
            <p class="import-mode-hint">
                ${mode === 'clean'
                    ? 'Creates fresh copies of all items with new IDs. No merging or conflict detection.'
                    : 'Analyzes your vault and merges items. Detects conflicts, duplicates, and updates.'}
            </p>
        `;
    },

    /**
     * Render vault selector dropdown
     * @param {Array} vaults - Array of vault objects
     * @param {string} selectedId - Currently selected vault ID or '__new__'
     * @param {string} newName - Name for new vault if creating
     */
    renderVaultSelector(vaults, selectedId, newName) {
        const sortedVaults = [...vaults]
            .filter(v => !v.deleted_at)
            .sort((a, b) => {
                const aIsDefault = a.is_default === true || a.is_default === 1 || a.is_default === '1';
                const bIsDefault = b.is_default === true || b.is_default === 1 || b.is_default === '1';
                if (aIsDefault && !bIsDefault) return -1;
                if (!aIsDefault && bIsDefault) return 1;
                return (a.sort_order || 0) - (b.sort_order || 0);
            });

        let selectedName;
        if (selectedId === '__new__') {
            selectedName = `New Vault: "${newName}"`;
        } else {
            const selectedVault = sortedVaults.find(v => String(v.id) === String(selectedId));
            selectedName = selectedVault?.name || 'Select Vault';
        }

        let optionsHtml = `
            <div class="dropdown-item${selectedId === '__new__' ? ' selected' : ''}" data-vault-id="__new__">
                <span class="dropdown-item-text">- Create new Vault -</span>
                <span class="dropdown-item-badge dropdown-item-badge--new">New</span>
            </div>
        `;

        for (const vault of sortedVaults) {
            const isSelected = String(vault.id) === String(selectedId);
            const isDefault = vault.is_default === true || vault.is_default === 1 || vault.is_default === '1';
            optionsHtml += `<div class="dropdown-item${isSelected ? ' selected' : ''}" data-vault-id="${vault.id}">`;
            optionsHtml += `<span class="dropdown-item-text">${Utils.escapeHtml(vault.name || 'Unnamed')}</span>`;
            if (isDefault) {
                optionsHtml += `<span class="dropdown-item-badge">Default</span>`;
            }
            optionsHtml += `</div>`;
        }

        return `
            <div class="import-vault-selector">
                <label class="import-vault-label">Import into vault:</label>
                <div class="dropdown-wrapper" id="importVaultDropdown">
                    <button type="button" class="dropdown-trigger">
                        <span class="dropdown-value">${Utils.escapeHtml(selectedName)}</span>
                        <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <div class="dropdown-menu">
                        ${optionsHtml}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render the import tree view
     * @param {Object} data - { folders, items } decrypted import data
     * @param {Object} analysis - Analysis result from BaseImporter (null for no-analysis mode)
     * @param {Object} options - Rendering options
     * @param {boolean} options.showVaults - Show vault nodes (false for Nextcloud flat tree)
     * @param {boolean} options.isCleanMode - No status badges in clean mode
     * @param {string} options.targetRootFolderId - Root folder ID for flat tree
     * @param {string} options.targetVaultId - Target vault ID (or preview ID)
     * @param {string} options.previewVaultId - Preview vault ID for "Create new Vault"
     * @param {boolean} options.updateConflictItems - Checkbox state
     * @param {boolean} options.restoreDeletedItems - Checkbox state
     * @param {boolean} options.mergeDefaultVaults - Checkbox state
     * @param {Object} options.mergeInfo - Default vault merge info (or null)
     * @param {Object} options.originalImportIds - Original import IDs before merge (or null)
     */
    renderImportTree(data, analysis, options) {
        if (!data) return '';

        const {
            showVaults = true,
            isCleanMode = false,
            targetRootFolderId = null,
            targetVaultId = null,
            previewVaultId = null,
            updateConflictItems = true,
            restoreDeletedItems = false,
            mergeDefaultVaults = false,
            mergeInfo = null,
            originalImportIds = null,
            hasRestorableItems = false
        } = options;

        // Build lookup maps for status
        const folderStatus = new Map();
        const itemStatus = new Map();

        if (analysis && !isCleanMode) {
            const conflictStatus = updateConflictItems ? 'updating' : 'skipping';

            analysis.folders.new.forEach(f => folderStatus.set(String(f.id), 'new'));
            analysis.folders.conflicts.forEach(c => folderStatus.set(String(c.import.id), conflictStatus));
            analysis.folders.unchanged.forEach(f => folderStatus.set(String(f.import?.id || f.id), 'unchanged'));
            analysis.folders.relocated.forEach(f => folderStatus.set(String(f.import?.id || f.id), 'relocated'));

            analysis.items.new.forEach(i => itemStatus.set(String(i.id), 'new'));
            analysis.items.conflicts.forEach(c => itemStatus.set(String(c.import.id), conflictStatus));
            analysis.items.unchanged.forEach(i => itemStatus.set(String(i.import?.id || i.id), 'unchanged'));
            analysis.items.relocated.forEach(i => itemStatus.set(String(i.import?.id || i.id), 'relocated'));

            analysis.skipped.olderThanLocal.forEach(s => {
                if (s.type === 'folder') folderStatus.set(String(s.import.id), 'skipping');
                if (s.type === 'item') itemStatus.set(String(s.import.id), 'skipping');
            });

            analysis.skipped.duplicates.forEach(s => {
                if (s.type === 'folder') folderStatus.set(String(s.import.id), 'duplicate');
                if (s.type === 'item') itemStatus.set(String(s.import.id), 'duplicate');
            });

            analysis.restoring.forEach(r => {
                let status;
                if (restoreDeletedItems) {
                    status = r.updateContent ? 'restoring-updating' : 'restoring';
                } else {
                    status = 'skipping';
                }
                if (r.type === 'folder') folderStatus.set(String(r.import.id), status);
                if (r.type === 'item') itemStatus.set(String(r.import.id), status);
            });
        } else if (!analysis && !isCleanMode) {
            // No analysis mode (e.g., Nextcloud) - everything is "new"
            for (const f of data.folders) folderStatus.set(String(f.id), 'new');
            for (const i of data.items) itemStatus.set(String(i.id), 'new');
        }

        // Track deleted items for badge
        const deletedFolders = new Set();
        const deletedItems = new Set();
        if (analysis && !isCleanMode) {
            analysis.restoring.forEach(r => {
                if (r.type === 'folder') deletedFolders.add(String(r.import.id));
                if (r.type === 'item') deletedItems.add(String(r.import.id));
            });
        }

        // Build folder tree by following parent_folder_id chains
        const buildFolderTree = (parentFolderId, depth) => {
            const folders = data.folders
                .filter(f => String(f.parent_folder_id) === String(parentFolderId))
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

            let html = '';
            for (const folder of folders) {
                const status = folderStatus.get(String(folder.id)) || 'unknown';

                const folderName = folder.decrypted_name || folder.name || 'Unnamed';
                const isDeleted = deletedFolders.has(String(folder.id));
                html += `<div class="tree-node tree-folder${isCleanMode ? '' : ` tree-status-${status}`}" style="padding-left: ${depth * 16}px">`;
                html += `<span class="tree-icon">📁</span>`;
                html += `<span class="tree-name">${Utils.escapeHtml(folderName)}</span>`;
                if (!isCleanMode) {
                    if (isDeleted) html += `<span class="tree-badge tree-badge-deleted">Deleted</span>`;
                    html += `<span class="tree-badge tree-badge-${status}">${ImportRenderer.statusText(status)}</span>`;
                    html += `<span class="tree-id">${Utils.escapeHtml(String(folder.id))}</span>`;
                }
                html += '</div>';

                html += buildFolderTree(folder.id, depth + 1);

                const folderItems = data.items
                    .filter(i => String(i.folder_id) === String(folder.id))
                    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                for (const item of folderItems) {
                    const iStatus = itemStatus.get(String(item.id)) || 'unknown';
                    const itemName = ImportRenderer.getItemDisplayName(item);
                    const itemIcon = ImportRenderer.getItemIcon(item.item_type);
                    const isDeleted = deletedItems.has(String(item.id));

                    html += `<div class="tree-node tree-item${isCleanMode ? '' : ` tree-status-${iStatus}`}" style="padding-left: ${(depth + 1) * 16}px">`;
                    html += `<span class="tree-icon">${itemIcon}</span>`;
                    html += `<span class="tree-name">${Utils.escapeHtml(itemName)}</span>`;
                    if (!isCleanMode) {
                        if (isDeleted) html += `<span class="tree-badge tree-badge-deleted">Deleted</span>`;
                        html += `<span class="tree-badge tree-badge-${iStatus}">${ImportRenderer.statusText(iStatus)}</span>`;
                        html += `<span class="tree-id">${Utils.escapeHtml(String(item.id))}</span>`;
                    }
                    html += '</div>';
                }
            }
            return html;
        };

        // Find orphaned items
        const allFolderIds = new Set(data.folders.map(f => String(f.id)));
        if (targetRootFolderId) {
            allFolderIds.add(String(targetRootFolderId));
        }
        const orphanedItems = data.items.filter(i => {
            // Items at root level (folder_id = null) are valid when targetRootFolderId is null
            if (i.folder_id === null && targetRootFolderId === null) return false;
            return !allFolderIds.has(String(i.folder_id));
        });

        // Build summary counts
        let html = '';
        html += ImportRenderer.renderSummary(data, analysis, {
            isCleanMode,
            updateConflictItems,
            restoreDeletedItems,
            orphanedCount: orphanedItems.length
        });

        // Import mode tabs
        html += ImportRenderer.renderImportModeTabs(isCleanMode ? 'clean' : 'merge', showVaults);

        // Vault selector for inject imports
        if (!showVaults && options.vaults) {
            html += ImportRenderer.renderVaultSelector(
                options.vaults,
                targetVaultId === '__new__' ? '__new__' : targetVaultId,
                options.newVaultName || ''
            );
        }

        html += '<div class="import-tree">';
        html += '<div class="import-tree-content">';

        if (!showVaults) {
            // Flat tree (Nextcloud): render folders/items under root
            html += buildFolderTree(targetRootFolderId, 0);

            // Render items at root level (folder_id is null or matches targetRootFolderId)
            const rootItems = data.items
                .filter(i => {
                    if (targetRootFolderId === null) return i.folder_id === null;
                    return String(i.folder_id) === String(targetRootFolderId);
                })
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

            for (const item of rootItems) {
                const iStatus = itemStatus.get(String(item.id)) || 'unknown';
                const itemName = ImportRenderer.getItemDisplayName(item);
                const itemIcon = ImportRenderer.getItemIcon(item.item_type);

                html += `<div class="tree-node tree-item${isCleanMode ? '' : ` tree-status-${iStatus}`}">`;
                html += `<span class="tree-icon">${itemIcon}</span>`;
                html += `<span class="tree-name">${Utils.escapeHtml(itemName)}</span>`;
                if (!isCleanMode) {
                    html += `<span class="tree-badge tree-badge-${iStatus}">${ImportRenderer.statusText(iStatus)}</span>`;
                    html += `<span class="tree-id">${Utils.escapeHtml(String(item.id))}</span>`;
                }
                html += '</div>';
            }
        } else {
            // Vault tree (KeyHive): render each vault (root folder) with its folder tree
            const importDefaultVaultId = mergeInfo
                ? (originalImportIds?.vaultId || mergeInfo.importVault.id)
                : null;

            const vaults = data.folders
                .filter(f => f.parent_folder_id === null || f.parent_folder_id === undefined)
                .sort((a, b) => {
                    const aIsDefault = a.is_default === true || a.is_default === 1 || a.is_default === '1';
                    const bIsDefault = b.is_default === true || b.is_default === 1 || b.is_default === '1';
                    if (aIsDefault && !bIsDefault) return -1;
                    if (!aIsDefault && bIsDefault) return 1;
                    return (a.sort_order || 0) - (b.sort_order || 0);
                });

            for (const vault of vaults) {
                const isImportDefaultVault = importDefaultVaultId &&
                    (String(vault.id) === String(importDefaultVaultId) ||
                     String(vault.id) === String(mergeInfo?.localVault?.id));

                let status, badgeText;
                if (isImportDefaultVault && mergeInfo && mergeDefaultVaults) {
                    status = 'merging';
                    badgeText = 'Merging';
                } else {
                    status = folderStatus.get(String(vault.id)) || 'new';
                    badgeText = ImportRenderer.statusText(status);
                }

                const vaultName = vault.decrypted_name || vault.name || 'Unnamed';
                const isDefault = vault.is_default === true || vault.is_default === 1 || vault.is_default === '1';
                const isDeleted = deletedFolders.has(String(vault.id));

                html += `<div class="tree-node tree-project${isCleanMode ? '' : ` tree-status-${status}`}">`;
                html += `<span class="tree-icon">📦</span>`;
                html += `<span class="tree-name"><strong>${Utils.escapeHtml(vaultName)}</strong>`;
                if (!isCleanMode) {
                    if (isDefault) html += ` <span class="tree-badge tree-badge-default">Default</span>`;
                    if (isDeleted) html += ` <span class="tree-badge tree-badge-deleted">Deleted</span>`;
                    html += ` <span class="tree-badge tree-badge-${status}">${badgeText}</span>`;
                }
                html += `</span>`;
                if (!isCleanMode) {
                    html += `<span class="tree-id">${Utils.escapeHtml(String(vault.id))}</span>`;
                }
                html += '</div>';

                html += buildFolderTree(vault.id, 1);

                // Render items directly in this vault's root
                const vaultItems = data.items
                    .filter(i => String(i.folder_id) === String(vault.id))
                    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                for (const item of vaultItems) {
                    const iStatus = itemStatus.get(String(item.id)) || 'unknown';
                    const itemName = ImportRenderer.getItemDisplayName(item);
                    const itemIcon = ImportRenderer.getItemIcon(item.item_type);
                    const isDeleted = deletedItems.has(String(item.id));

                    html += `<div class="tree-node tree-item${isCleanMode ? '' : ` tree-status-${iStatus}`}" style="padding-left: 16px">`;
                    html += `<span class="tree-icon">${itemIcon}</span>`;
                    html += `<span class="tree-name">${Utils.escapeHtml(itemName)}</span>`;
                    if (!isCleanMode) {
                        if (isDeleted) html += `<span class="tree-badge tree-badge-deleted">Deleted</span>`;
                        html += `<span class="tree-badge tree-badge-${iStatus}">${ImportRenderer.statusText(iStatus)}</span>`;
                        html += `<span class="tree-id">${Utils.escapeHtml(String(item.id))}</span>`;
                    }
                    html += '</div>';
                }
            }
        }

        // Orphaned items section
        if (orphanedItems.length > 0) {
            html += '<div class="tree-orphaned-section">';
            html += `<div class="tree-orphaned-header">`;
            html += `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tree-orphaned-icon">`;
            html += `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>`;
            html += `<line x1="12" y1="9" x2="12" y2="13"></line>`;
            html += `<line x1="12" y1="17" x2="12.01" y2="17"></line>`;
            html += `</svg>`;
            html += `<span class="tree-orphaned-title">${orphanedItems.length} Orphaned Item${orphanedItems.length !== 1 ? 's' : ''}</span>`;
            html += `</div>`;
            html += `<p class="tree-orphaned-hint">These items reference folders that don't exist in the export file.</p>`;
            html += '<div class="tree-orphaned-list">';
            for (const item of orphanedItems) {
                const itemName = ImportRenderer.getItemDisplayName(item);
                const itemIcon = ImportRenderer.getItemIcon(item.item_type);
                const itemData = item.decrypted_data || item.data || {};
                let subtitle = '';
                if (item.item_type === 'password') {
                    subtitle = itemData.username || itemData.website_url || '';
                } else if (item.item_type === 'totp') {
                    subtitle = itemData.issuer || '';
                } else if (item.item_type === 'note') {
                    subtitle = (itemData.content || '').substring(0, 50);
                }

                html += `<div class="tree-orphaned-item">`;
                html += `<span class="tree-icon">${itemIcon}</span>`;
                html += `<div class="tree-orphaned-item-info">`;
                html += `<span class="tree-orphaned-item-name">${Utils.escapeHtml(itemName)}</span>`;
                if (subtitle) {
                    html += `<span class="tree-orphaned-item-subtitle">${Utils.escapeHtml(subtitle)}</span>`;
                }
                html += `</div>`;
                html += `<span class="tree-orphaned-item-ref" title="Missing folder ID: ${Utils.escapeHtml(String(item.folder_id))}">folder not found</span>`;
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        }

        html += '</div></div>';

        // Merge options (only in merge mode with analysis)
        if (!isCleanMode && analysis) {
            if (mergeInfo) {
                const { localVault, importVault, namesMatch } = mergeInfo;
                const localName = localVault.name || 'Unnamed';
                const importName = importVault.decrypted_name || 'Unnamed';

                html += '<div class="import-merge-option">';
                html += `<label class="custom-checkbox custom-checkbox--on-surface">`;
                html += `<input type="checkbox" id="mergeDefaultVaultsCheckbox" ${mergeDefaultVaults ? 'checked' : ''}>`;
                html += `<span class="checkmark"></span>`;
                html += `<span class="checkbox-text">Merge default vaults</span>`;
                html += `</label>`;
                html += `<p class="import-merge-hint">`;
                if (namesMatch) {
                    html += `Both have a default vault named "<strong>${Utils.escapeHtml(importName)}</strong>". `;
                    html += `Merging will import items into your existing default vault.`;
                } else {
                    html += `Import has default vault "<strong>${Utils.escapeHtml(importName)}</strong>", `;
                    html += `yours is "<strong>${Utils.escapeHtml(localName)}</strong>". `;
                    html += `Check to merge into your existing default vault.`;
                }
                html += `</p>`;
                html += '</div>';
            }

            if (hasRestorableItems && analysis.restoring.length > 0) {
                const restoreCount = analysis.restoring.length;
                html += '<div class="import-merge-option">';
                html += `<label class="custom-checkbox custom-checkbox--on-surface">`;
                html += `<input type="checkbox" id="restoreDeletedCheckbox" ${restoreDeletedItems ? 'checked' : ''}>`;
                html += `<span class="checkmark"></span>`;
                html += `<span class="checkbox-text">Restore ${restoreCount} deleted item${restoreCount !== 1 ? 's' : ''}</span>`;
                html += `</label>`;
                html += `<p class="import-merge-hint">`;
                html += `These items exist in your vault but were deleted. Check to restore them from the import.`;
                html += `</p>`;
                html += '</div>';
            }
        }

        return html;
    },

    /**
     * Render summary counts
     */
    renderSummary(data, analysis, opts) {
        const { isCleanMode, updateConflictItems, restoreDeletedItems, orphanedCount } = opts;

        let html = '<div class="import-summary">';
        html += '<div class="import-summary-row">';

        if (isCleanMode) {
            const cleanTotal = data.folders.length + data.items.length;
            html += `<div class="import-summary-item import-summary-new">`;
            html += `<span class="import-summary-count">${cleanTotal}</span>`;
            html += `<span class="import-summary-label">New</span>`;
            html += `</div>`;
        } else if (analysis) {
            const totalNew = analysis.folders.new.length + analysis.items.new.length;
            const totalUnchanged = analysis.folders.unchanged.length + analysis.items.unchanged.length;
            const totalRelocated = analysis.folders.relocated.length + analysis.items.relocated.length;
            const totalConflicts = analysis.folders.conflicts.length + analysis.items.conflicts.length;
            const totalUpdating = updateConflictItems ? totalConflicts : 0;
            const baseSkipping = analysis.skipped.olderThanLocal.length;
            const restoringCount = analysis.restoring.length;
            const skippedRestoring = restoreDeletedItems ? 0 : restoringCount;
            const skippedConflicts = updateConflictItems ? 0 : totalConflicts;
            const totalSkipping = baseSkipping + skippedRestoring + skippedConflicts;
            const totalRestoring = restoreDeletedItems ? restoringCount : 0;

            if (totalNew > 0) {
                html += `<div class="import-summary-item import-summary-new">`;
                html += `<span class="import-summary-count">${totalNew}</span>`;
                html += `<span class="import-summary-label">New</span>`;
                html += `</div>`;
            }
            if (totalUnchanged > 0) {
                html += `<div class="import-summary-item import-summary-unchanged">`;
                html += `<span class="import-summary-count">${totalUnchanged}</span>`;
                html += `<span class="import-summary-label">Unchanged</span>`;
                html += `</div>`;
            }
            if (totalRelocated > 0) {
                html += `<div class="import-summary-item import-summary-relocated">`;
                html += `<span class="import-summary-count">${totalRelocated}</span>`;
                html += `<span class="import-summary-label">Relocated</span>`;
                html += `</div>`;
            }
            if (totalUpdating > 0) {
                html += `<div class="import-summary-item import-summary-updating">`;
                html += `<span class="import-summary-count">${totalUpdating}</span>`;
                html += `<span class="import-summary-label">Updating</span>`;
                html += `</div>`;
            }
            if (totalSkipping > 0) {
                html += `<div class="import-summary-item import-summary-skipping">`;
                html += `<span class="import-summary-count">${totalSkipping}</span>`;
                html += `<span class="import-summary-label">Skipping</span>`;
                html += `</div>`;
            }
            if (totalRestoring > 0) {
                html += `<div class="import-summary-item import-summary-restoring">`;
                html += `<span class="import-summary-count">${totalRestoring}</span>`;
                html += `<span class="import-summary-label">Restoring</span>`;
                html += `</div>`;
            }
            if (orphanedCount > 0) {
                html += `<div class="import-summary-item import-summary-orphaned">`;
                html += `<span class="import-summary-count">${orphanedCount}</span>`;
                html += `<span class="import-summary-label">Orphaned</span>`;
                html += `</div>`;
            }
        } else {
            // No analysis (Nextcloud) - just show total new
            const total = data.folders.length + data.items.length;
            html += `<div class="import-summary-item import-summary-new">`;
            html += `<span class="import-summary-count">${total}</span>`;
            html += `<span class="import-summary-label">New</span>`;
            html += `</div>`;
        }

        html += '</div>';
        html += '</div>';
        return html;
    },

    /**
     * Render action buttons
     * @param {string} text - Button text
     * @param {boolean} disabled - Whether button is disabled
     */
    renderActionButtons(text, disabled) {
        return `
            <div class="import-actions">
                <button class="btn btn-secondary" id="importCancelBtn">Cancel</button>
                <button class="btn btn-primary" id="importStartBtn" ${disabled ? 'disabled' : ''}>
                    ${text}
                </button>
            </div>
        `;
    },

    /**
     * Render "nothing to import" alert
     * @param {boolean} show - Whether to show the alert
     */
    renderNothingAlert(show) {
        return `
            <div class="alert alert-info" id="nothingToImportAlert" style="${show ? '' : 'display: none;'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <div>No new items to import. All items already exist in your vault.</div>
            </div>
        `;
    },

    /**
     * Status to badge text
     */
    statusText(status) {
        switch (status) {
            case 'new': return 'New';
            case 'unchanged': return 'Unchanged';
            case 'updating': return 'Updating';
            case 'skipping': return 'Skipping';
            case 'duplicate': return 'Duplicate';
            case 'relocated': return 'Relocated';
            case 'restoring': return 'Restoring';
            case 'restoring-updating': return 'Restoring (updating)';
            default: return status;
        }
    },

    /**
     * Get display name for item based on type
     */
    getItemDisplayName(item) {
        const d = item.decrypted_data || item.data || {};
        const type = (item.item_type || '').toLowerCase();
        switch (type) {
            case 'totp':
                return d.issuer || d.label || d.name || 'Unnamed';
            case 'note':
                return d.label || d.name || d.title || 'Unnamed';
            case 'card':
                return d.name || d.label || d.card_name || 'Unnamed';
            case 'password':
            case 'login':
                return d.name || d.label || d.title || 'Unnamed';
            case 'website':
                return d.name || d.label || d.title || d.url || 'Unnamed';
            default:
                return d.name || d.label || d.title || d.issuer || 'Unnamed';
        }
    },

    /**
     * Get icon for item type
     */
    getItemIcon(type) {
        switch (type) {
            case 'password':
            case 'login': return '🔑';
            case 'note': return '📝';
            case 'card': return '💳';
            case 'totp': return '🔐';
            case 'file': return '📎';
            case 'website': return '🌐';
            default: return '📄';
        }
    },

    /**
     * Get orphaned items from import data
     * @param {Object} data - { folders, items }
     * @param {string} rootFolderId - Target root folder ID (also valid)
     */
    getOrphanedItems(data, rootFolderId) {
        if (!data) return [];
        const allFolderIds = new Set(data.folders.map(f => String(f.id)));
        if (rootFolderId) {
            allFolderIds.add(String(rootFolderId));
        }
        return data.items.filter(i => {
            if (i.folder_id === null && rootFolderId === null) return false;
            return !allFolderIds.has(String(i.folder_id));
        });
    }
};
