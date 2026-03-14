/**
 * Application Configuration
 */
const Config = {
    // App version (dev default, overwritten by build)
    VERSION: '1.3.0',

    // Public-facing domain (shown to users on mobile, no protocol)
    APP_DOMAIN: 'keyhive.app',
	
    // Application URL (used for external registration links)
    APP_URL: 'https://web.keyhive.app',
	
    // API URL
    API_URL: 'https://api.keyhive.app',

    // Free trial days for new cloud accounts (0 = no trial)
    TRIAL_DAYS: 14,

    // Skip the subscription step during registration when trial is active
    // true = auto-skip to master password setup (user gets full trial without seeing payment page)
    // false = show subscription page with subscribe/skip options
    // Ignored when TRIAL_DAYS = 0 (payment is always required)
    SKIP_TRIAL_PAYMENT: true,

    // Session timeout in minutes (default)
    SESSION_TIMEOUT: 15,

    // Auto-lock options (in minutes)
    AUTO_LOCK_OPTIONS: [5, 10, 15, 30, 60],

};

// Freeze config to prevent modification
Object.freeze(Config);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}
