/**
 * Biometric Unlock Manager
 *
 * Enables Face ID / Touch ID / fingerprint unlock on Capacitor mobile apps.
 * Stores the master password via NativeBiometric credential storage (iOS Keychain / Android Keystore)
 * and retrieves it only after successful biometric authentication.
 *
 * All state is stored in localStorage (synchronous, always available).
 * No IndexedDB dependency — biometric state must survive cold starts instantly.
 *
 * Account tracking: biometrics are tied to a specific account identifier
 * ("local" or "cloud:{userId}"). When the account changes, biometrics are
 * reset and the user is prompted to set up again.
 *
 * On non-Capacitor platforms (browser, Electron), this is a no-op.
 */

const Biometric = {
    _available: false,   // device has biometric hardware + Capacitor runtime
    _enabled: false,     // user has opted in for the current account
    _initialized: false,
    _plugin: null,       // NativeBiometric plugin reference
    _autoUnlock: true,   // true on cold start, suppressed by lock/logout

    // NativeBiometric credential key
    _server: 'keyhive.app',

    // localStorage keys
    _LS_ENABLED: 'keyhive_biometric_enabled',
    _LS_ACCOUNT: 'keyhive_biometric_account',
    _LS_PROMPTED: 'keyhive_biometric_prompted',

    /**
     * Get the current account identifier
     * @returns {string|null} "local" or "cloud:{userId}"
     */
    getCurrentAccount() {
        const mode = localStorage.getItem('keyhive_mode');
        if (mode === 'local') return 'local';
        const userId = localStorage.getItem('keyhive_user_id');
        if (mode === 'cloud' && userId) return `cloud:${userId}`;
        return null;
    },

    /**
     * Initialize biometric support
     * Checks hardware availability and reads enabled state from localStorage
     */
    async init() {
        this._available = false;
        this._enabled = false;
        this._initialized = true;
        this._plugin = null;

        // Only available in Capacitor runtime
        if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) {
            return;
        }

        // Get NativeBiometric plugin from Capacitor
        const NativeBiometric = Capacitor.Plugins?.NativeBiometric;
        if (!NativeBiometric) {
            console.warn('[Biometric] NativeBiometric plugin not available');
            return;
        }

        try {
            const result = await NativeBiometric.isAvailable();
            if (!result?.isAvailable) {
                console.log('[Biometric] No biometric hardware available');
                return;
            }
            this._plugin = NativeBiometric;
            this._available = true;
        } catch (e) {
            console.log('[Biometric] Availability check failed:', e.message);
            return;
        }

        // Read enabled state from localStorage (sync, instant)
        this._enabled = localStorage.getItem(this._LS_ENABLED) === 'true';

        console.log(`[Biometric] Initialized — available: ${this._available}, enabled: ${this._enabled}`);
    },

    /**
     * Can we offer biometric unlock on this device?
     * @returns {boolean}
     */
    isAvailable() {
        return this._available;
    },

    /**
     * Has the user opted in to biometric unlock?
     * @returns {boolean}
     */
    isEnabled() {
        return this._available && this._enabled;
    },

    /**
     * Has the user already been prompted for biometric setup?
     * @returns {boolean}
     */
    wasPrompted() {
        return localStorage.getItem(this._LS_PROMPTED) === 'true';
    },

    /**
     * Mark that the user has been prompted for biometric setup
     */
    setPrompted() {
        localStorage.setItem(this._LS_PROMPTED, 'true');
    },

    /**
     * Suppress auto-unlock (called on manual lock or logout)
     */
    suppressAutoUnlock() {
        this._autoUnlock = false;
    },

    /**
     * Consume auto-unlock flag (one-shot: returns true once on cold start, then false)
     * @returns {boolean}
     */
    consumeAutoUnlock() {
        if (this._available && this._enabled && this._autoUnlock) {
            this._autoUnlock = false;
            return true;
        }
        return false;
    },

    /**
     * Authenticate with biometrics and retrieve the stored master password
     * @returns {Promise<string|null>} The master password, or null on failure/cancel
     */
    async authenticate() {
        if (!this._available || !this._enabled || !this._plugin) return null;

        try {
            // Prompt biometric authentication
            await this._plugin.verifyIdentity({
                reason: 'Unlock KeyHive',
                title: 'Biometric Unlock',
                subtitle: 'Verify your identity to unlock your vault',
                negativeButtonText: 'Use Password'
            });

            // Biometric succeeded — retrieve password from credential storage
            const result = await this._plugin.getCredentials({ server: this._server });
            if (result?.password) {
                return result.password;
            }

            console.warn('[Biometric] No password found in secure storage');
            return null;
        } catch (e) {
            // User cancelled or biometric failed — not an error, just fallback
            console.log('[Biometric] Authentication cancelled or failed:', e.message);
            return null;
        }
    },

    /**
     * Enable biometric unlock — stores the master password in secure storage
     * @param {string} masterPassword
     */
    async enable(masterPassword) {
        if (!this._available || !this._plugin) return;

        const account = this.getCurrentAccount();
        if (!account) {
            console.error('[Biometric] Cannot enable — no account identified');
            return;
        }

        try {
            // Trigger biometric prompt immediately so user grants permission now
            await this._plugin.verifyIdentity({
                reason: 'Enable biometric unlock',
                title: 'Biometric Setup',
                subtitle: 'Verify your identity to enable biometric unlock',
                negativeButtonText: 'Cancel'
            });

            // Permission granted — store the password
            await this._plugin.setCredentials({
                username: 'keyhive',
                password: masterPassword,
                server: this._server
            });

            // All state in localStorage — no IndexedDB
            localStorage.setItem(this._LS_ENABLED, 'true');
            localStorage.setItem(this._LS_ACCOUNT, account);
            localStorage.setItem(this._LS_PROMPTED, 'true');

            this._enabled = true;
            console.log(`[Biometric] Enabled for account: ${account}`);
        } catch (e) {
            console.error('[Biometric] Failed to enable:', e);
            throw e;
        }
    },

    /**
     * Disable biometric unlock — removes password from secure storage
     */
    async disable() {
        try {
            if (this._plugin) {
                await this._plugin.deleteCredentials({ server: this._server });
            }
        } catch (e) {
            // Key might not exist — that's fine
            console.warn('[Biometric] Failed to remove from secure storage:', e);
        }

        // Clear all localStorage state
        localStorage.removeItem(this._LS_ENABLED);
        localStorage.removeItem(this._LS_ACCOUNT);

        this._enabled = false;
        console.log('[Biometric] Disabled');
    },

    /**
     * Update the stored password after a master password change
     * Only updates if biometric is currently enabled
     * @param {string} newPassword
     */
    async updatePassword(newPassword) {
        if (!this._available || !this._enabled || !this._plugin) return;

        try {
            await this._plugin.setCredentials({
                username: 'keyhive',
                password: newPassword,
                server: this._server
            });
            console.log('[Biometric] Password updated in secure storage');
        } catch (e) {
            console.error('[Biometric] Failed to update password:', e);
            await this.disable();
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Biometric;
}
