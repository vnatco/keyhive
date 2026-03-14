/**
 * DateUtils - Centralized UTC date handling
 *
 * All dates are stored in UTC format (ISO 8601) to ensure consistency.
 * Dates are only converted to local timezone when displayed to users.
 */
const DateUtils = {
    /**
     * Get current UTC timestamp in ISO 8601 format
     * Use this for all created_at, updated_at, deleted_at values
     *
     * @returns {string} e.g., "2026-03-05T17:35:19.214Z"
     */
    now() {
        return new Date().toISOString();
    },

    /**
     * Convert UTC timestamp to local timezone for display
     *
     * @param {string} utcString - ISO 8601 UTC timestamp
     * @param {string} format - 'datetime' | 'date' | 'time' | 'relative'
     * @returns {string} Formatted local time string
     */
    toLocal(utcString, format = 'datetime') {
        if (!utcString) return '';

        const date = new Date(utcString);
        if (isNaN(date.getTime())) return '';

        switch (format) {
            case 'date':
                return date.toLocaleDateString();

            case 'time':
                return date.toLocaleTimeString();

            case 'relative':
                return this.toRelative(date);

            case 'datetime':
            default:
                return date.toLocaleString();
        }
    },

    /**
     * Get relative time string (e.g., "5 minutes ago", "2 days ago")
     *
     * @param {Date|string} date - Date object or ISO string
     * @returns {string}
     */
    toRelative(date) {
        if (typeof date === 'string') {
            date = new Date(date);
        }

        const now = new Date();
        const diff = now - date;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);

        if (seconds < 60) {
            return 'just now';
        } else if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        } else if (hours < 24) {
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else if (days < 7) {
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        } else if (weeks < 4) {
            return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
        } else if (months < 12) {
            return `${months} month${months !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    },

    /**
     * Format date for display with custom options
     *
     * @param {string} utcString - ISO 8601 UTC timestamp
     * @param {Intl.DateTimeFormatOptions} options - Intl options
     * @returns {string}
     */
    format(utcString, options = {}) {
        if (!utcString) return '';

        const date = new Date(utcString);
        if (isNaN(date.getTime())) return '';

        const defaultOptions = {
            dateStyle: 'medium',
            timeStyle: 'short'
        };

        return date.toLocaleString(undefined, { ...defaultOptions, ...options });
    },

    /**
     * Get days remaining until a date (for trash auto-delete countdown)
     *
     * @param {string} deletedAt - ISO 8601 UTC timestamp when item was deleted
     * @param {number} retentionDays - Number of days before permanent deletion
     * @returns {number} Days remaining (0 if already expired)
     */
    daysRemaining(deletedAt, retentionDays = 30) {
        if (!deletedAt) return retentionDays;

        const deleted = new Date(deletedAt);
        const expiry = new Date(deleted.getTime() + retentionDays * 24 * 60 * 60 * 1000);
        const now = new Date();
        const daysLeft = Math.floor((expiry - now) / (24 * 60 * 60 * 1000));

        return Math.max(0, daysLeft);
    },

    /**
     * Check if a timestamp is expired
     *
     * @param {string} utcString - ISO 8601 UTC timestamp
     * @returns {boolean}
     */
    isExpired(utcString) {
        if (!utcString) return false;
        const date = new Date(utcString);
        return date < new Date();
    },

    /**
     * Parse any date string to Date object
     *
     * @param {string} dateString
     * @returns {Date|null}
     */
    parse(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    },

    /**
     * Get UTC timestamp for N days ago
     *
     * @param {number} days
     * @returns {string} ISO 8601 timestamp
     */
    daysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    },

    /**
     * Get UTC timestamp for N minutes from now
     *
     * @param {number} minutes
     * @returns {string} ISO 8601 timestamp
     */
    minutesFromNow(minutes) {
        const date = new Date();
        date.setMinutes(date.getMinutes() + minutes);
        return date.toISOString();
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateUtils;
}

// Also expose globally
if (typeof window !== 'undefined') {
    window.DateUtils = DateUtils;
}
