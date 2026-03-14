/**
 * SecureTokenStore — Platform-aware secure token storage
 *
 * Electron:   Uses safeStorage (OS-level encryption via IPC)
 * Capacitor:  Falls back to localStorage (Capacitor has its own secure storage plugins)
 * Web:        Not used (web uses HttpOnly cookies)
 *
 * All reads are from in-memory cache (synchronous).
 * Writes persist to the platform's secure backend asynchronously.
 *
 * Must call SecureTokenStore.init() before use (loads encrypted tokens into memory).
 */

const SecureTokenStore = {
    // In-memory cache (populated on init)
    _cache: {},

    // Whether Electron secure storage is available
    _useSecure: false,

    /**
     * Initialize — load tokens from secure storage into memory
     * Must be called (and awaited) before ApiClient.init()
     */
    async init() {
        // Only Electron has secureStorage via electronAPI
        if (typeof window.electronAPI !== 'undefined' && window.electronAPI.secureStorage) {
            this._useSecure = true;
            await this._loadFromSecure();
            // Migrate any tokens left in localStorage from before this feature
            await this._migrateFromLocalStorage();
        }
    },

    /**
     * Load all known token keys from secure storage into memory
     */
    async _loadFromSecure() {
        const keys = ['access_token', 'refresh_token', 'device_token'];
        for (const key of keys) {
            try {
                const result = await window.electronAPI.secureStorage.get(key);
                if (result.success && result.value !== null) {
                    this._cache[key] = result.value;
                }
            } catch (e) {
                console.error(`[SecureTokenStore] Failed to load ${key}:`, e);
            }
        }
    },

    /**
     * One-time migration: move tokens from localStorage to secure storage
     */
    async _migrateFromLocalStorage() {
        const keys = ['access_token', 'refresh_token', 'device_token'];
        let migrated = false;

        for (const key of keys) {
            const value = localStorage.getItem(key);
            if (value && !this._cache[key]) {
                // Token exists in localStorage but not in secure storage — migrate it
                await this.set(key, value);
                migrated = true;
            }
            // Always clean up localStorage regardless
            if (value) {
                localStorage.removeItem(key);
            }
        }

        if (migrated) {
            console.log('[SecureTokenStore] Migrated tokens from localStorage to secure storage');
        }
    },

    /**
     * Get a token (synchronous — reads from memory cache)
     * @param {string} key
     * @returns {string|null}
     */
    get(key) {
        if (this._useSecure) {
            return this._cache[key] || null;
        }
        // Fallback: localStorage (Capacitor or other native platforms)
        return localStorage.getItem(key);
    },

    /**
     * Store a token (async — writes to secure backend + memory cache)
     * @param {string} key
     * @param {string} value
     */
    async set(key, value) {
        if (this._useSecure) {
            this._cache[key] = value;
            try {
                await window.electronAPI.secureStorage.set(key, value);
            } catch (e) {
                console.error(`[SecureTokenStore] Failed to store ${key}:`, e);
            }
            return;
        }
        // Fallback: localStorage
        localStorage.setItem(key, value);
    },

    /**
     * Delete a token
     * @param {string} key
     */
    async delete(key) {
        if (this._useSecure) {
            delete this._cache[key];
            try {
                await window.electronAPI.secureStorage.delete(key);
            } catch (e) {
                console.error(`[SecureTokenStore] Failed to delete ${key}:`, e);
            }
            return;
        }
        localStorage.removeItem(key);
    },

    /**
     * Clear all tokens (logout)
     * Note: device_token is intentionally NOT cleared (survives logout)
     */
    async clearAuth() {
        const authKeys = ['access_token', 'refresh_token'];
        for (const key of authKeys) {
            await this.delete(key);
        }
    }
};
