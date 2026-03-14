/**
 * Settings for Cloud Mode
 * Full-featured settings with server integration:
 * - Account info
 * - Session timeout
 * - Theme
 * - 2FA management
 * - Master password change
 * - Sessions management
 * - Storage & cleanup
 * - Export/Import
 */

const SettingsCloud = {
    settings: {
        session_timeout: 15,
        theme: 'system'
    },

    /**
     * Initialize the settings page
     */
    async init() {
        this.render();
        this.bindEvents();
        this.bindConnectivityListener();
        this.initDesktopSettings();
        await this.loadSettings();
    },

    /**
     * Initialize desktop app settings (if running in Electron)
     */
    initDesktopSettings() {
        if (Platform.isDesktop()) {
            const section = document.getElementById('desktopSettingsSection');
            if (section) {
                section.style.display = '';

                // Load current settings
                const settings = Platform.getSettings();
                if (settings) {
                    // Update shortcut display
                    const shortcutHint = document.getElementById('currentShortcut');
                    if (shortcutHint) {
                        shortcutHint.textContent = settings.shortcut || 'Not set';
                    }

                    // Update run on startup toggle
                    const toggle = document.getElementById('runOnStartupToggle');
                    if (toggle) {
                        toggle.checked = settings.runOnStartup || false;
                    }
                }
            }
        }
    },

    /**
     * Bind connectivity change listener
     */
    bindConnectivityListener() {
        // Remove existing listener if any
        if (this._connectivityHandler) {
            window.removeEventListener('connectivity', this._connectivityHandler);
        }

        // Add listener for connectivity changes
        this._connectivityHandler = (e) => {
            if (e.detail.isOnline) {
                this.hideOfflineState();
            } else {
                this.showOfflineState();
            }
        };

        window.addEventListener('connectivity', this._connectivityHandler);
    },

    /**
     * Render the settings page
     */
    render() {
        const container = document.getElementById('settingsPageContent');
        if (container) {
            container.innerHTML = this.getHTML();
        }
    },

    /**
     * Get page HTML
     * @returns {string}
     */
    getHTML() {
        const user = App?.state?.user || {};

        return `
            <div class="settings-page" id="settingsPage">
                <!-- Account Section -->
                <section class="settings-section">
                    <h2 class="settings-section-title">Account</h2>
                    <div class="settings-card">
                        <div class="settings-item clickable" id="changeName">
                            <div class="settings-item-icon" id="profileIcon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Name</span>
                                <span class="settings-item-value" id="userName">${Utils.escapeHtml(this.getUserName())}</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Email</span>
                                <span class="settings-item-value" id="userEmail">${Utils.escapeHtml(user.email || 'Loading...')}</span>
                            </div>
                        </div>
                        <div class="settings-item clickable" id="changePassword">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Change Account Password</span>
                                <span class="settings-item-hint">Update your login password</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        ${Platform.isMobile() ? `
                        <div class="settings-item">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Account Status</span>
                                <span class="settings-item-hint" id="mobileAccountStatus">Loading...</span>
                            </div>
                        </div>
                        <div class="settings-item clickable" id="mobileAccountSettings">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="2" y1="12" x2="22" y2="12"></line>
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Account Settings</span>
                                <span class="settings-item-hint">Visit <a href="${Config.APP_URL}" target="_blank" style="color: var(--accent); text-decoration: none;">${Config.APP_DOMAIN}</a> to manage your account</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        ` : ''}
                    </div>
                </section>

                ${Platform.isMobile() ? '' : `
                <!-- Subscription Section -->
                <section class="settings-section" id="subscriptionSection">
                    <h2 class="settings-section-title">Subscription</h2>
                    <div class="settings-card">
                        <div class="settings-item">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                    <line x1="1" y1="10" x2="23" y2="10"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Plan Status</span>
                                <span class="settings-item-hint" id="subscriptionStatus">Loading...</span>
                            </div>
                        </div>
                        <div class="settings-item clickable" id="manageSubscription" style="display: none;">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Manage Subscription</span>
                                <span class="settings-item-hint">Change plan, update payment, or cancel</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>
                </section>
                `}

                <!-- Security Section -->
                <section class="settings-section" id="securitySection">
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
                                <span class="settings-item-hint">Re-encrypts all your data</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item clickable" id="changeKdf">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                    <path d="M2 17l10 5 10-5"></path>
                                    <path d="M2 12l10 5 10-5"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Encryption Strength (KDF)</span>
                                <span class="settings-item-hint" id="kdfStatus">Loading...</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item clickable" id="setup2FA">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Two-Factor Authentication</span>
                                <span class="settings-item-hint" id="2faStatus">Loading...</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item clickable" id="recoveryCodes">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Recovery Codes</span>
                                <span class="settings-item-hint" id="recoveryCodesStatus">Loading...</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        ${SettingsBase.getBiometricToggleHTML()}
                    </div>
                </section>

                <!-- Desktop App Settings (only shown in Electron) -->
                <section class="settings-section" id="desktopSettingsSection" style="display: none;">
                    <h2 class="settings-section-title">App Settings</h2>
                    <div class="settings-card">
                        <div class="settings-item clickable" id="changeShortcut">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                                    <path d="M6 8h.01"></path>
                                    <path d="M10 8h.01"></path>
                                    <path d="M14 8h.01"></path>
                                    <path d="M18 8h.01"></path>
                                    <path d="M8 12h.01"></path>
                                    <path d="M12 12h.01"></path>
                                    <path d="M16 12h.01"></path>
                                    <path d="M7 16h10"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Toggle Shortcut</span>
                                <span class="settings-item-hint" id="currentShortcut">Ctrl+Alt+Z</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item has-toggle" id="runOnStartupItem">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polygon points="10 8 16 12 10 16 10 8"></polygon>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Run on Startup</span>
                                <span class="settings-item-hint">Launch KeyHive when computer starts</span>
                            </div>
                            <label class="settings-toggle">
                                <input type="checkbox" id="runOnStartupToggle">
                                <span class="toggle-switch"></span>
                            </label>
                        </div>
                    </div>
                    <p class="settings-section-note">
                        Use the shortcut to quickly show or hide KeyHive from anywhere.
                    </p>
                </section>

                <!-- Preferences Section -->
                <section class="settings-section">
                    <h2 class="settings-section-title">Preferences</h2>
                    <div class="settings-card">
                        <div class="settings-item has-dropdown">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Auto-Lock Timeout</span>
                                <span class="settings-item-hint">Lock vault after inactivity</span>
                            </div>
                            <div class="custom-select" id="sessionTimeoutSelect" data-value="15">
                                <button class="custom-select-trigger" type="button">
                                    <span class="custom-select-value">15 min</span>
                                    <svg class="custom-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                <div class="custom-select-dropdown">
                                    <button class="custom-select-option" data-value="5">5 min</button>
                                    <button class="custom-select-option" data-value="10">10 min</button>
                                    <button class="custom-select-option active" data-value="15">15 min</button>
                                    <button class="custom-select-option" data-value="30">30 min</button>
                                    <button class="custom-select-option" data-value="60">1 hour</button>
                                    <button class="custom-select-option" data-value="0">Never</button>
                                </div>
                            </div>
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
                                <span class="settings-item-label">Theme</span>
                            </div>
                            <div class="custom-select" id="themeSelect" data-value="system">
                                <button class="custom-select-trigger" type="button">
                                    <span class="custom-select-value">System</span>
                                    <svg class="custom-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                <div class="custom-select-dropdown">
                                    <button class="custom-select-option active" data-value="dark">Dark</button>
                                    <button class="custom-select-option" data-value="midnight">Midnight</button>
                                    <button class="custom-select-option" data-value="light">Light</button>
                                    <button class="custom-select-option" data-value="system">System</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Sessions Section -->
                <section class="settings-section" id="sessionsSection">
                    <h2 class="settings-section-title">Sessions</h2>
                    <div class="settings-card">
                        <div class="settings-item has-dropdown">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                    <path d="M12 8v4"></path>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Session Binding</span>
                                <span class="settings-item-hint">Restrict sessions to IP/browser</span>
                            </div>
                            <div class="custom-select" id="sessionBindingSelect" data-value="none">
                                <button class="custom-select-trigger" type="button">
                                    <span class="custom-select-value">None (Recommended)</span>
                                    <svg class="custom-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                <div class="custom-select-dropdown">
                                    <button class="custom-select-option active" data-value="none">None (Recommended)</button>
                                    <button class="custom-select-option" data-value="ip">IP Address Only</button>
                                    <button class="custom-select-option" data-value="full">IP + Browser</button>
                                </div>
                            </div>
                        </div>
                        <div class="settings-item clickable" id="viewSessions">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                    <line x1="8" y1="21" x2="16" y2="21"></line>
                                    <line x1="12" y1="17" x2="12" y2="21"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Active Sessions</span>
                                <span class="settings-item-hint">View and manage active sessions</span>
                            </div>
                            <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="settings-item clickable danger" id="revokeAllSessions">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Revoke All Sessions</span>
                                <span class="settings-item-hint">Sign out from all devices</span>
                            </div>
                        </div>
                    </div>
                    <p class="settings-section-note">
                        Session binding may cause issues if your IP changes frequently (mobile networks, VPNs).
                    </p>
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
                        <div class="settings-item" id="storageUsage">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Storage Used</span>
                                <span class="settings-item-hint" id="storageInfo">Loading...</span>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Danger Zone -->
                <section class="settings-section" id="dangerZoneSection">
                    <h2 class="settings-section-title danger">Danger Zone</h2>
                    <div class="settings-card danger">
                        <div class="settings-item clickable danger" id="deleteAccount">
                            <div class="settings-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            </div>
                            <div class="settings-item-content">
                                <span class="settings-item-label">Delete Account</span>
                                <span class="settings-item-hint">Permanently delete your account and all data</span>
                            </div>
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
                        Sign Out
                    </button>
                </div>

                <!-- App Info -->
                <div class="settings-info">
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

    /**
     * Get user display name
     */
    getUserName() {
        // Get from App state (loaded from API)
        const user = App?.state?.user;
        if (user?.name) return user.name;

        // Fallback to current vault name
        if (typeof Vault !== 'undefined') {
            const vault = Vault.getCurrentVault();
            if (vault?.name) return vault.name;
        }

        return 'My Vault';
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Change name
        document.getElementById('changeName')?.addEventListener('click', () => {
            this.showChangeNamePopup();
        });

        // Change account password
        document.getElementById('changePassword')?.addEventListener('click', () => {
            this.showChangePasswordPopup();
        });

        // Change master password
        document.getElementById('changeMasterPassword')?.addEventListener('click', () => {
            this.showChangeMasterPasswordPopup();
        });

        // Setup 2FA
        document.getElementById('setup2FA')?.addEventListener('click', () => {
            this.showSetup2FAPopup();
        });

        // Recovery codes
        document.getElementById('recoveryCodes')?.addEventListener('click', () => {
            this.showRecoveryCodesPopup();
        });

        // Initialize custom selects
        this.initCustomSelects();

        // View sessions
        document.getElementById('viewSessions')?.addEventListener('click', () => {
            this.showSessionsPopup();
        });

        // Revoke all sessions
        document.getElementById('revokeAllSessions')?.addEventListener('click', () => {
            this.confirmRevokeAllSessions();
        });

        // Manage subscription (web/desktop only)
        document.getElementById('manageSubscription')?.addEventListener('click', async () => {
            try {
                const response = await ApiClient.createPortal();
                if (response.success && response.data.portal_url) {
                    window.open(response.data.portal_url, '_blank');
                }
            } catch (err) {
                Toast.error(err.message || 'Failed to open subscription portal');
            }
        });

        // Mobile: open account settings in browser
        document.getElementById('mobileAccountSettings')?.addEventListener('click', () => {
            window.open(Config.APP_URL, '_blank');
        });

        // Export data
        document.getElementById('exportData')?.addEventListener('click', () => {
            this.exportData();
        });

        // Import data
        document.getElementById('importData')?.addEventListener('click', () => {
            this.importData();
        });

        // View trash
        document.getElementById('viewTrash')?.addEventListener('click', () => {
            if (typeof TrashManager !== 'undefined') {
                TrashManager.show();
            }
        });

        // Delete account
        document.getElementById('deleteAccount')?.addEventListener('click', () => {
            this.confirmDeleteAccount();
        });

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
        });

        // Change KDF
        document.getElementById('changeKdf')?.addEventListener('click', () => {
            this.showChangeKdfPopup();
        });

        // Biometric unlock toggle (shared via SettingsBase)
        SettingsBase.bindBiometricToggle();

        // Desktop app settings
        document.getElementById('changeShortcut')?.addEventListener('click', () => {
            this.showChangeShortcutPopup();
        });

        document.getElementById('runOnStartupToggle')?.addEventListener('change', async (e) => {
            await this.updateRunOnStartup(e.target.checked);
        });
    },

    /**
     * Initialize custom select dropdowns
     */
    initCustomSelects() {
        CustomSelect.init('.settings-page', (selectId, value) => {
            this.handleCustomSelectChange(selectId, value);
        });
    },

    /**
     * Handle custom select value change
     * @param {string} selectId
     * @param {string} value
     */
    handleCustomSelectChange(selectId, value) {
        switch(selectId) {
            case 'sessionTimeoutSelect':
                this.updateSessionTimeout(parseInt(value));
                break;
            case 'themeSelect':
                this.updateTheme(value);
                break;
            case 'sessionBindingSelect':
                this.updateSessionBinding(value);
                break;
        }
    },

    /**
     * Check if currently offline or in local mode
     * @returns {boolean}
     */
    isOffline() {
        // Local mode = no server connection
        const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';
        if (isLocalMode) {
            return true;
        }
        return typeof Connectivity !== 'undefined' && Connectivity.isOffline();
    },

    /**
     * Load settings from localStorage and server
     * Flow: localStorage takes priority (per-device settings), server provides fallback defaults
     */
    async loadSettings() {
        // Read local settings (may be null if not set yet)
        const localTheme = localStorage.getItem('keyhive_theme');
        const localTimeout = localStorage.getItem('keyhive_session_timeout');

        // Apply local theme immediately if exists (prevents flash)
        if (localTheme) {
            this.settings.theme = localTheme;
            if (typeof App !== 'undefined' && App.applyTheme) {
                App.applyTheme(localTheme);
            }
        }
        if (localTimeout) {
            this.settings.session_timeout = parseInt(localTimeout, 10);
        }

        // Update UI with local settings
        this.updateSettingsUI();

        // Check if offline
        if (this.isOffline()) {
            console.log('[Settings] Offline mode - using local settings only');
            // Load user avatar from IndexedDB when offline
            try {
                if (typeof LocalDB !== 'undefined') {
                    const userAvatar = await LocalDB.getUserAvatar();
                    if (userAvatar) {
                        this.userAvatar = userAvatar;
                        const profileIcon = document.getElementById('profileIcon');
                        if (profileIcon) {
                            profileIcon.classList.add('has-avatar');
                            profileIcon.innerHTML = Utils.sanitizeImageSrc(`data:image/png;base64,${userAvatar}`) ? `<img src="data:image/png;base64,${userAvatar}" alt="Avatar" class="settings-avatar-img">` : '';
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to load user avatar:', e);
            }
            this.showOfflineState();
            return;
        }

        // ONLINE: Fetch server settings (name, storage, 2FA status, etc.)
        try {
            const response = await ApiClient.getSettings();
            if (response.success) {
                const serverSettings = response.data.settings || response.data;

                // If localStorage doesn't have these settings, use server values as defaults
                // This makes server settings the "global default" for new devices
                if (!localTheme && serverSettings.theme) {
                    this.settings.theme = serverSettings.theme;
                    localStorage.setItem('keyhive_theme', serverSettings.theme);
                    if (typeof App !== 'undefined' && App.applyTheme) {
                        App.applyTheme(serverSettings.theme);
                    }
                }
                if (!localTimeout && serverSettings.session_timeout) {
                    this.settings.session_timeout = serverSettings.session_timeout;
                    localStorage.setItem('keyhive_session_timeout', serverSettings.session_timeout.toString());
                    if (typeof SessionTimeout !== 'undefined') {
                        SessionTimeout.setTimeout(serverSettings.session_timeout);
                    }
                }

                // Merge server settings (keep local theme/timeout which may have been updated above)
                this.settings = {
                    ...serverSettings,
                    theme: this.settings.theme,
                    session_timeout: this.settings.session_timeout
                };

                // Load KDF settings from IndexedDB
                try {
                    if (typeof LocalDB !== 'undefined') {
                        const offlineAuth = await LocalDB.getOfflineAuth();
                        if (offlineAuth && offlineAuth.kdf) {
                            this.settings.kdf = offlineAuth.kdf;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to load KDF from IndexedDB:', e);
                }

                // Update UI to reflect any changes
                this.updateSettingsUI();

                // Update name in App state and UI
                if (this.settings.name && App?.state?.user) {
                    App.state.user.name = this.settings.name;
                }
                const nameEl = document.getElementById('userName');
                if (nameEl) {
                    nameEl.textContent = this.settings.name || this.getUserName();
                }

                // Load user avatar from server settings
                if (this.settings.avatar) {
                    this.userAvatar = this.settings.avatar;
                    const profileIcon = document.getElementById('profileIcon');
                    if (profileIcon) {
                        profileIcon.classList.add('has-avatar');
                        profileIcon.innerHTML = Utils.sanitizeImageSrc(`data:image/png;base64,${this.settings.avatar}`) ? `<img src="data:image/png;base64,${this.settings.avatar}" alt="Avatar" class="settings-avatar-img">` : '';
                    }
                    // Cache in IndexedDB for offline access
                    if (typeof LocalDB !== 'undefined') {
                        LocalDB.saveUserAvatar(this.settings.avatar).catch(e => {
                            console.warn('Failed to cache avatar in IndexedDB:', e);
                        });
                    }
                }
            }

            // Load storage usage
            try {
                const usageResponse = await ApiClient.getStorageUsage();
                if (usageResponse?.success) {
                    const usage = usageResponse.data;
                    document.getElementById('storageInfo').textContent =
                        `${usage.used_formatted} / ${usage.total_formatted} (${usage.percentage}%)`;
                }
            } catch (e) {
                document.getElementById('storageInfo').textContent = 'N/A';
            }

            // Load subscription / account status
            try {
                const subResponse = await ApiClient.getSubscriptionStatus();
                if (subResponse?.success) {
                    const sub = subResponse.data;
                    const isActive = sub.status === 'active' || sub.status === 'complimentary'
                        || (sub.status === 'trialing' && sub.trial_days_remaining > 0);

                    // Mobile: simple active/inactive in Account section
                    const mobileStatusEl = document.getElementById('mobileAccountStatus');
                    if (mobileStatusEl) {
                        const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isActive ? '#22c55e' : '#ef4444'};margin-right:6px;vertical-align:middle;"></span>`;
                        mobileStatusEl.innerHTML = `${dot}${isActive ? 'Active' : 'Inactive'}`;
                    }

                    // Desktop/web: detailed status in Subscription section
                    const statusEl = document.getElementById('subscriptionStatus');
                    if (statusEl) {
                        let statusText = '';
                        switch (sub.status) {
                            case 'trialing':
                                statusText = sub.trial_days_remaining > 0
                                    ? `Free trial (${sub.trial_days_remaining} days remaining)`
                                    : 'Trial expired';
                                break;
                            case 'active':
                                statusText = 'Active';
                                break;
                            case 'past_due':
                                statusText = 'Past due - please update payment';
                                break;
                            case 'canceled':
                                statusText = sub.current_period_end
                                    ? `Canceled - active until ${new Date(sub.current_period_end).toLocaleDateString()}`
                                    : 'Canceled';
                                break;
                            case 'expired':
                                statusText = 'Expired';
                                break;
                            case 'complimentary':
                                statusText = 'Complimentary';
                                break;
                            case 'paused':
                                statusText = 'Paused';
                                break;
                            default:
                                statusText = sub.status || 'Unknown';
                        }
                        statusEl.textContent = statusText;
                    }
                    // Show manage button if has Stripe customer (web/desktop only)
                    if (sub.has_stripe_customer) {
                        const manageBtn = document.getElementById('manageSubscription');
                        if (manageBtn) manageBtn.style.display = '';
                    }
                }
            } catch (e) {
                const statusEl = document.getElementById('subscriptionStatus');
                if (statusEl) statusEl.textContent = 'Unable to load';
                const mobileStatusEl = document.getElementById('mobileAccountStatus');
                if (mobileStatusEl) mobileStatusEl.textContent = 'Unable to load';
            }

            // Update 2FA status
            const user = App?.state?.user;
            if (user) {
                document.getElementById('userEmail').textContent = user.email;
            }

            // Fetch 2FA status from API
            try {
                const twoFAResponse = await ApiClient.get2FAStatus();
                if (twoFAResponse?.success) {
                    this.twoFactorStatus = twoFAResponse.data;
                    const statusEl = document.getElementById('2faStatus');
                    if (statusEl) {
                        const methods = [];
                        const data = twoFAResponse.data;

                        // Check for strong 2FA methods (not email)
                        if (data.methods?.totp) methods.push('Authenticator');
                        if (data.methods?.webauthn) {
                            const count = data.webauthn_count || 0;
                            methods.push(count === 1 ? '1 Security Key' : `${count} Security Keys`);
                        }

                        if (methods.length > 0) {
                            statusEl.textContent = `Enabled (${methods.join(', ')})`;
                            statusEl.style.color = 'var(--color-success)';
                        } else {
                            statusEl.textContent = 'Email only';
                            statusEl.style.color = 'var(--color-text-muted)';
                        }
                    }
                }
            } catch (e) {
                document.getElementById('2faStatus').textContent = 'Error loading';
            }

            // Update recovery codes status
            const recoveryCount = this.settings.recovery_codes_count || 0;
            const recoveryStatusEl = document.getElementById('recoveryCodesStatus');
            if (recoveryStatusEl) {
                if (recoveryCount > 0) {
                    recoveryStatusEl.textContent = `${recoveryCount} code${recoveryCount !== 1 ? 's' : ''} remaining`;
                    recoveryStatusEl.style.color = '';
                } else {
                    recoveryStatusEl.textContent = 'No recovery codes set up';
                    recoveryStatusEl.style.color = 'var(--color-warning)';
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            // Show offline state if server request failed
            this.showOfflineState();
        }
    },

    /**
     * Show offline state - hide server-only settings
     */
    showOfflineState() {
        // Prevent duplicate calls
        if (document.querySelector('.settings-offline-notice')) {
            return;
        }

        // Hide entire sections that require server
        const sectionsToHide = [
            'securitySection',
            'sessionsSection',
            'dangerZoneSection'
        ];

        sectionsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
            }
        });

        // Hide specific items within Account section
        const itemsToHide = [
            'changePassword',
        ];

        itemsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
            }
        });

        // Hide storage-related items in Data section
        const dataItemsToHide = [
            'importData',
            'storageUsage',
            'viewTrash'
        ];

        dataItemsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
            }
        });

        // Make Name unclickable but visible (no dimming)
        const changeName = document.getElementById('changeName');
        if (changeName) {
            changeName.classList.remove('clickable');
            changeName.style.pointerEvents = 'none';
            changeName.style.cursor = 'default';
            // Hide the arrow
            const arrow = changeName.querySelector('.settings-item-arrow');
            if (arrow) {
                arrow.style.display = 'none';
            }
        }

        // Show offline notice
        const settingsPage = document.getElementById('settingsPage');
        if (settingsPage) {
            const notice = document.createElement('div');
            notice.className = 'settings-offline-notice';
            notice.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                    <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                    <line x1="12" y1="20" x2="12.01" y2="20"></line>
                </svg>
                <span>You're offline. Some settings require an internet connection.</span>
            `;
            settingsPage.insertBefore(notice, settingsPage.firstChild);
        }
    },

    /**
     * Hide offline state - re-enable settings when back online
     */
    hideOfflineState() {
        // Remove offline notice
        const notice = document.querySelector('.settings-offline-notice');
        if (notice) {
            notice.remove();
        }

        // Show hidden sections
        const sectionsToShow = [
            'securitySection',
            'sessionsSection',
            'dangerZoneSection'
        ];

        sectionsToShow.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = '';
            }
        });

        // Show hidden items
        const itemsToShow = [
            'changePassword',
            'importData',
            'storageUsage',
            'viewTrash'
        ];

        itemsToShow.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = '';
            }
        });

        // Restore Name item to clickable
        const changeName = document.getElementById('changeName');
        if (changeName) {
            changeName.classList.add('clickable');
            changeName.style.pointerEvents = '';
            changeName.style.cursor = '';
            const arrow = changeName.querySelector('.settings-item-arrow');
            if (arrow) {
                arrow.style.display = '';
            }
        }

        // Reset status displays and reload data
        const statusIds = ['2faStatus', 'recoveryCodesStatus', 'kdfStatus', 'storageInfo'];
        statusIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = 'Loading...';
                el.style.color = '';
            }
        });

        // Reload settings from server
        this.loadSettings();
    },

    /**
     * Update settings UI with loaded values
     */
    updateSettingsUI() {
        // Session timeout
        this.setCustomSelectValue('sessionTimeoutSelect', this.settings.session_timeout || 15);

        // Theme
        this.setCustomSelectValue('themeSelect', this.settings.theme || 'system');

        // Session binding
        this.setCustomSelectValue('sessionBindingSelect', this.settings.session_binding || 'none');

        // KDF status
        const kdfStatus = document.getElementById('kdfStatus');
        if (kdfStatus && this.settings.kdf) {
            const kdf = this.settings.kdf;
            const memoryMB = Math.round(kdf.memory / 1024);
            kdfStatus.textContent = `${memoryMB}MB memory, ${kdf.iterations} iterations`;
        }
    },

    /**
     * Set custom select value programmatically
     * @param {string} selectId
     * @param {string|number} value
     */
    setCustomSelectValue(selectId, value) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const valueStr = String(value);
        const option = select.querySelector(`.custom-select-option[data-value="${valueStr}"]`);
        const valueDisplay = select.querySelector('.custom-select-value');

        if (option && valueDisplay) {
            // Update active state
            select.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');

            // Update display
            valueDisplay.textContent = option.textContent;
            select.dataset.value = valueStr;
        }
    },

    /**
     * Update session timeout setting
     * Saves to localStorage (device-specific) and server (global default)
     * @param {number} minutes
     */
    async updateSessionTimeout(minutes) {
        this.settings.session_timeout = minutes;
        App.setSessionTimeout(minutes);

        // Sync to server (global default for other devices) - skip in local/offline mode
        if (!this.isOffline()) {
            try {
                await ApiClient.updateSettings({ session_timeout: minutes });
            } catch (error) {
                console.error('Failed to sync session timeout to server:', error);
            }
        }
    },

    /**
     * Update theme setting
     * Saves to localStorage (device-specific) and server (global default)
     * @param {string} theme
     */
    async updateTheme(theme) {
        this.settings.theme = theme;
        App.setTheme(theme);

        // Sync to server (global default for other devices) - skip in local/offline mode
        if (!this.isOffline()) {
            try {
                await ApiClient.updateSettings({ theme: theme });
            } catch (error) {
                console.error('Failed to sync theme to server:', error);
            }
        }
    },

    /**
     * Update session binding setting
     * @param {string} value - 'none', 'ip', or 'full'
     */
    async updateSessionBinding(value) {
        // Session binding is a server feature - not available in local/offline mode
        if (this.isOffline()) {
            Toast.error('Session binding not available in local mode');
            return;
        }

        try {
            await ApiClient.updateSettings({ session_binding: value });
            this.settings.session_binding = value;

            if (value === 'none') {
                Toast.success('Session binding disabled');
            } else if (value === 'ip') {
                Toast.success('Sessions now bound to IP address');
            } else {
                Toast.success('Sessions now bound to IP and browser');
            }
        } catch (error) {
            Toast.error('Failed to update session binding');
            // Revert UI
            this.setCustomSelectValue('sessionBindingSelect', this.settings.session_binding || 'none');
        }
    },

    /**
     * Show change shortcut popup (Desktop app only)
     */
    showChangeShortcutPopup() {
        if (!Platform.isDesktop()) return;

        const currentShortcut = Platform.getSettings()?.shortcut || 'Ctrl+Alt+Z';
        let capturedShortcut = currentShortcut;
        let isCapturing = false;
        let keyHandler = null;

        const popup = Popup.open({
            title: 'Change Toggle Shortcut',
            body: `
                <p class="popup-description">
                    Press the key combination you want to use to show/hide KeyHive.
                </p>
                <div class="shortcut-capture-box" id="shortcutCaptureBox">
                    <span class="shortcut-display" id="shortcutDisplay">${Utils.escapeHtml(currentShortcut)}</span>
                    <span class="shortcut-hint">Click here and press keys</span>
                </div>
                <p class="settings-section-note" style="margin-top: var(--space-3);">
                    Use combinations with Ctrl, Alt, or Shift. Example: Ctrl+Alt+P
                </p>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                {
                    text: 'Save',
                    type: 'primary',
                    id: 'saveBtn',
                    onClick: async () => {
                        if (capturedShortcut === currentShortcut) {
                            return true; // No changes, just close
                        }

                        const result = await Platform.setShortcut(capturedShortcut);

                        if (result.success) {
                            // Update the hint in settings
                            const shortcutHint = document.getElementById('currentShortcut');
                            if (shortcutHint) {
                                shortcutHint.textContent = capturedShortcut;
                            }
                            Toast.success('Shortcut updated');
                            return true;
                        } else {
                            Toast.error(result.error || 'Failed to set shortcut');
                            return false;
                        }
                    }
                }
            ],
            onOpen: (api) => {
                const captureBox = api.querySelector('#shortcutCaptureBox');
                const display = api.querySelector('#shortcutDisplay');

                // Handle key capture
                keyHandler = (e) => {
                    if (!isCapturing) return;

                    e.preventDefault();
                    e.stopPropagation();

                    // Build shortcut string
                    const parts = [];
                    if (e.ctrlKey) parts.push('Ctrl');
                    if (e.altKey) parts.push('Alt');
                    if (e.shiftKey) parts.push('Shift');

                    // Get the key (ignore modifier-only presses)
                    const key = e.key;
                    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
                        // Normalize key name
                        let keyName = key.length === 1 ? key.toUpperCase() : key;

                        // Handle special keys
                        const keyMap = {
                            'ArrowUp': 'Up',
                            'ArrowDown': 'Down',
                            'ArrowLeft': 'Left',
                            'ArrowRight': 'Right',
                            ' ': 'Space',
                            'Escape': 'Esc'
                        };
                        keyName = keyMap[key] || keyName;

                        parts.push(keyName);

                        // Must have at least one modifier
                        if (parts.length >= 2) {
                            capturedShortcut = parts.join('+');
                            display.textContent = capturedShortcut;
                            captureBox.classList.remove('capturing');
                            captureBox.classList.add('captured');
                            isCapturing = false;
                        }
                    }
                };

                // Start capture on click
                captureBox.addEventListener('click', () => {
                    isCapturing = true;
                    captureBox.classList.add('capturing');
                    captureBox.classList.remove('captured');
                    display.textContent = 'Press keys...';
                });

                document.addEventListener('keydown', keyHandler);
            },
            onClose: () => {
                if (keyHandler) {
                    document.removeEventListener('keydown', keyHandler);
                }
            }
        });
    },

    /**
     * Update run on startup setting (Desktop app only)
     * @param {boolean} enabled
     */
    async updateRunOnStartup(enabled) {
        if (!Platform.isDesktop()) return;

        const toggle = document.getElementById('runOnStartupToggle');
        const result = await Platform.setRunOnStartup(enabled);

        if (result.success) {
            Toast.success(enabled ? 'KeyHive will run on startup' : 'Startup disabled');
        } else {
            Toast.error(result.error || 'Failed to update setting');
            // Revert toggle
            if (toggle) {
                toggle.checked = !enabled;
            }
        }
    },

    /**
     * Show change KDF popup
     */
    async showChangeKdfPopup() {
        const self = this;
        SettingsBase.showChangeKdfPopup({
            mode: 'cloud',
            settings: this.settings,
            onSuccess: (overlay, masterPassword, newSalt, kdf) => {
                self.settings.kdf = kdf;
                self.updateSettingsUI();
                self.showReencryptionSuccess(overlay, masterPassword, newSalt, kdf);
            }
        });
    },

    /**
     * Show re-encryption success with countdown
     * @param {HTMLElement} overlay
     * @param {string} newPassword - New master password (for regenerating recovery codes)
     * @param {string} newSalt - New salt
     * @param {Object} newKdf - New KDF parameters
     */
    showReencryptionSuccess(overlay, newPassword = null, newSalt = null, newKdf = null) {
        // Re-encryption complete - unlock UI (allow page close now)
        if (typeof UILock !== 'undefined') {
            UILock.unlock();
        }
        overlay._reencryptInProgress = false;

        // Delete existing recovery codes (they're now invalid)
        const hadRecoveryCodes = (this.settings.recovery_codes_count || 0) > 0;
        if (hadRecoveryCodes) {
            ApiClient.deleteRecoveryCodes().catch(err => console.error('Failed to delete recovery codes:', err));
            this.settings.recovery_codes_count = 0;
        }

        const content = overlay.querySelector('.reencrypt-content');
        const progressFill = overlay.querySelector('.reencrypt-progress-fill');

        if (progressFill) {
            progressFill.style.width = '100%';
            progressFill.classList.add('complete');
        }

        content.innerHTML = `
            <div class="reencrypt-icon success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <h2 class="reencrypt-title">Re-encryption Complete!</h2>
            <p class="reencrypt-message">Your vault has been re-encrypted with new encryption settings.</p>
            <button class="btn btn-primary reencrypt-ok-btn" id="reencryptOkBtn">
                Close <span class="countdown">(10)</span>
            </button>
        `;

        let countdown = 10;
        const countdownSpan = content.querySelector('.countdown');
        const okBtn = content.querySelector('#reencryptOkBtn');

        const handleClose = () => {
            SettingsBase.hideReencryptionOverlay(overlay);
            Toast.success('Encryption settings updated successfully');

            // Update recovery codes status in UI
            const recoveryStatusEl = document.getElementById('recoveryCodesStatus');
            if (recoveryStatusEl) {
                recoveryStatusEl.textContent = 'No recovery codes set up';
                recoveryStatusEl.style.color = 'var(--color-warning)';
            }

            // Prompt to regenerate recovery codes if we had them before
            if (hadRecoveryCodes && newPassword && newSalt) {
                setTimeout(() => {
                    this.showRecoveryCodesRegeneratePrompt(newPassword, newSalt, newKdf);
                }, 500);
            }
        };

        const timer = setInterval(() => {
            countdown--;
            if (countdownSpan) {
                countdownSpan.textContent = `(${countdown})`;
            }
            if (countdown <= 0) {
                clearInterval(timer);
                handleClose();
            }
        }, 1000);

        okBtn?.addEventListener('click', () => {
            clearInterval(timer);
            handleClose();
        });
    },

    /**
     * Show prompt to regenerate recovery codes after password/KDF change
     */
    showRecoveryCodesRegeneratePrompt(newPassword, newSalt, newKdf) {
        // Lock body scroll when popup opens
        document.body.classList.add('popup-open');

        const popup = document.createElement('div');
        popup.className = 'popup-overlay popup-compact active';
        popup.innerHTML = `
            <div class="popup">
                <div class="popup-header">
                    <h3>Recovery Codes Invalidated</h3>
                    <button class="popup-close" id="popupClose">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="popup-body">
                    <div class="alert alert-warning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>Your previous recovery codes are no longer valid because your encryption settings changed.</span>
                    </div>
                    <p style="margin-top: var(--space-4);">Would you like to generate new recovery codes now?</p>
                </div>
                <div class="popup-footer">
                    <button class="btn btn-secondary" id="skipRecoveryCodes">Skip for Now</button>
                    <button class="btn btn-primary" id="generateNewCodes">
                        <span class="btn-text">Generate New Codes</span>
                        <span class="btn-loading" style="display: none;">
                            <span class="spinner-inline"></span>
                            Loading...
                        </span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        let isProcessing = false;
        const closeBtn = popup.querySelector('#popupClose');
        const skipBtn = popup.querySelector('#skipRecoveryCodes');
        const generateBtn = popup.querySelector('#generateNewCodes');

        const close = () => {
            // Prevent closing while processing
            if (isProcessing) return;
            popup.classList.remove('active');
            setTimeout(() => {
                popup.remove();
                // Unlock body scroll if no other popups are open
                if (!document.querySelector('.popup-overlay.active')) {
                    document.body.classList.remove('popup-open');
                }
            }, 300);
        };

        const setLoading = (loading) => {
            isProcessing = loading;
            generateBtn.disabled = loading;
            skipBtn.disabled = loading;
            closeBtn.style.pointerEvents = loading ? 'none' : '';
            closeBtn.style.opacity = loading ? '0.3' : '';
            const text = generateBtn.querySelector('.btn-text');
            const loader = generateBtn.querySelector('.btn-loading');
            if (text) text.style.display = loading ? 'none' : 'inline';
            if (loader) loader.style.display = loading ? 'inline-flex' : 'none';
        };

        // Prevent escape key while loading
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                if (isProcessing) {
                    e.preventDefault();
                    e.stopPropagation();
                } else {
                    close();
                }
            }
        };
        document.addEventListener('keydown', escapeHandler);

        closeBtn.addEventListener('click', close);
        skipBtn.addEventListener('click', close);

        generateBtn.addEventListener('click', async () => {
            if (isProcessing) return;
            setLoading(true);

            try {
                // Generate recovery codes with the new password
                const result = await CryptoAPI.generateRecoveryCodes(newPassword, newSalt, newKdf, 8);
                const codes = result.codes;

                // Send to server (ApiClient strips plaintext, sends only hash + encrypted key)
                const response = await ApiClient.generateRecoveryCodes(codes);
                if (!response.success) {
                    Toast.error(response.message || 'Failed to save recovery codes');
                    setLoading(false);
                    return;
                }

                // Update local settings
                this.settings.recovery_codes_count = codes.length;
                const recoveryStatusEl = document.getElementById('recoveryCodesStatus');
                if (recoveryStatusEl) {
                    recoveryStatusEl.textContent = `${codes.length} codes remaining`;
                    recoveryStatusEl.style.color = '';
                }

                // Close this popup and show the codes
                document.removeEventListener('keydown', escapeHandler);
                popup.classList.remove('active');
                setTimeout(() => {
                    popup.remove();
                    this.showRecoveryCodesDisplayPopup(codes.map(c => c.code));
                }, 300);
            } catch (error) {
                console.error('Failed to generate recovery codes:', error);
                Toast.error(error.message || 'Failed to generate recovery codes');
                setLoading(false);
            }
        });
    },

    /**
     * Show change name popup (uses shared function)
     */
    showChangeNamePopup() {
        const self = this;
        SettingsBase.showChangeNamePopup({
            mode: 'cloud',
            currentName: this.getUserName(),
            currentAvatar: this.userAvatar,
            onSave: async (newName, newAvatar) => {
                const avatarChanged = newAvatar !== self.userAvatar;

                // Save to server or local depending on connectivity
                if (self.isOffline()) {
                    // Offline: save to IndexedDB only
                    if (typeof LocalDB !== 'undefined') {
                        await LocalDB.saveUserName(newName);
                        if (avatarChanged) {
                            if (newAvatar) {
                                await LocalDB.saveUserAvatar(newAvatar);
                            } else {
                                await LocalDB.deleteUserAvatar();
                            }
                        }
                    }
                } else {
                    // Online: save to server (name and avatar together if avatar changed)
                    const updateData = { name: newName };
                    if (avatarChanged) {
                        updateData.avatar = newAvatar; // null to remove, base64 string to set
                    }
                    await ApiClient.updateSettings(updateData);

                    // Cache avatar in IndexedDB for offline access
                    if (avatarChanged && typeof LocalDB !== 'undefined') {
                        if (newAvatar) {
                            await LocalDB.saveUserAvatar(newAvatar);
                        } else {
                            await LocalDB.deleteUserAvatar();
                        }
                    }
                }

                // Update App state
                if (App?.state?.user) {
                    App.state.user.name = newName;
                }

                // Update UI - name
                const nameEl = document.getElementById('userName');
                if (nameEl) {
                    nameEl.textContent = newName;
                }

                // Update avatar state and UI
                if (avatarChanged) {
                    self.userAvatar = newAvatar;

                    // Update profile icon in settings
                    const profileIcon = document.getElementById('profileIcon');
                    if (profileIcon) {
                        if (newAvatar) {
                            profileIcon.classList.add('has-avatar');
                            profileIcon.innerHTML = Utils.sanitizeImageSrc(`data:image/png;base64,${newAvatar}`) ? `<img src="data:image/png;base64,${newAvatar}" alt="Avatar" class="settings-avatar-img">` : '';
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

                // Update sidebar
                if (typeof Sidebar !== 'undefined' && Sidebar.updateUserInfo) {
                    Sidebar.updateUserInfo();
                }
            }
        });
    },

    /**
     * Show change password popup
     */
    showChangePasswordPopup() {
        const self = this;

        Popup.open({
            title: 'Change Account Password',
            body: `
                <div class="alert alert-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>Your account password is used to log in to your account. This is separate from your vault key.</span>
                </div>

                <div class="form-group">
                    <label class="form-label" for="currentAccountPassword">Current Password</label>
                    <input type="password" class="form-input" id="currentAccountPassword" placeholder="Enter current password" autocomplete="current-password">
                </div>

                <div class="form-group">
                    <label class="form-label" for="newAccountPassword">New Password</label>
                    <input type="password" class="form-input" id="newAccountPassword" placeholder="Enter new password" autocomplete="new-password">
                    <div class="password-strength" id="accountPasswordStrength"></div>
                    <div class="password-same-error" id="accountPasswordSameError"></div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="confirmAccountPassword">Confirm New Password</label>
                    <input type="password" class="form-input" id="confirmAccountPassword" placeholder="Confirm new password" autocomplete="new-password">
                    <div class="password-match" id="accountPasswordMatch"></div>
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary' },
                {
                    text: 'Change Password',
                    type: 'primary',
                    id: 'changePasswordBtn',
                    disabled: true,
                    onClick: async () => {
                        const current = document.getElementById('currentAccountPassword').value;
                        const newPass = document.getElementById('newAccountPassword').value;
                        const confirm = document.getElementById('confirmAccountPassword').value;

                        // Validation (should already be handled by button state, but double-check)
                        if (!current) {
                            Toast.error('Current password is required');
                            return false;
                        }

                        if (!newPass) {
                            Toast.error('New password is required');
                            return false;
                        }

                        if (newPass !== confirm) {
                            Toast.error('Passwords do not match');
                            return false;
                        }

                        // Check password strength (must be STRONG - score >= 3)
                        const analysis = SecurityAnalyzer.analyzeStrength(newPass);
                        if (analysis.score < 3) {
                            Toast.error('Password must be strong');
                            return false;
                        }

                        try {
                            await ApiClient.changePassword(current, newPass);
                            Toast.success('Password changed');
                            return true;
                        } catch (error) {
                            Toast.error(error.message || 'Failed to change password');
                            return false;
                        }
                    }
                }
            ],
            onOpen: (api) => {
                self.bindAccountPasswordValidationWithApi(api);
            }
        });
    },

    /**
     * Bind password validation events for change account password popup
     * @param {Object} api - Popup API object
     */
    bindAccountPasswordValidationWithApi(api) {
        const currentPasswordInput = document.getElementById('currentAccountPassword');
        const newPasswordInput = document.getElementById('newAccountPassword');
        const confirmPasswordInput = document.getElementById('confirmAccountPassword');
        const strengthContainer = document.getElementById('accountPasswordStrength');
        const matchContainer = document.getElementById('accountPasswordMatch');
        const sameErrorContainer = document.getElementById('accountPasswordSameError');

        let currentPasswordFilled = false;
        let passwordStrong = false;
        let passwordsMatch = false;
        let passwordDifferent = false;

        const updateButtonState = () => {
            const shouldEnable = currentPasswordFilled && passwordStrong && passwordsMatch && passwordDifferent;
            api.setButtonDisabled('changePasswordBtn', !shouldEnable);
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
                passwordDifferent = true; // Don't block if either is empty
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

            // Check if new password is different from current
            checkPasswordDifferent();
            updateButtonState();
            // Also update match status since new password changed
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
     * Show change master password popup
     */
    async showChangeMasterPasswordPopup() {
        const self = this;
        SettingsBase.showChangeMasterPasswordPopup({
            mode: 'cloud',
            settings: this.settings,
            onSuccess: (overlay, newPassword, newSalt, kdf) => {
                self.showReencryptionSuccess(overlay, newPassword, newSalt, kdf);
            }
        });
    },

    /**
     * Show 2FA setup popup
     */
    async showSetup2FAPopup() {
        const self = this;

        // Fetch current 2FA status
        let status = this.twoFactorStatus;
        if (!status) {
            try {
                const response = await ApiClient.get2FAStatus();
                if (response.success) {
                    status = response.data;
                    this.twoFactorStatus = status;
                }
            } catch (e) {
                Toast.error('Failed to load 2FA status');
                return;
            }
        }

        const hasEmailOTP = status?.methods?.email || false;
        const hasTOTP = status?.methods?.totp || false;
        const hasWebAuthn = status?.methods?.webauthn || false;

        Popup.open({
            title: 'Two-Factor Authentication',
            body: `
                <p class="twofa-description">
                    Add extra security to your account. When logging in, you'll need to verify your identity using one of these methods.
                </p>

                <div class="twofa-methods">
                    <div class="twofa-method">
                        <div class="twofa-method-info">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            <div class="twofa-method-text">
                                <span class="twofa-method-name">Email OTP</span>
                                <span class="twofa-method-desc">Receive a code via email</span>
                            </div>
                        </div>
                        ${hasEmailOTP
                            ? '<span class="twofa-method-status enabled">Active</span>'
                            : '<button class="btn btn-sm btn-primary" id="setupEmailOTPBtn">Set Up</button>'
                        }
                    </div>

                    <div class="twofa-method">
                        <div class="twofa-method-info">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                <line x1="12" y1="18" x2="12.01" y2="18"></line>
                            </svg>
                            <div class="twofa-method-text">
                                <span class="twofa-method-name">Authenticator App</span>
                                <span class="twofa-method-desc">Use Google Authenticator, Authy, etc.</span>
                            </div>
                        </div>
                        ${hasTOTP
                            ? '<button class="btn btn-sm btn-outline btn-danger" id="disableTOTPBtn">Disable</button>'
                            : '<button class="btn btn-sm btn-primary" id="setupTOTPBtn">Set Up</button>'
                        }
                    </div>

                    <div class="twofa-method">
                        <div class="twofa-method-info">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            <div class="twofa-method-text">
                                <span class="twofa-method-name">Security Key</span>
                                <span class="twofa-method-desc">Use a hardware key or passkey</span>
                            </div>
                        </div>
                        ${hasWebAuthn
                            ? '<button class="btn btn-sm btn-secondary" id="manageWebAuthnBtn">Manage</button>'
                            : '<button class="btn btn-sm btn-primary" id="setupWebAuthnBtn">Set Up</button>'
                        }
                    </div>
                </div>
            `,
            buttons: [
                { text: 'Close', type: 'secondary' }
            ],
            onOpen: (api) => {
                const setupEmailOTPBtn = api.querySelector('#setupEmailOTPBtn');
                const setupTOTPBtn = api.querySelector('#setupTOTPBtn');
                const disableTOTPBtn = api.querySelector('#disableTOTPBtn');
                const setupWebAuthnBtn = api.querySelector('#setupWebAuthnBtn');
                const manageWebAuthnBtn = api.querySelector('#manageWebAuthnBtn');

                if (setupEmailOTPBtn) {
                    setupEmailOTPBtn.addEventListener('click', () => {
                        api.close();
                        self.showEmailOTPSetupPopup();
                    });
                }

                if (setupTOTPBtn) {
                    setupTOTPBtn.addEventListener('click', () => {
                        api.close();
                        self.showTOTPSetupPopup();
                    });
                }

                if (disableTOTPBtn) {
                    disableTOTPBtn.addEventListener('click', () => {
                        api.close();
                        self.showDisableTOTPPopup();
                    });
                }

                if (setupWebAuthnBtn) {
                    setupWebAuthnBtn.addEventListener('click', () => {
                        api.close();
                        self.showWebAuthnSetupPopup();
                    });
                }

                if (manageWebAuthnBtn) {
                    manageWebAuthnBtn.addEventListener('click', () => {
                        api.close();
                        self.showWebAuthnManagePopup();
                    });
                }
            }
        });
    },

    /**
     * Show Email OTP setup popup
     */
    async showEmailOTPSetupPopup() {
        const self = this;

        Popup.open({
            title: 'Set Up Email OTP',
            body: `
                <div class="email-otp-setup">
                    <div class="email-otp-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                    </div>
                    <p class="email-otp-description">
                        We'll send a verification code to your email address. Enter the code to enable Email OTP.
                    </p>
                    <div class="email-otp-status" id="emailOtpStatus">
                        <button class="btn btn-primary" id="sendCodeBtn">Send Verification Code</button>
                    </div>
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary' }
            ],
            onOpen: (api) => {
                const statusDiv = api.querySelector('#emailOtpStatus');
                const sendCodeBtn = api.querySelector('#sendCodeBtn');

                sendCodeBtn.addEventListener('click', async () => {
                    sendCodeBtn.disabled = true;
                    sendCodeBtn.innerHTML = '<span class="spinner-inline"></span> Sending...';

                    try {
                        const response = await ApiClient.sendEmailOTPSetup();
                        if (response.success) {
                            // Show verification input
                            statusDiv.innerHTML = `
                                <p class="email-otp-sent">Code sent to your email</p>
                                <div class="form-group">
                                    <input type="text" id="emailOtpCode" class="form-input otp-input"
                                        placeholder="Enter 6-digit code" maxlength="6" autocomplete="one-time-code">
                                </div>
                                <button class="btn btn-primary" id="verifyCodeBtn">Verify & Enable</button>
                                <button class="btn btn-link" id="resendCodeBtn">Resend Code</button>
                            `;

                            const codeInput = statusDiv.querySelector('#emailOtpCode');
                            const verifyBtn = statusDiv.querySelector('#verifyCodeBtn');
                            const resendBtn = statusDiv.querySelector('#resendCodeBtn');

                            codeInput.focus();

                            codeInput.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') verifyBtn.click();
                            });

                            verifyBtn.addEventListener('click', async () => {
                                const code = codeInput.value.trim();
                                if (!code || code.length < 6) {
                                    Toast.error('Please enter the 6-digit code');
                                    return;
                                }

                                verifyBtn.disabled = true;
                                verifyBtn.innerHTML = '<span class="spinner-inline"></span> Verifying...';

                                try {
                                    const verifyResponse = await ApiClient.verifyEmailOTPSetup(code);
                                    if (verifyResponse.success) {
                                        Toast.success('Email OTP enabled successfully');
                                        self.twoFactorStatus = { methods: { email: true, totp: false } };
                                        api.close();
                                        self.loadSettings();
                                    } else {
                                        Toast.error(verifyResponse.message || 'Invalid code');
                                        verifyBtn.disabled = false;
                                        verifyBtn.textContent = 'Verify & Enable';
                                        codeInput.value = '';
                                        codeInput.focus();
                                    }
                                } catch (e) {
                                    Toast.error('Verification failed');
                                    verifyBtn.disabled = false;
                                    verifyBtn.textContent = 'Verify & Enable';
                                }
                            });

                            resendBtn.addEventListener('click', async () => {
                                resendBtn.disabled = true;
                                resendBtn.textContent = 'Sending...';
                                try {
                                    await ApiClient.sendEmailOTPSetup();
                                    Toast.success('Code resent');
                                    resendBtn.textContent = 'Resend Code';
                                    resendBtn.disabled = false;
                                } catch (e) {
                                    Toast.error('Failed to resend');
                                    resendBtn.textContent = 'Resend Code';
                                    resendBtn.disabled = false;
                                }
                            });
                        } else {
                            Toast.error(response.message || 'Failed to send code');
                            sendCodeBtn.disabled = false;
                            sendCodeBtn.textContent = 'Send Verification Code';
                        }
                    } catch (e) {
                        Toast.error('Failed to send verification code');
                        sendCodeBtn.disabled = false;
                        sendCodeBtn.textContent = 'Send Verification Code';
                    }
                });
            }
        });
    },

    /**
     * Show disable 2FA confirmation popup
     */
    showDisable2FAPopup() {
        const self = this;

        Popup.open({
            title: 'Disable Two-Factor Authentication',
            body: `
                <div class="alert alert-warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>This will remove all 2FA protection from your account, including any configured authenticator app.</span>
                </div>

                <div class="form-group">
                    <label class="form-label" for="disable2fa-password">Enter Account Password to Confirm</label>
                    <input type="password" id="disable2fa-password" class="form-input" placeholder="Your account password" autocomplete="off">
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary' },
                {
                    text: 'Disable 2FA',
                    type: 'danger',
                    id: 'disable2FABtn',
                    disabled: true,
                    onClick: async () => {
                        const passwordInput = document.getElementById('disable2fa-password');
                        const password = passwordInput?.value;
                        if (!password) return false;

                        try {
                            const response = await ApiClient.disable2FA(password);
                            if (response.success) {
                                Toast.success('Two-factor authentication disabled');
                                self.twoFactorStatus = { methods: { email: false, totp: false } };
                                self.loadSettings();
                                return true;
                            } else {
                                Toast.error(response.message || 'Failed to disable 2FA');
                                return false;
                            }
                        } catch (e) {
                            Toast.error('Failed to disable 2FA');
                            return false;
                        }
                    }
                }
            ],
            onOpen: (api) => {
                const passwordInput = api.querySelector('#disable2fa-password');

                passwordInput?.addEventListener('input', () => {
                    api.setButtonDisabled('disable2FABtn', passwordInput.value.length < 1);
                });
            }
        });
    },

    /**
     * Show TOTP setup popup with QR code
     * Only requires account password (TOTP secret is encrypted with account password)
     */
    async showTOTPSetupPopup() {
        const self = this;

        Popup.open({
            title: 'Set Up Authenticator App',
            body: `
                <div class="totp-master-verify">
                    <div class="totp-master-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <p class="totp-master-desc">Enter your account password to set up the authenticator app.</p>
                    <div class="form-group">
                        <label class="form-label">Account Password</label>
                        <input type="password" id="totp-account-password" class="form-input" placeholder="Your login password" autocomplete="off">
                    </div>
                </div>
            `,
            compact: false,
            buttons: [
                { text: 'Cancel', type: 'secondary' },
                {
                    text: 'Continue',
                    type: 'primary',
                    id: 'continueBtn',
                    disabled: true,
                    onClick: async () => {
                        const accountInput = document.getElementById('totp-account-password');
                        const accountPassword = accountInput?.value;
                        if (!accountPassword) return false;

                        // Go directly to QR code setup - return false to keep popup open
                        self.showTOTPQRCodePopup(self._currentTotpApi, accountPassword);
                        return false;
                    }
                }
            ],
            onOpen: (api) => {
                self._currentTotpApi = api;
                const accountInput = api.querySelector('#totp-account-password');

                accountInput?.addEventListener('input', () => {
                    api.setButtonDisabled('continueBtn', accountInput.value.length < 1);
                });

                accountInput?.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const continueBtn = api.getElement().querySelector('#continueBtn');
                        if (continueBtn && !continueBtn.disabled) {
                            continueBtn.click();
                        }
                    }
                });

                accountInput?.focus();
            }
        });
    },

    /**
     * Show TOTP QR code popup
     * @param api - Popup API object
     * @param accountPassword - User's account password for TOTP encryption
     */
    async showTOTPQRCodePopup(api, accountPassword) {
        const self = this;
        const popup = api.getElement();

        // Update button state while loading
        api.setButtonLoading('continueBtn', true);

        // Update popup to show loading
        api.setBody(`
            <div class="totp-setup-loading">
                <div class="spinner"></div>
                <p>Generating QR code...</p>
            </div>
        `);

        // Hide the footer buttons while loading
        const footer = popup.querySelector('.popup-footer');
        footer.innerHTML = '';

        try {
            const response = await ApiClient.totpSetup(accountPassword);
            if (!response.success) {
                Toast.error(response.message || 'Failed to start TOTP setup');
                api.close();
                return;
            }

            const { secret, uri } = response.data;

            api.setBody(`
                <div class="totp-setup">
                    <p class="totp-instructions">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>

                    <div class="totp-qr-container" id="totpQRCode"></div>

                    <div class="totp-secret">
                        <span class="totp-secret-label">Or enter this code manually:</span>
                        <code class="totp-secret-code">${Utils.escapeHtml(secret)}</code>
                        <button class="btn btn-sm btn-link" id="copySecretBtn">Copy</button>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="totp-verify-code">Enter the 6-digit code from your app</label>
                        <input type="text" id="totp-verify-code" class="form-input totp-code-input" placeholder="000000" maxlength="6" autocomplete="one-time-code" inputmode="numeric">
                    </div>
                </div>
            `);

            // Add footer buttons back
            footer.innerHTML = `
                <button class="btn btn-secondary" id="cancelTOTPBtn">Cancel</button>
                <button class="btn btn-primary" id="verifyTOTPBtn" disabled>Verify & Enable</button>
            `;

            // Generate QR code
            const qrContainer = popup.querySelector('#totpQRCode');
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrContainer, {
                    text: uri,
                    width: 180,
                    height: 180,
                    colorDark: '#1a1a2e',
                    colorLight: '#ffffff',
                });
            } else {
                qrContainer.innerHTML = `<p style="font-size: 12px; word-break: break-all;">${Utils.escapeHtml(uri)}</p>`;
            }

            // Bind events
            const codeInput = popup.querySelector('#totp-verify-code');
            const verifyBtn = popup.querySelector('#verifyTOTPBtn');
            const copyBtn = popup.querySelector('#copySecretBtn');
            const cancelBtn = popup.querySelector('#cancelTOTPBtn');

            codeInput?.focus();

            codeInput?.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                verifyBtn.disabled = e.target.value.length !== 6;
            });

            codeInput?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !verifyBtn.disabled) {
                    verifyBtn.click();
                }
            });

            copyBtn?.addEventListener('click', () => {
                navigator.clipboard.writeText(secret);
                Toast.success('Secret copied to clipboard');
            });

            verifyBtn?.addEventListener('click', async () => {
                const code = codeInput?.value;
                if (!code || code.length !== 6) return;

                verifyBtn.disabled = true;
                verifyBtn.innerHTML = '<span class="spinner-inline"></span> Verifying...';

                try {
                    // Pass account password for TOTP secret decryption
                    const response = await ApiClient.totpConfirm(code, accountPassword);
                    if (response.success) {
                        Toast.success('Authenticator app enabled');
                        self.twoFactorStatus.methods.totp = true;
                        api.close();
                        self.loadSettings();
                    } else {
                        Toast.error(response.message || 'Invalid code');
                        verifyBtn.disabled = false;
                        verifyBtn.textContent = 'Verify & Enable';
                        codeInput.value = '';
                        codeInput.focus();
                    }
                } catch (e) {
                    Toast.error('Verification failed');
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verify & Enable';
                }
            });

            cancelBtn?.addEventListener('click', () => api.close());

        } catch (e) {
            Toast.error('Failed to set up authenticator');
            api.close();
        }
    },

    /**
     * Show disable TOTP popup
     */
    showDisableTOTPPopup() {
        const self = this;

        Popup.open({
            title: 'Disable Authenticator App',
            body: `
                <div class="alert alert-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>You'll still have 2FA enabled via email OTP. You can set up a new authenticator app at any time.</span>
                </div>

                <div class="form-group">
                    <label class="form-label" for="disabletotp-password">Enter Vault Key to Confirm</label>
                    <input type="password" id="disabletotp-password" class="form-input" placeholder="Vault key" autocomplete="off">
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary' },
                {
                    text: 'Disable Authenticator',
                    type: 'danger',
                    id: 'disableBtn',
                    disabled: true,
                    onClick: async () => {
                        const passwordInput = document.getElementById('disabletotp-password');
                        const password = passwordInput?.value;
                        if (!password) return false;

                        try {
                            // Verify master password first
                            const isValid = await CryptoAPI.verifyMasterPassword(password);

                            if (!isValid) {
                                Toast.error('Incorrect vault key');
                                passwordInput.value = '';
                                passwordInput.focus();
                                return false;
                            }

                            const response = await ApiClient.totpDisable();
                            if (response.success) {
                                Toast.success('Authenticator app disabled');
                                self.twoFactorStatus.methods.totp = false;
                                self.loadSettings();
                                return true;
                            } else {
                                Toast.error(response.message || 'Failed to disable authenticator');
                                return false;
                            }
                        } catch (e) {
                            Toast.error('Failed to disable authenticator');
                            return false;
                        }
                    }
                }
            ],
            focusFirst: true,
            onOpen: (api) => {
                const passwordInput = api.querySelector('#disabletotp-password');

                passwordInput?.addEventListener('input', () => {
                    api.setButtonDisabled('disableBtn', passwordInput.value.length < 1);
                });

                passwordInput?.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const disableBtn = api.getElement().querySelector('#disableBtn');
                        if (disableBtn && !disableBtn.disabled) {
                            disableBtn.click();
                        }
                    }
                });
            }
        });
    },

    // ==================== WebAuthn (Security Key) Methods ====================

    /**
     * Show WebAuthn setup popup
     */
    async showWebAuthnSetupPopup() {
        const self = this;

        // Check browser support
        if (!window.PublicKeyCredential) {
            Popup.open({
                title: 'Security Key Not Supported',
                body: `
                    <div class="alert alert-warning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>Your browser does not support Security Keys (WebAuthn). Please use a modern browser like Chrome, Firefox, Safari, or Edge.</span>
                    </div>
                `,
                buttons: [
                    { text: 'Close', type: 'secondary' }
                ]
            });
            return;
        }

        Popup.open({
            title: 'Set Up Security Key',
            body: `
                <div class="webauthn-setup">
                    <div class="webauthn-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                    </div>

                    <p class="webauthn-description">
                        Use a hardware security key (like YubiKey) or your device's built-in biometric authentication (Touch ID, Face ID, Windows Hello) to secure your account.
                    </p>

                    <div class="form-group">
                        <label class="form-label" for="webauthn-name">Security Key Name</label>
                        <input type="text" id="webauthn-name" class="form-input" placeholder="e.g., YubiKey 5, Touch ID" maxlength="50">
                        <span class="form-hint">Give your key a name to identify it later</span>
                    </div>

                    <div class="webauthn-status" id="webauthnStatus">
                        <button class="btn btn-primary" id="registerKeyBtn">Register Security Key</button>
                    </div>
                </div>
            `,
            compact: false,
            buttons: [
                { text: 'Close', type: 'secondary' }
            ],
            onOpen: (api) => {
                const nameInput = api.querySelector('#webauthn-name');
                const statusDiv = api.querySelector('#webauthnStatus');

                nameInput?.focus();

                const handleRegister = async () => {
                    const registerBtn = api.querySelector('#registerKeyBtn');
                    const name = nameInput?.value.trim() || 'Security Key';

                    registerBtn.disabled = true;
                    registerBtn.innerHTML = '<span class="spinner-inline"></span> Preparing...';

                    try {
                        // Get registration options from server
                        const optionsResponse = await ApiClient.webauthnRegisterOptions();
                        if (!optionsResponse.success) {
                            throw new Error(optionsResponse.message || 'Failed to get registration options');
                        }

                        const options = optionsResponse.data;

                        // Convert base64 strings to ArrayBuffer for WebAuthn API
                        const publicKeyOptions = {
                            challenge: Utils.base64ToArrayBuffer(options.challenge),
                            rp: options.rp,
                            user: {
                                id: Utils.base64ToArrayBuffer(options.user.id),
                                name: options.user.name,
                                displayName: options.user.displayName
                            },
                            pubKeyCredParams: options.pubKeyCredParams,
                            timeout: options.timeout,
                            authenticatorSelection: options.authenticatorSelection,
                            attestation: options.attestation,
                            excludeCredentials: (options.excludeCredentials || []).map(cred => ({
                                id: Utils.base64ToArrayBuffer(cred.id),
                                type: cred.type
                            }))
                        };

                        statusDiv.innerHTML = `
                            <div class="webauthn-waiting">
                                <div class="webauthn-waiting-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                    </svg>
                                </div>
                                <p>Touch your security key or use biometric authentication...</p>
                            </div>
                        `;

                        // Create credential
                        const credential = await navigator.credentials.create({
                            publicKey: publicKeyOptions
                        });

                        statusDiv.innerHTML = '<p><span class="spinner-inline"></span> Verifying...</p>';

                        // Prepare credential for sending to server
                        const credentialForServer = {
                            id: credential.id,
                            rawId: Utils.arrayBufferToBase64(credential.rawId),
                            type: credential.type,
                            response: {
                                clientDataJSON: Utils.arrayBufferToBase64(credential.response.clientDataJSON),
                                attestationObject: Utils.arrayBufferToBase64(credential.response.attestationObject)
                            }
                        };

                        // Verify with server
                        const verifyResponse = await ApiClient.webauthnRegisterVerify(credentialForServer, name);

                        if (verifyResponse.success) {
                            Toast.success('Security key registered successfully');
                            self.twoFactorStatus.methods.webauthn = true;
                            api.close();
                            self.loadSettings();
                        } else {
                            throw new Error(verifyResponse.message || 'Failed to register security key');
                        }
                    } catch (e) {
                        console.error('WebAuthn registration error:', e);
                        let errorMsg = 'Failed to register security key';
                        if (e.name === 'NotAllowedError') {
                            errorMsg = 'Registration was cancelled or timed out';
                        } else if (e.name === 'InvalidStateError') {
                            errorMsg = 'This security key is already registered';
                        } else if (e.message) {
                            errorMsg = e.message;
                        }
                        Toast.error(errorMsg);
                        statusDiv.innerHTML = `
                            <button class="btn btn-primary" id="registerKeyBtn">Try Again</button>
                        `;
                        api.querySelector('#registerKeyBtn')?.addEventListener('click', handleRegister);
                    }
                };

                api.querySelector('#registerKeyBtn')?.addEventListener('click', handleRegister);
            }
        });
    },

    /**
     * Show WebAuthn manage popup (list/delete keys)
     */
    async showWebAuthnManagePopup() {
        const self = this;

        Popup.open({
            title: 'Manage Security Keys',
            body: `
                <div class="webauthn-manage">
                    <div class="webauthn-keys-list" id="webauthnKeysList">
                        <div class="loading-inline">
                            <span class="spinner-inline"></span> Loading...
                        </div>
                    </div>

                    <div class="webauthn-add-new">
                        <button class="btn btn-secondary" id="addNewKeyBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Another Security Key
                        </button>
                    </div>
                </div>
            `,
            compact: false,
            buttons: [
                { text: 'Close', type: 'secondary' }
            ],
            onOpen: async (api) => {
                const keysList = api.querySelector('#webauthnKeysList');
                const addNewBtn = api.querySelector('#addNewKeyBtn');

                // Load credentials
                try {
                    const response = await ApiClient.webauthnListCredentials();
                    if (response.success && response.data.credentials) {
                        const credentials = response.data.credentials;
                        if (credentials.length === 0) {
                            keysList.innerHTML = '<p class="no-keys">No security keys registered</p>';
                        } else {
                            keysList.innerHTML = credentials.map(cred => `
                                <div class="webauthn-key-item" data-id="${cred.id}">
                                    <div class="webauthn-key-info">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                        </svg>
                                        <div class="webauthn-key-details">
                                            <span class="webauthn-key-name">${Utils.escapeHtml(cred.name)}</span>
                                            <span class="webauthn-key-date">Added ${self.formatDate(cred.created_at)}${cred.last_used_at ? ` • Last used ${self.formatDate(cred.last_used_at)}` : ''}</span>
                                        </div>
                                    </div>
                                    <button class="btn btn-sm btn-outline btn-danger delete-key-btn">Remove</button>
                                </div>
                            `).join('');

                            // Bind delete handlers
                            api.getElement().querySelectorAll('.delete-key-btn').forEach(btn => {
                                btn.addEventListener('click', async (e) => {
                                    const keyItem = e.target.closest('.webauthn-key-item');
                                    const keyId = keyItem.dataset.id;
                                    const keyName = keyItem.querySelector('.webauthn-key-name').textContent;

                                    if (confirm(`Remove security key "${keyName}"? You won't be able to use it to sign in anymore.`)) {
                                        btn.disabled = true;
                                        btn.innerHTML = '<span class="spinner-inline"></span>';

                                        try {
                                            const deleteResponse = await ApiClient.webauthnDeleteCredential(keyId);
                                            if (deleteResponse.success) {
                                                keyItem.remove();
                                                Toast.success('Security key removed');

                                                // Check if any keys left
                                                const remaining = api.getElement().querySelectorAll('.webauthn-key-item').length;
                                                if (remaining === 0) {
                                                    keysList.innerHTML = '<p class="no-keys">No security keys registered</p>';
                                                    self.twoFactorStatus.methods.webauthn = false;
                                                    self.loadSettings();
                                                }
                                            } else {
                                                throw new Error(deleteResponse.message);
                                            }
                                        } catch (err) {
                                            Toast.error('Failed to remove security key');
                                            btn.disabled = false;
                                            btn.textContent = 'Remove';
                                        }
                                    }
                                });
                            });
                        }
                    }
                } catch (e) {
                    keysList.innerHTML = '<p class="error">Failed to load security keys</p>';
                }

                addNewBtn?.addEventListener('click', () => {
                    api.close();
                    self.showWebAuthnSetupPopup();
                });
            }
        });
    },

    /**
     * Format date for display
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;

        return date.toLocaleDateString();
    },

    /**
     * Show recovery codes popup
     */
    showRecoveryCodesPopup() {
        const self = this;
        const recoveryCount = this.settings.recovery_codes_count || 0;
        const hasExistingCodes = recoveryCount > 0;

        const warningMessage = hasExistingCodes
            ? `You currently have <strong>${recoveryCount} recovery code${recoveryCount !== 1 ? 's' : ''}</strong> remaining. Generating new codes will invalidate all existing codes.`
            : 'You have no recovery codes set up. Recovery codes allow you to regain access to your vault if you forget your vault key.';

        Popup.open({
            title: 'Recovery Codes',
            body: `
                <div class="alert ${hasExistingCodes ? 'alert-warning' : 'alert-info'}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${hasExistingCodes
                            ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
                            : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
                        }
                    </svg>
                    <span>${warningMessage}</span>
                </div>

                <div class="form-group">
                    <label class="form-label" for="recoveryMasterPassword">Enter Vault Key to Continue</label>
                    <input type="password" id="recoveryMasterPassword" class="form-input" placeholder="Enter your vault key" autocomplete="current-password">
                </div>

                <p class="text-muted text-sm" style="margin-top: var(--space-3);">
                    You will receive 8 one-time use recovery codes. Store them safely - they will only be shown once.
                </p>
            `,
            compact: false,
            buttons: [
                { text: 'Cancel', type: 'secondary' },
                {
                    text: 'Generate Codes',
                    type: 'primary',
                    id: 'generateBtn',
                    onClick: async () => {
                        const passwordInput = document.getElementById('recoveryMasterPassword');
                        const masterPassword = passwordInput.value;

                        if (!masterPassword) {
                            Toast.error('Please enter your vault key');
                            return false;
                        }

                        // Verify master password by deriving key and comparing with current key
                        try {
                            const saltResponse = await ApiClient.getSalt();
                            if (!saltResponse.success) {
                                Toast.error('Failed to verify password');
                                return false;
                            }

                            const { salt, kdf } = saltResponse.data;

                            // Get current verification hash from unlocked vault
                            const currentVerificationHash = await CryptoAPI.getVerificationHash();
                            if (!currentVerificationHash) {
                                Toast.error('Vault is locked. Please unlock first.');
                                return false;
                            }

                            // Derive key for verification (doesn't replace current key)
                            const derived = await CryptoAPI.deriveKeyForVerification(masterPassword, salt, kdf);

                            // Compare with current key's verification hash
                            if (derived.verificationHash !== currentVerificationHash) {
                                Toast.error('Incorrect vault key');
                                return false;
                            }

                            // Generate recovery codes
                            const result = await CryptoAPI.generateRecoveryCodes(masterPassword, salt, kdf, 8);
                            const codes = result.codes;

                            // Send to server (ApiClient strips plaintext, sends only hash + encrypted key)
                            const response = await ApiClient.generateRecoveryCodes(codes);
                            if (!response.success) {
                                Toast.error(response.message || 'Failed to save recovery codes');
                                return false;
                            }

                            // Update local settings
                            self.settings.recovery_codes_count = codes.length;
                            const recoveryStatusEl = document.getElementById('recoveryCodesStatus');
                            if (recoveryStatusEl) {
                                recoveryStatusEl.textContent = `${codes.length} codes remaining`;
                                recoveryStatusEl.style.color = '';
                            }

                            // Show the codes (this closes the current popup)
                            setTimeout(() => {
                                self.showRecoveryCodesDisplayPopup(codes.map(c => c.code));
                            }, 100);

                            return true;
                        } catch (error) {
                            console.error('Recovery code generation failed:', error);
                            Toast.error(error.message || 'Failed to generate recovery codes');
                            return false;
                        }
                    }
                }
            ]
        });
    },

    /**
     * Show recovery codes display popup (shown only once)
     */
    showRecoveryCodesDisplayPopup(codes) {
        const codesHtml = codes.map(code => `
            <div class="recovery-code-item">
                <code class="recovery-code">${Utils.escapeHtml(code)}</code>
            </div>
        `).join('');

        Popup.open({
            title: 'Save Your Recovery Codes',
            body: `
                <div class="alert alert-danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span><strong>These codes will NOT be shown again!</strong> Save them in a secure location.</span>
                </div>

                <div class="recovery-codes-grid">
                    ${codesHtml}
                </div>

                <div class="recovery-codes-actions">
                    <button class="btn btn-secondary" id="copyRecoveryCodes">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy All
                    </button>
                    <button class="btn btn-secondary" id="downloadRecoveryCodes">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                </div>
            `,
            compact: false,
            buttons: [
                {
                    text: "I've Saved My Codes",
                    type: 'primary',
                    id: 'doneBtn',
                    onClick: () => {
                        Toast.success('Recovery codes saved successfully');
                        return true;
                    }
                }
            ],
            onOpen: (api) => {
                // Copy all codes
                api.querySelector('#copyRecoveryCodes').addEventListener('click', () => {
                    const codesText = codes.map((code, i) => `${i + 1}. ${code}`).join('\n');
                    navigator.clipboard.writeText(codesText).then(() => {
                        Toast.success('Recovery codes copied to clipboard');
                    }).catch(() => {
                        Toast.error('Failed to copy codes');
                    });
                });

                // Download codes
                api.querySelector('#downloadRecoveryCodes').addEventListener('click', () => {
                    const codesText = [
                        '╔══════════════════════════════════════════════════════════════╗',
                        '║              KEYHIVE RECOVERY CODES                        ║',
                        '╠══════════════════════════════════════════════════════════════╣',
                        '║  KEEP THESE CODES IN A SECURE LOCATION                       ║',
                        '║  Each code can only be used ONCE                             ║',
                        '║  These codes are protected with military-grade encryption    ║',
                        '╚══════════════════════════════════════════════════════════════╝',
                        '',
                        'If you forget your vault key, use one of these codes',
                        'to recover access to your vault.',
                        '',
                        '───────────────────────────────────────────────────────────────',
                        '',
                        ...codes.map((code, i) => `  ${i + 1}.  ${code}`),
                        '',
                        '───────────────────────────────────────────────────────────────',
                        '',
                        `Generated: ${new Date().toLocaleString()}`,
                        '',
                        'SECURITY NOTE: These codes are encrypted with Argon2id (128MB)',
                        'and 160-bit entropy. Even with database access, brute-force',
                        'attacks are computationally infeasible.',
                    ].join('\n');

                    const blob = new Blob([codesText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'keyhive-recovery-codes.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    Toast.success('Recovery codes downloaded');
                });
            }
        });
    },

    /**
     * Show sessions popup
     */
    async showSessionsPopup() {
        const self = this;
        let popupApi = null;

        const bindRevokeButtons = () => {
            popupApi.getElement().querySelectorAll('.revoke-session-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const sessionId = btn.dataset.sessionId;
                    const sessionItem = btn.closest('.session-item');

                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner-inline"></span>';

                    try {
                        const result = await ApiClient.revokeSession(sessionId);
                        if (result.success) {
                            sessionItem.style.opacity = '0';
                            setTimeout(() => sessionItem.remove(), 300);
                            Toast.success('Session revoked');

                            // Check if list is empty
                            const remaining = popupApi.getElement().querySelectorAll('.session-item');
                            if (remaining.length === 0) {
                                popupApi.querySelector('.sessions-list').innerHTML = `
                                    <div class="sessions-empty">
                                        <p>No other active sessions.</p>
                                    </div>
                                `;
                            }
                        }
                    } catch (error) {
                        Toast.error(error.message || 'Failed to revoke session');
                        btn.disabled = false;
                        btn.textContent = 'End Session';
                    }
                });
            });
        };

        popupApi = Popup.open({
            title: 'Active Sessions',
            body: `
                <div class="sessions-loading">
                    <div class="spinner"></div>
                    <p>Loading sessions...</p>
                </div>
            `,
            compact: false,
            buttons: [
                { text: 'Close', type: 'secondary', isCancel: true, id: 'closeBtn' }
            ],
            onOpen: async (api) => {
                // Fetch sessions
                try {
                    const response = await ApiClient.getSessions();
                    if (!response.success) {
                        throw new Error(response.message || 'Failed to load sessions');
                    }

                    const sessions = response.data.sessions || [];

                    if (sessions.length === 0) {
                        api.setBody(`
                            <div class="sessions-empty">
                                <p>No active sessions found.</p>
                            </div>
                        `);
                        return;
                    }

                    api.setBody(`
                        <p class="sessions-description">These devices are currently signed in to your account.</p>
                        <div class="sessions-list" id="sessionsList">
                            ${sessions.map(session => self.renderSessionItem(session)).join('')}
                        </div>
                    `);

                    // Bind revoke buttons
                    bindRevokeButtons();

                } catch (error) {
                    api.setBody(`
                        <div class="sessions-error">
                            <p>Failed to load sessions: ${Utils.escapeHtml(error.message)}</p>
                        </div>
                    `);
                }
            }
        });
    },

    /**
     * Render a single session item
     */
    renderSessionItem(session) {
        const device = session.device || {};
        const createdAt = new Date(session.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const deviceIcon = this.getDeviceIcon(device.os);
        const deviceName = device.os || 'Unknown';
        const browserName = device.browser || 'Unknown Browser';

        return `
            <div class="session-item ${session.is_current ? 'session-current' : ''}">
                <div class="session-header">
                    <div class="session-icon">
                        ${deviceIcon}
                    </div>
                    <div class="session-device-info">
                        <div class="session-device">${Utils.escapeHtml(deviceName)}</div>
                        <div class="session-browser">${Utils.escapeHtml(browserName)}</div>
                    </div>
                    ${session.is_current ? '<span class="session-badge">This device</span>' : ''}
                </div>
                <div class="session-meta">
                    <div class="session-meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                        <span>${Utils.escapeHtml(session.ip_address || 'Unknown')}</span>
                    </div>
                    <div class="session-meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>${createdAt}</span>
                    </div>
                </div>
                ${!session.is_current ? `
                    <div class="session-actions">
                        <button class="session-revoke-btn revoke-session-btn" data-session-id="${session.id}">
                            End Session
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Get device icon based on OS
     */
    getDeviceIcon(os) {
        if (!os) {
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>`;
        }

        if (os.includes('iPhone') || os.includes('iPad') || os.includes('iOS')) {
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>`;
        }

        if (os.includes('Android')) {
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>`;
        }

        if (os.includes('Windows') || os.includes('macOS') || os.includes('Linux')) {
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>`;
        }

        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>`;
    },

    /**
     * Confirm and revoke all sessions
     */
    async confirmRevokeAllSessions() {
        const confirmed = await this.showConfirmPopup(
            'Revoke All Sessions',
            'This will sign you out from all devices. Continue?'
        );

        if (confirmed) {
            try {
                await ApiClient.revokeAllSessions();
                Toast.success('All sessions revoked');
                this.logout();
            } catch (error) {
                Toast.error('Failed to revoke sessions');
            }
        }
    },

    /**
     * Export data
     */
    exportData() {
        SettingsBase.showExportPopup();
    },

    /**
     * Import data
     */
    async importData() {
        if (typeof ImportManager !== 'undefined') {
            ImportManager.show();
        } else {
            Toast.error('Import feature not available');
        }
    },

    /**
     * Confirm and delete account
     */
    async confirmDeleteAccount() {
        Popup.open({
            title: 'Delete Account',
            body: `
                <div class="danger-warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <p>This action cannot be undone. All your data will be permanently deleted.</p>
                </div>
                <div class="form-group">
                    <label class="form-label" for="deleteMasterPassword">Vault Key</label>
                    <input type="password" class="form-input" id="deleteMasterPassword" required autocomplete="new-password" placeholder="Enter your vault key">
                </div>
                <div class="form-group">
                    <label class="form-label" for="deleteAccountPassword">Account Password</label>
                    <input type="password" class="form-input" id="deleteAccountPassword" required autocomplete="new-password" placeholder="Enter your account password">
                </div>
                <div class="form-group" style="margin-top: var(--space-2);">
                    <label class="custom-checkbox">
                        <input type="checkbox" id="deleteConfirmCheck">
                        <span class="checkmark"></span>
                        <span class="checkbox-text">I understand all my data will be permanently deleted</span>
                    </label>
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary' },
                {
                    text: 'Delete Account',
                    type: 'danger',
                    id: 'deleteBtn',
                    disabled: true,
                    onClick: async () => {
                        const masterPassword = document.getElementById('deleteMasterPassword').value;
                        const accountPassword = document.getElementById('deleteAccountPassword').value;

                        if (!masterPassword) {
                            Toast.error('Vault key required');
                            return false;
                        }

                        if (!accountPassword) {
                            Toast.error('Account password required');
                            return false;
                        }

                        // Stop sync
                        if (typeof SyncManager !== 'undefined') {
                            SyncManager.stop();
                        }

                        try {
                            // Verify master password first
                            const isValidMaster = await CryptoAPI.verifyMasterPassword(masterPassword);
                            if (!isValidMaster) {
                                Toast.error('Incorrect vault key');
                                return false;
                            }

                            // Delete account with account password
                            await ApiClient.deleteAccount(accountPassword);
                            Toast.success('Account deleted');
                            App.logout();
                            return true;
                        } catch (error) {
                            Toast.error(error.message || 'Failed to delete account');
                            return false;
                        }
                    }
                }
            ],
            onOpen: (api) => {
                // Enable delete button only when checkbox is checked
                const checkbox = api.querySelector('#deleteConfirmCheck');
                checkbox?.addEventListener('change', () => {
                    api.setButtonDisabled('deleteBtn', !checkbox.checked);
                });
            }
        });
    },

    /**
     * Logout
     */
    async logout() {
        try {
            if (typeof App !== 'undefined') {
                await App.logout();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    /**
     * Show confirm popup
     * @param {string} title
     * @param {string} message
     * @returns {Promise<boolean>}
     */
    showConfirmPopup(title, message) {
        return Popup.confirm({
            title,
            message,
            danger: true
        });
    },

    /**
     * Load settings (called when page is shown)
     */
    load() {
        this.loadSettings();
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsCloud;
}
