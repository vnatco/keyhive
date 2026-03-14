/**
 * Session Timeout Manager
 * Auto-locks vault after period of inactivity
 */

const SessionTimeout = {
    timeout: 15 * 60 * 1000, // 15 minutes default
    lastActivity: Date.now(),
    timer: null,
    warningTimer: null,
    warningCallback: null,
    lockCallback: null,

    /**
     * Initialize session timeout
     * @param {Object} options
     */
    init(options = {}) {
        this.timeout = (options.timeout || 15) * 60 * 1000;
        this.warningCallback = options.onWarning || null;
        this.lockCallback = options.onLock || null;

        // Skip if timeout is 0 (never)
        if (this.timeout === 0) {
            return;
        }

        // Track activity
        this.bindEvents();

        // Start timer
        this.resetTimer();
    },

    /**
     * Bind activity events
     */
    bindEvents() {
        const events = ['click', 'keypress', 'mousemove', 'scroll', 'touchstart'];

        events.forEach(event => {
            document.addEventListener(event, () => this.recordActivity(), { passive: true });
        });

        // Also reset on API calls
        const originalFetch = window.fetch.bind(window);
        window.fetch = (...args) => {
            this.recordActivity();
            return originalFetch(...args);
        };
    },

    /**
     * Record user activity
     */
    recordActivity() {
        this.lastActivity = Date.now();
        this.resetTimer();
    },

    /**
     * Reset the timeout timer
     */
    resetTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
        }

        if (this.timeout === 0) {
            return; // Never timeout
        }

        // Warning 1 minute before lock
        const warningTime = this.timeout - 60000;
        if (warningTime > 0 && this.warningCallback) {
            this.warningTimer = setTimeout(() => {
                this.warningCallback(60); // 60 seconds warning
            }, warningTime);
        }

        // Lock timer
        this.timer = setTimeout(() => {
            this.lock();
        }, this.timeout);
    },

    /**
     * Lock the vault
     */
    async lock() {
        if (this.lockCallback) {
            this.lockCallback();
        }

        // Clear vault data
        if (typeof Vault !== 'undefined') {
            await Vault.lock();
        }

        // Clear timers
        if (this.timer) clearTimeout(this.timer);
        if (this.warningTimer) clearTimeout(this.warningTimer);
    },

    /**
     * Update timeout setting
     * @param {number} minutes - Timeout in minutes (0 = never)
     */
    setTimeout(minutes) {
        this.timeout = minutes * 60 * 1000;
        this.resetTimer();
    },

    /**
     * Get remaining time
     * @returns {number} - Milliseconds until lock
     */
    getRemaining() {
        if (this.timeout === 0) return Infinity;
        return Math.max(0, this.timeout - (Date.now() - this.lastActivity));
    },

    /**
     * Extend session (reset timer without activity)
     */
    extend() {
        this.lastActivity = Date.now();
        this.resetTimer();
    },

    /**
     * Stop tracking (e.g., on logout)
     */
    stop() {
        if (this.timer) clearTimeout(this.timer);
        if (this.warningTimer) clearTimeout(this.warningTimer);
        this.timer = null;
        this.warningTimer = null;
    },
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionTimeout;
}
