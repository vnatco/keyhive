/**
 * Authentication Pages Component
 * Handles all auth-related views:
 * - Login
 * - Register
 * - Unlock (master password)
 * - Setup master password
 * - 2FA verification
 */

const AuthPages = {
    currentView: 'login',
    isLoading: false,

    /**
     * Show mode selection page (Local vs Cloud)
     */
    showModeSelect() {
        this.currentView = 'mode-select';
        this.render();
    },

    /**
     * Show login page
     */
    showLogin() {
        this.currentView = 'login';
        this.render();
    },

    /**
     * Show register page
     */
    showRegister() {
        this.currentView = 'register';
        this.render();
    },

    /**
     * Show unlock page
     */
    showUnlock() {
        this.currentView = 'unlock';
        this.render();
    },

    /**
     * Show master password setup page
     */
    showSetupMaster() {
        this.currentView = 'setup-master';
        this.render();
    },

    /**
     * Show local mode master password setup page
     */
    showSetupMasterLocal() {
        this.currentView = 'setup-master-local';
        this.render();
    },

    /**
     * Show 2FA verification page
     */
    showVerify2FA() {
        this.currentView = 'verify-2fa';
        this.render();
    },

    /**
     * Show registration email verification page
     */
    showVerifyRegistrationEmail() {
        this.currentView = 'verify-registration-email';
        this.render();
    },

    /**
     * Show recovery keys page
     */
    showRecoveryKeys() {
        this.currentView = 'recovery-keys';
        this.render();
    },

    /**
     * Show subscription page
     */
    showSubscription() {
        this.currentView = 'subscription';
        this.render();
    },

    /**
     * Show forgot password page
     */
    showForgotPassword() {
        this.currentView = 'forgot-password';
        this.render();
    },

    /**
     * Show reset password page
     * @param {string} token - Reset token from URL
     */
    showResetPassword(token) {
        this.resetToken = token;
        this.currentView = 'reset-password';
        this.render();
    },

    /**
     * Render the current view
     */
    render() {
        // Hide loading
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';

        // Get or create auth container
        let container = document.getElementById('authContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'authContainer';
            const app = document.getElementById('app');
            app.appendChild(container);
        }

        container.style.display = 'block';
        container.innerHTML = this.getHTML();
        this.bindEvents();
    },

    /**
     * Hide auth pages
     */
    hide() {
        const container = document.getElementById('authContainer');
        if (container) {
            container.style.display = 'none';
        }
    },

    /**
     * Get HTML for current view
     * @returns {string}
     */
    getHTML() {
        switch (this.currentView) {
            case 'mode-select':
                return this.getModeSelectHTML();
            case 'login':
                return this.getLoginHTML();
            case 'register':
                return this.getRegisterHTML();
            case 'unlock':
                return this.getUnlockHTML();
            case 'setup-master':
                return this.getSetupMasterHTML();
            case 'setup-master-local':
                return this.getSetupMasterLocalHTML();
            case 'verify-2fa':
                return this.getVerify2FAHTML();
            case 'verify-registration-email':
                return this.getVerifyRegistrationEmailHTML();
            case 'recovery-keys':
                return this.getRecoveryKeysHTML();
            case 'forgot-password':
                return this.getForgotPasswordHTML();
            case 'reset-password':
                return this.getResetPasswordHTML();
            case 'subscription':
                return typeof SubscriptionPage !== 'undefined' ? SubscriptionPage.getHTML() : '';
            default:
                return this.getLoginHTML();
        }
    },

    /**
     * Get mode selection page HTML (Local vs Cloud)
     * @returns {string}
     */
    getModeSelectHTML() {
        return `
            <div class="auth-page">
                <div class="auth-container auth-container-wide">
                    <div class="auth-header">
                        <div class="auth-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>

                        <h1 class="auth-title">Welcome to KeyHive</h1>
                        <p class="auth-subtitle">Choose how you want to store your passwords</p>
                    </div>

                    <div class="mode-select-options">
                        <button type="button" class="mode-select-card" id="selectLocalMode">
                            <div class="mode-select-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                    <line x1="8" y1="21" x2="16" y2="21"></line>
                                    <line x1="12" y1="17" x2="12" y2="21"></line>
                                </svg>
                            </div>
                            <h3 class="mode-select-title">Local Storage</h3>
                            <p class="mode-select-desc">
                                Store passwords only on this device. No account needed.
                                Data stays private and offline.
                            </p>
                            <ul class="mode-select-features">
                                <li>No registration required</li>
                                <li>Works offline</li>
                                <li>Data never leaves your device</li>
                                <li>No cloud sync</li>
                            </ul>
                        </button>

                        <button type="button" class="mode-select-card" id="selectCloudMode">
                            <div class="mode-select-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                                </svg>
                            </div>
                            <h3 class="mode-select-title">Cloud Sync</h3>
                            <p class="mode-select-desc">
                                Sync passwords across all your devices.
                                End-to-end encrypted with zero-knowledge.
                            </p>
                            <ul class="mode-select-features">
                                <li>Access from any device</li>
                                <li>End-to-end encrypted</li>
                                <li>Two-factor authentication</li>
                                <li>${Config.TRIAL_DAYS > 0 ? `${Config.TRIAL_DAYS}-day free trial` : 'Secure cloud storage'}</li>
                            </ul>
                        </button>
                    </div>

                    <div class="auth-footer mode-select-footer">
                        <p class="mode-select-note">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-inline">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            Both options are encrypted entirely on your device.
                        </p>
                        <p class="auth-legal-links">
                            &copy; ${new Date().getFullYear()} <a href="https://keyhive.app" target="_blank" rel="noopener">KeyHive</a> v${Config.VERSION}
                            <span class="auth-legal-sep">&middot;</span>
                            <a href="https://keyhive.app/terms" target="_blank" rel="noopener">Terms</a>
                            <span class="auth-legal-sep">&middot;</span>
                            <a href="https://keyhive.app/privacy" target="_blank" rel="noopener">Privacy</a>
                        </p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get login page HTML
     * @returns {string}
     */
    getLoginHTML() {
        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <h1 class="auth-title">Welcome back</h1>
                        <p class="auth-subtitle">Sign In to your vault</p>
                    </div>

                    <form class="auth-form" id="loginForm" data-action="login">
                        <div class="form-group">
                            <label class="form-label" for="email">Email</label>
                            <input type="email" class="form-input" id="email" name="email"
                                   placeholder="you@example.com" required autofocus
                                   autocomplete="off">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="password">Password</label>
                            <div class="input-with-actions">
                                <input type="password" class="form-input" id="password" name="password"
                                       placeholder="Enter your password" required
                                       autocomplete="off">
                                <button type="button" class="input-action toggle-password">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn">
                            <span class="btn-text">Sign In</span>
                            <span class="btn-loading" style="display: none;">
                                <div class="spinner"></div>
                            </span>
                        </button>
                    </form>

                    <div class="auth-footer">
                        <p><a href="#" id="forgotPassword">Forgot Password?</a></p>
                        <p>Don't have an account? <a href="#" id="goToRegister">Create One</a></p>
                        <p class="auth-mode-switch"><a href="#" id="switchToLocal">Switch to Local Storage</a></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get register page HTML
     * @returns {string}
     */
    getRegisterHTML() {
        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <h1 class="auth-title">Create Account</h1>
                        <p class="auth-subtitle">Start securing your passwords</p>
                    </div>

                    <form class="auth-form" id="registerForm" data-action="register">
                        <div class="form-group">
                            <label class="form-label" for="name">Name</label>
                            <div class="input-with-toggle">
                                <input type="text" class="form-input" id="name" name="name"
                                       placeholder="Your name" required minlength="4" maxlength="50"
                                       pattern="[A-Za-z0-9 .\\-_]{4,50}" autofocus
                                       autocomplete="name"
                                       value="${typeof RandomNames !== 'undefined' ? RandomNames.generate() : ''}">
                                <button type="button" class="input-toggle-btn" id="regenerateRegisterName" title="Generate random name">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="1 4 1 10 7 10"></polyline>
                                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="email">Email</label>
                            <input type="email" class="form-input" id="email" name="email"
                                   placeholder="you@example.com" required
                                   autocomplete="off">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="password">Password</label>
                            <div class="input-with-actions">
                                <input type="password" class="form-input" id="password" name="password"
                                       placeholder="Create a strong password" required minlength="8"
                                       autocomplete="new-password">
                                <button type="button" class="input-action toggle-password">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                            <div class="password-strength" id="registerPasswordStrength"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="password_confirm">Confirm Password</label>
                            <input type="password" class="form-input" id="password_confirm" name="password_confirm"
                                   placeholder="Confirm your password" required
                                   autocomplete="new-password">
                            <div class="password-match" id="registerPasswordMatch"></div>
                        </div>

                        <div class="form-group">
                            <label class="custom-checkbox">
                                <input type="checkbox" id="agreeTerms">
                                <span class="checkmark"></span>
                                <span class="checkbox-text">I agree to the <a href="https://keyhive.app/terms" target="_blank" rel="noopener">Terms of Service</a> and <a href="https://keyhive.app/privacy" target="_blank" rel="noopener">Privacy Policy</a></span>
                            </label>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn" disabled>
                            <span class="btn-text">Create Account</span>
                            <span class="btn-loading" style="display: none;">
                                <div class="spinner"></div>
                            </span>
                        </button>
                    </form>

                    <div class="auth-footer">
                        <p>Already have an account? <a href="#" id="goToLogin">Sign In</a></p>
                        <p class="auth-mode-switch"><a href="#" id="switchToLocal">Switch to Local Storage</a></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get unlock page HTML
     * @returns {string}
     */
    getUnlockHTML() {
        const user = App?.state?.user || {};
        const isLocalMode = App?.state?.isLocalMode || localStorage.getItem('keyhive_mode') === 'local';

        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo locked">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <h1 class="auth-title">Unlock Vault</h1>
                        <p class="auth-subtitle">${isLocalMode ? 'Local Storage' : Utils.escapeHtml(user.email || '')}</p>
                    </div>

                    <form class="auth-form" id="unlockForm" data-action="unlock">
                        <div class="form-group">
                            <label class="form-label" for="master_password">Vault Key</label>
                            <div class="input-with-actions">
                                <input type="password" class="form-input" id="master_password" name="master_password"
                                       placeholder="Enter your vault key" required autofocus
                                       autocomplete="off">
                                <button type="button" class="input-action toggle-password">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn">
                            <span class="btn-text">Unlock</span>
                            <span class="btn-loading" style="display: none;">
                                <div class="spinner"></div>
                            </span>
                        </button>
                    </form>

                    ${typeof Biometric !== 'undefined' && Biometric.isAvailable() && Biometric.isEnabled() ? `
                    <div class="biometric-unlock-section" style="margin-top: var(--space-4); text-align: center;">
                        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: var(--space-3);">or</p>
                        <button type="button" class="btn btn-secondary btn-block btn-lg" id="biometricUnlockBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="margin-right: 8px;">
                                <path d="M12 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z"></path>
                                <path d="M18.36 5.64a9 9 0 0 1 0 12.73"></path>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                <path d="M5.64 18.36a9 9 0 0 1 0-12.73"></path>
                                <path d="M8.46 15.54a5 5 0 0 1 0-7.07"></path>
                            </svg>
                            <span class="btn-text">Unlock with Biometrics</span>
                        </button>
                    </div>
                    ` : ''}

                    <div class="auth-footer">
                        ${isLocalMode ? `
                            <p><a href="#" id="forgotMasterLocal">Forgot Password?</a></p>
                            <p class="auth-mode-switch"><a href="#" id="switchToCloud">Switch to Cloud Account</a></p>
                        ` : `
                            <p><a href="#" id="forgotMaster">Forgot Vault Key?</a></p>
                            <p><a href="#" id="logoutLink">Use Different Account</a></p>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get master password setup HTML
     * @returns {string}
     */
    getSetupMasterHTML() {
        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo setup">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                        </div>
                        <h1 class="auth-title">Create Your Vault Key <button type="button" class="vault-key-info-btn" id="vaultKeyInfoBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                        </button></h1>
                        <p class="auth-subtitle">This is NOT your login password. This key encrypts your vault so only you can read it.</p>
                    </div>

                    <div class="alert alert-info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <span>Your vault key never leaves this app. All encryption happens on your device.</span>
                    </div>

                    <form class="auth-form" id="setupMasterForm" data-action="setup-master">
                        <div class="form-group">
                            <label class="form-label" for="master_password">Vault Key</label>
                            <div class="input-with-actions">
                                <input type="password" class="form-input" id="master_password" name="master_password"
                                       placeholder="Create a strong passphrase" required minlength="8" autofocus
                                       autocomplete="new-password">
                                <button type="button" class="input-action toggle-password">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                            <div class="password-strength" id="passwordStrength"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="master_password_confirm">Confirm Vault Key</label>
                            <input type="password" class="form-input" id="master_password_confirm" name="master_password_confirm"
                                   placeholder="Re-enter your vault key" required
                                   autocomplete="new-password">
                            <div class="password-match" id="masterPasswordMatch"></div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn" disabled>
                            <span class="btn-text">Set Vault Key</span>
                            <span class="btn-loading" style="display: none;">
                                <div class="spinner"></div>
                            </span>
                        </button>
                    </form>
                </div>
            </div>
        `;
    },

    /**
     * Get local mode master password setup HTML
     * @returns {string}
     */
    getSetupMasterLocalHTML() {
        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo setup">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                        </div>
                        <h1 class="auth-title">Create Your Vault Key <button type="button" class="vault-key-info-btn" id="vaultKeyInfoBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                        </button></h1>
                        <p class="auth-subtitle">This is NOT your login password. This key encrypts your vault so only you can read it.</p>
                    </div>

                    <div class="auth-warning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <p>Your vault key cannot be recovered. If you forget it, your data will be lost forever!</p>
                    </div>

                    <form class="auth-form" id="setupMasterLocalForm" data-action="setup-master-local">
                        <div class="form-group">
                            <label class="form-label" for="master_password">Vault Key</label>
                            <div class="input-with-actions">
                                <input type="password" class="form-input" id="master_password" name="master_password"
                                       placeholder="Create a strong passphrase" required minlength="8" autofocus
                                       autocomplete="new-password">
                                <button type="button" class="input-action toggle-password">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                            <div class="password-strength" id="passwordStrength"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="master_password_confirm">Confirm Vault Key</label>
                            <input type="password" class="form-input" id="master_password_confirm" name="master_password_confirm"
                                   placeholder="Re-enter your vault key" required
                                   autocomplete="new-password">
                            <div class="password-match" id="masterPasswordMatch"></div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn" disabled>
                            <span class="btn-text">Set Vault Key</span>
                            <span class="btn-loading" style="display: none;">
                                <div class="spinner"></div>
                            </span>
                        </button>
                    </form>

                    <div class="auth-footer">
                        <p class="auth-mode-switch"><a href="#" id="backToModeSelect">Switch to Cloud Account</a></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get 2FA verification HTML
     * @returns {string}
     */
    getVerify2FAHTML() {
        const twoFA = App?.state?.twoFA || {};
        const method = twoFA.currentMethod || twoFA.method || 'email';
        const availableMethods = twoFA.availableMethods || [];
        const isEmail = method === 'email';
        const isWebAuthn = method === 'webauthn';
        const isTOTP = method === 'totp';

        // Check what other methods are available for switching
        // Email is ONLY available if user has no strong methods (TOTP/WebAuthn)
        const hasStrongMethods = availableMethods.includes('totp') || availableMethods.includes('webauthn');
        const canSwitchToTOTP = availableMethods.includes('totp') && !isTOTP;
        const canSwitchToWebAuthn = availableMethods.includes('webauthn') && !isWebAuthn;
        const canSwitchToEmail = !hasStrongMethods && !isEmail;

        let title, subtitle, icon;
        if (isEmail) {
            title = 'Check Your Email';
            subtitle = `Enter the code sent to ${Utils.escapeHtml(twoFA.emailHint) || 'your email'}`;
            icon = '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>';
        } else if (isWebAuthn) {
            title = 'Security Key';
            subtitle = 'Use your security key or biometric to verify';
            icon = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';
        } else {
            title = 'Authenticator App';
            subtitle = 'Enter the code from your authenticator app';
            icon = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>';
        }

        // Resend button for email verification
        const resendBtn = isEmail ? `
            <button type="button" class="code-resend-btn" id="resendCode" title="Resend verification code">
                <svg class="resend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                    <path d="M21 21v-5h-5"></path>
                </svg>
                <svg class="resend-ring" viewBox="0 0 36 36">
                    <circle class="resend-ring-bg" cx="18" cy="18" r="15.5" fill="none" stroke-width="3"></circle>
                    <circle class="resend-ring-progress" cx="18" cy="18" r="15.5" fill="none" stroke-width="3"></circle>
                </svg>
                <span class="resend-countdown"></span>
            </button>
        ` : '';

        // WebAuthn form (button to trigger security key)
        const webAuthnForm = `
            <div class="webauthn-prompt">
                <button type="button" class="btn btn-primary btn-block btn-lg" id="triggerWebAuthn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="margin-right: 8px;">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span class="btn-text">Use Security Key</span>
                    <span class="btn-loading" style="display: none;">
                        <div class="spinner"></div>
                    </span>
                </button>
                <p class="form-hint" style="text-align: center; margin-top: 12px;">
                    Click the button and follow your browser's prompt
                </p>
            </div>
        `;

        // Code input form (for TOTP and Email)
        const codeForm = `
            <form class="auth-form" id="verify2FAForm" data-action="verify-2fa">
                <div class="form-group">
                    <label class="form-label" for="code">Verification Code</label>
                    <div class="code-input-wrapper">
                        <input type="text" class="form-input form-input-code" id="code" name="code"
                               placeholder="000000" required maxlength="6" pattern="[0-9]{6}"
                               inputmode="numeric" autocomplete="one-time-code" autofocus
                              >
                        ${resendBtn}
                    </div>
                    ${isEmail ? '<p class="form-hint">Didn\'t receive the code? Click the refresh button to resend.</p>' : ''}
                </div>

                <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn">
                    <span class="btn-text">Verify</span>
                    <span class="btn-loading" style="display: none;">
                        <div class="spinner"></div>
                    </span>
                </button>
            </form>
        `;

        // Build method switcher links (WebAuthn prioritized first)
        let methodSwitcher = '';
        if (canSwitchToTOTP || canSwitchToWebAuthn || canSwitchToEmail) {
            const links = [];
            if (canSwitchToWebAuthn) {
                links.push('<a href="#" id="switchToWebAuthn">Use Security Key</a>');
            }
            if (canSwitchToTOTP) {
                links.push('<a href="#" id="switchToTOTP">Use Authenticator App</a>');
            }
            if (canSwitchToEmail) {
                links.push('<a href="#" id="switchToEmail">Use Email Code</a>');
            }
            methodSwitcher = links.map(link => `<p>${link}</p>`).join('');
        }

        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo verify">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                ${icon}
                            </svg>
                        </div>
                        <h1 class="auth-title">${title}</h1>
                        <p class="auth-subtitle">${subtitle}</p>
                    </div>

                    ${isWebAuthn ? webAuthnForm : codeForm}

                    <div class="trust-device-option" style="margin-top: var(--space-3); display: flex; justify-content: center;">
                        <label class="custom-checkbox custom-checkbox--on-surface">
                            <input type="checkbox" id="trustDeviceCheck">
                            <span class="checkmark"></span>
                            <span class="checkbox-text">Trust this device for 7 days</span>
                        </label>
                    </div>

                    <div class="auth-footer">
                        ${methodSwitcher}
                        <p><a href="#" id="backToLogin">Back to Login</a></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get registration email verification HTML
     * @returns {string}
     */
    getVerifyRegistrationEmailHTML() {
        const email = App?.state?.user?.email || 'your email';

        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo verify">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                        </div>
                        <h1 class="auth-title">Verify Your Email</h1>
                        <p class="auth-subtitle">Enter the verification code sent to ${Utils.escapeHtml(email)}</p>
                    </div>

                    <div class="auth-info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <p>Email verification is required to secure your account. This also enables email-based two-factor authentication.</p>
                    </div>

                    <form class="auth-form" id="verifyRegistrationEmailForm" data-action="verify-registration-email">
                        <div class="form-group">
                            <label class="form-label" for="code">Verification Code</label>
                            <div class="code-input-wrapper">
                                <input type="text" class="form-input form-input-code" id="code" name="code"
                                       placeholder="000000" required maxlength="6" pattern="[0-9]{6}"
                                       inputmode="numeric" autocomplete="one-time-code" autofocus
                                      >
                                <button type="button" class="code-resend-btn" id="resendRegistrationCode" title="Resend verification code">
                                    <svg class="resend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                        <path d="M3 3v5h5"></path>
                                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                                        <path d="M21 21v-5h-5"></path>
                                    </svg>
                                    <svg class="resend-ring" viewBox="0 0 36 36">
                                        <circle class="resend-ring-bg" cx="18" cy="18" r="15.5" fill="none" stroke-width="3"></circle>
                                        <circle class="resend-ring-progress" cx="18" cy="18" r="15.5" fill="none" stroke-width="3"></circle>
                                    </svg>
                                    <span class="resend-countdown"></span>
                                </button>
                            </div>
                            <p class="form-hint">Didn't receive the code? Click the refresh button to resend.</p>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn">
                            <span class="btn-text">Verify Email</span>
                            <span class="btn-loading" style="display: none;">
                                <div class="spinner"></div>
                            </span>
                        </button>
                    </form>

                    <div class="trust-device-option" style="margin-top: var(--space-3); display: flex; justify-content: center;">
                        <label class="custom-checkbox custom-checkbox--on-surface">
                            <input type="checkbox" id="trustDeviceCheck">
                            <span class="checkmark"></span>
                            <span class="checkbox-text">Trust this device for 7 days</span>
                        </label>
                    </div>

                    <div class="auth-footer">
                        <p><a href="#" id="logoutLink">Use a Different Email</a></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get forgot password HTML
     * @returns {string}
     */
    getForgotPasswordHTML() {
        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                        </div>
                        <h1 class="auth-title">Forgot Password</h1>
                        <p class="auth-subtitle">Enter your email to receive a reset link</p>
                    </div>

                    <form class="auth-form" id="forgotPasswordForm" data-action="forgot-password">
                        <div class="form-group">
                            <label class="form-label" for="email">Email</label>
                            <input type="email" class="form-input" id="email" name="email"
                                   placeholder="you@example.com" required autofocus
                                   autocomplete="email">
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn">
                            <span class="btn-text">Send Reset Link</span>
                            <span class="btn-loading" style="display: none;">
                                <div class="spinner"></div>
                            </span>
                        </button>
                    </form>

                    <div class="auth-footer">
                        <p><a href="#" id="backToLoginFromForgot">Back to Login</a></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get reset password HTML
     * @returns {string}
     */
    getResetPasswordHTML() {
        const resetState = this.resetState || {};
        const requires2FA = resetState.requires_2fa || false;
        const methods = resetState.methods || [];
        const hasTOTP = methods.includes('totp');

        // Show 2FA form if required and not yet verified
        if (requires2FA && !resetState.twoFAVerified) {
            return `
                <div class="auth-page">
                    <div class="auth-container">
                        <div class="auth-header">
                            <div class="auth-logo verify">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                            </div>
                            <h1 class="auth-title">Verify Your Identity</h1>
                            <p class="auth-subtitle">${hasTOTP ? 'Enter the code from your authenticator app' : 'Two-factor authentication required'}</p>
                        </div>

                        <form class="auth-form" id="reset2FAForm" data-action="reset-2fa">
                            <div class="form-group">
                                <label class="form-label" for="code">Verification Code</label>
                                <input type="text" class="form-input form-input-code" id="code" name="code"
                                       placeholder="000000" required maxlength="6" pattern="[0-9]{6}"
                                       inputmode="numeric" autocomplete="one-time-code" autofocus
                                      >
                            </div>

                            <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn">
                                <span class="btn-text">Verify</span>
                                <span class="btn-loading" style="display: none;">
                                    <div class="spinner"></div>
                                </span>
                            </button>
                        </form>

                        <div class="auth-footer">
                            <p><a href="#" id="backToLoginFromReset">Cancel and Return to Login</a></p>
                        </div>
                    </div>
                </div>
            `;
        }

        // Show new password form
        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo setup">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                            </svg>
                        </div>
                        <h1 class="auth-title">Set New Password</h1>
                        <p class="auth-subtitle">Choose a strong password for your account</p>
                    </div>

                    <form class="auth-form" id="resetPasswordForm" data-action="reset-password">
                        <div class="form-group">
                            <label class="form-label" for="new_password">New Password</label>
                            <div class="input-with-actions">
                                <input type="password" class="form-input" id="new_password" name="new_password"
                                       placeholder="Enter new password" required minlength="8" autofocus
                                       autocomplete="new-password">
                                <button type="button" class="input-action toggle-password">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                            <div class="password-strength" id="passwordStrength"></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="new_password_confirm">Confirm New Password</label>
                            <input type="password" class="form-input" id="new_password_confirm" name="new_password_confirm"
                                   placeholder="Confirm new password" required
                                   autocomplete="new-password">
                        </div>

                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="submitBtn">
                            <span class="btn-text">Reset Password</span>
                            <span class="btn-loading" style="display: none;">
                                <div class="spinner"></div>
                            </span>
                        </button>
                    </form>

                    <div class="auth-footer">
                        <p><a href="#" id="backToLoginFromReset">Cancel and Return to Login</a></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get recovery keys HTML
     * @returns {string}
     */
    getRecoveryKeysHTML() {
        return `
            <div class="auth-page">
                <div class="auth-container auth-container-wide">
                    <div class="auth-header">
                        <div class="auth-logo setup">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                            </svg>
                        </div>
                        <h1 class="auth-title">Save Your Recovery Keys</h1>
                        <p class="auth-subtitle">These keys can be used to recover your account if you lose access</p>
                    </div>

                    <div class="auth-warning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <p>Save these keys in a secure location. They will only be shown once and cannot be recovered!</p>
                    </div>

                    <div class="recovery-keys-container" id="recoveryKeysContainer">
                        <div class="recovery-keys-loading">
                            <div class="spinner"></div>
                            <p>Generating recovery keys...</p>
                        </div>
                    </div>

                    <div class="recovery-keys-actions" id="recoveryKeysActions" style="display: none;">
                        <button type="button" class="btn btn-secondary" id="copyRecoveryKeys">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy All Keys
                        </button>
                        <button type="button" class="btn btn-secondary" id="downloadRecoveryKeys">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download Keys
                        </button>
                    </div>

                    <div class="recovery-keys-confirm" id="recoveryKeysConfirm" style="display: none;">
                        <label class="custom-checkbox custom-checkbox--on-surface">
                            <input type="checkbox" id="confirmSaved">
                            <span class="checkmark"></span>
                            <span class="checkbox-text">I have saved my recovery keys in a secure location</span>
                        </label>
                        <button type="button" class="btn btn-primary btn-block btn-lg" id="continueBtn" disabled>
                            <span class="btn-text">Continue to KeyHive</span>
                            <span class="btn-loading" style="display: none;">
                                <div class="spinner"></div>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Toggle password visibility
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const input = e.target.closest('.input-with-actions').querySelector('input');
                this.togglePasswordVisibility(input, btn);
            });
        });

        // Mode selection buttons
        document.getElementById('selectLocalMode')?.addEventListener('click', async () => {
            // Set local mode
            if (typeof LocalDB !== 'undefined') {
                LocalDB.saveMode('local');
                LocalDB.setDatabase('local');
                await LocalDB.init();

                // Check if master password is already set up
                const hasAuth = await LocalDB.hasOfflineAuth();
                if (hasAuth) {
                    // Already set up - show unlock screen
                    if (typeof App !== 'undefined') {
                        App.showView('unlock');
                    }
                    return;
                }
            }
            // Not set up yet - show master password setup
            this.showSetupMasterLocal();
        });

        document.getElementById('selectCloudMode')?.addEventListener('click', () => {
            // Clear any leftover local mode state
            if (typeof App !== 'undefined') {
                App.state.isLocalMode = false;
            }
            // Set cloud mode indicator (user ID set after login)
            localStorage.setItem('keyhive_mode', 'cloud');
            this.showLogin();
        });

        // Back to mode selection
        document.getElementById('backToModeSelect')?.addEventListener('click', (e) => {
            e.preventDefault();
            // Clear any partial mode setup
            if (typeof App !== 'undefined') {
                App.state.isLocalMode = false;
            }
            if (typeof LocalDB !== 'undefined') {
                LocalDB.clearMode();
            }
            localStorage.removeItem('keyhive_mode');
            this.showModeSelect();
        });

        // Switch to local storage (from cloud login page)
        document.getElementById('switchToLocal')?.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('keyhive_mode');
            if (typeof LocalDB !== 'undefined') {
                LocalDB.clearMode();
            }
            this.showModeSelect();
        });

        // Switch to cloud account (from local unlock page)
        document.getElementById('switchToCloud')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof App !== 'undefined') {
                App.state.isLocalMode = false;
            }
            localStorage.removeItem('keyhive_mode');
            if (typeof LocalDB !== 'undefined') {
                LocalDB.clearMode();
            }
            this.showModeSelect();
        });

        // Regenerate name button on register form
        document.getElementById('regenerateRegisterName')?.addEventListener('click', () => {
            const nameInput = document.getElementById('name');
            if (nameInput && typeof RandomNames !== 'undefined') {
                nameInput.value = RandomNames.generate();
                nameInput.focus();
            }
        });

        // Navigation links
        document.getElementById('goToRegister')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (Platform.isMobile()) {
                // Mobile apps - open browser for registration (avoid in-app purchase rules)
                window.open(Config.APP_URL + '?register', '_blank');
            } else {
                this.showRegister();
            }
        });

        document.getElementById('goToLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });

        // Subscription page events
        if (this.currentView === 'subscription' && typeof SubscriptionPage !== 'undefined') {
            SubscriptionPage.bindEvents();
        }

        document.getElementById('logoutLink')?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (typeof App !== 'undefined') {
                await App.logout();
            }
        });

        // Biometric unlock button
        document.getElementById('biometricUnlockBtn')?.addEventListener('click', () => {
            this.triggerBiometricUnlock();
        });

        // Auto-trigger biometric on unlock page load
        if (this.currentView === 'unlock' && typeof Biometric !== 'undefined' && Biometric.isEnabled()) {
            // Small delay to let the UI render first
            setTimeout(() => this.triggerBiometricUnlock(), 300);
        }

        // Vault key info button
        document.getElementById('vaultKeyInfoBtn')?.addEventListener('click', () => {
            Popup.open({
                title: 'Why Two Passwords?',
                body: `<p class="popup-message">Your <strong>account password</strong> logs you into KeyHive. Your <strong>vault key</strong> encrypts your data so that even we can never read it.</p>
                       <p class="popup-message" style="margin-top: var(--space-3);">These must be different because your account password is sent to our server for authentication, but your vault key <strong>never leaves your device</strong>.</p>`,
                popupClass: 'popup-sm',
                closeOnOutsideClick: true,
                buttons: []
            });
        });

        document.getElementById('forgotMaster')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRecoveryPopup();
        });

        // Forgot master password for local mode - wipe data
        document.getElementById('forgotMasterLocal')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.showLocalWipeConfirmation();
        });

        // Forgot password link from login page
        document.getElementById('forgotPassword')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPassword();
        });

        // Back to Login from forgot password page
        document.getElementById('backToLoginFromForgot')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });

        // Back to Login from reset password page
        document.getElementById('backToLoginFromReset')?.addEventListener('click', (e) => {
            e.preventDefault();
            delete this.resetToken;
            delete this.resetState;
            this.showLogin();
        });

        // Password strength for reset password
        if (this.currentView === 'reset-password') {
            document.getElementById('new_password')?.addEventListener('input', (e) => {
                this.updatePasswordStrength(e.target.value);
            });

            // Auto-format 2FA code
            document.getElementById('code')?.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
            });
        }

        document.getElementById('resendCode')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.target.closest('.code-resend-btn');
            if (!btn) return;

            // Check if in cooldown
            if (btn.classList.contains('cooldown')) {
                return;
            }

            // Show sending state
            btn.classList.add('sending');

            try {
                await App.resendEmailOTP();
                btn.classList.remove('sending');
                // Start 30s cooldown with circular progress
                this.startResendCooldown(btn, 30);
            } catch (error) {
                btn.classList.remove('sending');
                Toast.error(error.message || 'Failed to resend code');
            }
        });

        document.getElementById('useEmailInstead')?.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await App.fallbackToEmail();
            } catch (error) {
                Toast.error(error.message || 'Failed to switch to email');
            }
        });

        // Method switching handlers
        document.getElementById('switchToTOTP')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (App?.state?.twoFA) {
                App.state.twoFA.currentMethod = 'totp';
                this.render();
            }
        });

        document.getElementById('switchToWebAuthn')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (App?.state?.twoFA) {
                App.state.twoFA.currentMethod = 'webauthn';
                this.render();
            }
        });

        document.getElementById('switchToEmail')?.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await App.fallbackToEmail();
            } catch (error) {
                Toast.error(error.message || 'Failed to switch to email');
            }
        });

        // WebAuthn trigger
        document.getElementById('triggerWebAuthn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.target.closest('button');
            if (btn) {
                btn.querySelector('.btn-text').style.display = 'none';
                btn.querySelector('.btn-loading').style.display = 'inline-flex';
            }
            try {
                await App.verifyWithWebAuthn();
            } catch (error) {
                Toast.error(error.message || 'WebAuthn verification failed');
                if (btn) {
                    btn.querySelector('.btn-text').style.display = 'inline';
                    btn.querySelector('.btn-loading').style.display = 'none';
                }
            }
        });

        document.getElementById('backToLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            // Clear 2FA state
            if (App?.state?.twoFA) {
                delete App.state.twoFA;
            }
            this.showLogin();
        });

        // Password strength and match for master password (only on setup pages, not unlock)
        if (this.currentView === 'setup-master' || this.currentView === 'setup-master-local') {
            document.getElementById('master_password')?.addEventListener('input', (e) => {
                this.updatePasswordStrength(e.target.value);
                this.updatePasswordMatch('master_password', 'master_password_confirm', 'masterPasswordMatch');
                this.updateMasterSubmitButton();
            });

            document.getElementById('master_password_confirm')?.addEventListener('input', () => {
                this.updatePasswordMatch('master_password', 'master_password_confirm', 'masterPasswordMatch');
                this.updateMasterSubmitButton();
            });
        }

        // Password strength and match for registration (only on register page)
        if (this.currentView === 'register') {
            document.getElementById('password')?.addEventListener('input', (e) => {
                this.updateRegisterPasswordStrength(e.target.value);
                this.updatePasswordMatch('password', 'password_confirm', 'registerPasswordMatch');
                this.updateRegisterSubmitButton();
            });

            document.getElementById('password_confirm')?.addEventListener('input', () => {
                this.updatePasswordMatch('password', 'password_confirm', 'registerPasswordMatch');
                this.updateRegisterSubmitButton();
            });

            document.getElementById('agreeTerms')?.addEventListener('change', () => {
                this.updateRegisterSubmitButton();
            });
        }

        // Auto-format 2FA code
        document.getElementById('code')?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
        });

        // Registration email verification with 30s cooldown and circular progress
        document.getElementById('resendRegistrationCode')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.target.closest('.code-resend-btn');
            if (!btn) return;

            // Check if in cooldown
            if (btn.classList.contains('cooldown')) {
                return;
            }

            // Show sending state
            btn.classList.add('sending');

            try {
                const response = await ApiClient.resendRegistrationEmail();
                btn.classList.remove('sending');

                if (response.success) {
                    Toast.success('Verification code sent');
                    // Start 30s cooldown with circular progress
                    this.startResendCooldown(btn, 30);
                } else {
                    Toast.error(response.message || 'Failed to send code');
                }
            } catch (error) {
                btn.classList.remove('sending');
                Toast.error(error.message || 'Failed to send code');
            }
        });

        // Recovery keys page
        if (this.currentView === 'recovery-keys') {
            this.loadRecoveryKeys();
        }

        document.getElementById('copyRecoveryKeys')?.addEventListener('click', () => {
            const keys = this.recoveryKeys;
            if (keys && keys.length) {
                const text = keys.join('\n');
                navigator.clipboard.writeText(text).then(() => {
                    Toast.success('Recovery keys copied to clipboard');
                }).catch(() => {
                    Toast.error('Failed to copy keys');
                });
            }
        });

        document.getElementById('downloadRecoveryKeys')?.addEventListener('click', () => {
            const keys = this.recoveryKeys;
            if (keys && keys.length) {
                const text = 'KeyHive Recovery Keys\n' +
                    '========================\n\n' +
                    'Keep these keys safe! Each key can only be used once.\n\n' +
                    keys.map((k, i) => `${i + 1}. ${k}`).join('\n') +
                    '\n\nGenerated: ' + DateUtils.now();

                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'keyhive-recovery-keys.txt';
                a.click();
                URL.revokeObjectURL(url);
                Toast.success('Recovery keys downloaded');
            }
        });

        document.getElementById('confirmSaved')?.addEventListener('change', (e) => {
            const continueBtn = document.getElementById('continueBtn');
            if (continueBtn) {
                continueBtn.disabled = !e.target.checked;
            }
        });

        document.getElementById('continueBtn')?.addEventListener('click', async () => {
            const btn = document.getElementById('continueBtn');
            const btnText = btn.querySelector('.btn-text');
            const btnLoading = btn.querySelector('.btn-loading');

            btn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = '';

            try {
                // First, save recovery codes via existing API
                if (!this.recoveryCodesData || this.recoveryCodesData.length === 0) {
                    Toast.error('Recovery codes not found. Please try again.');
                    btn.disabled = false;
                    btnText.style.display = '';
                    btnLoading.style.display = 'none';
                    return;
                }

                // Save codes via API (ApiClient strips plaintext, sends only hash + encrypted key)
                const saveResponse = await ApiClient.generateRecoveryCodes(this.recoveryCodesData);
                if (!saveResponse.success) {
                    Toast.error(saveResponse.message || 'Failed to save recovery codes');
                    btn.disabled = false;
                    btnText.style.display = '';
                    btnLoading.style.display = 'none';
                    return;
                }

                // Now confirm registration complete
                const response = await ApiClient.confirmRecoveryKeys();
                if (response.success) {
                    // Unlock UI - user confirmed saving keys
                    if (typeof UILock !== 'undefined') {
                        UILock.unlock();
                    }

                    // Clear pending codes from state
                    delete App.state.pendingRecoveryCodes;
                    delete App.state.pendingRecoveryMeta;

                    Toast.success('Registration complete!');

                    // Key is derived (user just set up master password) - go directly to vault
                    App.state.isUnlocked = true;

                    // Initialize LocalDB before creating vault
                    if (typeof LocalDB !== 'undefined' && App.state.user?.id) {
                        LocalDB.setDatabase('cloud', App.state.user.id);
                        LocalDB.saveMode('cloud', App.state.user.id);
                        await LocalDB.init();
                    }

                    // Create default vault named after user
                    const userName = App.state.user?.name || 'Personal';
                    await Vault.createVault(userName + "'s Vault");

                    // Initialize session timeout
                    App.initSessionTimeout();

                    // Go to vault
                    App.showView('vault');

                    // Check if user needs 2FA setup prompt (after small delay for UI to render)
                    setTimeout(() => App.check2FASetupPrompt(), 500);
                } else {
                    Toast.error(response.message || 'Failed to complete registration');
                    btn.disabled = false;
                    btnText.style.display = '';
                    btnLoading.style.display = 'none';
                }
            } catch (error) {
                Toast.error(error.message || 'Failed to complete registration');
                btn.disabled = false;
                btnText.style.display = '';
                btnLoading.style.display = 'none';
            }
        });
    },

    /**
     * Load recovery keys from API
     */
    async loadRecoveryKeys() {
        const container = document.getElementById('recoveryKeysContainer');
        const actions = document.getElementById('recoveryKeysActions');
        const confirm = document.getElementById('recoveryKeysConfirm');

        // Get pre-generated codes from App state (generated in handleSetupMaster)
        const pendingCodes = App?.state?.pendingRecoveryCodes;

        if (pendingCodes && pendingCodes.length > 0) {
            this.displayRecoveryCodes(pendingCodes, container, actions, confirm);
        } else {
            // Codes not in state - user refreshed the page or logged in from new browser
            // We CANNOT generate recovery codes without the master password
            // Reset registration back to master_password step
            container.innerHTML = `
                <div class="recovery-keys-reset">
                    <div class="reset-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <p class="reset-message">Your session was interrupted. Recovery codes cannot be generated without your vault key.</p>
                    <p class="reset-submessage">You need to set up your vault key again.</p>
                    <div class="spinner" style="margin: var(--space-4) auto;"></div>
                </div>
            `;

            // Call reset API and redirect to master password setup
            try {
                const response = await ApiClient.resetRegistrationToMaster();
                if (response.success) {
                    Toast.info('Please set up your vault key again');
                    App.showView('setup-master');
                } else {
                    container.innerHTML = `
                        <div class="recovery-keys-error">
                            <p>${Utils.escapeHtml(response.message || 'Failed to reset registration')}</p>
                            <button class="btn btn-primary" id="recoveryRetryBtn">Try Again</button>
                        </div>
                    `;
                    document.getElementById('recoveryRetryBtn')?.addEventListener('click', () => location.reload());
                }
            } catch (error) {
                container.innerHTML = `
                    <div class="recovery-keys-error">
                        <p>${Utils.escapeHtml(error.message || 'Failed to reset registration')}</p>
                        <button class="btn btn-primary" id="recoveryRetryBtn">Try Again</button>
                    </div>
                `;
                document.getElementById('recoveryRetryBtn')?.addEventListener('click', () => location.reload());
            }
        }
    },

    /**
     * Display recovery codes
     */
    displayRecoveryCodes(codes, container, actions, confirm) {
        // Display codes (only showing the code part, not encrypted_key)
        this.recoveryKeys = codes.map(c => c.code);
        this.recoveryCodesData = codes; // Keep full data for saving

        container.innerHTML = `
            <div class="recovery-keys-grid">
                ${this.recoveryKeys.map((key, i) => `
                    <div class="recovery-key-item">
                        <span class="recovery-key-num">${i + 1}</span>
                        <code class="recovery-key-code">${Utils.escapeHtml(key)}</code>
                    </div>
                `).join('')}
            </div>
        `;
        actions.style.display = '';
        confirm.style.display = '';

        // Lock UI - prevent user from leaving without saving keys
        if (typeof UILock !== 'undefined') {
            UILock.lock('Your recovery codes have not been saved! If you leave now, you will need to set up your vault key again.');
        }
    },

    /**
     * Trigger biometric unlock flow
     * Authenticates with biometrics, retrieves stored password, and unlocks vault
     */
    async triggerBiometricUnlock() {
        if (typeof Biometric === 'undefined' || !Biometric.isEnabled()) return;

        const password = await Biometric.authenticate();
        if (!password) return; // cancelled or failed — user types manually

        // Use the same unlock flow as the form
        if (typeof App !== 'undefined' && App.handleUnlock) {
            try {
                this.setLoading(true);
                await App.handleUnlock({ master_password: password });
            } catch (error) {
                this.setLoading(false);
                Toast.error(error.message || 'Unlock failed');
            }
        }
    },

    /**
     * Toggle password visibility
     * @param {HTMLInputElement} input
     * @param {HTMLButtonElement} btn
     */
    togglePasswordVisibility(input, btn) {
        if (!input || !btn) return;

        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
            `;
        } else {
            input.type = 'password';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            `;
        }
    },

    /**
     * Update password strength indicator using global SecurityAnalyzer
     * @param {string} password
     */
    updatePasswordStrength(password) {
        SecurityAnalyzer.renderStrengthBar('#passwordStrength', password);
    },

    /**
     * Update password strength indicator for registration form
     * @param {string} password
     */
    updateRegisterPasswordStrength(password) {
        SecurityAnalyzer.renderStrengthBar('#registerPasswordStrength', password);
    },

    /**
     * Update password match indicator
     * @param {string} passwordId - ID of password input
     * @param {string} confirmId - ID of confirm password input
     * @param {string} containerId - ID of match indicator container
     */
    updatePasswordMatch(passwordId, confirmId, containerId) {
        const passwordInput = document.getElementById(passwordId);
        const confirmInput = document.getElementById(confirmId);
        const container = document.getElementById(containerId);

        if (!container || !passwordInput || !confirmInput) return;

        const password = passwordInput.value;
        const confirm = confirmInput.value;

        if (!confirm) {
            container.innerHTML = '';
            return;
        }

        if (password === confirm) {
            container.innerHTML = `
                <span class="password-match-label" style="color: var(--color-success);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Passwords match
                </span>
            `;
        } else {
            container.innerHTML = `
                <span class="password-match-label" style="color: var(--color-danger);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Passwords do not match
                </span>
            `;
        }
    },

    /**
     * Update master password submit button state
     */
    updateMasterSubmitButton() {
        const submitBtn = document.getElementById('submitBtn');
        const passwordInput = document.getElementById('master_password');
        const confirmInput = document.getElementById('master_password_confirm');

        if (!submitBtn || !passwordInput) return;

        const password = passwordInput.value;
        const confirm = confirmInput?.value || '';

        // Check password strength (must be STRONG - score >= 3)
        const analysis = SecurityAnalyzer.analyzeStrength(password);
        const isStrong = analysis.score >= 3;

        // Check passwords match
        const doMatch = password === confirm;

        // Enable button only if password is strong and passwords match
        submitBtn.disabled = !(password && isStrong && doMatch);
    },

    /**
     * Update register submit button state
     */
    updateRegisterSubmitButton() {
        const submitBtn = document.getElementById('submitBtn');
        const passwordInput = document.getElementById('password');
        const confirmInput = document.getElementById('password_confirm');
        const agreeCheckbox = document.getElementById('agreeTerms');

        if (!submitBtn || !passwordInput) return;

        const password = passwordInput.value;
        const confirm = confirmInput?.value || '';

        // Check password strength (must be STRONG - score >= 3)
        const analysis = SecurityAnalyzer.analyzeStrength(password);
        const isStrong = analysis.score >= 3;

        // Check passwords match
        const doMatch = password === confirm;

        // Check terms agreement
        const agreed = agreeCheckbox?.checked || false;

        // Enable button only if password is strong, passwords match, and terms agreed
        submitBtn.disabled = !(password && isStrong && doMatch && agreed);
    },

    /**
     * Start resend cooldown with circular progress
     * @param {HTMLElement} btn - The resend button
     * @param {number} duration - Cooldown duration in seconds
     */
    startResendCooldown(btn, duration) {
        const countdown = btn.querySelector('.resend-countdown');
        const progress = btn.querySelector('.resend-ring-progress');

        btn.classList.add('cooldown');
        let seconds = duration;

        // Calculate circle circumference (2 * PI * r)
        const circumference = 2 * Math.PI * 15.5;
        progress.style.strokeDasharray = circumference;

        const updateProgress = () => {
            const percent = seconds / duration;
            progress.style.strokeDashoffset = circumference * (1 - percent);
            countdown.textContent = seconds;
        };

        updateProgress();

        const interval = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(interval);
                btn.classList.remove('cooldown');
                countdown.textContent = '';
            } else {
                updateProgress();
            }
        }, 1000);
    },

    /**
     * Set loading state
     * @param {boolean} loading
     */
    setLoading(loading) {
        this.isLoading = loading;
        const btn = document.getElementById('submitBtn');
        if (btn) {
            const text = btn.querySelector('.btn-text');
            const loader = btn.querySelector('.btn-loading');
            if (loading) {
                btn.disabled = true;
                if (text) text.style.display = 'none';
                if (loader) loader.style.display = 'flex';
            } else {
                btn.disabled = false;
                if (text) text.style.display = 'inline';
                if (loader) loader.style.display = 'none';
            }
        }
    },

    /**
     * Show master password recovery popup
     * Called when user clicks "Forgot Master Password?" on the unlock screen
     */
    async showRecoveryPopup() {
        const self = this;
        let popupApi = null;

        popupApi = Popup.open({
            title: 'Recover Your Vault',
            body: `
                <div class="alert alert-warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>Enter one of your recovery codes to regain access to your vault.</span>
                </div>

                <p class="text-muted text-sm" style="margin-bottom: var(--space-3);">
                    If you don't have recovery codes, your data cannot be recovered. Each recovery code can only be used once.
                </p>

                <div class="form-group">
                    <label class="form-label" for="recoveryCodeInput">Recovery Code</label>
                    <input type="text" id="recoveryCodeInput" class="form-input recovery-code-input"
                           placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                           autocomplete="off" autocapitalize="characters" spellcheck="false">
                    <p class="form-hint">Enter your 32-character recovery code (dashes are optional)</p>
                </div>

                <div id="recoveryError" class="alert alert-danger" style="display: none; margin-top: var(--space-3);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <span id="recoveryErrorText"></span>
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                {
                    text: 'Recover',
                    type: 'primary',
                    id: 'recoverBtn',
                    onClick: async () => {
                        const codeInput = popupApi.querySelector('#recoveryCodeInput');
                        // Keep the dashes - they're part of the code format used for hashing and encryption
                        const recoveryCode = codeInput.value.toUpperCase().trim();
                        // Check length: 32 chars + 7 dashes = 39 total
                        const codeWithoutDashes = recoveryCode.replace(/[\s\-]/g, '');

                        if (codeWithoutDashes.length !== 32) {
                            popupApi.querySelector('#recoveryError').style.display = 'flex';
                            popupApi.querySelector('#recoveryErrorText').textContent = 'Please enter a valid 32-character recovery code';
                            return false;
                        }

                        popupApi.querySelector('#recoveryError').style.display = 'none';

                        try {
                            // Hash recovery code client-side (zero-knowledge: server never sees plaintext)
                            const recoveryCodeHash = await CryptoAPI.hashRecoveryCode(recoveryCode);

                            // Call API with hash to get encrypted master key
                            const response = await ApiClient.recover(recoveryCodeHash);

                            if (!response.success) {
                                throw new Error(response.message || 'Invalid recovery code');
                            }

                            const { encrypted_master_key, salt, kdf } = response.data;

                            // Decrypt master key using recovery code
                            const result = await CryptoAPI.recoverWithCode(recoveryCode, encrypted_master_key);

                            if (!result.success) {
                                throw new Error('Failed to decrypt vault');
                            }

                            // Initialize LocalDB for cloud user
                            if (typeof LocalDB !== 'undefined' && App.state.user?.id) {
                                LocalDB.setDatabase('cloud', App.state.user.id);
                                LocalDB.saveMode('cloud', App.state.user.id);
                                await LocalDB.init();
                                await LocalDB.saveOfflineAuth(salt, kdf);
                            }

                            // Initialize vault (this syncs data from server and decrypts)
                            await Vault.init();

                            // Mark as unlocked
                            App.state.isUnlocked = true;

                            // Load and apply user settings
                            App.loadUserSettings();

                            // Show success message
                            Toast.success('Recovery successful! Please set a new vault key.');

                            // Set flag to force password change, then navigate to vault
                            App.state.forcePasswordChange = true;
                            App.showView('vault');

                            // Show change password popup using existing SettingsBase
                            setTimeout(() => {
                                self.showForceChangePasswordPopup(kdf);
                            }, 500);

                            return true;

                        } catch (error) {
                            console.error('Recovery failed:', error);
                            popupApi.querySelector('#recoveryError').style.display = 'flex';
                            popupApi.querySelector('#recoveryErrorText').textContent = error.message || 'Recovery failed. Please try again.';
                            return false;
                        }
                    }
                }
            ],
            onOpen: (api) => {
                const codeInput = api.querySelector('#recoveryCodeInput');

                // Input formatting - auto-add dashes as user types
                codeInput.addEventListener('input', (e) => {
                    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    // Add dashes every 4 characters
                    const parts = [];
                    for (let i = 0; i < value.length && i < 32; i += 4) {
                        parts.push(value.substring(i, i + 4));
                    }
                    e.target.value = parts.join('-');

                    // Hide error when user types
                    api.querySelector('#recoveryError').style.display = 'none';
                });

                // Focus input
                codeInput.focus();

                // Allow Enter key to submit
                codeInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        api.getElement().querySelector('#recoverBtn')?.click();
                    }
                });
            }
        });
    },

    /**
     * Show forced change password popup after recovery
     * This popup CANNOT be closed - user MUST set a new password
     * Uses existing SettingsBase.performReEncryption for the actual work
     * @param {Object} kdf - Current KDF params
     */
    async showForceChangePasswordPopup(kdf) {
        const self = this;
        let popupApi = null;

        // Check for encrypted files (same logic as settings page)
        let fileWarningHtml = '';
        const fileItems = typeof Vault !== 'undefined' && Vault.getFileItems ? await Vault.getFileItems() || [] : [];
        if (fileItems.length > 0) {
            let totalSize = 0;
            for (const item of fileItems) {
                totalSize += item.data?.file_size || item.data?.size || item.file_size || 0;
            }
            fileWarningHtml = `
                <div class="alert alert-danger" style="margin-top: var(--space-3);">
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

        popupApi = Popup.open({
            title: 'Set New Vault Key',
            body: `
                <div class="alert alert-warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span><strong>MANDATORY:</strong> You recovered your vault using a recovery code. You must set a new vault key to continue. All your data will be re-encrypted.</span>
                </div>

                <div class="form-group">
                    <label class="form-label" for="newMasterPassword">New Vault Key</label>
                    <input type="password" id="newMasterPassword" class="form-input" placeholder="Enter new vault key" autocomplete="new-password">
                    <div class="password-strength" id="newPasswordStrength"></div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="confirmMasterPassword">Confirm New Vault Key</label>
                    <input type="password" id="confirmMasterPassword" class="form-input" placeholder="Confirm new vault key" autocomplete="new-password">
                    <div class="password-match" id="passwordMatch"></div>
                </div>
                ${fileWarningHtml}
            `,
            closable: false,
            closeOnEscape: false,
            closeOnOutsideClick: false,
            buttons: [
                {
                    text: 'Set Vault Key & Re-encrypt',
                    type: 'primary',
                    id: 'setPasswordBtn',
                    disabled: true,
                    onClick: async () => {
                        const newPassword = popupApi.querySelector('#newMasterPassword').value;
                        const confirmPassword = popupApi.querySelector('#confirmMasterPassword').value;

                        if (!newPassword || newPassword !== confirmPassword) {
                            Toast.error('Please fill in both password fields correctly');
                            return false;
                        }

                        const analysis = SecurityAnalyzer.analyzeStrength(newPassword);
                        if (analysis.score < 3) {
                            Toast.error('Password must be strong');
                            return false;
                        }

                        try {
                            // Use existing re-encryption flow from SettingsBase
                            const result = await SettingsBase.performReEncryption(newPassword, kdf, {
                                mode: 'cloud',
                                currentPassword: newPassword,
                                onSuccess: (reencryptOverlay, newSalt, kdfParams) => {
                                    // Force close the popup
                                    popupApi.forceClose();

                                    // Hide re-encryption overlay
                                    SettingsBase.hideReencryptionOverlay(reencryptOverlay);

                                    Toast.success('Vault key set successfully!');
                                    App.state.forcePasswordChange = false;

                                    // Prompt to regenerate recovery codes
                                    setTimeout(() => {
                                        self.showRegenerateRecoveryCodesPrompt();
                                    }, 500);
                                }
                            });

                            if (!result) {
                                throw new Error('Re-encryption failed');
                            }

                            return false; // Don't close via normal flow, onSuccess handles it

                        } catch (error) {
                            console.error('Failed to set new password:', error);
                            Toast.error(error.message || 'Failed to set new password. Please try again.');
                            return false;
                        }
                    }
                }
            ],
            onOpen: (api) => {
                const newPasswordInput = api.querySelector('#newMasterPassword');
                const confirmPasswordInput = api.querySelector('#confirmMasterPassword');

                // Password validation
                const updateValidation = () => {
                    const password = newPasswordInput.value;
                    const confirm = confirmPasswordInput.value;
                    const strengthContainer = api.querySelector('#newPasswordStrength');
                    const matchContainer = api.querySelector('#passwordMatch');

                    // Strength indicator
                    if (password) {
                        const analysis = SecurityAnalyzer.analyzeStrength(password);
                        let color;
                        switch (analysis.score) {
                            case 0: case 1: color = 'var(--color-danger)'; break;
                            case 2: color = 'var(--color-warning)'; break;
                            default: color = 'var(--color-success)';
                        }
                        strengthContainer.innerHTML = `
                            <div class="strength-bar">
                                <div class="strength-fill" style="width: ${(analysis.score / 4) * 100}%; background: ${color};"></div>
                            </div>
                            <span class="strength-label" style="color: ${color};">${analysis.label}</span>
                        `;

                        // Match indicator
                        if (confirm) {
                            if (password === confirm) {
                                matchContainer.innerHTML = `<span style="color: var(--color-success); font-size: var(--font-size-xs);">✓ Passwords match</span>`;
                            } else {
                                matchContainer.innerHTML = `<span style="color: var(--color-danger); font-size: var(--font-size-xs);">✗ Passwords do not match</span>`;
                            }
                        } else {
                            matchContainer.innerHTML = '';
                        }

                        // Enable button only if strong password and matches
                        api.setButtonDisabled('setPasswordBtn', !(analysis.score >= 3 && password === confirm));
                    } else {
                        strengthContainer.innerHTML = '';
                        matchContainer.innerHTML = '';
                        api.setButtonDisabled('setPasswordBtn', true);
                    }
                };

                newPasswordInput.addEventListener('input', updateValidation);
                confirmPasswordInput.addEventListener('input', updateValidation);

                // Focus input
                newPasswordInput.focus();
            }
        });
    },

    /**
     * Show prompt to regenerate recovery codes after recovery
     */
    async showRegenerateRecoveryCodesPrompt() {
        return new Promise((resolve) => {
            Popup.open({
                title: 'Regenerate Recovery Codes?',
                body: `
                    <div class="alert alert-warning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>We strongly recommend generating new recovery codes. The code you just used is no longer valid.</span>
                    </div>
                    <p class="text-muted text-sm">
                        Your remaining recovery codes may still work, but for best security, you should generate new codes with your new vault key.
                    </p>
                `,
                buttons: [
                    {
                        text: 'Skip for Now',
                        type: 'secondary',
                        onClick: () => {
                            Toast.info('You can generate new recovery codes in Settings > Security');
                        }
                    },
                    {
                        text: 'Regenerate Codes',
                        type: 'primary',
                        onClick: () => {
                            // Navigate to settings and trigger recovery codes popup
                            setTimeout(() => {
                                App.showView('settings');
                                // The settings page will load, then we can trigger the recovery codes popup
                                setTimeout(() => {
                                    if (typeof SettingsCloud !== 'undefined' && SettingsCloud.showRecoveryCodesPopup) {
                                        SettingsCloud.showRecoveryCodesPopup();
                                    }
                                }, 500);
                            }, 100);
                        }
                    }
                ],
                onClose: () => resolve()
            });
        });
    },

    /**
     * Show local data wipe confirmation popup
     */
    async showLocalWipeConfirmation() {
        const confirmed = await Popup.confirmWithCheckbox({
            title: 'Forgot Vault Key?',
            message: `
                <p>If you forgot your vault key, the <strong>only option</strong> is to wipe all local data and start over with a new vault key.</p>
                <p><strong>ALL OF YOUR DATA WILL BE DELETED FOREVER.</strong></p>
                <div class="alert alert-danger" style="margin-top: var(--space-3); margin-bottom: 0;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <div>
                        Your passwords, notes, and all other stored items will be <strong>permanently erased</strong>.
                    </div>
                </div>
            `,
            checkboxLabel: 'I understand that all my data will be permanently deleted',
            confirmText: 'Wipe All Data',
            cancelText: 'Cancel',
            danger: true
        });

        if (confirmed) {
            try {
                // Delete the IndexedDB database
                if (typeof LocalDB !== 'undefined') {
                    await LocalDB.deleteDatabase();
                }
                // Clear local storage
                localStorage.removeItem('keyhive_mode');
                localStorage.removeItem('keyhive_has_local_data');
                // Clear session storage
                sessionStorage.clear();

                Toast.success('All data has been wiped');

                // Show local setup page to create new master password
                this.showSetupMasterLocal();
            } catch (error) {
                console.error('Failed to wipe data:', error);
                Toast.error('Failed to wipe data. Please try again.');
            }
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthPages;
}
