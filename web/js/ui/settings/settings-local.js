/**
 * Settings for Local Storage Mode
 * Matches the original beautiful design with clickable rows, icons, and proper styling
 */

const SettingsLocal = {
    settings: {
        session_timeout: 15,
        theme: 'system'
    },

    async init() {
        // Load vault name and avatar
        let vaultName = 'My Vault';
        let userAvatar = null;
        try {
            if (typeof LocalDB !== 'undefined') {
                vaultName = await LocalDB.getUserName() || 'My Vault';
                userAvatar = await LocalDB.getUserAvatar();
            }
        } catch (e) {
            console.warn('Failed to load vault name/avatar:', e);
        }

        this.vaultName = vaultName;
        this.userAvatar = userAvatar;
        this.loadSettingsSync();
        this.render();
        this.bindEvents();
        this.initDesktopSettings();

        // Load KDF settings async and update UI
        await this.loadKdfSettings();
        this.updateKdfStatus();
    },

    loadSettingsSync() {
        this.settings.theme = localStorage.getItem('keyhive_theme') || 'system';
        this.settings.session_timeout = parseInt(localStorage.getItem('keyhive_session_timeout') || '15', 10);
    },

    async loadKdfSettings() {
        try {
            const offlineAuth = await LocalDB.getOfflineAuth();
            if (offlineAuth && offlineAuth.kdf) {
                this.settings.kdf = offlineAuth.kdf;
            }
        } catch (e) {
            console.error('Failed to load KDF settings:', e);
        }
    },

    updateKdfStatus() {
        const kdfStatus = document.getElementById('kdfStatus');
        if (kdfStatus && this.settings.kdf) {
            const kdf = this.settings.kdf;
            const memoryMB = Math.round(kdf.memory / 1024);
            kdfStatus.textContent = `${memoryMB}MB memory, ${kdf.iterations} iterations`;
        } else if (kdfStatus) {
            kdfStatus.textContent = '64MB memory, 3 iterations';
        }
    },

    destroy() {
        // Cleanup if needed
    },

    render() {
        const container = document.getElementById('settingsPageContent');
        if (!container) return;
        container.innerHTML = this.getHTML();
    },

    getHTML() {
        const isDesktop = Platform.isDesktop();

        return `
            <div class="settings-page" id="settingsPage">
                <!-- Profile Section -->
                <section class="settings-section">
                    <h2 class="settings-section-title">Profile</h2>
                    <div class="settings-card">
                        <div class="settings-item clickable" id="changeVaultName">
                            <div class="settings-item-icon ${this.userAvatar ? 'has-avatar' : ''}" id="profileIcon">
                                ${this.userAvatar && Utils.sanitizeImageSrc(`data:image/png;base64,${this.userAvatar}`)
                                    ? `<img src="data:image/png;base64,${this.userAvatar}" alt="Avatar" class="settings-avatar-img">`
                                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>`
                                }
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Name</span>
                                <span class="settings-item-value" id="vaultNameDisplay">${Utils.escapeHtml(this.vaultName)}</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item has-dropdown">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="5"></circle>
                                    <line x1="12" y1="1" x2="12" y2="3"></line>
                                    <line x1="12" y1="21" x2="12" y2="23"></line>
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                    <line x1="1" y1="12" x2="3" y2="12"></line>
                                    <line x1="21" y1="12" x2="23" y2="12"></line>
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Appearance</span>
                                <span class="settings-item-hint">Choose your theme</span>
                            </div>
                            <div class="custom-select" id="themeSelect" data-value="${this.settings.theme}">
                                <button class="custom-select-trigger" type="button">
                                    <span class="custom-select-value">${this.getThemeLabel(this.settings.theme)}</span>
                                    <svg class="custom-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                <div class="custom-select-dropdown">
                                    <button class="custom-select-option ${this.settings.theme === 'dark' ? 'active' : ''}" data-value="dark">Dark</button>
                                    <button class="custom-select-option ${this.settings.theme === 'midnight' ? 'active' : ''}" data-value="midnight">Midnight</button>
                                    <button class="custom-select-option ${this.settings.theme === 'light' ? 'active' : ''}" data-value="light">Light</button>
                                    <button class="custom-select-option ${this.settings.theme === 'system' ? 'active' : ''}" data-value="system">System</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Desktop Settings (only shown on desktop) -->
                <section class="settings-section" id="desktopSettingsSection" style="${isDesktop ? '' : 'display: none;'}">
                    <h2 class="settings-section-title">Desktop App</h2>
                    <div class="settings-card">
                        <div class="settings-item clickable" id="changeShortcut">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Global Shortcut</span>
                                <span class="settings-item-value" id="currentShortcut">Loading...</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item has-toggle">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polygon points="10 8 16 12 10 16 10 8"></polygon>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Run on Startup</span>
                                <span class="settings-item-hint">Launch when you log in</span>
                            </div>
                            <label class="settings-toggle">
                                <input type="checkbox" id="runOnStartupToggle">
                                <span class="toggle-switch"></span>
                            </label>
                        </div>
                    </div>
                </section>

                <!-- Security Section -->
                <section class="settings-section">
                    <h2 class="settings-section-title">Security</h2>
                    <div class="settings-card">
                        <div class="settings-item clickable" id="changeMasterPassword">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Change Vault Key</span>
                                <span class="settings-item-hint">Re-encrypt all data with new vault key</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item clickable" id="changeKdf">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                    <path d="M12 8v4"></path>
                                    <path d="M12 16h.01"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Encryption Strength</span>
                                <span class="settings-item-hint" id="kdfStatus">Loading...</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        ${SettingsBase.getBiometricToggleHTML()}
                    </div>
                </section>

                <!-- Data Section -->
                <section class="settings-section">
                    <h2 class="settings-section-title">Data</h2>
                    <div class="settings-card">
                        <div class="settings-item clickable" id="viewTrash">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Trash</span>
                                <span class="settings-item-hint" id="trashHint">View and manage deleted items</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item clickable" id="exportData">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Export Data</span>
                                <span class="settings-item-hint">Download encrypted backup</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item clickable" id="importData">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Import Data</span>
                                <span class="settings-item-hint">Import from backup or other apps</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item clickable danger" id="deleteAllData">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Delete All Data</span>
                                <span class="settings-item-hint">Permanently delete your local vault</span>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Sessions Section -->
                <section class="settings-section">
                    <h2 class="settings-section-title">Session</h2>
                    <div class="settings-card">
                        <div class="settings-item has-dropdown">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Auto-Lock</span>
                                <span class="settings-item-hint">Lock vault after inactivity</span>
                            </div>
                            <div class="custom-select" id="sessionTimeoutSelect" data-value="${this.settings.session_timeout}">
                                <button class="custom-select-trigger" type="button">
                                    <span class="custom-select-value">${this.getTimeoutLabel(this.settings.session_timeout)}</span>
                                    <svg class="custom-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                <div class="custom-select-dropdown">
                                    <button class="custom-select-option ${this.settings.session_timeout === 1 ? 'active' : ''}" data-value="1">1 minute</button>
                                    <button class="custom-select-option ${this.settings.session_timeout === 5 ? 'active' : ''}" data-value="5">5 minutes</button>
                                    <button class="custom-select-option ${this.settings.session_timeout === 15 ? 'active' : ''}" data-value="15">15 minutes</button>
                                    <button class="custom-select-option ${this.settings.session_timeout === 30 ? 'active' : ''}" data-value="30">30 minutes</button>
                                    <button class="custom-select-option ${this.settings.session_timeout === 60 ? 'active' : ''}" data-value="60">1 hour</button>
                                    <button class="custom-select-option ${this.settings.session_timeout === 0 ? 'active' : ''}" data-value="0">Never</button>
                                </div>
                            </div>
                        </div>
                        <div class="settings-item clickable" id="lockVault">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Lock Vault</span>
                                <span class="settings-item-hint">Lock now and return to unlock screen</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>
                </section>

                <!-- Logout Button -->
                <div class="settings-logout">
                    <button class="btn btn-danger btn-block" id="logoutBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Switch Account
                    </button>
                </div>

                <!-- App Info -->
                <div class="settings-info">
                    <p>Local Storage Mode</p>
                    <p>Client-side encryption</p>
                    <p class="settings-legal-links">
                        &copy; ${new Date().getFullYear()} <a href="https://keyhive.app" target="_blank" rel="noopener">KeyHive</a> v${Config.VERSION}
                        <span>&middot;</span>
                        <a href="https://keyhive.app/terms" target="_blank" rel="noopener">Terms</a>
                        <span>&middot;</span>
                        <a href="https://keyhive.app/privacy" target="_blank" rel="noopener">Privacy</a>
                    </p>
                </div>
            </div>
        `;
    },

    getThemeLabel(theme) {
        const labels = { dark: 'Dark', midnight: 'Midnight', light: 'Light', system: 'System' };
        return labels[theme] || 'System';
    },

    getTimeoutLabel(minutes) {
        if (minutes === 0) return 'Never';
        if (minutes === 1) return '1 minute';
        if (minutes === 60) return '1 hour';
        return `${minutes} minutes`;
    },

    bindEvents() {
        // Change vault name
        document.getElementById('changeVaultName')?.addEventListener('click', () => {
            this.showChangeNamePopup();
        });

        // Init custom selects
        this.initCustomSelects();

        // Lock vault
        document.getElementById('lockVault')?.addEventListener('click', async () => {
            if (typeof CryptoAPI !== 'undefined') await CryptoAPI.lock();
            if (typeof Vault !== 'undefined') Vault.isUnlocked = false;
            if (typeof App !== 'undefined') {
                App.state.isUnlocked = false;
                App.showView('unlock');
            }
        });

        // Switch account (logout for local)
        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            if (typeof App !== 'undefined') {
                await App.logout();
            }
        });

        // Change master password
        document.getElementById('changeMasterPassword')?.addEventListener('click', () => {
            this.showChangeMasterPasswordPopup();
        });

        // Change KDF settings
        document.getElementById('changeKdf')?.addEventListener('click', () => {
            this.showChangeKdfPopup();
        });

        // Biometric unlock toggle (shared via SettingsBase)
        SettingsBase.bindBiometricToggle();

        // Delete all data
        document.getElementById('deleteAllData')?.addEventListener('click', () => {
            this.handleDeleteAllData();
        });

        // View trash
        document.getElementById('viewTrash')?.addEventListener('click', () => {
            if (typeof TrashManager !== 'undefined') {
                TrashManager.show();
            }
        });

        // Export data
        document.getElementById('exportData')?.addEventListener('click', () => {
            this.exportData();
        });

        // Import data
        document.getElementById('importData')?.addEventListener('click', () => {
            this.importData();
        });

        // Desktop settings
        document.getElementById('changeShortcut')?.addEventListener('click', () => {
            this.showChangeShortcutPopup();
        });

        document.getElementById('runOnStartupToggle')?.addEventListener('change', async (e) => {
            if (Platform.isDesktop()) {
                const enabled = e.target.checked;
                const result = await Platform.setRunOnStartup(enabled);
                if (result.success) {
                    Toast.success(enabled ? 'KeyHive will run on startup' : 'Startup disabled');
                } else {
                    Toast.error(result.error || 'Failed to update setting');
                    e.target.checked = !enabled;
                }
            }
        });
    },

    initCustomSelects() {
        CustomSelect.init('.settings-page', (selectId, value) => {
            this.handleCustomSelectChange(selectId, value);
        });
    },

    handleCustomSelectChange(selectId, value) {
        if (selectId === 'themeSelect') {
            this.updateTheme(value);
        } else if (selectId === 'sessionTimeoutSelect') {
            this.updateSessionTimeout(parseInt(value, 10));
        }
    },

    updateTheme(theme) {
        this.settings.theme = theme;
        App.setTheme(theme);
    },

    updateSessionTimeout(minutes) {
        this.settings.session_timeout = minutes;
        App.setSessionTimeout(minutes);
    },

    initDesktopSettings() {
        if (Platform.isDesktop()) {
            const section = document.getElementById('desktopSettingsSection');
            if (section) {
                section.style.display = '';
                const settings = Platform.getSettings();
                if (settings) {
                    const shortcutHint = document.getElementById('currentShortcut');
                    if (shortcutHint) shortcutHint.textContent = settings.shortcut || 'Not set';
                    const toggle = document.getElementById('runOnStartupToggle');
                    if (toggle) toggle.checked = settings.runOnStartup || false;
                }
            }
        }
    },

    showChangeNamePopup() {
        const self = this;
        SettingsBase.showChangeNamePopup({
            mode: 'local',
            currentName: this.vaultName,
            currentAvatar: this.userAvatar,
            onSave: async (newName, newAvatar) => {
                // Save name
                await LocalDB.saveUserName(newName);
                self.vaultName = newName;
                document.getElementById('vaultNameDisplay').textContent = newName;

                // Save avatar
                if (newAvatar !== self.userAvatar) {
                    if (newAvatar) {
                        await LocalDB.saveUserAvatar(newAvatar);
                    } else {
                        await LocalDB.deleteUserAvatar();
                    }
                    self.userAvatar = newAvatar;

                    // Update the profile icon in settings
                    const profileIcon = document.getElementById('profileIcon');
                    if (profileIcon) {
                        if (newAvatar) {
                            profileIcon.classList.add('has-avatar');
                            const safeSrc = Utils.sanitizeImageSrc(`data:image/png;base64,${newAvatar}`);
                            profileIcon.innerHTML = safeSrc ? `<img src="${safeSrc}" alt="Avatar" class="settings-avatar-img">` : '';
                        } else {
                            profileIcon.classList.remove('has-avatar');
                            profileIcon.innerHTML = `
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>`;
                        }
                    }
                }

                // Update sidebar avatar
                if (typeof Sidebar !== 'undefined' && Sidebar.updateUserInfo) {
                    Sidebar.updateUserInfo();
                }
            }
        });
    },

    /**
     * Show change master password popup (uses shared function)
     */
    showChangeMasterPasswordPopup() {
        SettingsBase.showChangeMasterPasswordPopup({
            mode: 'local',
            settings: this.settings
        });
    },

    /**
     * Show change KDF popup (uses shared function)
     */
    showChangeKdfPopup() {
        const self = this;
        SettingsBase.showChangeKdfPopup({
            mode: 'local',
            settings: this.settings,
            onSuccess: (overlay, masterPassword, newSalt, kdf) => {
                self.settings.kdf = kdf;
                self.updateKdfStatus();
                SettingsBase.hideReencryptionOverlay(overlay);
                Toast.success('Encryption settings updated successfully');
            }
        });
    },

    async handleDeleteAllData() {
        return new Promise((resolve) => {
            let popupApi = null;
            let resolved = false;

            popupApi = Popup.open({
                title: 'Delete All Local Data',
                body: `
                    <div class="alert alert-danger">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <div>
                            <strong>This action is irreversible!</strong> All your passwords, notes, files, and vault data will be permanently deleted. There is no way to recover this data.
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: var(--space-4);">
                        <label class="form-label" for="deleteConfirmPassword">Vault Key</label>
                        <input type="password" class="form-input" id="deleteConfirmPassword"
                               placeholder="Enter your vault key" required autocomplete="new-password">
                    </div>

                    <label class="custom-checkbox" style="margin-top: var(--space-4);">
                        <input type="checkbox" id="deleteConfirmCheckbox">
                        <span class="checkmark"></span>
                        <span class="checkbox-text">I understand that all my data will be permanently deleted and cannot be recovered</span>
                    </label>
                `,
                buttons: [
                    { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                    {
                        text: 'Delete All Data',
                        type: 'danger',
                        id: 'confirmBtn',
                        disabled: true,
                        onClick: async () => {
                            const passwordInput = popupApi.querySelector('#deleteConfirmPassword');
                            const checkbox = popupApi.querySelector('#deleteConfirmCheckbox');
                            const password = passwordInput?.value?.trim();

                            if (!password) {
                                Toast.error('Please enter your vault key');
                                return false;
                            }

                            if (!checkbox?.checked) {
                                Toast.error('Please confirm you understand');
                                return false;
                            }

                            try {
                                const isValid = await CryptoAPI.verifyMasterPassword(password);
                                if (!isValid) {
                                    Toast.error('Incorrect vault key');
                                    return false;
                                }

                                // Password verified, delete everything
                                popupApi.setButtonText('confirmBtn', 'Deleting...');

                                if (typeof LocalDB !== 'undefined') {
                                    await LocalDB.deleteDatabase();
                                    LocalDB.clearMode();
                                }
                                localStorage.removeItem('keyhive_mode');
                                localStorage.removeItem('keyhive_theme');
                                localStorage.removeItem('keyhive_session_timeout');
                                if (typeof CryptoAPI !== 'undefined') await CryptoAPI.lock();

                                Toast.success('All local data deleted');

                                if (typeof App !== 'undefined') {
                                    App.state = { isAuthenticated: false, isUnlocked: false, isLocalMode: false, user: null };
                                    App.showView('mode-select');
                                }
                                resolved = true;
                                resolve(true);
                                return true;
                            } catch (error) {
                                console.error('Failed to delete local data:', error);
                                Toast.error('Failed to delete data: ' + error.message);
                                return false;
                            }
                        }
                    }
                ],
                onOpen: (api) => {
                    const passwordInput = api.querySelector('#deleteConfirmPassword');
                    const checkbox = api.querySelector('#deleteConfirmCheckbox');

                    passwordInput?.focus();

                    // Enable/disable confirm button based on checkbox
                    checkbox?.addEventListener('change', () => {
                        api.setButtonDisabled('confirmBtn', !checkbox.checked);
                    });

                    // Handle Enter key
                    passwordInput?.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && checkbox?.checked) {
                            api.getElement().querySelector('#confirmBtn')?.click();
                        }
                    });
                },
                onClose: () => {
                    if (!resolved) {
                        resolve(false);
                    }
                }
            });
        });
    },

    showChangeShortcutPopup() {
        const self = this;
        const currentShortcut = Platform.getSettings()?.shortcut || 'Ctrl+Alt+Z';

        Popup.open({
            title: 'Change Global Shortcut',
            body: `
                <div class="form-group">
                    <label class="form-label">Current Shortcut</label>
                    <div class="shortcut-recorder" id="shortcutRecorder">
                        <span class="shortcut-keys" id="shortcutKeys">${Utils.escapeHtml(currentShortcut)}</span>
                        <button class="btn btn-secondary btn-sm" id="recordShortcut">Record New</button>
                    </div>
                    <p class="form-hint">Click "Record New" then press your desired key combination.</p>
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary' },
                {
                    text: 'Save',
                    type: 'primary',
                    onClick: async () => {
                        const newShortcut = document.getElementById('shortcutKeys').textContent;
                        if (newShortcut && Platform.isDesktop()) {
                            const result = await Platform.setShortcut(newShortcut);
                            if (result.success) {
                                document.getElementById('currentShortcut').textContent = newShortcut;
                                Toast.success('Shortcut updated');
                                return true;
                            } else {
                                Toast.error(result.error || 'Failed to set shortcut. It may be in use by another app.');
                                return false;
                            }
                        }
                        return true;
                    }
                }
            ],
            onOpen: () => {
                self.bindShortcutRecorder(currentShortcut);
            }
        });
    },

    bindShortcutRecorder(currentShortcut) {
        const recordBtn = document.getElementById('recordShortcut');
        const keysDisplay = document.getElementById('shortcutKeys');
        let isRecording = false;

        recordBtn?.addEventListener('click', () => {
            if (isRecording) return;
            isRecording = true;
            recordBtn.textContent = 'Press keys...';
            keysDisplay.textContent = '...';

            const keyHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const parts = [];
                if (e.ctrlKey) parts.push('Ctrl');
                if (e.altKey) parts.push('Alt');
                if (e.shiftKey) parts.push('Shift');
                if (e.metaKey) parts.push('Cmd');

                const key = e.key;
                if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
                    parts.push(key.length === 1 ? key.toUpperCase() : key);
                    keysDisplay.textContent = parts.join('+');
                    recordBtn.textContent = 'Record New';
                    isRecording = false;
                    document.removeEventListener('keydown', keyHandler);
                }
            };

            document.addEventListener('keydown', keyHandler);

            setTimeout(() => {
                if (isRecording) {
                    isRecording = false;
                    recordBtn.textContent = 'Record New';
                    keysDisplay.textContent = currentShortcut;
                    document.removeEventListener('keydown', keyHandler);
                }
            }, 5000);
        });
    },

    /**
     * Export data - uses shared function from SettingsBase
     */
    exportData() {
        SettingsBase.showExportPopup();
    },

    /**
     * Import data
     */
    importData() {
        if (typeof ImportManager !== 'undefined') {
            ImportManager.show();
        } else {
            Toast.error('Import feature not available');
        }
    }
};
