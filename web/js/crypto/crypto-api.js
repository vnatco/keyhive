/**
 * Crypto API - Main Thread Interface
 *
 * SECURITY: This module communicates with the crypto worker.
 * The encryption key NEVER exists in this thread.
 * All crypto operations are performed in the isolated worker.
 *
 * This provides the same API as the old KeyDerivation and Encryption modules,
 * but all operations are routed through the secure worker.
 */

const CryptoAPI = {
    _worker: null,
    _ready: false,
    _readyPromise: null,
    _pendingRequests: new Map(),
    _requestId: 0,

    // ============================================================
    // INITIALIZATION
    // ============================================================

    /**
     * Initialize the crypto worker
     * @returns {Promise<void>}
     */
    init() {
        if (this._readyPromise) {
            return this._readyPromise;
        }

        this._readyPromise = new Promise((resolve, reject) => {
            try {
                this._worker = new Worker('/js/crypto/crypto-worker.js');

                this._worker.onmessage = (event) => {
                    const data = event.data;

                    // Handle ready signal
                    if (data.ready) {
                        this._ready = true;
                        resolve();
                        return;
                    }

                    // Handle request responses
                    const { id, success, result, error } = data;
                    const pending = this._pendingRequests.get(id);

                    if (pending) {
                        this._pendingRequests.delete(id);

                        if (success) {
                            pending.resolve(result);
                        } else {
                            pending.reject(new Error(error));
                        }
                    }
                };

                this._worker.onerror = (error) => {
                    console.error('Crypto worker error:', error);
                    reject(error);
                };

                // Timeout for worker initialization
                setTimeout(() => {
                    if (!this._ready) {
                        reject(new Error('Crypto worker initialization timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });

        return this._readyPromise;
    },

    /**
     * Send a request to the worker
     * @private
     */
    _request(action, payload = {}) {
        return new Promise((resolve, reject) => {
            if (!this._ready) {
                reject(new Error('Crypto worker not initialized'));
                return;
            }

            const id = ++this._requestId;
            this._pendingRequests.set(id, { resolve, reject });
            this._worker.postMessage({ id, action, payload });
        });
    },

    // ============================================================
    // KEY DERIVATION (replaces KeyDerivation module)
    // ============================================================

    /**
     * Derive encryption key from master password
     * @param {string} masterPassword
     * @param {string} salt - Base64 encoded salt
     * @param {Object} kdf - Optional KDF parameters {memory, iterations, parallelism}
     * @returns {Promise<{verificationHash: string}>}
     */
    async deriveKey(masterPassword, salt, kdf = null) {
        await this.init();
        return this._request('deriveKey', { password: masterPassword, salt, kdf });
    },

    /**
     * Derive key with a new randomly generated salt
     * @param {string} masterPassword
     * @returns {Promise<{verificationHash: string, salt: string}>}
     */
    async deriveKeyWithNewSalt(masterPassword) {
        await this.init();
        return this._request('deriveKeyWithSalt', { password: masterPassword });
    },

    /**
     * Derive key for verification only (does NOT replace cached key)
     * Used to verify a password matches before sensitive operations
     * @param {string} password
     * @param {string} salt - Base64 encoded salt
     * @param {Object} kdf - KDF parameters {memory, iterations, parallelism}
     * @returns {Promise<{verificationHash: string}>}
     */
    async deriveKeyForVerification(password, salt, kdf = null) {
        await this.init();
        return this._request('deriveKeyForVerification', { password, salt, kdf });
    },

    /**
     * Verify a verification hash matches current key
     * @param {string} verificationHash
     * @returns {Promise<{valid: boolean}>}
     */
    async verifyKey(verificationHash) {
        await this.init();
        return this._request('verifyKey', { verificationHash });
    },

    /**
     * Check if vault is unlocked (key is loaded)
     * @returns {Promise<boolean>}
     */
    async isUnlocked() {
        await this.init();
        const result = await this._request('isUnlocked');
        return result.unlocked;
    },

    /**
     * Get current verification hash
     * @returns {Promise<string|null>}
     */
    async getVerificationHash() {
        await this.init();
        const result = await this._request('getVerificationHash');
        return result.hash;
    },

    /**
     * Generate a new random salt
     * @returns {Promise<string>} - Base64 encoded salt
     */
    async generateSalt() {
        await this.init();
        const result = await this._request('generateSalt');
        return result.salt;
    },

    /**
     * Lock the vault (clear the key from worker memory)
     * @returns {Promise<void>}
     */
    async lock() {
        await this.init();
        await this._request('lock');
    },

    /**
     * Verify master password by re-deriving key and comparing verification hash
     * @param {string} password - Master password to verify
     * @returns {Promise<boolean>} - True if password is correct
     */
    async verifyMasterPassword(password) {
        await this.init();

        try {
            let salt, kdf;

            // Check for local mode or offline
            const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';
            const isOffline = typeof Vault !== 'undefined' && Vault.isOffline();

            if (isLocalMode || isOffline) {
                // Get salt and KDF from LocalDB
                if (typeof LocalDB !== 'undefined') {
                    const offlineAuth = await LocalDB.getOfflineAuth();
                    if (!offlineAuth) {
                        throw new Error('No offline auth data available');
                    }
                    salt = offlineAuth.salt;
                    kdf = offlineAuth.kdf;
                } else {
                    throw new Error('LocalDB not available');
                }
            } else {
                // Get current salt and KDF from server
                const saltResponse = await ApiClient.getSalt();
                if (!saltResponse.success) {
                    throw new Error('Failed to get salt');
                }
                salt = saltResponse.data.salt;
                kdf = saltResponse.data.kdf;
            }

            // Derive key for verification (doesn't replace cached key)
            const derived = await this._request('deriveKeyForVerification', { password, salt, kdf });

            // Get current verification hash
            const current = await this._request('getVerificationHash');

            // Compare using timing-safe comparison in worker
            const cmpResult = await this._request('compareHashes', {
                a: derived.verificationHash,
                b: current.hash
            });
            return cmpResult.equal;
        } catch (e) {
            console.error('Master password verification failed:', e);
            return false;
        }
    },

    // ============================================================
    // ENCRYPTION / DECRYPTION (replaces Encryption module)
    // ============================================================

    /**
     * Encrypt plaintext string
     * @param {string} plaintext
     * @returns {Promise<string>} - Base64 encoded ciphertext
     */
    async encrypt(plaintext) {
        await this.init();
        const result = await this._request('encrypt', { plaintext });
        return result.ciphertext;
    },

    /**
     * Decrypt ciphertext
     * @param {string} ciphertext - Base64 encoded
     * @returns {Promise<string>} - Decrypted plaintext
     */
    async decrypt(ciphertext) {
        await this.init();
        const result = await this._request('decrypt', { ciphertext });
        return result.plaintext;
    },

    /**
     * Encrypt a JavaScript object
     * @param {Object} obj
     * @returns {Promise<string>} - Base64 encoded ciphertext
     */
    async encryptObject(obj) {
        await this.init();
        const result = await this._request('encryptObject', { obj });
        return result.ciphertext;
    },

    /**
     * Decrypt to a JavaScript object
     * @param {string} ciphertext
     * @returns {Promise<Object>}
     */
    async decryptObject(ciphertext) {
        await this.init();
        const result = await this._request('decryptObject', { ciphertext });
        return result.obj;
    },

    /**
     * Encrypt a field value (alias for encrypt)
     * @param {string} value
     * @returns {Promise<string>}
     */
    async encryptField(value) {
        return this.encrypt(value);
    },

    /**
     * Decrypt a field value (alias for decrypt)
     * @param {string} ciphertext
     * @returns {Promise<string>}
     */
    async decryptField(ciphertext) {
        return this.decrypt(ciphertext);
    },

    // ============================================================
    // FILE ENCRYPTION
    // ============================================================

    /**
     * Encrypt file content
     * @param {ArrayBuffer} fileData
     * @returns {Promise<string>} - Base64 encoded encrypted file
     */
    async encryptFile(fileData) {
        await this.init();
        const fileDataBase64 = this.arrayBufferToBase64(fileData);
        const result = await this._request('encryptFile', { fileDataBase64 });
        return result.encryptedFile;
    },

    /**
     * Decrypt file content
     * @param {string} encryptedFile - Base64 encoded
     * @returns {Promise<ArrayBuffer>}
     */
    async decryptFile(encryptedFile) {
        await this.init();
        const result = await this._request('decryptFile', { encryptedFile });
        return this.base64ToArrayBuffer(result.fileDataBase64);
    },

    // ============================================================
    // RECOVERY
    // ============================================================

    /**
     * SHA-256 hash a recovery code for zero-knowledge server verification
     * Used during recovery flow - hash code client-side before sending to server
     * @param {string} code - Plaintext recovery code
     * @returns {Promise<string>} - Hex-encoded SHA-256 hash
     */
    async hashRecoveryCode(code) {
        const data = new TextEncoder().encode(code);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Generate recovery codes with encrypted master key
     * @param {string} password - Master password (to re-derive key for raw bytes)
     * @param {string} salt - Current salt
     * @param {Object} kdf - KDF parameters {memory, iterations, parallelism}
     * @param {number} count - Number of codes to generate (default 8)
     * @returns {Promise<{codes: Array<{code: string, code_hash: string, encrypted_key: string}>}>}
     */
    async generateRecoveryCodes(password, salt, kdf, count = 8) {
        await this.init();
        return this._request('generateRecoveryCodes', { password, salt, kdf, count });
    },

    /**
     * Recover master key using recovery code
     * @param {string} code - Recovery code
     * @param {string} encrypted_key - Encrypted master key blob
     * @returns {Promise<{success: boolean, verificationHash: string}>}
     */
    async recoverWithCode(code, encrypted_key) {
        await this.init();
        return this._request('recoverWithCode', { code, encrypted_key });
    },

    // ============================================================
    // RE-ENCRYPTION (for master password change)
    // ============================================================

    /**
     * Re-encrypt all items with a new master password and/or KDF settings
     * @param {Array} items - Items with encrypted_data, encrypted_name, encrypted_icon
     * @param {string} newPassword - New master password
     * @param {string} newSalt - New salt for key derivation
     * @param {Object|null} newKdf - New KDF settings { memory, iterations, parallelism }, or null for defaults
     * @returns {Promise<{items: Array, verificationHash: string}>}
     */
    async reEncryptWithNewKey(items, newPassword, newSalt, newKdf = null) {
        await this.init();
        return this._request('reEncryptWithNewKey', {
            items,
            newPassword,
            newSalt,
            newKdf
        });
    },

    /**
     * Re-encrypt items for export WITHOUT switching the active key
     * Use this for exporting data with a different password while keeping the session intact
     * @param {Array} items - Items with encrypted_data, encrypted_name, encrypted_icon
     * @param {string} newPassword - Export password
     * @param {string} newSalt - New salt for key derivation
     * @param {Object|null} newKdf - KDF settings { memory, iterations, parallelism }, or null for defaults
     * @returns {Promise<{items: Array}>}
     */
    async reEncryptForExport(items, newPassword, newSalt, newKdf = null) {
        await this.init();
        return this._request('reEncryptForExport', {
            items,
            newPassword,
            newSalt,
            newKdf
        });
    },

    // ============================================================
    // IMPORT OPERATIONS
    // ============================================================

    /**
     * Decrypt data from an import file using a temporary key
     * Does NOT replace the user's current key - used for import operations
     * @param {Array} items - Items with encrypted_data, encrypted_name, encrypted_icon
     * @param {string} password - Import file password
     * @param {string} salt - Import file salt
     * @param {Object|null} kdf - Import file KDF settings
     * @returns {Promise<{items: Array, errors: Array|null}>}
     */
    async importDecrypt(items, password, salt, kdf = null) {
        await this.init();
        return this._request('importDecrypt', {
            items,
            password,
            salt,
            kdf
        });
    },

    /**
     * Re-encrypt already-decrypted data with the user's current key
     * Used during import to encrypt data from an import file with the user's key
     * @param {Array} items - Items with decrypted_data, decrypted_name, decrypted_icon
     * @returns {Promise<{items: Array}>}
     */
    async importReEncrypt(items) {
        await this.init();
        return this._request('importReEncrypt', { items });
    },

    // ============================================================
    // UTILITIES
    // ============================================================

    /**
     * Convert ArrayBuffer to Base64
     * @param {ArrayBuffer} buffer
     * @returns {string}
     */
    arrayBufferToBase64(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    /**
     * Convert Base64 to ArrayBuffer
     * @param {string} base64
     * @returns {Uint8Array}
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    /**
     * Generate random bytes as Base64
     * @param {number} length
     * @returns {string}
     */
    randomBase64(length) {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        return this.arrayBufferToBase64(bytes);
    }
};

// ============================================================
// BACKWARDS COMPATIBILITY LAYER
// These objects maintain the old API but route to CryptoAPI
// ============================================================

const KeyDerivation = {
    async deriveKey(masterPassword, salt) {
        const result = await CryptoAPI.deriveKey(masterPassword, salt);
        return {
            key: null,  // Key stays in worker - return null
            verificationHash: result.verificationHash
        };
    },

    async isUnlocked() {
        return CryptoAPI.isUnlocked();
    },

    async getVerificationHash() {
        return CryptoAPI.getVerificationHash();
    },

    generateSalt() {
        // Synchronous version for compatibility - uses crypto.getRandomValues
        const saltBytes = crypto.getRandomValues(new Uint8Array(32));
        return CryptoAPI.arrayBufferToBase64(saltBytes);
    },

    async lock() {
        return CryptoAPI.lock();
    },

    // Legacy method - no longer returns key
    getKey() {
        console.warn('KeyDerivation.getKey() is deprecated. Key is isolated in worker.');
        return null;
    }
};

const Encryption = {
    async encrypt(plaintext) {
        return CryptoAPI.encrypt(plaintext);
    },

    async decrypt(ciphertext) {
        return CryptoAPI.decrypt(ciphertext);
    },

    async encryptObject(obj) {
        return CryptoAPI.encryptObject(obj);
    },

    async decryptObject(ciphertext) {
        return CryptoAPI.decryptObject(ciphertext);
    },

    async encryptFile(fileData) {
        return CryptoAPI.encryptFile(fileData);
    },

    async decryptFile(encryptedData) {
        return CryptoAPI.decryptFile(encryptedData);
    },

    arrayBufferToBase64(buffer) {
        return CryptoAPI.arrayBufferToBase64(buffer);
    },

    base64ToArrayBuffer(base64) {
        return CryptoAPI.base64ToArrayBuffer(base64);
    },

    randomBase64(length) {
        return CryptoAPI.randomBase64(length);
    },

    randomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CryptoAPI, KeyDerivation, Encryption };
}
