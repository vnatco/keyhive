/**
 * ID Utility
 *
 * Generates permanent UUIDs for entities. IDs are generated client-side
 * and never change - the server accepts client-provided IDs.
 */

const TempId = {
    /**
     * Generate a new permanent UUID
     * Uses crypto.randomUUID() for proper UUID v4 generation
     * @returns {string} UUID in format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
     */
    generate() {
        // Use native crypto.randomUUID() if available (modern browsers)
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for older browsers
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Check if an ID is valid (all IDs are now permanent UUIDs)
     * @param {string} id - ID to check
     * @returns {boolean} True if valid ID
     */
    isReal(id) {
        return typeof id === 'string' && id.length > 0;
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.TempId = TempId;
}
