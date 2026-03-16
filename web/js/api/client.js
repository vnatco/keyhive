/**
 * API Client
 * Handles all communication with the backend API
 * Browser: Uses HttpOnly cookies for auth tokens
 * Native apps (Electron/Capacitor): Uses Authorization header + localStorage tokens
 */

const ApiClient = {
    baseUrl: Config.API_URL,
    csrfToken: null,
    isAuthenticated: false,

    // Native app only: tokens stored in memory/localStorage
    accessToken: null,
    refreshToken: null,
    deviceToken: null,

    /**
     * Check if running in a native app (Electron, Capacitor)
     * Native apps can't use HttpOnly cookies cross-origin, so they use Authorization headers.
     * @returns {boolean}
     */
    isNativeApp() {
        return Platform.isNative();
    },

    /**
     * Initialize client with stored data
     */
    init() {
        // Native app: restore state from secure storage (tokens loaded by SecureTokenStore.init())
        if (this.isNativeApp()) {
            this.accessToken = SecureTokenStore.get('access_token');
            this.refreshToken = SecureTokenStore.get('refresh_token');
            this.deviceToken = SecureTokenStore.get('device_token');
            this.isAuthenticated = localStorage.getItem('authenticated') === 'true';
            this.csrfToken = localStorage.getItem('csrf_token');
        } else {
            // Browser: use sessionStorage (cleared when tab closes)
            this.csrfToken = sessionStorage.getItem('csrf_token');
            this.isAuthenticated = sessionStorage.getItem('authenticated') === 'true';
            // Clean up old localStorage device_token (migrated to HttpOnly cookie)
            localStorage.removeItem('device_token');
        }
    },

    /**
     * Store tokens (Electron only)
     * @param {Object} tokens - {access_token, refresh_token, device_token}
     */
    setTokens(tokens) {
        if (!tokens) return;

        if (tokens.access_token) {
            this.accessToken = tokens.access_token;
            SecureTokenStore.set('access_token', tokens.access_token);
        }
        if (tokens.refresh_token) {
            this.refreshToken = tokens.refresh_token;
            SecureTokenStore.set('refresh_token', tokens.refresh_token);
        }
        if (tokens.device_token) {
            this.deviceToken = tokens.device_token;
            SecureTokenStore.set('device_token', tokens.device_token);
        }
    },

    /**
     * Clear tokens (desktop/mobile app only)
     */
    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        SecureTokenStore.clearAuth();
        // NOTE: device_token is NOT cleared - it's a long-lived trust token
        // that must survive logout to recognize this device on next login
    },

    /**
     * Set CSRF token after login
     * @param {string} csrfToken
     */
    setCsrfToken(csrfToken) {
        this.csrfToken = csrfToken;
        const storage = this.isNativeApp() ? localStorage : sessionStorage;
        if (csrfToken) {
            storage.setItem('csrf_token', csrfToken);
        } else {
            storage.removeItem('csrf_token');
        }
    },

    /**
     * Mark as authenticated
     */
    setAuthenticated(authenticated) {
        this.isAuthenticated = authenticated;
        const storage = this.isNativeApp() ? localStorage : sessionStorage;
        if (authenticated) {
            storage.setItem('authenticated', 'true');
        } else {
            storage.removeItem('authenticated');
        }
    },

    /**
     * Clear auth state on logout
     */
    clearAuth() {
        this.csrfToken = null;
        this.isAuthenticated = false;

        // Clear from both storages to be safe
        sessionStorage.removeItem('csrf_token');
        sessionStorage.removeItem('authenticated');
        localStorage.removeItem('csrf_token');
        localStorage.removeItem('authenticated');

        // Electron: also clear tokens
        if (this.isNativeApp()) {
            this.clearTokens();
        }
    },

    /**
     * Make API request
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    async request(method, endpoint, data = null, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
        };

        // Include CSRF token for state-changing requests
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && this.csrfToken) {
            headers['X-CSRF-Token'] = this.csrfToken;
        }

        // Native apps: add Authorization header with access token
        const isNative = this.isNativeApp();
        if (isNative && this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const config = {
            method,
            headers,
            credentials: 'include', // Send cookies with request (browser mode)
        };

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        try {
            let response = await fetch(url, config);

            // Handle 401 - try to refresh token
            if (response.status === 401 && this.isAuthenticated && !options.isRefresh) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    // Retry original request with new CSRF token
                    if (this.csrfToken) {
                        headers['X-CSRF-Token'] = this.csrfToken;
                    }
                    response = await fetch(url, { ...config, headers });
                } else {
                    // Refresh failed — session is revoked, force logout
                    if (!options.noLogout && typeof App !== 'undefined' && App.logout) {
                        console.warn('[ApiClient] Session revoked, logging out');
                        App.logout();
                    }
                    throw new ApiError('Session expired', 401);
                }
            }

            const json = await response.json();

            // Handle 402 - subscription required
            if (response.status === 402) {
                // Store subscription info for the subscription page
                if (json.data) {
                    this._subscriptionData = json.data;
                }
                if (typeof App !== 'undefined' && App.showView) {
                    App.state.subscription = json.data || {};
                    App.showView('subscription');
                }
                throw new ApiError(json.message || 'Subscription required', 402, json);
            }

            if (!response.ok) {
                throw new ApiError(json.message || 'Request failed', response.status, json);
            }

            // Auto-update CSRF token if rotated (after sensitive operations)
            if (json.data && json.data.csrf_token) {
                this.setCsrfToken(json.data.csrf_token);
            }

            // Native apps: store tokens from response
            if (isNative && json.data && json.data.tokens) {
                this.setTokens(json.data.tokens);
            }

            return json;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(`Network error: ${error.message}`, 0, { originalError: error.message });
        }
    },

    /**
     * Refresh access token
     * @returns {Promise<boolean>}
     */
    async refreshAccessToken() {
        try {
            // Native apps: send refresh_token in body (can't use cookies cross-origin)
            const body = this.isNativeApp() && this.refreshToken
                ? { refresh_token: this.refreshToken }
                : null;

            const response = await this.request('POST', '/auth/refresh', body, {
                isRefresh: true,
            });

            if (response.success && response.data.csrf_token) {
                this.setCsrfToken(response.data.csrf_token);
                return true;
            }
        } catch (error) {
            // Refresh failed, clear auth
            this.clearAuth();
        }
        return false;
    },

    // Convenience methods
    get(endpoint, options) {
        return this.request('GET', endpoint, null, options);
    },

    post(endpoint, data, options) {
        return this.request('POST', endpoint, data, options);
    },

    put(endpoint, data, options) {
        return this.request('PUT', endpoint, data, options);
    },

    delete(endpoint, data, options) {
        return this.request('DELETE', endpoint, data, options);
    },

    // ==================
    // Auth endpoints
    // ==================

    async register(email, password, name) {
        const response = await this.post('/auth/register', { email, password, name });
        if (response.success && response.data.csrf_token) {
            this.setCsrfToken(response.data.csrf_token);
            this.setAuthenticated(true);
        }
        return response;
    },

    async login(email, password) {
        // Browser: device_token is HttpOnly cookie — sent automatically
        // Native apps: send device_token in body (cookies don't work cross-origin)
        const body = { email, password };
        if (this.isNativeApp() && this.deviceToken) {
            body.device_token = this.deviceToken;
        }

        const response = await this.post('/auth/login', body);
        // Only set tokens if no 2FA required (trusted device or direct login)
        if (response.success && response.data.csrf_token && !response.data.requires_2fa) {
            this.setCsrfToken(response.data.csrf_token);
            this.setAuthenticated(true);
        }
        return response;
    },

    // 2FA verification during login
    async verify2FA(pendingToken, code, method = null, trustDevice = false) {
        const response = await this.post('/auth/2fa/verify', {
            pending_token: pendingToken,
            code,
            method,
            trust_device: trustDevice
        });
        if (response.success && response.data.csrf_token) {
            this.setCsrfToken(response.data.csrf_token);
            this.setAuthenticated(true);
            // device_token set as HttpOnly cookie by server
        }
        return response;
    },

    // Request fallback to email OTP during login
    async fallbackToEmail(pendingToken) {
        return this.post('/auth/2fa/fallback', { pending_token: pendingToken });
    },

    // Resend email OTP during login
    async resendEmailOTP(pendingToken) {
        return this.post('/auth/2fa/resend', { pending_token: pendingToken });
    },

    // WebAuthn login verification (no auth required)
    async webauthnLoginOptions(pendingToken) {
        return this.post('/auth/2fa/webauthn/login-options', { pending_token: pendingToken });
    },

    async webauthnLoginVerify(pendingToken, credential, trustDevice = false) {
        const response = await this.post('/auth/2fa/webauthn/login-verify', {
            pending_token: pendingToken,
            credential,
            trust_device: trustDevice
        });
        if (response.success && response.data.csrf_token) {
            this.setCsrfToken(response.data.csrf_token);
            this.setAuthenticated(true);
            // device_token set as HttpOnly cookie by server
        }
        return response;
    },

    // Password reset endpoints (no auth required)
    async forgotPassword(email) {
        return this.post('/auth/forgot-password', { email });
    },

    async verifyResetToken(token) {
        return this.post('/auth/verify-reset-token', { token });
    },

    async resetPassword(pendingToken, newPassword, code = null, method = null) {
        const data = { pending_token: pendingToken };
        if (newPassword) data.new_password = newPassword;
        if (code) data.code = code;
        if (method) data.method = method;
        return this.post('/auth/reset-password', data);
    },

    // ==================
    // 2FA Settings (authenticated)
    // ==================

    get2FAStatus() {
        return this.get('/auth/2fa');
    },

    enable2FA(password) {
        return this.post('/auth/2fa/enable', { password });
    },

    disable2FA(password) {
        return this.post('/auth/2fa/disable', { password });
    },

    totpSetup(password) {
        return this.post('/auth/2fa/totp/setup', { password });
    },

    totpConfirm(code, password) {
        return this.post('/auth/2fa/totp/confirm', { code, password });
    },

    totpDisable(password) {
        return this.post('/auth/2fa/totp/disable', { password });
    },

    // Email OTP setup (sends code to user's email)
    sendEmailOTPSetup() {
        return this.post('/auth/2fa/email/setup');
    },

    // Verify Email OTP setup code
    verifyEmailOTPSetup(code) {
        return this.post('/auth/2fa/email/verify', { code });
    },

    // WebAuthn (Security Key) methods
    webauthnRegisterOptions() {
        return this.post('/auth/2fa/webauthn/register-options');
    },

    webauthnRegisterVerify(credential, name) {
        return this.post('/auth/2fa/webauthn/register-verify', { credential, name });
    },

    webauthnListCredentials() {
        return this.get('/auth/2fa/webauthn/credentials');
    },

    webauthnDeleteCredential(credentialId, password) {
        return this.post('/auth/2fa/webauthn/delete', { credential_id: credentialId, password });
    },

    // Registration flow methods
    verifyRegistrationEmail(code, trustDevice = false) {
        return this.post('/auth/2fa/registration/verify-email', { code, trust_device: trustDevice });
    },

    resendRegistrationEmail() {
        return this.post('/auth/2fa/registration/resend-email');
    },

    confirmSubscriptionStep() {
        return this.post('/auth/2fa/registration/confirm-subscription');
    },

    confirmRecoveryKeys() {
        return this.post('/auth/2fa/registration/confirm-recovery');
    },

    resetRegistrationToMaster() {
        return this.post('/auth/2fa/registration/reset-to-master');
    },

    async logout() {
        try {
            await this.post('/auth/logout');
        } finally {
            this.clearAuth();
        }
    },

    getMe() {
        return this.get('/auth/me');
    },

    // ==================
    // Master password endpoints
    // ==================

    getSalt() {
        return this.get('/master/salt');
    },

    // Zero-knowledge: only salt and KDF params sent to server, no verification hash
    setupMaster(salt, kdfParams = {}) {
        return this.post('/master/setup', {
            salt,
            kdf_memory: kdfParams.memory || 65536,
            kdf_iterations: kdfParams.iterations || 3,
            kdf_parallelism: kdfParams.parallelism || 4,
        });
    },

    // NOTE: verifyMaster removed - verification happens client-side by attempting decryption
    // This is true zero-knowledge architecture

    // Change master password - re-encrypts all vault data with new key
    changeMaster(newSalt, items, folders) {
        return this.post('/master/change', {
            new_salt: newSalt,
            items,
            folders,    // Includes vaults (root folders with parent_folder_id = null)
        });
    },

    // Change KDF parameters - requires re-encryption of all vault data
    changeKdf(newSalt, kdfParams, items, folders) {
        return this.post('/master/change-kdf', {
            new_salt: newSalt,
            kdf_memory: kdfParams.memory,
            kdf_iterations: kdfParams.iterations,
            kdf_parallelism: kdfParams.parallelism,
            items,
            folders,    // Includes vaults (root folders with parent_folder_id = null)
        });
    },

    recover(recoveryCodeHash) {
        return this.post('/master/recover', { recovery_code_hash: recoveryCodeHash });
    },

    // ==================
    // Vault endpoints
    // ==================

    getItems() {
        return this.get('/vault/items');
    },

    getItemsByType(type) {
        return this.get(`/vault/items/type/${type}`);
    },

    getItemsByFolder(folderId) {
        return this.get(`/vault/items/folder/${folderId}`);
    },

    getItem(id) {
        return this.get(`/vault/items/${id}`);
    },

    createItem(itemType, encryptedData, folderId = null, sortOrder = null, id = null, createdAt = null, updatedAt = null) {
        const data = {
            item_type: itemType,
            encrypted_data: encryptedData,
            folder_id: folderId,
            sort_order: sortOrder,
        };
        if (id) data.id = id;
        if (createdAt) data.created_at = createdAt;
        if (updatedAt) data.updated_at = updatedAt;
        return this.post('/vault/items', data);
    },

    updateItem(id, encryptedData, folderId, sortOrder, itemType, deletedAt, updatedAt) {
        const data = {};
        if (encryptedData != null) data.encrypted_data = encryptedData;
        if (folderId != null) data.folder_id = folderId;
        if (sortOrder != null) data.sort_order = sortOrder;
        if (itemType != null) data.item_type = itemType;
        if (deletedAt !== undefined) data.deleted_at = deletedAt; // null = restore, timestamp = soft delete
        if (updatedAt != null) data.updated_at = updatedAt;
        return this.put(`/vault/items/${id}`, data);
    },

    deleteItem(id) {
        return this.delete(`/vault/items/${id}`);
    },

    updateItemsOrder(orderData) {
        return this.put('/vault/items/order', { items: orderData });
    },

    getTrash() {
        return this.get('/vault/trash');
    },

    emptyTrash() {
        return this.delete('/vault/trash');
    },

    // ==================
    // Vault endpoints (Vaults = Root Folders)
    // ==================

    getVaults() {
        return this.get('/vault/vaults');
    },

    getVault(id) {
        return this.get(`/vault/vaults/${id}`);
    },

    createVault(encryptedName, encryptedIcon = null, sortOrder = null, id = null, createdAt = null, updatedAt = null) {
        const data = {
            encrypted_name: encryptedName,
            encrypted_icon: encryptedIcon,
            sort_order: sortOrder,
        };
        if (id) data.id = id;
        if (createdAt) data.created_at = createdAt;
        if (updatedAt) data.updated_at = updatedAt;
        return this.post('/vault/vaults', data);
    },

    updateVault(id, encryptedName = null, encryptedIcon = undefined, isDefault = null, deletedAt = undefined, updatedAt = null) {
        const data = {};
        if (encryptedName !== null) data.encrypted_name = encryptedName;
        if (encryptedIcon !== undefined) data.encrypted_icon = encryptedIcon;
        if (isDefault !== null) data.is_default = isDefault;
        if (deletedAt !== undefined) data.deleted_at = deletedAt;
        if (updatedAt) data.updated_at = updatedAt;
        return this.put(`/vault/vaults/${id}`, data);
    },

    deleteVault(id) {
        return this.delete(`/vault/vaults/${id}`);
    },

    updateVaultsOrder(orderData) {
        return this.put('/vault/vaults/order', { vaults: orderData });
    },

    // ==================
    // Folder endpoints
    // ==================

    getFolders() {
        return this.get('/folders');
    },

    getFoldersByVault(vaultId) {
        return this.get(`/folders?vault_id=${vaultId}`);
    },

    getFolder(id) {
        return this.get(`/folders/${id}`);
    },

    createFolder(parentFolderId, encryptedName, encryptedIcon = null, sortOrder = null, id = null, createdAt = null, updatedAt = null) {
        const data = {
            parent_folder_id: parentFolderId,
            encrypted_name: encryptedName,
            encrypted_icon: encryptedIcon,
            sort_order: sortOrder,
        };
        if (id) data.id = id;
        if (createdAt) data.created_at = createdAt;
        if (updatedAt) data.updated_at = updatedAt;
        return this.post('/folders', data);
    },

    updateFolder(id, encryptedName = null, encryptedIcon = undefined, parentFolderId = undefined, deletedAt = undefined, updatedAt = null, isDefault = undefined) {
        const data = {};
        if (encryptedName !== null) data.encrypted_name = encryptedName;
        if (encryptedIcon !== undefined) data.encrypted_icon = encryptedIcon;
        if (parentFolderId !== undefined) data.parent_folder_id = parentFolderId;
        if (deletedAt !== undefined) data.deleted_at = deletedAt; // null = restore, timestamp = soft delete
        if (updatedAt) data.updated_at = updatedAt;
        if (isDefault !== undefined) data.is_default = isDefault; // For vaults only
        return this.put(`/folders/${id}`, data);
    },

    moveFolder(id, parentFolderId, updatedAt = null) {
        const data = {
            parent_folder_id: parentFolderId,
        };
        if (updatedAt) data.updated_at = updatedAt;
        return this.put(`/folders/${id}`, data);
    },

    deleteFolder(id) {
        return this.delete(`/folders/${id}`);
    },

    updateFoldersOrder(orderData) {
        return this.put('/folders/order', { folders: orderData });
    },

    // ==================
    // File endpoints
    // ==================

    uploadFile(itemId, encryptedContent, originalSize) {
        return this.post('/files', {
            item_id: itemId,
            encrypted_content: encryptedContent,
            original_size: originalSize,
        });
    },

    downloadFile(itemId) {
        return this.get(`/files/${itemId}`);
    },

    deleteFile(itemId) {
        return this.delete(`/files/${itemId}`);
    },

    // Re-upload a file with new encryption (for master password/KDF change)
    updateFileContent(itemId, encryptedContent) {
        return this.put(`/files/${itemId}`, {
            encrypted_content: encryptedContent
        });
    },

    getStorageUsage() {
        return this.get('/files/usage');
    },

    // ==================
    // Settings endpoints
    // ==================

    getSettings() {
        return this.get('/settings');
    },

    updateSettings(settings) {
        return this.put('/settings', settings);
    },

    getAuditLog(limit = 50) {
        return this.get(`/settings/audit-log?limit=${limit}`);
    },

    getSessions() {
        return this.get('/settings/sessions');
    },

    revokeSession(sessionId) {
        return this.delete(`/settings/sessions/${sessionId}`);
    },

    revokeAllSessions() {
        return this.delete('/settings/sessions');
    },

    changePassword(currentPassword, newPassword) {
        return this.post('/settings/change-password', {
            current_password: currentPassword,
            new_password: newPassword,
        });
    },

    deleteAccount(password) {
        return this.delete('/settings/account', { password });
    },

    // Recovery codes
    getRecoveryCodesCount() {
        return this.get('/settings/recovery-codes');
    },

    generateRecoveryCodes(codes) {
        // Strip plaintext codes - only send hash + encrypted key (zero-knowledge)
        const serverCodes = codes.map(c => ({ code_hash: c.code_hash, encrypted_key: c.encrypted_key }));
        return this.post('/settings/recovery-codes', { codes: serverCodes });
    },

    deleteRecoveryCodes() {
        return this.delete('/settings/recovery-codes');
    },

    // ==================
    // Sync endpoints
    // ==================

    fullSync() {
        return this.get('/sync/full');
    },

    syncChanges(since) {
        return this.get(`/sync?since=${encodeURIComponent(since)}`);
    },

    pushChanges(items, folders) {
        return this.post('/sync/push', { items, folders });
    },

    // ==================
    // Subscription endpoints
    // ==================

    getSubscriptionStatus() {
        return this.get('/subscription/status');
    },

    createCheckout(priceId) {
        return this.post('/subscription/checkout', { price_id: priceId });
    },

    createPortal() {
        return this.post('/subscription/portal');
    },

    // ==================
    // Cleanup endpoints
    // ==================

    scanCleanup() {
        return this.get('/cleanup/scan');
    },

    runCleanup() {
        return this.post('/cleanup/run');
    },
};

/**
 * API Error class
 */
class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// Initialize on load
ApiClient.init();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiClient, ApiError };
}
