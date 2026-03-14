/**
 * Settings Base - Shared utilities and base functionality
 */

const SettingsBase = {
    container: null,
    sections: [],
    context: {},
    _connectivityHandler: null,

    /**
     * Initialize settings page
     * @param {Object} context - { mode, platform, user, settings }
     */
    init(context) {
        this.context = context;
        this.loadSettings();
        this.render();
        this.bindEvents();
        this.bindConnectivityListener();
    },

    /**
     * Load settings from storage
     */
    loadSettings() {
        // Theme and session timeout are device-specific (localStorage)
        this.context.settings = {
            theme: localStorage.getItem('keyhive_theme') || 'system',
            session_timeout: parseInt(localStorage.getItem('keyhive_session_timeout') || '15', 10),
        };

        // Load KDF settings if available
        if (this.context.mode === 'cloud' && App?.state?.settings?.kdf) {
            this.context.settings.kdf = App.state.settings.kdf;
        }
    },

    /**
     * Detect current platform
     * @returns {string} 'web', 'electron', 'ios', 'android', etc.
     */
    detectPlatform() {
        return Platform.getPlatform();
    },

    /**
     * Check if section should be shown
     * @param {Object} section
     * @returns {boolean}
     */
    shouldShowSection(section) {
        // Check mode compatibility
        if (section.modes && !section.modes.includes(this.context.mode)) {
            return false;
        }
        // Check platform compatibility
        if (section.platforms && !section.platforms.includes(this.context.platform)) {
            return false;
        }
        return true;
    },

    /**
     * Render the settings page
     */
    render() {
        const container = document.getElementById('settingsPageContent');
        if (!container) return;

        container.innerHTML = `
            <div class="settings-page" id="settingsPage">
                ${this.renderSections()}
            </div>
        `;

        this.container = container;
    },

    /**
     * Render all applicable sections
     * @returns {string}
     */
    renderSections() {
        return this.sections
            .filter(section => this.shouldShowSection(section))
            .map(section => section.render(this.context))
            .join('');
    },

    /**
     * Bind events for all sections
     */
    bindEvents() {
        this.sections
            .filter(section => this.shouldShowSection(section))
            .forEach(section => {
                if (typeof section.bind === 'function') {
                    section.bind(this.context);
                }
            });
    },

    /**
     * Bind connectivity change listener
     */
    bindConnectivityListener() {
        if (this._connectivityHandler) {
            window.removeEventListener('connectivity', this._connectivityHandler);
        }

        this._connectivityHandler = (e) => {
            this.context.isOnline = e.detail.isOnline;
            // Re-render sections that depend on connectivity
            this.sections
                .filter(s => this.shouldShowSection(s) && s.onConnectivityChange)
                .forEach(s => s.onConnectivityChange(this.context));
        };

        window.addEventListener('connectivity', this._connectivityHandler);
    },

    /**
     * Cleanup when leaving settings
     */
    destroy() {
        if (this._connectivityHandler) {
            window.removeEventListener('connectivity', this._connectivityHandler);
        }
        this.sections.forEach(section => {
            if (typeof section.destroy === 'function') {
                section.destroy();
            }
        });
    },

    // ===========================================
    // Shared Popup Utilities
    // ===========================================

    /**
     * Show export data popup (shared between cloud and local settings)
     */
    showExportPopup() {
        let passwordStrong = true;
        let passwordsMatch = true;
        let popupApi = null;

        const setupPasswordToggle = (inputId, toggleId) => {
            const input = popupApi.querySelector(`#${inputId}`);
            const toggle = popupApi.querySelector(`#${toggleId}`);
            if (toggle && input) {
                toggle.addEventListener('click', () => {
                    const isPassword = input.type === 'password';
                    input.type = isPassword ? 'text' : 'password';
                    toggle.querySelector('.icon-show').style.display = isPassword ? 'none' : '';
                    toggle.querySelector('.icon-hide').style.display = isPassword ? '' : 'none';
                });
            }
        };

        const updateExportButtonState = () => {
            const password = popupApi.querySelector('#exportPassword').value;
            popupApi.setButtonDisabled('exportBtn', password ? !(passwordStrong && passwordsMatch) : false);
        };

        const updateExportStrength = () => {
            const exportPasswordInput = popupApi.querySelector('#exportPassword');
            const confirmGroup = popupApi.querySelector('#confirmPasswordGroup');
            const strengthContainer = popupApi.querySelector('#exportPasswordStrength');
            const matchContainer = popupApi.querySelector('#exportPasswordMatch');
            const password = exportPasswordInput.value;
            confirmGroup.style.display = password ? '' : 'none';

            if (!password) {
                strengthContainer.innerHTML = '';
                matchContainer.innerHTML = '';
                passwordStrong = true;
                passwordsMatch = true;
                updateExportButtonState();
                return;
            }

            const analysis = SecurityAnalyzer.analyzeStrength(password);
            const color = SecurityAnalyzer.getStrengthColor(analysis.score);
            passwordStrong = analysis.score >= 3;

            strengthContainer.innerHTML = `
                <div class="strength-bar">
                    <div class="strength-fill" style="width: ${(analysis.score / 4) * 100}%; background: ${color};"></div>
                </div>
                <span class="strength-label" style="color: ${color};">${analysis.label}</span>
            `;

            updateExportMatch();
            updateExportButtonState();
        };

        const updateExportMatch = () => {
            const exportPasswordInput = popupApi.querySelector('#exportPassword');
            const exportPasswordConfirm = popupApi.querySelector('#exportPasswordConfirm');
            const matchContainer = popupApi.querySelector('#exportPasswordMatch');
            const password = exportPasswordInput.value;
            const confirmPassword = exportPasswordConfirm.value;

            if (!password || !confirmPassword) {
                matchContainer.innerHTML = '';
                passwordsMatch = !password;
                updateExportButtonState();
                return;
            }

            if (password === confirmPassword) {
                matchContainer.innerHTML = `<span class="password-match-label" style="color: var(--color-success);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Passwords match</span>`;
                passwordsMatch = true;
            } else {
                matchContainer.innerHTML = `<span class="password-match-label" style="color: var(--color-danger);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    Passwords do not match</span>`;
                passwordsMatch = false;
            }
            updateExportButtonState();
        };

        popupApi = Popup.open({
            title: 'Export Data',
            body: `
                <div class="alert alert-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <div>
                        <strong>Export your vault data</strong><br>
                        Your data will be downloaded as an encrypted JSON file. You can optionally set a different password for the export file, or leave it blank to use your current vault key.
                        <br><br>
                        <em>Note: File attachments are not included in exports.</em>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Export Password (optional)</label>
                    <div class="input-with-toggle">
                        <input type="password" class="form-input" id="exportPassword" placeholder="Leave blank for same vault key" autocomplete="off">
                        <button type="button" class="input-toggle-btn" id="toggleExportPassword">
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
                    <div class="password-strength" id="exportPasswordStrength"></div>
                </div>
                <div class="form-group" id="confirmPasswordGroup" style="display: none;">
                    <label class="form-label">Confirm Export Password</label>
                    <div class="input-with-toggle">
                        <input type="password" class="form-input" id="exportPasswordConfirm" placeholder="Confirm password" autocomplete="off">
                        <button type="button" class="input-toggle-btn" id="toggleExportPasswordConfirm">
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
                    <div class="password-match" id="exportPasswordMatch"></div>
                </div>
                <div class="export-progress" id="exportProgress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="exportProgressFill"></div>
                    </div>
                    <p class="progress-text" id="exportProgressText">Preparing export...</p>
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                {
                    text: 'Export',
                    type: 'primary',
                    id: 'exportBtn',
                    onClick: async () => {
                        const password = popupApi.querySelector('#exportPassword').value;
                        const confirmPassword = popupApi.querySelector('#exportPasswordConfirm').value;

                        if (password) {
                            const analysis = SecurityAnalyzer.analyzeStrength(password);
                            if (analysis.score < 3) {
                                Toast.error('Password must be strong');
                                return false;
                            }
                            if (password !== confirmPassword) {
                                Toast.error('Passwords do not match');
                                return false;
                            }
                        }

                        // Hide footer (buttons), show progress
                        const footer = popupApi.getElement().querySelector('.popup-footer');
                        const progress = popupApi.querySelector('#exportProgress');
                        const progressFill = popupApi.querySelector('#exportProgressFill');
                        const progressText = popupApi.querySelector('#exportProgressText');

                        footer.style.display = 'none';
                        progress.style.display = '';

                        try {
                            const result = await this.performExport(password, (percent, message) => {
                                progressFill.style.width = `${percent}%`;
                                progressText.textContent = message;
                            });

                            if (result.skippedFiles > 0) {
                                Toast.success(`Export downloaded (${result.skippedFiles} file attachment${result.skippedFiles > 1 ? 's' : ''} not included)`);
                            } else {
                                Toast.success('Export downloaded successfully');
                            }
                            return true; // Close popup
                        } catch (error) {
                            console.error('Export failed:', error);
                            footer.style.display = '';
                            progress.style.display = 'none';
                            Toast.error(error.message || 'Export failed');
                            return false; // Keep popup open
                        }
                    }
                }
            ],
            onOpen: (api) => {
                popupApi = api; // Assign api so helper functions can use it
                setupPasswordToggle('exportPassword', 'toggleExportPassword');
                setupPasswordToggle('exportPasswordConfirm', 'toggleExportPasswordConfirm');
                api.querySelector('#exportPassword').addEventListener('input', updateExportStrength);
                api.querySelector('#exportPasswordConfirm').addEventListener('input', updateExportMatch);
            }
        });
    },

    /**
     * Perform the actual export (shared between cloud and local)
     * @param {string} newPassword - Optional new password
     * @param {Function} onProgress - Progress callback (percent, message)
     */
    async performExport(newPassword, onProgress) {
        const EXPORT_VERSION = 1;

        onProgress(5, 'Loading vault data...');

        await LocalDB.ensureInit();
        const allFolders = await LocalDB.getAll(LocalDB.STORES.FOLDERS);
        const allItems = await LocalDB.getAll(LocalDB.STORES.ITEMS);

        // Filter out soft-deleted data (deleted_at is set)
        // Cascade: deleted vault -> all its folders/items excluded
        //          deleted folder -> all nested folders/items excluded

        // Build folder lookup
        const folderMap = new Map(allFolders.map(f => [String(f.id), f]));

        // Helper to find vault for a folder by traversing parent chain
        const findVaultForFolder = (folder) => {
            if (!folder) return null;
            if (folder.parent_folder_id === null) return folder;  // It's a vault
            let current = folder;
            while (current && current.parent_folder_id !== null) {
                current = folderMap.get(String(current.parent_folder_id));
            }
            return current || null;
        };

        // Helper to check if a folder should be excluded (recursively checks parents)
        const excludedFolderIds = new Set();
        const isFolderExcluded = (folderId, visited = new Set()) => {
            if (excludedFolderIds.has(folderId)) return true;
            if (visited.has(folderId)) return false; // Prevent infinite loop
            visited.add(folderId);

            const folder = folderMap.get(String(folderId));
            if (!folder) return false;

            // Excluded if: deleted or parent is excluded
            if (folder.deleted_at) return true;

            // For non-vault folders, check if vault is deleted
            if (folder.parent_folder_id !== null) {
                const vault = findVaultForFolder(folder);
                if (vault && vault.deleted_at) return true;
            }

            if (folder.parent_folder_id && isFolderExcluded(folder.parent_folder_id, visited)) return true;

            return false;
        };

        // Mark all excluded folders
        for (const folder of allFolders) {
            if (isFolderExcluded(folder.id)) {
                excludedFolderIds.add(String(folder.id));
            }
        }

        const folders = allFolders.filter(f => !excludedFolderIds.has(String(f.id)));

        // Exclude items in excluded folders or with deleted_at
        const activeItems = allItems.filter(i => !i.deleted_at && !excludedFolderIds.has(String(i.folder_id)));

        const fileItems = activeItems.filter(item => item.item_type === 'file');
        const items = activeItems.filter(item => item.item_type !== 'file');
        const skippedFileCount = fileItems.length;

        const offlineAuth = await LocalDB.getOfflineAuth();
        if (!offlineAuth || !offlineAuth.salt) {
            throw new Error('Could not retrieve encryption parameters');
        }

        let exportData;

        if (newPassword) {
            onProgress(20, 'Generating new encryption key...');
            const newSalt = await CryptoAPI.generateSalt();
            const newKdf = offlineAuth.kdf || { memory: 65536, iterations: 3, parallelism: 4 };

            onProgress(30, 'Re-encrypting data...');

            const allEncrypted = [];
            for (const item of items) {
                if (item.encrypted_data) {
                    allEncrypted.push({ _type: 'item', id: item.id, encrypted_data: item.encrypted_data, original: item });
                }
            }
            for (const folder of folders) {
                if (folder.encrypted_name || folder.encrypted_icon) {
                    allEncrypted.push({ _type: 'folder', id: folder.id, encrypted_name: folder.encrypted_name, encrypted_icon: folder.encrypted_icon, original: folder });
                }
            }

            onProgress(50, 'Encrypting with new password...');
            const result = await CryptoAPI.reEncryptForExport(allEncrypted, newPassword, newSalt, newKdf);

            onProgress(70, 'Building export file...');

            const exportFolders = [];
            const exportItems = [];

            for (const reEncrypted of result.items) {
                const original = allEncrypted.find(e => e.id === reEncrypted.id);
                if (!original) continue;

                switch (original._type) {
                    case 'item':
                        exportItems.push({ ...this.cleanForExport(original.original), encrypted_data: reEncrypted.encrypted_data });
                        break;
                    case 'folder':
                        exportFolders.push({ ...this.cleanForExport(original.original), encrypted_name: reEncrypted.encrypted_name, encrypted_icon: reEncrypted.encrypted_icon });
                        break;
                }
            }

            for (const item of items) { if (!item.encrypted_data) exportItems.push(this.cleanForExport(item)); }
            for (const folder of folders) { if (!folder.encrypted_name && !folder.encrypted_icon) exportFolders.push(this.cleanForExport(folder)); }

            exportData = {
                version: EXPORT_VERSION,
                exportDate: DateUtils.now(),
                salt: newSalt,
                kdf: newKdf,
                skippedFiles: skippedFileCount,
                data: { folders: exportFolders, items: exportItems }
            };
        } else {
            onProgress(50, 'Building export file...');
            exportData = {
                version: EXPORT_VERSION,
                exportDate: DateUtils.now(),
                salt: offlineAuth.salt,
                kdf: offlineAuth.kdf || { memory: 65536, iterations: 3, parallelism: 4 },
                skippedFiles: skippedFileCount,
                data: {
                    folders: folders.map(f => this.cleanForExport(f)),
                    items: items.map(i => this.cleanForExport(i))
                }
            };
        }

        onProgress(90, 'Downloading...');

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `keyhive-export-${DateUtils.now().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onProgress(100, 'Complete!');
        return { skippedFiles: skippedFileCount };
    },

    /**
     * Clean object for export (remove internal fields)
     */
    cleanForExport(obj) {
        const cleaned = { ...obj };
        delete cleaned._localUpdatedAt;
        delete cleaned._pendingSync;
        return cleaned;
    },

    // ===========================================
    // Shared Re-encryption Functions
    // ===========================================

    /**
     * Show re-encryption overlay
     * @returns {HTMLElement} The overlay element
     */
    showReencryptionOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'reencrypt-overlay';
        overlay.innerHTML = `
            <div class="reencrypt-content">
                <div class="reencrypt-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                </div>
                <h2 class="reencrypt-title">Re-encrypting Your Vault</h2>
                <div class="reencrypt-warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>DO NOT CLOSE THIS WINDOW</span>
                </div>
                <div class="reencrypt-progress">
                    <div class="reencrypt-progress-bar">
                        <div class="reencrypt-progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="reencrypt-step">Initializing...</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        // Lock UI to prevent page unload during re-encryption
        if (typeof UILock !== 'undefined') {
            UILock.lock('Re-encryption is in progress. Leaving now may corrupt your data!');
        }

        overlay._reencryptInProgress = true;
        return overlay;
    },

    /**
     * Update re-encryption progress
     * @param {HTMLElement} overlay
     * @param {number} step - Current step (1-7)
     * @param {string} message - Progress message
     * @param {boolean} complete - Whether this is the final step
     */
    updateReencryptionProgress(overlay, step, message, complete = false) {
        const totalSteps = 7;
        const progress = Math.round((step / totalSteps) * 100);
        const progressFill = overlay.querySelector('.reencrypt-progress-fill');
        const stepText = overlay.querySelector('.reencrypt-step');

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            if (complete) {
                progressFill.classList.add('complete');
            }
        }
        if (stepText) {
            stepText.textContent = message;
        }
    },

    /**
     * Hide re-encryption overlay
     * @param {HTMLElement} overlay
     */
    hideReencryptionOverlay(overlay) {
        if (typeof UILock !== 'undefined') {
            UILock.unlock();
        }
        overlay._reencryptInProgress = false;
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    },

    /**
     * Perform re-encryption of vault data
     * @param {string} password - The password to encrypt with (current or new)
     * @param {Object} kdf - KDF parameters
     * @param {Object} options - Additional options
     * @param {string} options.mode - 'cloud' or 'local'
     * @param {string} options.currentPassword - Current password for error recovery (cloud only)
     * @param {Function} options.onSuccess - Callback on success (overlay, newSalt, kdf)
     * @returns {Promise<boolean>}
     */
    async performReEncryption(password, kdf, options = {}) {
        const mode = options.mode || 'cloud';
        const currentPassword = options.currentPassword || password;

        // Close any active popup first
        const popupOverlay = document.querySelector('.popup-overlay.active');
        if (popupOverlay) {
            popupOverlay.classList.remove('active');
            setTimeout(() => popupOverlay.remove(), 300);
        }

        // Show re-encryption overlay
        const overlay = this.showReencryptionOverlay();

        // Determine if this is a KDF change or password change
        const isKdfChange = currentPassword === password; // same password = KDF change

        // Get current KDF from app state or LocalDB
        let oldKdf = kdf; // default fallback
        if (App?.state?.settings?.kdf) {
            oldKdf = App.state.settings.kdf;
        } else if (typeof LocalDB !== 'undefined') {
            try {
                const auth = await LocalDB.getOfflineAuth();
                if (auth?.kdf) oldKdf = auth.kdf;
            } catch (e) { /* use fallback */ }
        }

        try {
            const result = await ReEncryption.reEncrypt({
                oldPassword: currentPassword,
                newPassword: password,
                oldKdf: oldKdf,
                newKdf: kdf,
                mode: isKdfChange ? 'kdf_change' : 'password_change',
                skipPasswordVerification: true, // all callers verify before calling
                onProgress: (stage, percent, message) => {
                    // Map ReEncryption stages to overlay steps
                    const stageMap = {
                        checking: 1, loading: 2, files: 3,
                        preparing: 4, encrypting: 4,
                        saving: 5, syncing: 6, uploading: 6,
                        finalizing: 7, complete: 7
                    };
                    this.updateReencryptionProgress(overlay, stageMap[stage] || 4, message);
                }
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            // Update biometric stored password if master password changed
            if (!isKdfChange && typeof Biometric !== 'undefined' && Biometric.isEnabled()) {
                Biometric.updatePassword(password).catch(e =>
                    console.warn('[Settings] Failed to update biometric password:', e)
                );
            }

            // Success callback
            if (typeof options.onSuccess === 'function') {
                options.onSuccess(overlay, result.newSalt, result.newKdf);
            } else {
                this.hideReencryptionOverlay(overlay);
                Toast.success('Encryption settings updated successfully');
            }
            return true;

        } catch (error) {
            console.error('Re-encryption failed:', error);
            this.hideReencryptionOverlay(overlay);
            Toast.error(error.message || 'Failed to change encryption settings');
            return false;
        }
    },

    // ===========================================
    // Shared Password/KDF Change Popups
    // ===========================================

    /**
     * Verify the entered password matches the current vault encryption
     * @param {string} password - Password to verify
     * @param {string} mode - 'cloud' or 'local'
     * @returns {Promise<boolean>} true if password is correct
     */
    async verifyCurrentPassword(password, mode = 'cloud') {
        try {
            let salt, kdf;

            if (mode === 'cloud') {
                const saltResponse = await ApiClient.getSalt();
                if (!saltResponse.success) {
                    console.error('Failed to get salt for verification');
                    return false;
                }
                salt = saltResponse.data.salt;
                kdf = saltResponse.data.kdf;
            } else {
                // Local mode - get from IndexedDB
                const offlineAuth = await LocalDB.getOfflineAuth();
                if (!offlineAuth || !offlineAuth.salt) {
                    console.error('Failed to get salt for verification');
                    return false;
                }
                salt = offlineAuth.salt;
                kdf = offlineAuth.kdf;
            }

            // Derive key from entered password
            const result = await CryptoAPI.deriveKeyForVerification(password, salt, kdf);

            // Verify the derived key matches by comparing the verification hash
            const currentHash = await CryptoAPI.getVerificationHash();
            return result.verificationHash === currentHash;
        } catch (error) {
            console.error('Password verification failed:', error);
            return false;
        }
    },

    /**
     * Initialize custom selects within a popup
     * @param {HTMLElement} popup
     */
    initPopupCustomSelects(popup) {
        CustomSelect.init(popup);
    },

    /**
     * Bind password validation events for change password popup
     * @param {HTMLElement} popup
     */
    bindPasswordValidation(popup) {
        const currentPasswordInput = document.getElementById('currentMasterPassword');
        const newPasswordInput = document.getElementById('newMasterPassword');
        const confirmPasswordInput = document.getElementById('confirmMasterPassword');
        const strengthContainer = document.getElementById('newPasswordStrength');
        const matchContainer = document.getElementById('passwordMatch');
        const sameErrorContainer = document.getElementById('passwordSameError');
        const confirmBtn = popup.querySelector('#confirmBtn');

        let currentPasswordFilled = false;
        let passwordStrong = false;
        let passwordsMatch = false;
        let passwordDifferent = false;

        const updateButtonState = () => {
            if (confirmBtn) {
                const shouldEnable = currentPasswordFilled && passwordStrong && passwordsMatch && passwordDifferent;
                confirmBtn.disabled = !shouldEnable;
            }
        };

        const updateCurrentPassword = () => {
            currentPasswordFilled = currentPasswordInput && currentPasswordInput.value.length > 0;
            checkPasswordDifferent();
            updateButtonState();
        };

        const checkPasswordDifferent = () => {
            const currentPassword = currentPasswordInput?.value || '';
            const newPassword = newPasswordInput?.value || '';

            if (!currentPassword || !newPassword) {
                if (sameErrorContainer) sameErrorContainer.innerHTML = '';
                passwordDifferent = true;
                return;
            }

            if (currentPassword === newPassword) {
                if (sameErrorContainer) {
                    sameErrorContainer.innerHTML = `
                        <span class="password-same-label" style="color: var(--color-danger);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            New password must be different from current password
                        </span>
                    `;
                }
                passwordDifferent = false;
            } else {
                if (sameErrorContainer) sameErrorContainer.innerHTML = '';
                passwordDifferent = true;
            }
        };

        const updateStrength = () => {
            const password = newPasswordInput?.value || '';

            if (!password) {
                if (strengthContainer) strengthContainer.innerHTML = '';
                if (sameErrorContainer) sameErrorContainer.innerHTML = '';
                passwordStrong = false;
                passwordDifferent = true;
                updateButtonState();
                return;
            }

            const analysis = SecurityAnalyzer.analyzeStrength(password);
            const color = SecurityAnalyzer.getStrengthColor(analysis.score);
            passwordStrong = analysis.score >= 3;
            const percentage = (analysis.score / 4) * 100;

            if (strengthContainer) {
                strengthContainer.innerHTML = `
                    <div class="strength-bar">
                        <div class="strength-fill" style="width: ${percentage}%; background: ${color};"></div>
                    </div>
                    <span class="strength-label" style="color: ${color};">${analysis.label}</span>
                `;
            }

            checkPasswordDifferent();
            updateButtonState();
            updateMatch();
        };

        const updateMatch = () => {
            const newPassword = newPasswordInput?.value || '';
            const confirmPassword = confirmPasswordInput?.value || '';

            if (!confirmPassword) {
                if (matchContainer) matchContainer.innerHTML = '';
                passwordsMatch = false;
                updateButtonState();
                return;
            }

            if (newPassword === confirmPassword) {
                if (matchContainer) {
                    matchContainer.innerHTML = `
                        <span class="password-match-label" style="color: var(--color-success);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Passwords match
                        </span>
                    `;
                }
                passwordsMatch = true;
            } else {
                if (matchContainer) {
                    matchContainer.innerHTML = `
                        <span class="password-match-label" style="color: var(--color-danger);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Passwords do not match
                        </span>
                    `;
                }
                passwordsMatch = false;
            }

            updateButtonState();
        };

        currentPasswordInput?.addEventListener('input', updateCurrentPassword);
        newPasswordInput?.addEventListener('input', updateStrength);
        confirmPasswordInput?.addEventListener('input', updateMatch);

        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
    },

    /**
     * Bind password validation events for change password popup (Popup.open API version)
     * @param {Object} api - Popup API object
     */
    bindPasswordValidationWithApi(api) {
        const currentPasswordInput = document.getElementById('currentMasterPassword');
        const newPasswordInput = document.getElementById('newMasterPassword');
        const confirmPasswordInput = document.getElementById('confirmMasterPassword');
        const strengthContainer = document.getElementById('newPasswordStrength');
        const matchContainer = document.getElementById('passwordMatch');
        const sameErrorContainer = document.getElementById('passwordSameError');

        let currentPasswordFilled = false;
        let passwordStrong = false;
        let passwordsMatch = false;
        let passwordDifferent = false;

        const updateButtonState = () => {
            const shouldEnable = currentPasswordFilled && passwordStrong && passwordsMatch && passwordDifferent;
            api.setButtonDisabled('confirmBtn', !shouldEnable);
        };

        const updateCurrentPassword = () => {
            currentPasswordFilled = currentPasswordInput && currentPasswordInput.value.length > 0;
            checkPasswordDifferent();
            updateButtonState();
        };

        const checkPasswordDifferent = () => {
            const currentPassword = currentPasswordInput?.value || '';
            const newPassword = newPasswordInput?.value || '';

            if (!currentPassword || !newPassword) {
                if (sameErrorContainer) sameErrorContainer.innerHTML = '';
                passwordDifferent = true;
                return;
            }

            if (currentPassword === newPassword) {
                if (sameErrorContainer) {
                    sameErrorContainer.innerHTML = `
                        <span class="password-same-label" style="color: var(--color-danger);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            New password must be different from current password
                        </span>
                    `;
                }
                passwordDifferent = false;
            } else {
                if (sameErrorContainer) sameErrorContainer.innerHTML = '';
                passwordDifferent = true;
            }
        };

        const updateStrength = () => {
            const password = newPasswordInput?.value || '';

            if (!password) {
                if (strengthContainer) strengthContainer.innerHTML = '';
                if (sameErrorContainer) sameErrorContainer.innerHTML = '';
                passwordStrong = false;
                passwordDifferent = true;
                updateButtonState();
                return;
            }

            const analysis = SecurityAnalyzer.analyzeStrength(password);
            const color = SecurityAnalyzer.getStrengthColor(analysis.score);
            passwordStrong = analysis.score >= 3;
            const percentage = (analysis.score / 4) * 100;

            if (strengthContainer) {
                strengthContainer.innerHTML = `
                    <div class="strength-bar">
                        <div class="strength-fill" style="width: ${percentage}%; background: ${color};"></div>
                    </div>
                    <span class="strength-label" style="color: ${color};">${analysis.label}</span>
                `;
            }

            checkPasswordDifferent();
            updateButtonState();
            updateMatch();
        };

        const updateMatch = () => {
            const newPassword = newPasswordInput?.value || '';
            const confirmPassword = confirmPasswordInput?.value || '';

            if (!confirmPassword) {
                if (matchContainer) matchContainer.innerHTML = '';
                passwordsMatch = false;
                updateButtonState();
                return;
            }

            if (newPassword === confirmPassword) {
                if (matchContainer) {
                    matchContainer.innerHTML = `
                        <span class="password-match-label" style="color: var(--color-success);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Passwords match
                        </span>
                    `;
                }
                passwordsMatch = true;
            } else {
                if (matchContainer) {
                    matchContainer.innerHTML = `
                        <span class="password-match-label" style="color: var(--color-danger);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Passwords do not match
                        </span>
                    `;
                }
                passwordsMatch = false;
            }

            updateButtonState();
        };

        currentPasswordInput?.addEventListener('input', updateCurrentPassword);
        newPasswordInput?.addEventListener('input', updateStrength);
        confirmPasswordInput?.addEventListener('input', updateMatch);
    },

    /**
     * Show Change KDF popup
     * @param {Object} options
     * @param {string} options.mode - 'cloud' or 'local'
     * @param {Object} options.settings - Current settings object
     * @param {Function} options.onSuccess - Callback after successful re-encryption (overlay, newSalt, kdf)
     */
    async showChangeKdfPopup(options = {}) {
        const mode = options.mode || 'cloud';
        const settings = options.settings || {};
        const currentKdf = settings.kdf || { memory: 65536, iterations: 3, parallelism: 4 };

        const memoryOptions = [
            { value: '32768', label: '32 MB (Faster)' },
            { value: '65536', label: '64 MB (Recommended)' },
            { value: '131072', label: '128 MB (Stronger)' },
            { value: '262144', label: '256 MB (Very Strong)' }
        ];

        const iterationOptions = [
            { value: '2', label: '2 (Faster)' },
            { value: '3', label: '3 (Recommended)' },
            { value: '4', label: '4 (Stronger)' },
            { value: '5', label: '5 (Very Strong)' }
        ];

        const currentMemoryLabel = memoryOptions.find(o => o.value === String(currentKdf.memory))?.label || '64 MB (Recommended)';
        const currentIterLabel = iterationOptions.find(o => o.value === String(currentKdf.iterations))?.label || '3 (Recommended)';

        // File warning only for cloud mode
        let fileWarningHtml = '';
        if (mode === 'cloud') {
            const fileItems = typeof Vault !== 'undefined' && Vault.getFileItems ? await Vault.getFileItems() || [] : [];
            if (fileItems.length > 0) {
                let totalSize = 0;
                for (const item of fileItems) {
                    totalSize += item.data?.file_size || item.data?.size || item.file_size || 0;
                }
                fileWarningHtml = `
                    <div class="alert alert-danger" style="margin-bottom: 0; margin-top: var(--space-4);">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <div>
                            <strong>You have ${fileItems.length} encrypted file${fileItems.length > 1 ? 's' : ''}</strong> (${Utils.formatFileSize(totalSize)} total) that need to be re-encrypted. This may take a while. If something goes wrong during the process, you might lose access to these files. <strong>DO NOT close this page.</strong>
                        </div>
                    </div>
                `;
            }
        }

        const self = this;
        Popup.open({
            title: 'Encryption Strength (KDF)',
            body: `
                <div class="alert alert-warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>Changing these settings will re-encrypt ALL your data. This may take a while. We recommend exporting a backup of your vault first.</span>
                </div>
                <p class="popup-description">
                    Higher values = stronger encryption but slower unlock. Argon2id is memory-hard, making GPU attacks impractical.
                </p>

                <div class="form-group">
                    <label class="form-label">Memory (MB)</label>
                    <div class="custom-select custom-select-full" id="kdfMemorySelect" data-value="${currentKdf.memory}">
                        <button class="custom-select-trigger" type="button">
                            <span class="custom-select-value">${currentMemoryLabel}</span>
                            <svg class="custom-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div class="custom-select-dropdown">
                            ${memoryOptions.map(o => `<button class="custom-select-option${o.value === String(currentKdf.memory) ? ' active' : ''}" data-value="${o.value}">${o.label}</button>`).join('')}
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Iterations</label>
                    <div class="custom-select custom-select-full" id="kdfIterationsSelect" data-value="${currentKdf.iterations}">
                        <button class="custom-select-trigger" type="button">
                            <span class="custom-select-value">${currentIterLabel}</span>
                            <svg class="custom-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div class="custom-select-dropdown">
                            ${iterationOptions.map(o => `<button class="custom-select-option${o.value === String(currentKdf.iterations) ? ' active' : ''}" data-value="${o.value}">${o.label}</button>`).join('')}
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="kdfMasterPassword">Current Vault Key</label>
                    <input type="password" id="kdfMasterPassword" class="form-input" placeholder="Enter your current vault key" autocomplete="current-password">
                    <p class="form-hint">Required to verify your identity before re-encrypting data.</p>
                </div>
                ${fileWarningHtml}
            `,
            compact: false,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                {
                    text: 'Apply Changes',
                    type: 'primary',
                    id: 'confirmBtn',
                    onClick: async () => {
                        const newKdf = {
                            memory: parseInt(document.getElementById('kdfMemorySelect').dataset.value),
                            iterations: parseInt(document.getElementById('kdfIterationsSelect').dataset.value),
                            parallelism: currentKdf.parallelism
                        };
                        const masterPassword = document.getElementById('kdfMasterPassword').value;

                        if (!masterPassword) {
                            Toast.error('Vault key is required');
                            return false;
                        }

                        if (newKdf.memory === currentKdf.memory && newKdf.iterations === currentKdf.iterations) {
                            Toast.info('No changes detected');
                            return true;
                        }

                        const isValid = await self.verifyCurrentPassword(masterPassword, mode);
                        if (!isValid) {
                            Toast.error('Incorrect vault key');
                            return false;
                        }

                        return await self.performReEncryption(masterPassword, newKdf, {
                            mode: mode,
                            currentPassword: masterPassword,
                            onSuccess: (overlay, newSalt, kdf) => {
                                if (settings.kdf !== undefined) {
                                    settings.kdf = kdf;
                                }
                                if (typeof options.onSuccess === 'function') {
                                    options.onSuccess(overlay, masterPassword, newSalt, kdf);
                                } else {
                                    self.hideReencryptionOverlay(overlay);
                                    Toast.success('Encryption settings updated successfully');
                                }
                            }
                        });
                    }
                }
            ],
            onOpen: (api) => {
                CustomSelect.init(api.getElement());
            }
        });
    },

    /**
     * Show Change Master Password popup
     * @param {Object} options
     * @param {string} options.mode - 'cloud' or 'local'
     * @param {Object} options.settings - Current settings object
     * @param {Function} options.onSuccess - Callback after successful re-encryption (overlay, newPassword, newSalt, kdf)
     */
    async showChangeMasterPasswordPopup(options = {}) {
        const mode = options.mode || 'cloud';
        const settings = options.settings || {};
        const kdf = settings.kdf || { memory: 65536, iterations: 3, parallelism: 4 };

        // File warning only for cloud mode
        let fileWarningHtml = '';
        if (mode === 'cloud') {
            const fileItems = typeof Vault !== 'undefined' && Vault.getFileItems ? await Vault.getFileItems() || [] : [];
            if (fileItems.length > 0) {
                let totalSize = 0;
                for (const item of fileItems) {
                    totalSize += item.data?.file_size || item.data?.size || item.file_size || 0;
                }
                fileWarningHtml = `
                    <div class="alert alert-danger" style="margin-bottom: 0; margin-top: var(--space-4);">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <div>
                            <strong>You have ${fileItems.length} encrypted file${fileItems.length > 1 ? 's' : ''}</strong> (${Utils.formatFileSize(totalSize)} total) that need to be re-encrypted. This may take a while. If something goes wrong during the process, you might lose access to these files. <strong>DO NOT close this page.</strong>
                        </div>
                    </div>
                `;
            }
        }

        const self = this;
        Popup.open({
            title: 'Change Vault Key',
            body: `
                <div class="alert alert-warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>Changing your vault key will re-encrypt ALL your data. This may take a while. We recommend exporting a backup of your vault first.</span>
                </div>

                <div class="form-group">
                    <label class="form-label" for="currentMasterPassword">Current Vault Key</label>
                    <input type="password" id="currentMasterPassword" class="form-input" placeholder="Enter current vault key" autocomplete="current-password">
                </div>

                <div class="form-group">
                    <label class="form-label" for="newMasterPassword">New Vault Key</label>
                    <input type="password" id="newMasterPassword" class="form-input" placeholder="Enter new vault key" autocomplete="new-password">
                    <div class="password-strength" id="newPasswordStrength"></div>
                    <div class="password-same-error" id="passwordSameError"></div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="confirmMasterPassword">Confirm New Vault Key</label>
                    <input type="password" id="confirmMasterPassword" class="form-input" placeholder="Confirm new vault key" autocomplete="new-password">
                    <div class="password-match" id="passwordMatch"></div>
                </div>
                ${fileWarningHtml}
            `,
            compact: false,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                {
                    text: 'Change Vault Key',
                    type: 'primary',
                    id: 'confirmBtn',
                    disabled: true,
                    onClick: async () => {
                        const currentPassword = document.getElementById('currentMasterPassword').value;
                        const newPassword = document.getElementById('newMasterPassword').value;
                        const confirmPassword = document.getElementById('confirmMasterPassword').value;

                        if (!currentPassword) {
                            Toast.error('Current vault key is required');
                            return false;
                        }

                        if (!newPassword) {
                            Toast.error('New vault key is required');
                            return false;
                        }

                        if (newPassword !== confirmPassword) {
                            Toast.error('New passwords do not match');
                            return false;
                        }

                        const analysis = SecurityAnalyzer.analyzeStrength(newPassword);
                        if (analysis.score < 3) {
                            Toast.error('Password must be strong');
                            return false;
                        }

                        const isValid = await self.verifyCurrentPassword(currentPassword, mode);
                        if (!isValid) {
                            Toast.error('Incorrect current vault key');
                            return false;
                        }

                        return await self.performReEncryption(newPassword, kdf, {
                            mode: mode,
                            currentPassword: currentPassword,
                            onSuccess: (overlay, newSalt, kdfParams) => {
                                if (typeof options.onSuccess === 'function') {
                                    options.onSuccess(overlay, newPassword, newSalt, kdfParams);
                                } else {
                                    self.hideReencryptionOverlay(overlay);
                                    Toast.success('Vault key changed successfully');
                                }
                            }
                        });
                    }
                }
            ],
            onOpen: (api) => {
                self.bindPasswordValidationWithApi(api);
            }
        });
    },

    /**
     * Show change name popup (shared between cloud and local)
     * @param {Object} options - { mode, currentName, currentAvatar, onSave }
     */
    showChangeNamePopup(options = {}) {
        const mode = options.mode || 'cloud';
        const currentName = options.currentName || '';
        const currentAvatar = options.currentAvatar || null;
        const self = this;

        // Track pending avatar (will be saved on confirm)
        let pendingAvatar = currentAvatar;

        const avatarPreviewHtml = currentAvatar && Utils.sanitizeImageSrc(`data:image/png;base64,${currentAvatar}`)
            ? `<img src="data:image/png;base64,${currentAvatar}" alt="Avatar" class="avatar-preview-img">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                   <circle cx="12" cy="7" r="4"></circle>
               </svg>`;

        // Helper to update avatar preview
        const updateAvatarPreview = (base64) => {
            const preview = document.getElementById('avatarPreview');
            const removeBtn = document.getElementById('removeAvatarBtn');
            if (preview) {
                if (base64) {
                    const safeSrc = Utils.sanitizeImageSrc(`data:image/png;base64,${base64}`);
                    preview.innerHTML = safeSrc ? `<img src="${safeSrc}" alt="Avatar" class="avatar-preview-img">` : '';
                    if (removeBtn) removeBtn.style.display = '';
                } else {
                    preview.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>`;
                    if (removeBtn) removeBtn.style.display = 'none';
                }
            }
            pendingAvatar = base64;
        };

        Popup.open({
            title: 'Edit Profile',
            body: `
                <!-- Avatar Section -->
                <div class="avatar-edit-section">
                    <div class="avatar-preview" id="avatarPreview">
                        ${avatarPreviewHtml}
                    </div>
                    <div class="avatar-actions">
                        <button type="button" class="btn btn-secondary btn-sm" id="uploadAvatarBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            Upload
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" id="generateAvatarBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                            </svg>
                            <span class="btn-text">Generate</span>
                            <span class="btn-loading" style="display: none;">
                                <span class="spinner-inline"></span>
                            </span>
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm" id="removeAvatarBtn" style="${currentAvatar ? '' : 'display: none;'}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                    <input type="file" id="avatarFileInput" accept="image/*" style="display: none;">
                </div>

                <!-- Name Section -->
                <div class="form-group">
                    <label class="form-label" for="newDisplayName">Display Name</label>
                    <div class="input-with-toggle">
                        <input type="text" class="form-input" id="newDisplayName" value="${Utils.escapeHtml(currentName)}"
                               placeholder="Enter name" maxlength="50" autofocus>
                        <button type="button" class="input-toggle-btn" id="regenerateDisplayName" title="Generate random name">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="1 4 1 10 7 10"></polyline>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                {
                    text: 'Save',
                    type: 'primary',
                    id: 'confirmBtn',
                    onClick: async () => {
                        const newName = document.getElementById('newDisplayName').value.trim();
                        if (!newName) {
                            Toast.error('Please enter a name');
                            return false;
                        }
                        try {
                            const oldName = currentName;
                            const expectedVaultName = `${oldName}'s Vault`;

                            // Check if default vault name matches the old name pattern
                            if (typeof Vault !== 'undefined') {
                                const defaultVault = await Vault.getDefaultVault();
                                if (defaultVault && defaultVault.name === expectedVaultName) {
                                    // Update default vault name to match new name
                                    const newVaultName = `${newName}'s Vault`;
                                    await Vault.updateVault(defaultVault.id, newVaultName);
                                }
                            }

                            // Call the provided save callback with name and avatar
                            if (typeof options.onSave === 'function') {
                                await options.onSave(newName, pendingAvatar);
                            }

                            Toast.success('Profile updated');
                            return true;
                        } catch (error) {
                            Toast.error('Failed to update profile');
                            return false;
                        }
                    }
                }
            ],
            onOpen: (api) => {
                const input = document.getElementById('newDisplayName');
                if (input) { input.focus(); input.select(); }

                // Bind regenerate name button
                document.getElementById('regenerateDisplayName')?.addEventListener('click', () => {
                    if (typeof RandomNames !== 'undefined') {
                        input.value = RandomNames.generate();
                        input.focus();
                    }
                });

                // Upload avatar
                const fileInput = document.getElementById('avatarFileInput');
                document.getElementById('uploadAvatarBtn')?.addEventListener('click', () => {
                    fileInput?.click();
                });

                fileInput?.addEventListener('change', async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validate file type
                    if (!file.type.startsWith('image/')) {
                        Toast.error('Please select an image file');
                        return;
                    }

                    // Validate file size (max 500KB)
                    if (file.size > 500 * 1024) {
                        Toast.error('Image must be less than 500KB');
                        return;
                    }

                    try {
                        // Resize and convert to base64 (128x128 for avatar)
                        const base64 = await self.resizeImageToBase64(file, 128, 128);
                        updateAvatarPreview(base64);
                    } catch (error) {
                        console.error('Failed to process image:', error);
                        Toast.error('Failed to process image');
                    }
                });

                // Generate avatar
                document.getElementById('generateAvatarBtn')?.addEventListener('click', async () => {
                    const generateBtn = document.getElementById('generateAvatarBtn');
                    const btnText = generateBtn?.querySelector('.btn-text');
                    const btnLoading = generateBtn?.querySelector('.btn-loading');
                    const nameInput = document.getElementById('newDisplayName');
                    const name = nameInput?.value.trim();

                    if (!name) {
                        Toast.error('Please enter a name first');
                        nameInput?.focus();
                        return;
                    }

                    // Show loading
                    if (generateBtn) generateBtn.disabled = true;
                    if (btnText) btnText.style.display = 'none';
                    if (btnLoading) btnLoading.style.display = 'inline-flex';

                    try {
                        const data = await ApiClient.get(`/avatar/generate?name=${encodeURIComponent(name)}`);

                        if (data.success && data.image) {
                            // Resize to 128x128 before saving
                            const resized = await self.resizeBase64Image(data.image, 128, 128);
                            updateAvatarPreview(resized);
                            Toast.success('Avatar generated');
                        } else {
                            Toast.error(data.message || data.error || 'Failed to generate avatar');
                        }
                    } catch (error) {
                        console.error('Failed to generate avatar:', error);
                        Toast.error('Failed to generate avatar');
                    } finally {
                        // Hide loading
                        if (generateBtn) generateBtn.disabled = false;
                        if (btnText) btnText.style.display = '';
                        if (btnLoading) btnLoading.style.display = 'none';
                    }
                });

                // Remove avatar
                document.getElementById('removeAvatarBtn')?.addEventListener('click', () => {
                    updateAvatarPreview(null);
                });
            }
        });
    },

    /**
     * Resize image and convert to base64
     * @param {File} file
     * @param {number} maxWidth
     * @param {number} maxHeight
     * @returns {Promise<string>} Base64 string (without data: prefix)
     */
    resizeImageToBase64(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round(height * maxWidth / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round(width * maxHeight / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Get base64 without the data:image/png;base64, prefix
                    const dataUrl = canvas.toDataURL('image/png');
                    const base64 = dataUrl.split(',')[1];
                    resolve(base64);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Resize a base64 image to specified dimensions
     * @param {string} base64 - Base64 string (without data: prefix)
     * @param {number} maxWidth
     * @param {number} maxHeight
     * @returns {Promise<string>} Base64 string (without data: prefix)
     */
    resizeBase64Image(base64, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = maxWidth;
                canvas.height = maxHeight;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, maxWidth, maxHeight);

                const dataUrl = canvas.toDataURL('image/png');
                const resizedBase64 = dataUrl.split(',')[1];
                resolve(resizedBase64);
            };
            img.onerror = reject;
            img.src = 'data:image/png;base64,' + base64;
        });
    },

    // ===========================================
    // Biometric Unlock (shared between cloud/local)
    // ===========================================

    /**
     * Get the biometric toggle HTML for the settings security section
     * Returns empty string if biometric is not available on this platform
     * @returns {string}
     */
    getBiometricToggleHTML() {
        if (typeof Biometric === 'undefined' || !Biometric.isAvailable()) return '';

        return `
            <div class="settings-item has-toggle" id="biometricItem">
                <div class="settings-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"></path>
                        <path d="M5 19.5C5.5 18 6 15 6 12c0-3.3 2.7-6 6-6 1.8 0 3.4.8 4.5 2"></path>
                        <path d="M10 12c0-1.1.9-2 2-2s2 .9 2 2c0 3-1 6-3 8.5"></path>
                        <path d="M18 12c0 4-1.5 7.5-4 10"></path>
                        <path d="M22 12a10 10 0 0 1-2 6"></path>
                        <path d="M14 12c0 2-1 4.5-2.5 6.5"></path>
                    </svg>
                </div>
                <div class="settings-item-content">
                    <span class="settings-item-label">Biometric Unlock</span>
                    <span class="settings-item-hint">Use Face ID, Touch ID, or fingerprint</span>
                </div>
                <label class="settings-toggle">
                    <input type="checkbox" id="biometricToggle" ${Biometric.isEnabled() ? 'checked' : ''}>
                    <span class="toggle-switch"></span>
                </label>
            </div>
        `;
    },

    /**
     * Bind the biometric toggle event listener
     * Call this from bindEvents() in both cloud and local settings
     */
    bindBiometricToggle() {
        document.getElementById('biometricToggle')?.addEventListener('change', (e) => {
            this.handleBiometricToggle(e.target.checked, e.target);
        });
    },

    /**
     * Handle biometric unlock toggle change
     * @param {boolean} enabled - New toggle state
     * @param {HTMLInputElement} toggle - The checkbox element (to revert on cancel/failure)
     */
    handleBiometricToggle(enabled, toggle) {
        if (typeof Biometric === 'undefined') return;

        if (enabled) {
            Popup.open({
                title: 'Enable Biometric Unlock',
                body: `
                    <p style="color: var(--text-secondary); margin-bottom: var(--space-4);">
                        Enter your vault key to enable biometric unlock.
                    </p>
                    <div class="form-group">
                        <label class="form-label" for="biometricMasterPassword">Vault Key</label>
                        <input type="password" class="form-input" id="biometricMasterPassword"
                               placeholder="Enter your vault key" autocomplete="off">
                    </div>
                `,
                buttons: [
                    { text: 'Cancel', type: 'secondary', isCancel: true },
                    {
                        text: 'Enable',
                        type: 'primary',
                        onClick: async () => {
                            const password = document.getElementById('biometricMasterPassword')?.value;
                            if (!password) {
                                Toast.error('Vault key is required');
                                return false;
                            }

                            try {
                                const isValid = await CryptoAPI.verifyMasterPassword(password);
                                if (!isValid) {
                                    Toast.error('Incorrect vault key');
                                    return false;
                                }

                                await Biometric.enable(password);
                                Toast.success('Biometric unlock enabled');
                                return true;
                            } catch (e) {
                                Toast.error('Failed to enable biometric unlock');
                                return false;
                            }
                        }
                    }
                ],
                compact: true,
                onClose: () => {
                    if (toggle && !Biometric.isEnabled()) {
                        toggle.checked = false;
                    }
                }
            });
        } else {
            Biometric.disable().then(() => {
                Toast.success('Biometric unlock disabled');
            }).catch(() => {
                Toast.error('Failed to disable biometric unlock');
                if (toggle) toggle.checked = true;
            });
        }
    }
};
