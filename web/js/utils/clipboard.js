/**
 * Clipboard Utility
 * Handles copying with auto-clear for sensitive data
 */

const Clipboard = {
    // Timeout handle for clearing
    _clearTimeout: null,

    // Default auto-clear delay (30 seconds)
    AUTO_CLEAR_DELAY: 30000,

    /**
     * Copy text to clipboard with auto-clear
     * @param {string} text - Text to copy
     * @param {boolean} sensitive - If true, auto-clear after delay
     * @returns {Promise<boolean>}
     */
    async copy(text, sensitive = true) {
        try {
            await navigator.clipboard.writeText(text);

            if (sensitive) {
                this.scheduleAutoClear();
            }

            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    },

    /**
     * Schedule clipboard auto-clear
     */
    scheduleAutoClear() {
        // Clear any existing timeout
        if (this._clearTimeout) {
            clearTimeout(this._clearTimeout);
        }

        // Schedule new clear
        this._clearTimeout = setTimeout(() => {
            this.clear();
        }, this.AUTO_CLEAR_DELAY);
    },

    /**
     * Clear clipboard immediately
     */
    async clear() {
        try {
            // Write empty string to clear
            await navigator.clipboard.writeText('');

            if (this._clearTimeout) {
                clearTimeout(this._clearTimeout);
                this._clearTimeout = null;
            }
        } catch (error) {
            // Clipboard clear failed (might be browser restriction)
            console.warn('Could not clear clipboard:', error);
        }
    },

    /**
     * Cancel scheduled auto-clear
     */
    cancelAutoClear() {
        if (this._clearTimeout) {
            clearTimeout(this._clearTimeout);
            this._clearTimeout = null;
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Clipboard;
}
