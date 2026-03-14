/**
 * ID Encoder Utility
 *
 * Provides an abstraction layer for encoding/decoding entity IDs.
 * Currently passes through IDs unchanged, but can be modified later to:
 * - Use shorter encoded IDs (base62, etc.)
 * - Use index-based lookups
 * - Implement any other ID obfuscation scheme
 *
 * This makes the system future-proof - all ID handling goes through
 * this utility, so changing the encoding scheme only requires updating this file.
 */

const IdEncoder = {
    // Cache for encoded -> original ID mappings
    _cache: new Map(),
    _reverseCache: new Map(),

    /**
     * Encode an ID for display/storage
     * Currently: pass-through (returns original ID)
     * Future: could return shorter encoded version
     *
     * @param {string} id - Original ID (UUID or temp ID)
     * @returns {string} Encoded ID
     */
    encode(id) {
        if (!id) return id;

        // Currently: pass-through
        // Future: implement encoding here
        return id;
    },

    /**
     * Decode an encoded ID back to original
     * Currently: pass-through (returns input unchanged)
     * Future: could decode from shorter format
     *
     * @param {string} encoded - Encoded ID
     * @returns {string} Original ID
     */
    decode(encoded) {
        if (!encoded) return encoded;

        // Currently: pass-through
        // Future: implement decoding here
        return encoded;
    },

    /**
     * Encode an ID for use in DOM attributes
     * @param {string} id - Original ID
     * @returns {string} Safe encoded ID for DOM
     */
    forDom(id) {
        return this.encode(id);
    },

    /**
     * Get original ID from DOM element
     * @param {HTMLElement} element - DOM element with data-*-id attribute
     * @param {string} attrName - Attribute name (default: 'item-id')
     * @returns {string|null} Original ID
     */
    fromDom(element, attrName = 'item-id') {
        const encoded = element?.dataset?.[attrName.replace(/-/g, '')];
        return encoded ? this.decode(encoded) : null;
    },

    /**
     * Encode an ID for URL parameter
     * @param {string} id - Original ID
     * @returns {string} URL-safe encoded ID
     */
    forUrl(id) {
        return encodeURIComponent(this.encode(id));
    },

    /**
     * Decode an ID from URL parameter
     * @param {string} urlId - URL-encoded ID
     * @returns {string} Original ID
     */
    fromUrl(urlId) {
        return this.decode(decodeURIComponent(urlId));
    },

    /**
     * Clear encoding cache (e.g., on logout)
     */
    clearCache() {
        this._cache.clear();
        this._reverseCache.clear();
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.IdEncoder = IdEncoder;
}
