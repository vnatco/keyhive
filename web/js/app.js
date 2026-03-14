/**
 * KeyHive - Main Application Entry Point
 */

/**
 * UILock - Prevents user from leaving page during critical operations
 * Used for re-encryption, recovery key display, etc.
 */
const UILock = {
    _handlers: null,
    _isLocked: false,

    /**
     * Lock the UI to prevent navigation
     * @param {string} message - Warning message to show if user tries to leave
     */
    lock(message = 'You have unsaved changes. Are you sure you want to leave?') {
        if (this._isLocked) return;

        const beforeUnloadHandler = (e) => {
            e.preventDefault();
            e.returnValue = message;
            return e.returnValue;
        };

        const keydownHandler = (e) => {
            // Block F5, Ctrl+R, Ctrl+W, Ctrl+F4, Alt+F4 (refresh/close shortcuts)
            if (e.key === 'F5' ||
                (e.ctrlKey && (e.key === 'r' || e.key === 'R')) ||
                (e.ctrlKey && (e.key === 'w' || e.key === 'W')) ||
                (e.ctrlKey && e.key === 'F4') ||
                (e.altKey && e.key === 'F4')) {
                e.preventDefault();
                e.stopPropagation();
                Toast.warning('Please save your recovery keys before leaving.');
                return false;
            }
        };

        const contextMenuHandler = (e) => {
            e.preventDefault();
            return false;
        };

        window.addEventListener('beforeunload', beforeUnloadHandler);
        document.addEventListener('keydown', keydownHandler, true);
        document.addEventListener('contextmenu', contextMenuHandler, true);

        this._handlers = {
            beforeUnload: beforeUnloadHandler,
            keydown: keydownHandler,
            contextMenu: contextMenuHandler
        };
        this._isLocked = true;
    },

    /**
     * Unlock the UI
     */
    unlock() {
        if (!this._isLocked || !this._handlers) return;

        window.removeEventListener('beforeunload', this._handlers.beforeUnload);
        document.removeEventListener('keydown', this._handlers.keydown, true);
        document.removeEventListener('contextmenu', this._handlers.contextMenu, true);

        this._handlers = null;
        this._isLocked = false;
    },

    /**
     * Check if UI is locked
     */
    isLocked() {
        return this._isLocked;
    }
};

