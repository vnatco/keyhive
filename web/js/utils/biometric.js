/**
 * Biometric Unlock Manager
 *
 * Enables Face ID / Touch ID / fingerprint unlock on Capacitor mobile apps.
 * Stores the master password in iOS Keychain / Android Keystore (hardware-backed)
 * and retrieves it only after successful biometric authentication.
 *
 * On non-Capacitor platforms (browser, Electron), this is a no-op.
 * The crypto flow is unchanged — biometric is just a secure password retrieval mechanism.
 */

const Biometric = {
    _available: false,   // device has biometric hardware + Capacitor runtime
    _enabled: false,     // user has opted in (flag in LocalDB)
    _initialized: false,

    /**
     * Initialize biometric support
     * Checks hardware availability and user opt-in flag
     */
    async init() {
        this._available = false;
        this._enabled = false;
        this._initialized = true;

        // Only available in Capacitor runtime
        if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) {
            return;
        }

        // Check if biometric plugins are available
        if (typeof BiometricAuth === 'undefined' || typeof SecureStoragePlugin === 'undefined') {
            console.warn('[Biometric] Plugins not available');
            return;
        }

        try {
            const result = await BiometricAuth.isAvailable();
            if (!result || (!result.has && !result.isAvailable)) {
                console.log('[Biometric] No biometric hardware available');
                return;
            }
            this._available = true;
        } catch (e) {
            console.log('[Biometric] Availability check failed:', e.message);
            return;
        }

        // Check user opt-in flag from LocalDB
        try {
            if (typeof LocalDB !== 'undefined' && LocalDB.db) {
                const enabled = await LocalDB.getUserDataValue('biometric_enabled');
                this._enabled = enabled === true;
            }
        } catch (e) {
            console.warn('[Biometric] Failed to read enabled flag:', e);
        }

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
     * Authenticate with biometrics and retrieve the stored master password
     * @returns {Promise<string|null>} The master password, or null on failure/cancel
     */
    async authenticate() {
        if (!this._available || !this._enabled) return null;

        try {
            // Prompt biometric authentication
            await BiometricAuth.authenticate({
                reason: 'Unlock KeyHive',
                title: 'Biometric Unlock',
                subtitle: 'Verify your identity to unlock your vault',
                negativeButtonText: 'Use Password'
            });

            // Biometric succeeded — retrieve password from secure storage
            const result = await SecureStoragePlugin.get({ key: 'master_password' });
            if (result?.value) {
                return result.value;
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
     * Called after first successful typed unlock when user accepts the prompt
     * @param {string} masterPassword
     */
    async enable(masterPassword) {
        if (!this._available) return;

        try {
            await SecureStoragePlugin.set({ key: 'master_password', value: masterPassword });

            if (typeof LocalDB !== 'undefined') {
                await LocalDB.setUserDataValue('biometric_enabled', true);
            }

            this._enabled = true;
            console.log('[Biometric] Enabled');
        } catch (e) {
            console.error('[Biometric] Failed to enable:', e);
            throw e;
        }
    },

    /**
     * Disable biometric unlock — removes password from secure storage
     * Called on logout or when user toggles off in settings
     */
    async disable() {
        try {
            if (typeof SecureStoragePlugin !== 'undefined') {
                await SecureStoragePlugin.remove({ key: 'master_password' });
            }
        } catch (e) {
            // Key might not exist — that's fine
            console.warn('[Biometric] Failed to remove from secure storage:', e);
        }

        try {
            if (typeof LocalDB !== 'undefined' && LocalDB.db) {
                await LocalDB.setUserDataValue('biometric_enabled', false);
            }
        } catch (e) {
            console.warn('[Biometric] Failed to clear enabled flag:', e);
        }

        this._enabled = false;
        console.log('[Biometric] Disabled');
    },

    /**
     * Update the stored password after a master password change
     * Only updates if biometric is currently enabled
     * @param {string} newPassword
     */
    async updatePassword(newPassword) {
        if (!this._available || !this._enabled) return;

        try {
            await SecureStoragePlugin.set({ key: 'master_password', value: newPassword });
            console.log('[Biometric] Password updated in secure storage');
        } catch (e) {
            console.error('[Biometric] Failed to update password:', e);
            // Disable biometric if we can't update — user will be prompted to re-enable
            await this.disable();
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Biometric;
}
