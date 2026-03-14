/**
 * Connectivity Manager
 *
 * Detects online/offline status and notifies the app.
 * Works across: Electron, Capacitor (iOS/Android), PWA, browsers
 */

const Connectivity = {
    _isOnline: navigator.onLine,
    _listeners: [],
    _checkInterval: null,
    _lastServerCheck: null,
    _checking: false,

    /**
     * Initialize connectivity monitoring
     */
    init() {
        // Listen for browser online/offline events
        window.addEventListener('online', () => this._handleOnline());
        window.addEventListener('offline', () => this._handleOffline());

        // Initial state
        this._isOnline = navigator.onLine;

        console.log('[Connectivity] Initialized, online:', this._isOnline);

        // If we think we're online, verify with a server ping
        if (this._isOnline) {
            this.checkServerConnection();
        }

        return this;
    },

    /**
     * Check if currently online
     * @returns {boolean}
     */
    isOnline() {
        return this._isOnline;
    },

    /**
     * Check if currently offline
     * @returns {boolean}
     */
    isOffline() {
        return !this._isOnline;
    },

    /**
     * Handle coming online
     */
    _handleOnline() {
        console.log('[Connectivity] Browser reports online');

        // Verify with server before confirming
        this.checkServerConnection();
    },

    /**
     * Handle going offline
     */
    _handleOffline() {
        console.log('[Connectivity] Browser reports offline');

        if (this._isOnline) {
            this._isOnline = false;
            this._notifyListeners('offline');
            this._dispatchEvent('offline');
        }
    },

    /**
     * Check if server is actually reachable
     * (navigator.onLine only checks local network, not internet)
     * @returns {Promise<boolean>}
     */
    async checkServerConnection() {
        // Prevent concurrent checks — return current state if already checking
        if (this._checking) {
            return this._isOnline;
        }

        this._checking = true;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const apiBase = Config.API_URL;
            const response = await fetch(`${apiBase}/health`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });

            clearTimeout(timeout);
            this._lastServerCheck = new Date();

            const isReachable = response.ok;

            // Update state if different
            if (isReachable !== this._isOnline) {
                this._isOnline = isReachable;
                this._notifyListeners(isReachable ? 'online' : 'offline');
                this._dispatchEvent(isReachable ? 'online' : 'offline');
            }

            return isReachable;
        } catch (error) {
            console.log('[Connectivity] Server check failed:', error.message);

            if (this._isOnline) {
                this._isOnline = false;
                this._notifyListeners('offline');
                this._dispatchEvent('offline');
            }

            return false;
        } finally {
            this._checking = false;
        }
    },

    /**
     * Start periodic server checks
     * @param {number} intervalMs - Check interval in milliseconds (default: 30s)
     */
    startPeriodicCheck(intervalMs = 30000) {
        this.stopPeriodicCheck();

        this._checkInterval = setInterval(() => {
            if (navigator.onLine) {
                this.checkServerConnection();
            }
        }, intervalMs);

        console.log('[Connectivity] Started periodic checks every', intervalMs, 'ms');
    },

    /**
     * Stop periodic server checks
     */
    stopPeriodicCheck() {
        if (this._checkInterval) {
            clearInterval(this._checkInterval);
            this._checkInterval = null;
        }
    },

    /**
     * Add a connectivity change listener
     * @param {Function} callback - Called with 'online' or 'offline'
     * @returns {Function} - Unsubscribe function
     */
    addListener(callback) {
        this._listeners.push(callback);

        // Return unsubscribe function
        return () => {
            const index = this._listeners.indexOf(callback);
            if (index > -1) {
                this._listeners.splice(index, 1);
            }
        };
    },

    /**
     * Remove a connectivity change listener
     * @param {Function} callback
     */
    removeListener(callback) {
        const index = this._listeners.indexOf(callback);
        if (index > -1) {
            this._listeners.splice(index, 1);
        }
    },

    /**
     * Notify all listeners
     * @param {string} status - 'online' or 'offline'
     */
    _notifyListeners(status) {
        console.log('[Connectivity] Status changed:', status);
        this._listeners.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('[Connectivity] Listener error:', error);
            }
        });
    },

    /**
     * Dispatch a custom event
     * @param {string} status - 'online' or 'offline'
     */
    _dispatchEvent(status) {
        window.dispatchEvent(new CustomEvent('connectivity', {
            detail: { status, isOnline: status === 'online' }
        }));

        // Also dispatch specific events
        window.dispatchEvent(new CustomEvent(`connectivity:${status}`));
    },

    /**
     * Wait for online status
     * @param {number} timeoutMs - Maximum wait time (default: 30s)
     * @returns {Promise<boolean>} - True if came online, false if timeout
     */
    waitForOnline(timeoutMs = 30000) {
        return new Promise((resolve) => {
            if (this._isOnline) {
                resolve(true);
                return;
            }

            const timeout = setTimeout(() => {
                this.removeListener(listener);
                resolve(false);
            }, timeoutMs);

            const listener = (status) => {
                if (status === 'online') {
                    clearTimeout(timeout);
                    this.removeListener(listener);
                    resolve(true);
                }
            };

            this.addListener(listener);
        });
    },

    /**
     * Execute callback when online (immediately if already online)
     * @param {Function} callback
     * @param {number} timeoutMs - Maximum wait time
     * @returns {Promise<*>} - Result of callback
     */
    async whenOnline(callback, timeoutMs = 30000) {
        const isOnline = await this.waitForOnline(timeoutMs);

        if (!isOnline) {
            throw new Error('Timed out waiting for online status');
        }

        return callback();
    },

    /**
     * Get time since last server check
     * @returns {number|null} - Milliseconds since last check, or null if never checked
     */
    getTimeSinceLastCheck() {
        if (!this._lastServerCheck) return null;
        return Date.now() - this._lastServerCheck.getTime();
    },

    /**
     * Get connectivity status info
     * @returns {Object}
     */
    getStatus() {
        return {
            isOnline: this._isOnline,
            navigatorOnline: navigator.onLine,
            lastServerCheck: this._lastServerCheck,
            timeSinceLastCheck: this.getTimeSinceLastCheck()
        };
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Connectivity;
}