const App = {
    // Application state
    state: {
        isAuthenticated: false,
        isUnlocked: false,
        user: null,
        currentView: 'login',
        uiInitialized: false,
        generatorInitialized: false,
        securityInitialized: false,
        settingsInitialized: false,
        // Sync state
        isSyncing: false,
        lastSyncTime: null,
        syncInterval: null,
        // Vault lock - blocks ALL sync/refresh operations (re-encryption, import, etc.)
        isLocked: false,
        lockReason: null,
        // Subscription state
        subscription: null,
    },

    // ===========================================
    // Centralized Lock Mechanism
    // ===========================================

    /**
     * Lock the vault for critical operations (re-encryption, import, etc.)
     * Blocks all sync/refresh operations while locked.
     * @param {string} reason - Lock reason ('reencryption', 'import', etc.)
     */
    lock(reason = 'operation') {
        this.state.isLocked = true;
        this.state.lockReason = reason;
        this.stopPeriodicSync();
        console.log(`[App] Vault locked for: ${reason}`);
    },

    /**
     * Unlock the vault after critical operation completes
     */
    unlock() {
        this.state.isLocked = false;
        this.state.lockReason = null;
        this.startPeriodicSync();
        console.log('[App] Vault unlocked');
    },

    /**
     * Check if vault is locked for critical operations
     * @returns {boolean}
     */
    isLocked() {
        return this.state.isLocked === true;
    },

    /**
     * Get the current lock reason
     * @returns {string|null}
     */
    getLockReason() {
        return this.state.lockReason;
    },

    // Sync configuration
    SYNC_INTERVAL_MS: 30000, // 30 seconds

    /**
     * Apply theme to the document
     * @param {string} theme - 'dark', 'light', 'midnight', or 'system'
     */
    applyTheme(theme) {
        // 'system' defaults to light theme
        const effectiveTheme = theme === 'system' ? 'light' : theme;
        document.documentElement.setAttribute('data-theme', effectiveTheme);
    },

    /**
     * Set theme - saves to localStorage, applies to DOM, shows toast
     * @param {string} theme - 'dark', 'light', 'midnight', or 'system'
     * @param {boolean} showToast - Whether to show success toast
     */
    setTheme(theme, showToast = true) {
        localStorage.setItem('keyhive_theme', theme);
        this.applyTheme(theme);
        if (showToast && typeof Toast !== 'undefined') {
            Toast.success('Theme updated');
        }
    },

    /**
     * Set session timeout - saves to localStorage, updates SessionTimeout
     * @param {number} minutes - Timeout in minutes (0 = never)
     * @param {boolean} showToast - Whether to show success toast
     */
    setSessionTimeout(minutes, showToast = true) {
        localStorage.setItem('keyhive_session_timeout', String(minutes));

        if (typeof SessionTimeout !== 'undefined') {
            if (minutes === 0) {
                SessionTimeout.stop();
            } else {
                SessionTimeout.setTimeout(minutes);
                SessionTimeout.reset();
            }
        }

        if (showToast && typeof Toast !== 'undefined') {
            const label = minutes === 0 ? 'Never'
                : minutes === 1 ? '1 minute'
                : minutes === 60 ? '1 hour'
                : `${minutes} minutes`;
            Toast.success(`Auto-lock set to ${label}`);
        }
    },

    /**
     * Initialize the application
     */
    async init() {
        console.log('KeyHive initializing...');

        // Apply cached theme immediately to prevent flash
        const cachedTheme = localStorage.getItem('keyhive_theme');
        if (cachedTheme) {
            this.applyTheme(cachedTheme);
        } else {
            // Default to system theme
            this.applyTheme('system');
        }

        // Initialize Toast notifications
        if (typeof Toast !== 'undefined') {
            Toast.init();
        }

        // Initialize dropdown manager
        if (typeof DropdownManager !== 'undefined') {
            DropdownManager.init();
        }

        // Initialize connectivity monitoring
        if (typeof Connectivity !== 'undefined') {
            Connectivity.init();
            Connectivity.addListener((status) => this.handleConnectivityChange(status));
        }

        // Initialize biometric support (no-op on non-Capacitor platforms)
        if (typeof Biometric !== 'undefined') {
            Biometric.init().catch(e => console.warn('[App] Biometric init failed:', e));
        }

        // Initialize secure token storage (loads encrypted tokens into memory)
        if (typeof SecureTokenStore !== 'undefined') {
            await SecureTokenStore.init();
        }

        // Initialize API client
        ApiClient.init();

        // Initialize crypto worker early for better UX
        if (typeof CryptoAPI !== 'undefined') {
            CryptoAPI.init().catch(err => {
                console.error('Failed to initialize crypto worker:', err);
            });
        }

        // Check for password reset token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('reset');
        if (resetToken) {
            // Remove token from URL for security
            window.history.replaceState({}, document.title, window.location.pathname);
            await this.handleResetToken(resetToken);
            this.bindEvents();
            return;
        }

        // Check for ?register parameter (from external app links)
        if (urlParams.has('register')) {
            // Clean up URL
            const cleanUrl = new URL(window.location);
            cleanUrl.searchParams.delete('register');
            history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search);

            // Only show register if not already logged in
            if (!ApiClient.isAuthenticated) {
                localStorage.setItem('keyhive_mode', 'cloud');
                this.showView('register');
                this.bindEvents();
                return;
            }
        }

        // Check for ?subscription=success/cancel parameter
        if (urlParams.has('subscription')) {
            const subResult = urlParams.get('subscription');
            const cleanUrl = new URL(window.location);
            cleanUrl.searchParams.delete('subscription');
            history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search);

            if (subResult === 'success') {
                Toast.success('Subscription activated successfully!');
                // Advance registration step if still at subscription
                // (webhook may have already done this, but ensure it)
                this._subscriptionJustCompleted = true;
            }
        }

        // Check storage mode (local vs cloud)
        const storageMode = localStorage.getItem('keyhive_mode');

        if (!storageMode) {
            // No mode selected - show mode selection
            console.log('[App] No storage mode selected - showing mode selection');
            this.showView('mode-select');
            this.bindEvents();
            return;
        }

        // Handle local storage mode
        if (storageMode === 'local') {
            console.log('[App] Local storage mode');
            await this.initLocalMode();
            this.bindEvents();
            return;
        }

        // Cloud mode - continue with current flow
        console.log('[App] Cloud storage mode');

        // Check if we're offline
        const isOffline = typeof Connectivity !== 'undefined' && Connectivity.isOffline();

        if (isOffline) {
            // Offline mode: check if we have local data to work with
            console.log('[App] Cloud mode offline, checking local data...');

            let hasLocalData = false;
            if (typeof LocalDB !== 'undefined') {
                try {
                    // Set up LocalDB from stored settings
                    if (!LocalDB.setupFromStorage()) {
                        console.log('[App] No LocalDB configuration found');
                    } else {
                        await LocalDB.init();
                        hasLocalData = await LocalDB.hasOfflineAuth();
                    }
                } catch (e) {
                    console.warn('[App] LocalDB check failed:', e);
                }
            }

            if (hasLocalData) {
                // We have local data - go to unlock screen
                console.log('[App] Offline with local data - showing unlock');
                this.state.isAuthenticated = true;

                // Check for incomplete re-encryption (crash recovery)
                await this.checkIncompleteReencryption();

                // Set Vault to offline mode
                if (typeof Vault !== 'undefined') {
                    Vault.setOfflineMode(true);
                }

                this.showView('unlock');
            } else {
                // Offline but no local data - need to connect first
                console.log('[App] Offline but no local data - showing offline login message');
                this.showView('login');
                Toast.error('No offline data available. Please connect to internet.');
            }
        } else {
            // Online mode: ALWAYS try /auth/me to check if HttpOnly cookies are valid
            // Cookies are sent automatically by browser, even if sessionStorage is empty
            try {
                const response = await ApiClient.getMe();
                if (response.success) {
                    this.state.isAuthenticated = true;
                    this.state.user = response.data.user;
                    ApiClient.setAuthenticated(true);

                    // Store subscription info
                    if (response.data.subscription) {
                        this.state.subscription = response.data.subscription;
                    }

                    // Check registration step first - incomplete registration takes priority
                    const registrationStep = response.data.registration_step;
                    if (registrationStep && registrationStep !== 'complete') {
                        this.showRegistrationStep(registrationStep);
                    } else if (!this.isSubscriptionActive(response.data.subscription)) {
                        // Subscription expired - show subscription page
                        this.showView('subscription');
                    } else if (response.data.master_password_setup) {
                        this.showView('unlock');
                    } else {
                        // Need to set up master password
                        this.showView('setup-master');
                    }
                } else {
                    // Not authenticated - clear cached data for this user
                    await this.handleCloudAuthFailure();
                    this.showView('login');
                }
            } catch (error) {
                // Token invalid or network error - clear cached data
                await this.handleCloudAuthFailure();
                this.showView('login');
            }
        }

        // Bind global events
        this.bindEvents();
    },

    /**
     * Bind global event handlers
     */
    bindEvents() {
        // Handle forms
        document.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Handle tab changes from footer
        window.addEventListener('tabchange', (e) => {
            const tab = e.detail.tab;
            this.handleTabChange(tab);
        });

        // Handle add item events
        window.addEventListener('additem', (e) => {
            const type = e.detail.type;
            const folderId = e.detail.folderId || null;
            const prefillData = e.detail.prefillData || null;
            this.showAddItemPage(type, folderId, prefillData);
        });

        // Handle edit item events
        window.addEventListener('edititem', (e) => {
            const item = e.detail.item;
            this.showEditItemPage(item);
        });

        // Handle open item events (legacy - opens edit mode)
        window.addEventListener('openitem', (e) => {
            const item = e.detail.item;
            this.showItemDetail(item);
        });

        // Handle view item events (opens VIEW mode)
        window.addEventListener('viewitem', (e) => {
            const item = e.detail.item;
            this.showViewPage(item);
        });

        // Handle app errors
        window.addEventListener('apperror', (e) => {
            if (typeof Toast !== 'undefined') {
                Toast.error(e.detail.message);
            }
        });

        // Handle app warnings
        window.addEventListener('appwarning', (e) => {
            if (typeof Toast !== 'undefined') {
                Toast.warning(e.detail.message);
            }
        });

        // Global Escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;

            // Let popups handle their own Escape
            if (document.querySelector('.popup-overlay.active')) return;

            e.preventDefault();

            // Close overlays (ViewPage, AddEditPage with unsaved changes check)
            if ((typeof AddEditPage !== 'undefined' && AddEditPage.isVisible) ||
                (typeof ViewPage !== 'undefined' && ViewPage.isVisible)) {
                this.closeAllOverlays();
                return;
            }

            if (this.state.currentView === 'home') {
                // Clear home search and rerender
                const input = document.getElementById('homeSearchInput');
                if (input && input.value) {
                    input.value = '';
                    if (typeof HomePage !== 'undefined') {
                        HomePage.searchQuery = '';
                        HomePage.renderFolders();
                        HomePage.renderCards();
                    }
                }
            } else if (this.state.currentView === 'search') {
                // Clear search and go home
                const input = document.getElementById('searchPageInput');
                if (input) input.value = '';
                this.showView('home');
            }
        });

        // Auto-refresh: sync when app gains focus
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.handleAppFocus();
            } else {
                this.handleAppBlur();
            }
        });

        // Also handle window focus (for Electron)
        window.addEventListener('focus', () => this.handleAppFocus());
        window.addEventListener('blur', () => this.handleAppBlur());
    },

    /**
     * Close all page overlays (ViewPage, AddEditPage)
     * @returns {boolean} - true if all overlays were closed, false if blocked by unsaved changes
     */
    closeAllOverlays() {
        // Check AddEditPage first - it may have unsaved changes
        if (typeof AddEditPage !== 'undefined' && AddEditPage.isVisible) {
            if (AddEditPage.hasChanges) {
                // Has unsaved changes, show confirmation
                if (typeof Popup !== 'undefined') {
                    Popup.confirm(
                        'Unsaved Changes',
                        'You have unsaved changes. Are you sure you want to leave?',
                        () => {
                            AddEditPage.hide();
                            // Navigation will be handled by user clicking again
                        }
                    );
                }
                return false;
            }
            AddEditPage.hide();
        }

        // Close ViewPage
        if (typeof ViewPage !== 'undefined' && ViewPage.isVisible) {
            ViewPage.hide();
        }

        return true;
    },

    /**
     * Force-close all overlays without confirmation (used by auto-lock)
     */
    closeAllOverlaysForce() {
        // Remove all popup overlays from DOM
        document.querySelectorAll('.popup-overlay').forEach(el => el.remove());

        // Remove re-encryption overlays (safety net)
        document.querySelectorAll('.reencrypt-overlay').forEach(el => el.remove());

        // Close AddEditPage (skip unsaved changes check)
        if (typeof AddEditPage !== 'undefined' && AddEditPage.isVisible) {
            AddEditPage.hide();
        }

        // Close ViewPage
        if (typeof ViewPage !== 'undefined' && ViewPage.isVisible) {
            ViewPage.hide();
        }

        // Close dropdowns
        if (typeof DropdownManager !== 'undefined') {
            DropdownManager.closeAll();
        }

        // Clean up body scroll lock
        document.body.classList.remove('popup-open');
    },

    /**
     * Handle tab change from footer
     * @param {string} tab
     */
    handleTabChange(tab) {
        // Map tab names to view names
        const viewName = tab === 'home' ? 'home' : tab;

        // If already on this page, just scroll to top
        if (this.state.currentView === viewName ||
            (this.state.currentView === 'vault' && tab === 'home')) {
            this.scrollPageToTop(tab);
            return;
        }

        // Close all overlays first
        if (!this.closeAllOverlays()) {
            return; // Blocked by unsaved changes
        }

        switch (tab) {
            case 'home':
                this.showView('home');
                break;
            case 'generator':
                this.showView('generator');
                break;
            case 'security':
                this.showView('security');
                break;
            case 'settings':
                this.showView('settings');
                break;
            case 'search':
                this.showView('search');
                break;
        }
    },

    /**
     * Scroll page content to top
     * @param {string} pageId
     */
    scrollPageToTop(pageId) {
        const page = document.querySelector(`.page[data-page="${pageId}"]`);
        if (page) {
            page.scrollTop = 0;
            const content = page.querySelector('.page-content');
            if (content) content.scrollTop = 0;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Show add item page
     * @param {string} type
     */
    showAddItemPage(type, folderId = null, prefillData = null) {
        if (typeof AddEditPage !== 'undefined') {
            AddEditPage.showAdd(type, folderId, prefillData);
        }
    },

    /**
     * Show edit item page
     * @param {Object} item
     */
    showEditItemPage(item) {
        if (typeof AddEditPage !== 'undefined') {
            AddEditPage.showEdit(item);
        }
    },

    /**
     * Show item detail (legacy - opens edit mode)
     * @param {Object} item
     */
    showItemDetail(item) {
        // For now, open edit page. Can create separate detail view later
        if (typeof AddEditPage !== 'undefined') {
            AddEditPage.showEdit(item);
        }
    },

    /**
     * Show item in VIEW mode
     * @param {Object} item
     */
    showViewPage(item) {
        if (typeof ViewPage !== 'undefined') {
            ViewPage.show(item);
        } else {
            // Fallback to edit mode if ViewPage not loaded
            this.showItemDetail(item);
        }
    },

    /**
     * Handle form submissions
     * @param {Event} e
     */
    async handleFormSubmit(e) {
        const form = e.target;
        if (!form.dataset.action) return;

        e.preventDefault();

        const action = form.dataset.action;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Set loading state
        if (typeof AuthPages !== 'undefined') {
            AuthPages.setLoading(true);
        }

        try {
            switch (action) {
                case 'login':
                    await this.handleLogin(data);
                    break;
                case 'register':
                    await this.handleRegister(data);
                    break;
                case 'unlock':
                    await this.handleUnlock(data);
                    break;
                case 'setup-master':
                    await this.handleSetupMaster(data);
                    break;
                case 'setup-master-local':
                    await this.handleSetupMasterLocal(data);
                    break;
                case 'verify-2fa':
                    await this.handle2FA(data);
                    break;
                case 'verify-registration-email':
                    await this.handleVerifyRegistrationEmail(data);
                    break;
                case 'forgot-password':
                    await this.handleForgotPassword(data);
                    break;
                case 'reset-2fa':
                    await this.handleReset2FA(data);
                    break;
                case 'reset-password':
                    await this.handleResetPassword(data);
                    break;
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            // Clear loading state
            if (typeof AuthPages !== 'undefined') {
                AuthPages.setLoading(false);
            }
        }
    },

    /**
     * Handle login
     * @param {Object} data
     */
    async handleLogin(data) {
        const response = await ApiClient.login(data.email, data.password);

        if (!response.success) {
            throw new Error(response.message || 'Login failed');
        }

        if (response.data.requires_2fa) {
            // Store 2FA state
            this.state.twoFA = {
                pendingToken: response.data.pending_token,
                method: response.data.method,
                currentMethod: response.data.method,
                availableMethods: response.data.available_methods || [],
                fallback: response.data.fallback,
                emailHint: response.data.email_hint,
            };
            this.showView('verify-2fa');
        } else {
            this.state.isAuthenticated = true;
            this.state.user = response.data.user;

            // Store subscription info
            if (response.data.subscription) {
                this.state.subscription = response.data.subscription;
            }

            // Handle registration steps
            const step = response.data.registration_step;
            if (step && step !== 'complete') {
                this.showRegistrationStep(step);
            } else if (response.data.requires_master_setup) {
                this.showView('setup-master');
            } else {
                // Check subscription status before proceeding
                const sub = response.data.subscription;
                if (sub && !this.isSubscriptionActive(sub)) {
                    this.showView('subscription');
                } else {
                    this.showView('unlock');
                }
            }
        }
    },

    /**
     * Show appropriate registration step view
     * @param {string} step
     */
    /**
     * Check if subscription is active (trialing with time left, active, or in grace period)
     * @param {Object} sub - Subscription info from API
     * @returns {boolean}
     */
    isSubscriptionActive(sub) {
        if (!sub) return true; // No subscription data means not enforced
        const status = sub.status;
        if (status === 'active' || status === 'complimentary') return true;
        if (status === 'trialing' && sub.trial_days_remaining > 0) return true;
        if ((status === 'past_due' || status === 'canceled') && sub.current_period_end) {
            return new Date(sub.current_period_end) > new Date();
        }
        return false;
    },

    showRegistrationStep(step) {
        switch (step) {
            case 'email_verify':
                this.showView('verify-registration-email');
                break;
            case 'subscription':
                // If returning from Stripe checkout, auto-advance past subscription step
                if (this._subscriptionJustCompleted) {
                    this._subscriptionJustCompleted = false;
                    ApiClient.confirmSubscriptionStep().then(res => {
                        const nextStep = res?.data?.registration_step || 'master_password';
                        this.showRegistrationStep(nextStep);
                    }).catch(() => {
                        // Fallback: show subscription page
                        if (typeof SubscriptionPage !== 'undefined') {
                            SubscriptionPage._isNewRegistration = true;
                        }
                        this.showView('subscription');
                    });
                    return;
                }
                // Auto-skip subscription step when trial is active and SKIP_TRIAL_PAYMENT is enabled
                if (Config.TRIAL_DAYS > 0 && Config.SKIP_TRIAL_PAYMENT) {
                    ApiClient.confirmSubscriptionStep().then(res => {
                        const nextStep = res?.data?.registration_step || 'master_password';
                        this.showRegistrationStep(nextStep);
                    }).catch(() => {
                        this.showRegistrationStep('master_password');
                    });
                    return;
                }
                if (typeof SubscriptionPage !== 'undefined') {
                    SubscriptionPage._isNewRegistration = true;
                }
                this.showView('subscription');
                break;
            case 'master_password':
                this.showView('setup-master');
                break;
            case 'recovery_keys':
                this.showView('recovery-keys');
                break;
            default:
                this.showView('unlock');
        }
    },

    /**
     * Handle registration
     * @param {Object} data
     */
    async handleRegister(data) {
        // Validate name
        const name = (data.name || '').trim();
        if (name.length < 4) {
            throw new Error('Name must be at least 4 characters');
        }
        if (!/^[A-Za-z0-9 .\-_]+$/.test(name)) {
            throw new Error('Name can only contain letters, numbers, spaces, dots, dashes, and underscores');
        }

        // Check password strength (must be STRONG - score >= 3)
        if (typeof SecurityAnalyzer !== 'undefined') {
            const analysis = SecurityAnalyzer.analyzeStrength(data.password);
            if (analysis.score < 3) {
                throw new Error('Password must be strong');
            }
        }

        if (data.password !== data.password_confirm) {
            throw new Error('Passwords do not match');
        }

        const response = await ApiClient.register(data.email, data.password, name);

        if (!response.success) {
            throw new Error(response.message || 'Registration failed');
        }

        this.state.isAuthenticated = true;
        this.state.user = response.data.user;

        // Store subscription info (trial)
        if (response.data.subscription) {
            this.state.subscription = response.data.subscription;
        }

        // Generate avatar in the background (user won't notice)
        this.generateAvatarInBackground(name);

        // Handle registration steps
        const step = response.data.registration_step;
        if (step && step !== 'complete') {
            this.showRegistrationStep(step);
        } else {
            this.showView('setup-master');
        }
    },

    /**
     * Generate and save avatar silently in the background
     * @param {string} name
     */
    async generateAvatarInBackground(name) {
        try {
            // Strip non-letter characters for avatar API
            const avatarName = name.replace(/[^a-zA-Z\s]/g, '').trim();
            if (!avatarName) return;

            const data = await ApiClient.get(`/avatar/generate?name=${encodeURIComponent(avatarName)}`, { noLogout: true });
            if (!data.success || !data.image) return;

            // Resize to 128x128
            const resized = await SettingsBase.resizeBase64Image(data.image, 128, 128);

            // Save to user settings (noLogout: background task must never trigger logout)
            await ApiClient.put('/settings', { avatar: resized }, { noLogout: true });

            // Cache in IndexedDB and update sidebar
            if (typeof LocalDB !== 'undefined') {
                await LocalDB.saveUserAvatar(resized).catch(() => {});
            }
            const avatarEl = document.getElementById('sidebarUserAvatar');
            if (avatarEl) {
                const src = Utils.sanitizeImageSrc(`data:image/png;base64,${resized}`);
                if (src) {
                    avatarEl.innerHTML = `<img src="${src}" alt="Avatar" class="user-avatar-img">`;
                    avatarEl.classList.add('has-image');
                }
            }
        } catch (e) {
            // Silent fail - not critical
        }
    },

    /**
     * Handle cloud authentication failure
     * Clears cached data for the cloud user (but NOT local mode data)
     */
    async handleCloudAuthFailure() {
        console.log('[App] Cloud auth failure - cleaning up cached data');

        // Clear API client auth state
        ApiClient.clearAuth();

        // Clear cloud user's IndexedDB if we know their user ID
        if (typeof LocalDB !== 'undefined') {
            const storedUserId = localStorage.getItem('keyhive_user_id');
            if (storedUserId) {
                try {
                    await LocalDB.deleteCloudUserDatabase(storedUserId);
                    console.log(`[App] Deleted cloud cache for user: ${storedUserId}`);
                } catch (e) {
                    console.warn('[App] Failed to delete cloud user database:', e);
                }
            }

            // Clear mode from localStorage (but keep keyhive_mode if it's 'cloud')
            // This ensures user goes back to mode selection or login
            localStorage.removeItem('keyhive_user_id');
        }
    },

    /**
     * Check for incomplete re-encryption and warn user
     * This handles crash recovery scenarios
     */
    async checkIncompleteReencryption() {
        if (typeof LocalDB === 'undefined') return;

        try {
            const backup = await LocalDB.getReencryptionBackup();
            if (!backup || backup.status !== 'in_progress') return;

            console.warn('[App] Detected incomplete re-encryption!', backup);

            // Show warning popup
            return new Promise(resolve => {
                Popup.open({
                    title: 'Re-encryption Recovery',
                    body: `
                        <div class="alert alert-warning">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <div>
                                <strong>Previous re-encryption was interrupted</strong><br>
                                A password or encryption change did not complete successfully.
                                Your data may be encrypted with either your old or new password.
                            </div>
                        </div>
                        <p style="margin-top: var(--space-4);">
                            Please try unlocking with your password. If one doesn't work, try the other.
                            Once unlocked successfully, the recovery data will be cleared.
                        </p>
                    `,
                    buttons: [
                        { text: 'I Understand', type: 'primary', id: 'okBtn', onClick: () => { resolve(); return true; } }
                    ],
                    closeOnOutsideClick: false
                });
            });
        } catch (e) {
            console.error('[App] Error checking re-encryption backup:', e);
        }
    },

    /**
     * Initialize local storage mode
     * No server authentication, everything stored in IndexedDB
     */
    async initLocalMode() {
        console.log('[App] Initializing local storage mode...');

        // Setup LocalDB for local mode
        if (typeof LocalDB !== 'undefined') {
            LocalDB.setDatabase('local');
            await LocalDB.init();

            // Check for incomplete re-encryption (crash recovery)
            await this.checkIncompleteReencryption();

            // Check if master password is set up
            const hasAuth = await LocalDB.hasOfflineAuth();

            if (!hasAuth) {
                // Need to set up master password
                console.log('[App] Local mode: master password not set up');
                this.showView('setup-master-local');
                return;
            }

            // Master password is set up - show unlock screen
            console.log('[App] Local mode: showing unlock screen');

            this.showView('unlock');
        } else {
            console.error('[App] LocalDB not available for local mode');
            Toast.error('Local storage not available');
            this.showView('mode-select');
        }
    },

    /**
     * Handle password reset token from URL
     * @param {string} token
     */
    async handleResetToken(token) {
        // Show loading
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'flex';

        try {
            const response = await ApiClient.verifyResetToken(token);

            if (!response.success) {
                this.showView('login');
                Toast.error(response.message || 'Invalid or expired reset link');
                return;
            }

            // Store reset state
            if (typeof AuthPages !== 'undefined') {
                AuthPages.resetToken = token;
                AuthPages.resetState = {
                    pending_token: response.data.pending_token,
                    requires_2fa: response.data.requires_2fa,
                    methods: response.data.methods || [],
                    twoFAVerified: false,
                };
                AuthPages.showResetPassword(token);
            }
        } catch (error) {
            this.showView('login');
            Toast.error(error.message || 'Invalid or expired reset link');
        }
    },

    /**
     * Handle forgot password form submission
     * @param {Object} data
     */
    async handleForgotPassword(data) {
        const response = await ApiClient.forgotPassword(data.email);

        if (response.success) {
            Toast.success('If an account exists with this email, you will receive a reset link shortly.');
            // Stay on the same page but show success state
            if (typeof AuthPages !== 'undefined') {
                AuthPages.showLogin();
            }
        }
    },

    /**
     * Handle reset password 2FA verification
     * Store the code and show password form
     * @param {Object} data
     */
    async handleReset2FA(data) {
        if (typeof AuthPages === 'undefined' || !AuthPages.resetState) {
            throw new Error('Reset session expired');
        }

        // Store 2FA code for final submission with password
        AuthPages.resetState.twoFAVerified = true;
        AuthPages.resetState.code = data.code;
        AuthPages.resetState.method = 'totp';

        // Re-render to show password form
        AuthPages.render();
    },

    /**
     * Handle reset password form submission
     * @param {Object} data
     */
    async handleResetPassword(data) {
        if (data.new_password !== data.new_password_confirm) {
            throw new Error('Passwords do not match');
        }

        if (typeof AuthPages === 'undefined' || !AuthPages.resetState) {
            throw new Error('Reset session expired');
        }

        const resetState = AuthPages.resetState;
        const pendingToken = resetState.pending_token;
        const code = resetState.code || null;
        const method = resetState.method || null;

        const response = await ApiClient.resetPassword(
            pendingToken,
            data.new_password,
            code,
            method
        );

        if (response.success) {
            // Clear reset state
            delete AuthPages.resetToken;
            delete AuthPages.resetState;

            Toast.success('Password reset successfully. Please log in with your new password.');
            this.showView('login');
        }
    },

    /**
     * Handle registration email verification
     * @param {Object} data
     */
    async handleVerifyRegistrationEmail(data) {
        const trustDevice = document.getElementById('trustDeviceCheck')?.checked || false;
        const response = await ApiClient.verifyRegistrationEmail(data.code, trustDevice);

        if (!response.success) {
            throw new Error(response.message || 'Verification failed');
        }

        Toast.success('Email verified successfully');

        // Move to next step
        const step = response.data.registration_step;
        if (step && step !== 'complete') {
            this.showRegistrationStep(step);
        } else {
            this.showView('setup-master');
        }
    },

    /**
     * Handle 2FA verification
     * @param {Object} data
     */
    async handle2FA(data) {
        const twoFA = this.state.twoFA;
        if (!twoFA || !twoFA.pendingToken) {
            throw new Error('2FA session expired. Please login again.');
        }

        const trustDevice = document.getElementById('trustDeviceCheck')?.checked || false;
        const response = await ApiClient.verify2FA(twoFA.pendingToken, data.code, twoFA.currentMethod, trustDevice);

        if (!response.success) {
            throw new Error(response.message || 'Verification failed');
        }

        this.state.isAuthenticated = true;
        this.state.user = response.data.user;
        delete this.state.twoFA;

        // Store subscription info
        if (response.data.subscription) {
            this.state.subscription = response.data.subscription;
        }

        // Handle registration steps
        const step = response.data.registration_step;
        if (step && step !== 'complete') {
            this.showRegistrationStep(step);
        } else if (response.data.requires_master_setup) {
            this.showView('setup-master');
        } else {
            // Check subscription status
            const sub = response.data.subscription;
            if (sub && !this.isSubscriptionActive(sub)) {
                this.showView('subscription');
            } else {
                this.showView('unlock');
            }
        }
    },

    /**
     * Switch to email OTP fallback during 2FA
     */
    async fallbackToEmail() {
        const twoFA = this.state.twoFA;
        if (!twoFA || !twoFA.pendingToken) {
            throw new Error('2FA session expired. Please login again.');
        }

        const response = await ApiClient.fallbackToEmail(twoFA.pendingToken);

        if (response.success) {
            this.state.twoFA.currentMethod = 'email';
            this.state.twoFA.emailHint = response.data.email_hint;
            // Re-render 2FA page
            this.showView('verify-2fa');
            Toast.success('Verification code sent to your email');
        }
    },

    /**
     * Resend email OTP
     */
    async resendEmailOTP() {
        const twoFA = this.state.twoFA;
        if (!twoFA || !twoFA.pendingToken) {
            throw new Error('2FA session expired. Please login again.');
        }

        const response = await ApiClient.resendEmailOTP(twoFA.pendingToken);

        if (response.success) {
            Toast.success('Verification code sent');
        }
    },

    /**
     * Verify with WebAuthn (security key)
     */
    async verifyWithWebAuthn() {
        const twoFA = this.state.twoFA;
        if (!twoFA || !twoFA.pendingToken) {
            throw new Error('2FA session expired. Please login again.');
        }

        // Get WebAuthn challenge from server
        const optionsResponse = await ApiClient.webauthnLoginOptions(twoFA.pendingToken);
        if (!optionsResponse.success) {
            throw new Error(optionsResponse.message || 'Failed to get authentication options');
        }

        const options = optionsResponse.data.options;

        // Convert base64 to ArrayBuffer for WebAuthn API
        options.challenge = Utils.base64ToArrayBuffer(options.challenge);
        if (options.allowCredentials) {
            options.allowCredentials = options.allowCredentials.map(cred => ({
                ...cred,
                id: Utils.base64ToArrayBuffer(cred.id)
            }));
        }

        // Trigger browser's WebAuthn prompt
        const credential = await navigator.credentials.get({ publicKey: options });

        // Prepare credential for server
        const credentialData = {
            id: credential.id,
            rawId: Utils.arrayBufferToBase64(credential.rawId),
            type: credential.type,
            response: {
                authenticatorData: Utils.arrayBufferToBase64(credential.response.authenticatorData),
                clientDataJSON: Utils.arrayBufferToBase64(credential.response.clientDataJSON),
                signature: Utils.arrayBufferToBase64(credential.response.signature),
                userHandle: credential.response.userHandle
                    ? Utils.arrayBufferToBase64(credential.response.userHandle)
                    : null
            }
        };

        // Verify with server
        const trustDevice = document.getElementById('trustDeviceCheck')?.checked || false;
        const verifyResponse = await ApiClient.webauthnLoginVerify(twoFA.pendingToken, credentialData, trustDevice);

        if (!verifyResponse.success) {
            throw new Error(verifyResponse.message || 'WebAuthn verification failed');
        }

        // Login successful
        this.state.isAuthenticated = true;
        this.state.user = verifyResponse.data.user;
        delete this.state.twoFA;

        // Store subscription info
        if (verifyResponse.data.subscription) {
            this.state.subscription = verifyResponse.data.subscription;
        }

        // Handle registration steps
        const step = verifyResponse.data.registration_step;
        if (step && step !== 'complete') {
            this.showRegistrationStep(step);
        } else if (verifyResponse.data.requires_master_setup) {
            this.showView('setup-master');
        } else {
            // Check subscription status
            const sub = verifyResponse.data.subscription;
            if (sub && !this.isSubscriptionActive(sub)) {
                this.showView('subscription');
            } else {
                this.showView('unlock');
            }
        }
    },

    /**
     * Handle master password setup
     * @param {Object} data
     */
    async handleSetupMaster(data) {
        // Check password strength (must be STRONG - score >= 3)
        if (typeof SecurityAnalyzer !== 'undefined') {
            const analysis = SecurityAnalyzer.analyzeStrength(data.master_password);
            if (analysis.score < 3) {
                throw new Error('Vault key must be strong');
            }
        }

        if (data.master_password !== data.master_password_confirm) {
            throw new Error('Passwords do not match');
        }

        // Generate salt and derive key locally
        const salt = await CryptoAPI.generateSalt();

        // Derive key (stored in worker, never leaves)
        await CryptoAPI.deriveKey(data.master_password, salt);

        // Send ONLY salt to server (zero-knowledge)
        const response = await ApiClient.setupMaster(salt);

        if (response.success) {
            // Check if we need to show recovery keys (registration flow)
            const step = response.data.registration_step;
            if (step === 'recovery_keys') {
                // Generate recovery codes BEFORE showing recovery keys page
                // This uses the same system as settings page
                const kdf = response.data.kdf || null;
                const result = await CryptoAPI.generateRecoveryCodes(data.master_password, salt, kdf, 8);

                // Store codes in state for the recovery keys page to display
                this.state.pendingRecoveryCodes = result.codes;
                this.state.pendingRecoveryMeta = { salt, kdf };

                this.showRegistrationStep(step);
                return;
            }

            this.state.isUnlocked = true;

            // Create default vault named after user
            const userName = this.state.user?.name || 'Personal';
            await Vault.createVault(userName + "'s Vault");

            // Initialize session timeout
            this.initSessionTimeout();

            this.showView('vault');
        }
    },

    /**
     * Handle local mode master password setup
     * No server interaction - everything stored locally
     * @param {Object} data
     */
    async handleSetupMasterLocal(data) {
        // Check password strength (must be STRONG - score >= 3)
        if (typeof SecurityAnalyzer !== 'undefined') {
            const analysis = SecurityAnalyzer.analyzeStrength(data.master_password);
            if (analysis.score < 3) {
                throw new Error('Vault key must be strong');
            }
        }

        if (data.master_password !== data.master_password_confirm) {
            throw new Error('Passwords do not match');
        }

        // Generate salt locally
        const salt = await CryptoAPI.generateSalt();

        // Default KDF params (same as server would use)
        const kdf = {
            memory: 65536,      // 64MB
            iterations: 3,
            parallelism: 1
        };

        // Derive key (stored in worker, never leaves)
        await CryptoAPI.deriveKey(data.master_password, salt, kdf);

        // Generate random user name for local mode
        const userName = typeof RandomNames !== 'undefined'
            ? RandomNames.generate()
            : 'Local User';

        // Save to LocalDB
        if (typeof LocalDB !== 'undefined') {
            LocalDB.setDatabase('local');
            LocalDB.saveMode('local');  // Persist mode to localStorage
            await LocalDB.init();
            await LocalDB.saveOfflineAuth(salt, kdf);
            await LocalDB.saveUserName(userName);
        }

        // Store user info in state (BEFORE Vault.init so it can use the name)
        this.state.user = { name: userName };

        this.state.isUnlocked = true;
        this.state.isLocalMode = true;

        // Initialize session timeout
        this.initSessionTimeout();

        // Initialize Vault for local mode (creates default vault via _initializeCurrentVault)
        if (typeof Vault !== 'undefined') {
            Vault.setOfflineMode(true);
            await Vault.init();
        }

        console.log('[App] Local mode setup complete, user:', userName);
        this.showView('vault');
    },

    /**
     * Handle vault unlock
     * @param {Object} data
     */
    async handleUnlock(data) {
        let salt, kdf;

        // Check if we're in local mode or offline
        const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';
        const isOffline = typeof Connectivity !== 'undefined' && Connectivity.isOffline();

        if (isLocalMode || isOffline) {
            // Local mode or offline: get salt and KDF from LocalDB
            console.log(`[App] ${isLocalMode ? 'Local mode' : 'Offline'} unlock - using local auth data`);

            if (typeof LocalDB === 'undefined') {
                throw new Error('Local storage not available');
            }

            // Setup LocalDB for local mode
            if (isLocalMode) {
                LocalDB.setDatabase('local');
            }

            await LocalDB.init();
            const offlineAuth = await LocalDB.getOfflineAuth();

            if (!offlineAuth) {
                throw new Error(isLocalMode
                    ? 'Local vault not set up. Please set up your vault key.'
                    : 'No offline data available. Please connect to internet first.');
            }

            salt = offlineAuth.salt;
            kdf = offlineAuth.kdf;

            // Load user name from IndexedDB
            const userName = await LocalDB.getUserName();
            this.state.user = {
                name: userName || 'Local User'
            };

            // Set Vault to offline mode (no server sync)
            if (typeof Vault !== 'undefined') {
                Vault.setOfflineMode(true);
            }

            this.state.isLocalMode = isLocalMode;
        } else {
            // Online: get salt and KDF from server
            const saltResponse = await ApiClient.getSalt();

            if (!saltResponse.success) {
                throw new Error('Failed to get salt');
            }

            salt = saltResponse.data.salt;
            kdf = saltResponse.data.kdf;

            // Save to LocalDB for offline use
            if (typeof LocalDB !== 'undefined' && this.state.user?.id) {
                try {
                    // Set up cloud database for this user
                    LocalDB.setDatabase('cloud', this.state.user.id);
                    LocalDB.saveMode('cloud', this.state.user.id);
                    await LocalDB.init();
                    await LocalDB.saveOfflineAuth(salt, kdf);

                    // Save user name for offline display
                    if (this.state.user.name) {
                        await LocalDB.saveUserName(this.state.user.name);
                    }
                } catch (e) {
                    console.warn('[App] Failed to save offline auth:', e);
                }
            }
        }

        // Derive key locally using KDF params (stored in Web Worker, never leaves)
        await CryptoAPI.deriveKey(data.master_password, salt, kdf);

        // Zero-knowledge verification: try to load and decrypt vault data
        // If password is wrong, decryption will fail
        try {
            await Vault.init();

            // If we got here, decryption succeeded - password is correct
            this.state.isUnlocked = true;

            // Load and apply user settings (theme, etc.)
            this.loadUserSettings();

            // Initialize session timeout
            this.initSessionTimeout();

            // Start periodic sync (only when online)
            if (!isOffline) {
                this.startPeriodicSync();
            }

            // Clear re-encryption backup if exists (unlock succeeded = data is accessible)
            if (typeof LocalDB !== 'undefined') {
                LocalDB.clearReencryptionBackup().catch(e =>
                    console.warn('[App] Failed to clear re-encryption backup:', e)
                );
            }

            // Auto-cleanup old trash items (deleted > 30 days ago)
            if (typeof TrashManager !== 'undefined') {
                TrashManager.cleanupOldTrash().catch(e =>
                    console.warn('[App] Trash auto-cleanup failed:', e)
                );
            }

            this.showView('vault');

            // Check if user needs 2FA setup prompt (only when online)
            if (!isOffline) {
                this.check2FASetupPrompt();
            }

            // Check if user should be prompted to enable biometric unlock
            this.checkBiometricPrompt(data.master_password);
        } catch (error) {
            // Decryption failed - wrong master password
            // Clear the derived key
            await CryptoAPI.lock();
            throw new Error('Invalid vault key');
        }
    },

    /**
     * Load user settings and apply them (theme, auto-lock, etc.)
     * Flow: localStorage takes priority (per-device), server provides fallback defaults
     */
    async loadUserSettings() {
        // Check localStorage for local settings
        const localTheme = localStorage.getItem('keyhive_theme');
        const localTimeout = localStorage.getItem('keyhive_session_timeout');

        // Apply local settings if they exist
        if (localTheme) {
            this.applyTheme(localTheme);
        }
        if (localTimeout && typeof SessionTimeout !== 'undefined') {
            SessionTimeout.setTimeout(parseInt(localTimeout, 10));
        }

        // Skip server fetch in local mode - no server to fetch from
        const isLocalMode = this.state.isLocalMode || localStorage.getItem('keyhive_mode') === 'local';
        if (isLocalMode) {
            // Apply defaults if nothing set locally
            if (!localTheme) {
                localStorage.setItem('keyhive_theme', 'system');
                this.applyTheme('system');
            }
            if (!localTimeout && typeof SessionTimeout !== 'undefined') {
                SessionTimeout.setTimeout(15); // Default 15 minutes
            }
            return;
        }

        // Always fetch settings from server for cloud mode (for avatar and fallback values)
        try {
            const response = await ApiClient.getSettings();
            if (response?.success) {
                const serverSettings = response.data.settings || response.data;

                // Use server values only if localStorage is empty
                if (!localTheme && serverSettings.theme) {
                    localStorage.setItem('keyhive_theme', serverSettings.theme);
                    this.applyTheme(serverSettings.theme);
                }
                if (!localTimeout && serverSettings.session_timeout) {
                    localStorage.setItem('keyhive_session_timeout', serverSettings.session_timeout.toString());
                    if (typeof SessionTimeout !== 'undefined') {
                        SessionTimeout.setTimeout(serverSettings.session_timeout);
                    }
                }

                // Always cache avatar in IndexedDB for sidebar display
                if (typeof LocalDB !== 'undefined') {
                    if (serverSettings.avatar) {
                        LocalDB.saveUserAvatar(serverSettings.avatar).catch(e => {
                            console.warn('Failed to cache avatar:', e);
                        });
                    } else {
                        // Clear cached avatar if server has none
                        LocalDB.deleteUserAvatar().catch(e => {
                            console.warn('Failed to clear avatar cache:', e);
                        });
                    }
                }

                // Update sidebar with new avatar
                if (typeof Sidebar !== 'undefined' && Sidebar.updateUserInfo) {
                    Sidebar.updateUserInfo();
                }
            }
        } catch (error) {
            console.error('Failed to fetch server settings:', error);
        }
    },

    /**
     * Handle connectivity changes (online/offline)
     * @param {string} status - 'online' or 'offline'
     */
    async handleConnectivityChange(status) {
        console.log('[App] Connectivity changed:', status);

        // In local mode, we never sync with server regardless of connectivity
        const isLocalMode = this.state.isLocalMode || localStorage.getItem('keyhive_mode') === 'local';
        if (isLocalMode) {
            console.log('[App] Local mode - ignoring connectivity change');
            return;
        }

        if (status === 'online') {
            // We're back online - exit offline mode
            if (typeof Vault !== 'undefined') {
                Vault.setOfflineMode(false);
            }
            if (this.state.isUnlocked && typeof Vault !== 'undefined') {
                // Check for pending changes
                const hasPending = await Vault.hasPendingChanges();

                if (hasPending) {
                    Toast.info('Back online. Syncing changes...');

                    try {
                        const result = await Vault.syncPendingChanges();

                        if (result.synced > 0) {
                            Toast.success(`Synced ${result.synced} offline changes`);
                        }

                        if (result.conflicts > 0) {
                            Toast.info(`${result.conflicts} conflict(s) resolved - server version kept`);
                        }

                        if (result.failed > 0) {
                            Toast.warning(`${result.failed} changes failed to sync`);
                        }

                        // Refresh the current view
                        window.dispatchEvent(new CustomEvent('vaultrefreshed'));
                    } catch (error) {
                        console.error('[App] Sync failed:', error);
                        Toast.error('Failed to sync offline changes');
                    }

                    // Start periodic sync now that we're online
                    this.startPeriodicSync();
                } else if (Vault.isOffline()) {
                    // Was offline but no pending changes, just refresh
                    Toast.info('Back online');
                    try {
                        await Vault.forceRefresh();
                        window.dispatchEvent(new CustomEvent('vaultrefreshed'));
                    } catch (e) {
                        console.error('[App] Refresh failed:', e);
                    }
                }
            }
        } else {
            // We're offline - tell Vault to enter offline mode
            if (typeof Vault !== 'undefined') {
                Vault.setOfflineMode(true);
            }
            if (this.state.isUnlocked) {
                Toast.warning('You are offline. Changes will sync when connected.');
            }
        }

        // Update offline indicator
        this.updateOfflineIndicator(status === 'offline');
    },

    /**
     * Update offline indicator in UI
     * @param {boolean} isOffline
     */
    updateOfflineIndicator(isOffline) {
        // Add/remove class on body
        document.body.classList.toggle('is-offline', isOffline);

        // Dispatch event for UI components
        window.dispatchEvent(new CustomEvent('offlinestatuschange', {
            detail: { isOffline }
        }));
    },

    // ===========================================
    // Auto-Refresh & Sync
    // ===========================================

    /**
     * Handle app gaining focus - refresh data from server
     */
    async handleAppFocus() {
        // CRITICAL: Never sync during locked operations (re-encryption, import, etc.)
        if (this.isLocked()) {
            return;
        }

        if (!this.state.isUnlocked || this.state.isSyncing) {
            return;
        }

        // Skip sync in local mode
        if (this.state.isLocalMode || localStorage.getItem('keyhive_mode') === 'local') {
            return;
        }

        const isOffline = typeof Connectivity !== 'undefined' && Connectivity.isOffline();
        if (isOffline) {
            return;
        }

        console.log('[App] App focused - checking for updates');
        await this.silentSync();

        // Start periodic sync (only if not locked)
        if (!this.isLocked()) {
            this.startPeriodicSync();
        }
    },

    /**
     * Handle app losing focus - stop periodic sync
     */
    handleAppBlur() {
        this.stopPeriodicSync();
    },

    /**
     * Start periodic sync interval
     */
    startPeriodicSync() {
        // Skip in local mode - no server to sync with
        if (this.state.isLocalMode || localStorage.getItem('keyhive_mode') === 'local') {
            return;
        }

        if (this.state.syncInterval) {
            return; // Already running
        }

        this.state.syncInterval = setInterval(() => {
            if (this.state.isUnlocked && !this.state.isSyncing) {
                const isOffline = typeof Connectivity !== 'undefined' && Connectivity.isOffline();
                if (!isOffline) {
                    this.silentSync();
                }
            }
        }, this.SYNC_INTERVAL_MS);

        console.log('[App] Started periodic sync every', this.SYNC_INTERVAL_MS / 1000, 'seconds');
    },

    /**
     * Stop periodic sync interval
     */
    stopPeriodicSync() {
        if (this.state.syncInterval) {
            clearInterval(this.state.syncInterval);
            this.state.syncInterval = null;
            console.log('[App] Stopped periodic sync');
        }
    },

    /**
     * Silent sync - refresh from server without showing loading indicators
     * Used for auto-refresh on focus and periodic sync
     */
    async silentSync() {
        // CRITICAL: Never sync during locked operations (re-encryption, import, etc.)
        if (this.isLocked()) {
            console.log(`[App] Sync blocked - ${this.getLockReason() || 'operation'} in progress`);
            return;
        }

        if (this.state.isSyncing || !this.state.isUnlocked) {
            return;
        }

        // Skip sync in local mode - no server to sync with
        if (this.state.isLocalMode || localStorage.getItem('keyhive_mode') === 'local') {
            return;
        }

        try {
            this.state.isSyncing = true;
            this.updateSyncIndicator(true);

            // First sync any pending offline changes
            if (typeof Vault !== 'undefined' && typeof LocalDB !== 'undefined') {
                const hasPending = await Vault.hasPendingChanges();
                if (hasPending) {
                    console.log('[App] Syncing pending changes...');
                    const result = await Vault.syncPendingChanges();

                    if (result.conflicts > 0) {
                        Toast.info(`${result.conflicts} conflict(s) resolved - server version kept`);
                    }
                }
            }

            // Then refresh from server
            if (typeof Vault !== 'undefined') {
                await Vault.forceRefresh();
                this.state.lastSyncTime = new Date();

                // Notify UI components
                window.dispatchEvent(new CustomEvent('vaultrefreshed'));
            }
        } catch (error) {
            console.warn('[App] Silent sync failed:', error.message);
        } finally {
            this.state.isSyncing = false;
            this.updateSyncIndicator(false);
        }
    },

    /**
     * Update sync indicator in UI
     * @param {boolean} isSyncing
     */
    updateSyncIndicator(isSyncing) {
        document.body.classList.toggle('is-syncing', isSyncing);

        window.dispatchEvent(new CustomEvent('syncstatuschange', {
            detail: { isSyncing, lastSyncTime: this.state.lastSyncTime }
        }));
    },

    /**
     * Check if user needs 2FA setup prompt
     * Shows prompt if user doesn't have TOTP or WebAuthn enabled and hasn't dismissed it
     */
    async check2FASetupPrompt() {
        // Skip in local mode
        if (this.state.isLocalMode || localStorage.getItem('keyhive_mode') === 'local') return;

        const userId = this.state.user?.id;
        if (!userId) return;

        const key = (name) => `keyhive_${userId}_2fa_prompt_${name}`;

        try {
            // Dismissed forever?
            if (localStorage.getItem(key('dismissed')) === 'true') return;

            // Increment login counter
            const logins = parseInt(localStorage.getItem(key('logins')) || '0', 10) + 1;
            localStorage.setItem(key('logins'), String(logins));

            // Skip first login (don't pile onto registration flow)
            if (logins < 2) return;

            // Snoozed?
            const snoozedUntil = parseInt(localStorage.getItem(key('snoozed')) || '0', 10);
            if (snoozedUntil > Date.now()) return;

            // Check if 2FA is already enabled
            const twoFAResponse = await ApiClient.get2FAStatus();
            if (!twoFAResponse?.success) return;

            const methods = twoFAResponse.data.methods || {};
            if (methods.totp || methods.webauthn) return;

            // Show after delay (let UI settle)
            setTimeout(() => this.show2FASetupPrompt(), 2000);
        } catch (error) {
            console.error('Failed to check 2FA status:', error);
        }
    },

    /**
     * Show 2FA setup prompt popup
     */
    show2FASetupPrompt() {
        if (document.querySelector('.popup-overlay.active')) return;

        const userId = this.state.user?.id;
        if (!userId) return;

        const key = (name) => `keyhive_${userId}_2fa_prompt_${name}`;

        Popup.open({
            title: 'Secure Your Account',
            body: `
                <div class="tfa-prompt-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                </div>
                <p class="tfa-prompt-message">
                    Add an extra layer of security to your account by enabling two-factor authentication.
                </p>
                <p class="tfa-prompt-submessage">
                    We recommend using an <strong>Authenticator App</strong> or <strong>Security Key</strong> for the best protection.
                </p>
                <div class="tfa-prompt-options">
                    <button class="btn btn-primary btn-block" id="tfaPromptSetup">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        Set Up Two-Factor Authentication
                    </button>
                </div>
            `,
            buttons: [
                {
                    text: "Don't show again",
                    type: 'text',
                    onClick: () => {
                        localStorage.setItem(key('dismissed'), 'true');
                        return true;
                    }
                },
                {
                    text: 'Not Now',
                    type: 'secondary',
                    onClick: () => {
                        localStorage.setItem(key('snoozed'), String(Date.now() + 7 * 24 * 60 * 60 * 1000));
                        return true;
                    }
                }
            ],
            closeOnOutsideClick: true,
            onOpen: (api) => {
                api.querySelector('#tfaPromptSetup')?.addEventListener('click', () => {
                    localStorage.setItem(key('dismissed'), 'true');
                    api.close();
                    if (typeof SettingsCloud !== 'undefined') {
                        SettingsCloud.showSetup2FAPopup();
                    }
                });
            }
        });
    },

    /**
     * Check if user should be prompted to enable biometric unlock
     * Only shows once per install (tracked via LocalDB flag)
     * @param {string} masterPassword
     */
    async checkBiometricPrompt(masterPassword) {
        if (typeof Biometric === 'undefined' || !Biometric.isAvailable() || Biometric.isEnabled()) return;

        // Check if we already prompted the user
        try {
            if (typeof LocalDB !== 'undefined' && LocalDB.db) {
                const prompted = await LocalDB.getUserDataValue('biometric_prompt_shown');
                if (prompted) return;
            }
        } catch (e) {
            return;
        }

        // Wait for any other prompts (2FA) to clear
        setTimeout(async () => {
            // Don't show if another popup is active
            if (document.querySelector('.popup-overlay.active')) {
                // Retry once after a delay
                setTimeout(() => this.showBiometricPrompt(masterPassword), 3000);
                return;
            }
            this.showBiometricPrompt(masterPassword);
        }, 1500);
    },

    /**
     * Show biometric enable prompt popup
     * @param {string} masterPassword
     */
    showBiometricPrompt(masterPassword) {
        if (document.querySelector('.popup-overlay.active')) return;

        Popup.open({
            title: 'Enable Biometric Unlock',
            body: `
                <div style="text-align: center; margin-bottom: var(--space-4);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" width="48" height="48" style="margin: 0 auto;" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"></path>
                        <path d="M5 19.5C5.5 18 6 15 6 12c0-3.3 2.7-6 6-6 1.8 0 3.4.8 4.5 2"></path>
                        <path d="M10 12c0-1.1.9-2 2-2s2 .9 2 2c0 3-1 6-3 8.5"></path>
                        <path d="M18 12c0 4-1.5 7.5-4 10"></path>
                        <path d="M22 12a10 10 0 0 1-2 6"></path>
                        <path d="M14 12c0 2-1 4.5-2.5 6.5"></path>
                    </svg>
                </div>
                <p style="text-align: center; color: var(--text-secondary); margin-bottom: var(--space-2);">
                    Unlock your vault quickly using Face ID, Touch ID, or fingerprint instead of typing your vault key.
                </p>
                <p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">
                    Your vault key will be securely stored in your device's hardware security module.
                </p>
            `,
            buttons: [
                {
                    text: 'Not Now',
                    type: 'secondary',
                    onClick: async () => {
                        // Mark as shown so we don't ask again
                        try {
                            if (typeof LocalDB !== 'undefined') {
                                await LocalDB.setUserDataValue('biometric_prompt_shown', true);
                            }
                        } catch (e) { /* ignore */ }
                        return true;
                    }
                },
                {
                    text: 'Enable',
                    type: 'primary',
                    onClick: async () => {
                        try {
                            await Biometric.enable(masterPassword);
                            if (typeof LocalDB !== 'undefined') {
                                await LocalDB.setUserDataValue('biometric_prompt_shown', true);
                            }
                            Toast.success('Biometric unlock enabled');
                        } catch (e) {
                            Toast.error('Failed to enable biometric unlock');
                        }
                        return true;
                    }
                }
            ],
            closeOnOutsideClick: true,
            compact: true
        });
    },

    /**
     * Initialize session timeout
     */
    initSessionTimeout() {
        SessionTimeout.init({
            timeout: 15, // Default 15 minutes
            onWarning: (seconds) => {
                this.showWarning(`Session will lock in ${seconds} seconds`);
            },
            onLock: () => {
                this.lockVault();
            },
        });
    },

    /**
     * Lock the vault
     */
    async lockVault() {
        // Defer lock if critical operation in progress (re-encryption, import, recovery codes)
        if (typeof UILock !== 'undefined' && UILock._isLocked) {
            setTimeout(() => this.lockVault(), 60000);
            return;
        }

        this.closeAllOverlaysForce();
        this.state.isUnlocked = false;
        await Vault.lock();
        this.showView('unlock');
    },

    /**
     * Logout
     */
    async logout() {
        const isLocalMode = this.state.isLocalMode || localStorage.getItem('keyhive_mode') === 'local';

        // Clear biometric data (stored password in secure storage)
        if (typeof Biometric !== 'undefined') {
            await Biometric.disable();
        }

        // Lock crypto (clear derived keys)
        if (typeof CryptoAPI !== 'undefined') {
            await CryptoAPI.lock();
        }

        // Reset Vault state
        if (typeof Vault !== 'undefined') {
            Vault.reset();
        }

        this.state.isAuthenticated = false;
        this.state.isUnlocked = false;
        this.state.isLocalMode = false;
        this.state.user = null;
        SessionTimeout.stop();

        // For cloud mode: call API logout and delete IndexedDB
        if (!isLocalMode) {
            try {
                await ApiClient.logout();
            } catch (e) {
                console.warn('[App] API logout failed:', e);
            }

            // Delete cloud user's IndexedDB
            if (typeof LocalDB !== 'undefined') {
                try {
                    await LocalDB.deleteDatabase();
                    console.log('[App] Deleted cloud user IndexedDB on logout');
                } catch (e) {
                    console.warn('[App] Failed to delete LocalDB:', e);
                }
            }
        }

        // Clear mode - return to mode selection
        localStorage.removeItem('keyhive_mode');
        if (typeof LocalDB !== 'undefined') {
            LocalDB.clearMode();
        }

        console.log('[App] Logged out, returning to mode selection');
        this.showView('mode-select');
    },

    /**
     * Show a view
     * @param {string} view
     * @param {Object} params - Optional parameters for the view
     */
    showView(view, params = {}) {
        const previousView = this.state.currentView;
        this.state.currentView = view;
        console.log('Showing view:', view);

        // Exit select mode when changing views
        if (typeof HomePage !== 'undefined' && HomePage.isSelectMode) {
            HomePage.exitSelectMode();
        }

        // Clean up search page when leaving
        if (previousView === 'search' && view !== 'search') {
            if (typeof SearchPage !== 'undefined') SearchPage.hide();
        }

        // Hide loading spinner
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }

        // Handle vault-related views
        if (view === 'vault' || view === 'home') {
            this.initVaultUI();
            // Refresh user info in sidebar (in case user changed)
            if (typeof Sidebar !== 'undefined' && Sidebar.updateUserInfo) {
                Sidebar.updateUserInfo();
            }
            this.showHomePage();
        } else if (view === 'search') {
            this.initVaultUI();
            this.showSearchPage(params);
        } else if (view === 'generator') {
            this.initVaultUI();
            this.showGeneratorPage();
        } else if (view === 'security') {
            this.initVaultUI();
            this.showSecurityPage();
        } else if (view === 'settings') {
            this.initVaultUI();
            this.showSettingsPage();
        } else if (view === 'mode-select') {
            this.hideVaultUI();
            this.showAuthPage(view);
        } else if (view === 'login' || view === 'register') {
            this.hideVaultUI();
            this.showAuthPage(view);
        } else if (view === 'unlock' || view === 'setup-master' || view === 'setup-master-local') {
            this.hideVaultUI();
            this.showAuthPage(view);
        } else if (view === 'verify-2fa') {
            this.hideVaultUI();
            this.showAuthPage(view);
        } else if (view === 'verify-registration-email') {
            this.hideVaultUI();
            this.showAuthPage(view);
        } else if (view === 'recovery-keys') {
            this.hideVaultUI();
            this.showAuthPage(view);
        } else if (view === 'forgot-password') {
            this.hideVaultUI();
            this.showAuthPage(view);
        } else if (view === 'reset-password') {
            this.hideVaultUI();
            this.showAuthPage(view);
        } else if (view === 'subscription') {
            this.hideVaultUI();
            this.showAuthPage(view);
        }

        // Dispatch event for UI to handle
        window.dispatchEvent(new CustomEvent('viewchange', { detail: { view, params } }));
    },

    /**
     * Initialize vault UI components (header, footer, sidebar, etc.)
     */
    initVaultUI() {
        // Hide auth pages
        if (typeof AuthPages !== 'undefined') {
            AuthPages.hide();
        }

        if (this.state.uiInitialized) return;

        // Create pages container structure
        this.createPagesContainer();

        // Create offline banner
        this.createOfflineBanner();

        // Initialize sidebar (desktop)
        if (typeof Sidebar !== 'undefined') {
            Sidebar.init();
        }

        // Initialize footer (mobile)
        if (typeof Footer !== 'undefined') {
            Footer.init();
        }

        // Initialize all pages
        if (typeof HomePage !== 'undefined') {
            HomePage.init();
        }
        if (typeof GeneratorPage !== 'undefined') {
            GeneratorPage.init();
        }
        if (typeof SecurityPage !== 'undefined') {
            SecurityPage.init();
        }
        if (typeof SearchPage !== 'undefined' && !SearchPage._initialized) {
            SearchPage.init();
        }
        // Settings is initialized on page load, not here
        // (Settings.init() is called in showSettingsPage)

        this.state.uiInitialized = true;
        this.state.generatorInitialized = true;
        this.state.securityInitialized = true;
        this.state.settingsInitialized = true;
    },

    /**
     * Create the pages container structure
     */
    createPagesContainer() {
        const app = document.getElementById('app');
        if (!app || document.getElementById('pagesContainer')) return;

        const pagesContainer = document.createElement('div');
        pagesContainer.id = 'pagesContainer';
        pagesContainer.className = 'pages';
        pagesContainer.innerHTML = `
            <div class="page" data-page="home" id="pageHome">
                <div class="page-content" id="homePageContent"></div>
            </div>
            <div class="page" data-page="generator" id="pageGenerator">
                <div class="page-content" id="generatorPageContent"></div>
            </div>
            <div class="page" data-page="security" id="pageSecurity">
                <div class="page-content" id="securityPageContent"></div>
            </div>
            <div class="page" data-page="settings" id="pageSettings">
                <div class="page-content" id="settingsPageContent"></div>
            </div>
            <div class="page" data-page="search" id="pageSearch">
                <div class="page-content" id="searchPageContent"></div>
            </div>
        `;

        // Insert before footer if it exists, otherwise append
        const footer = app.querySelector('.footer');
        if (footer) {
            app.insertBefore(pagesContainer, footer);
        } else {
            app.appendChild(pagesContainer);
        }
    },

    /**
     * Create offline banner element
     */
    createOfflineBanner() {
        if (document.getElementById('offlineBanner')) return;

        const banner = document.createElement('div');
        banner.id = 'offlineBanner';
        banner.className = 'offline-banner';
        banner.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
            </svg>
            <span>You are offline. Changes will sync when connected.</span>
            <button class="offline-banner-sync" id="offlineSyncBtn" style="display: none;">
                Sync Now
            </button>
        `;

        document.body.insertBefore(banner, document.body.firstChild);

        // Bind sync button
        document.getElementById('offlineSyncBtn')?.addEventListener('click', async () => {
            if (typeof Vault !== 'undefined' && typeof Connectivity !== 'undefined') {
                if (Connectivity.isOnline()) {
                    const btn = document.getElementById('offlineSyncBtn');
                    btn.textContent = 'Syncing...';
                    btn.disabled = true;

                    try {
                        const result = await Vault.syncPendingChanges();
                        if (result.success) {
                            Toast.success('All changes synced');
                        } else {
                            Toast.warning(`${result.failed} changes failed to sync`);
                        }
                    } catch (e) {
                        Toast.error('Sync failed');
                    }

                    btn.textContent = 'Sync Now';
                    btn.disabled = false;
                }
            }
        });

        // Update offline state based on current connectivity
        if (typeof Connectivity !== 'undefined' && Connectivity.isOffline()) {
            this.updateOfflineIndicator(true);
        }
    },

    /**
     * Switch to a specific page
     * @param {string} pageId - home, generator, security, settings
     */
    switchPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Show target page
        const targetPage = document.querySelector(`.page[data-page="${pageId}"]`);
        if (targetPage) {
            targetPage.classList.add('active');
            // Scroll to top - try all possible scroll containers
            targetPage.scrollTop = 0;
            const content = targetPage.querySelector('.page-content');
            if (content) content.scrollTop = 0;
            window.scrollTo(0, 0);
        }

        // Toggle home-active class on body (hides mobile header on home page)
        if (pageId === 'home') {
            document.body.classList.add('home-active');
        } else {
            document.body.classList.remove('home-active');
        }

        // Update footer tab
        if (typeof Footer !== 'undefined') {
            Footer.setActiveTab(pageId);
        }

        // Update sidebar active nav
        if (typeof Sidebar !== 'undefined') {
            Sidebar.setTab(pageId, false);
        }
    },

    /**
     * Hide vault UI components
     */
    hideVaultUI() {
        const sidebar = document.querySelector('.sidebar');
        const header = document.querySelector('.header');
        const footer = document.querySelector('.footer');
        const pagesContainer = document.getElementById('pagesContainer');

        if (sidebar) sidebar.style.display = 'none';
        if (header) header.style.display = 'none';
        if (footer) footer.style.display = 'none';
        if (pagesContainer) pagesContainer.style.display = 'none';
    },

    /**
     * Show home page
     */
    showHomePage() {
        // Show sidebar, header and footer
        const sidebar = document.querySelector('.sidebar');
        const header = document.querySelector('.header');
        const footer = document.querySelector('.footer');
        const pagesContainer = document.getElementById('pagesContainer');

        if (sidebar) sidebar.style.display = '';
        if (header) header.style.display = 'flex';
        if (footer) footer.style.display = 'flex';
        if (pagesContainer) pagesContainer.style.display = 'flex';

        // Switch to home page
        this.switchPage('home');

        // Clear search and load data
        if (typeof HomePage !== 'undefined') {
            HomePage.searchQuery = '';
            const homeSearchInput = document.getElementById('homeSearchInput');
            if (homeSearchInput) homeSearchInput.value = '';
            HomePage.loadData();
        }
    },

    /**
     * Show search page
     */
    showSearchPage(params = {}) {
        const sidebar = document.querySelector('.sidebar');
        const header = document.querySelector('.header');
        const footer = document.querySelector('.footer');
        const pagesContainer = document.getElementById('pagesContainer');

        if (sidebar) sidebar.style.display = '';
        if (header) header.style.display = 'flex';
        if (footer) footer.style.display = 'flex';
        if (pagesContainer) pagesContainer.style.display = 'flex';

        this.switchPage('search');

        if (typeof SearchPage !== 'undefined') {
            SearchPage.show(params.query || '');
        }
    },

    /**
     * Show generator page
     */
    showGeneratorPage() {
        const sidebar = document.querySelector('.sidebar');
        const header = document.querySelector('.header');
        const footer = document.querySelector('.footer');
        const pagesContainer = document.getElementById('pagesContainer');

        if (sidebar) sidebar.style.display = '';
        if (header) header.style.display = 'flex';
        if (footer) footer.style.display = 'flex';
        if (pagesContainer) pagesContainer.style.display = 'flex';

        // Switch to generator page
        this.switchPage('generator');

        // Generate password if needed
        if (typeof GeneratorPage !== 'undefined') {
            GeneratorPage.generate();
        }
    },

    /**
     * Show security page
     */
    showSecurityPage() {
        const sidebar = document.querySelector('.sidebar');
        const header = document.querySelector('.header');
        const footer = document.querySelector('.footer');
        const pagesContainer = document.getElementById('pagesContainer');

        if (sidebar) sidebar.style.display = '';
        if (header) header.style.display = 'flex';
        if (footer) footer.style.display = 'flex';
        if (pagesContainer) pagesContainer.style.display = 'flex';

        // Switch to security page
        this.switchPage('security');

        // Run analysis
        if (typeof SecurityPage !== 'undefined') {
            SecurityPage.analyze();
        }
    },

    /**
     * Show settings page
     */
    showSettingsPage() {
        const sidebar = document.querySelector('.sidebar');
        const header = document.querySelector('.header');
        const footer = document.querySelector('.footer');
        const pagesContainer = document.getElementById('pagesContainer');

        if (sidebar) sidebar.style.display = '';
        if (header) header.style.display = 'flex';
        if (footer) footer.style.display = 'flex';
        if (pagesContainer) pagesContainer.style.display = 'flex';

        // Switch to settings page
        this.switchPage('settings');

        // Initialize settings (uses modular system)
        if (typeof Settings !== 'undefined') {
            Settings.init();
        }
    },

    /**
     * Show authentication page (login, register, unlock, etc.)
     * @param {string} view
     */
    async showAuthPage(view) {
        // Hide vault UI
        this.hideVaultUI();

        // Re-initialize biometric before unlock (LocalDB is ready by now)
        if (view === 'unlock' && typeof Biometric !== 'undefined') {
            try { await Biometric.init(); } catch (e) { /* ignore */ }
        }

        if (typeof AuthPages !== 'undefined') {
            switch (view) {
                case 'mode-select':
                    AuthPages.showModeSelect();
                    break;
                case 'login':
                    AuthPages.showLogin();
                    break;
                case 'register':
                    AuthPages.showRegister();
                    break;
                case 'unlock':
                    AuthPages.showUnlock();
                    break;
                case 'setup-master':
                    AuthPages.showSetupMaster();
                    break;
                case 'setup-master-local':
                    AuthPages.showSetupMasterLocal();
                    break;
                case 'verify-2fa':
                    AuthPages.showVerify2FA();
                    break;
                case 'verify-registration-email':
                    AuthPages.showVerifyRegistrationEmail();
                    break;
                case 'recovery-keys':
                    AuthPages.showRecoveryKeys();
                    break;
                case 'forgot-password':
                    AuthPages.showForgotPassword();
                    break;
                case 'reset-password':
                    AuthPages.showResetPassword(AuthPages.resetToken);
                    break;
                case 'subscription':
                    AuthPages.showSubscription();
                    break;
                default:
                    AuthPages.showLogin();
            }
        }
    },

    /**
     * Show error message
     * @param {string} message
     */
    showError(message) {
        console.error('Error:', message);
        window.dispatchEvent(new CustomEvent('apperror', { detail: { message } }));
    },

    /**
     * Show warning message
     * @param {string} message
     */
    showWarning(message) {
        console.warn('Warning:', message);
        window.dispatchEvent(new CustomEvent('appwarning', { detail: { message } }));
    },

};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Hide loading indicator when app view is ready
window.addEventListener('viewchange', () => {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
