/**
 * SecretStore - In-memory secret storage
 *
 * Keeps decrypted secrets (passwords, TOTP keys, etc.) OUT of the DOM.
 * Instead of data-copy="MyPassword", the DOM gets data-copy-id="abc123"
 * and the actual value lives only in this JS Map.
 *
 * This prevents DOM-scraping attacks (XSS, malicious extensions)
 * from harvesting secrets via querySelectorAll('[data-copy]').
 */
const SecretStore = {
    _store: new Map(),

    /**
     * Store a secret and return its ID
     * @param {string} value - The secret value
     * @returns {string} - Opaque ID for DOM reference
     */
    store(value) {
        const id = this._generateId();
        this._store.set(id, value);
        return id;
    },

    /**
     * Store a secret with a specific ID (for item-based lookups)
     * @param {string} id - The ID to use
     * @param {string} value - The secret value
     */
    set(id, value) {
        this._store.set(id, value);
    },

    /**
     * Retrieve a secret by ID
     * @param {string} id
     * @returns {string|undefined}
     */
    get(id) {
        return this._store.get(id);
    },

    /**
     * Remove a specific secret
     * @param {string} id
     */
    remove(id) {
        this._store.delete(id);
    },

    /**
     * Clear all stored secrets (called on lock/logout)
     */
    clear() {
        this._store.clear();
    },

    /**
     * Generate a random opaque ID
     * @returns {string}
     */
    _generateId() {
        const bytes = new Uint8Array(12);
        crypto.getRandomValues(bytes);
        let id = '';
        for (let i = 0; i < bytes.length; i++) {
            id += bytes[i].toString(36);
        }
        return id;
    }
};
