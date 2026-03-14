/**
 * Shared search matching utilities
 * Used by both HomePage (folder-scoped) and SearchPage (global)
 */
const SearchUtils = {
    /**
     * Check if an item matches a search query
     * @param {Object} item - Decrypted item object
     * @param {string} query - Lowercase search query
     * @returns {boolean}
     */
    matchItem(item, query) {
        const data = item.data || item.decrypted_data || {};

        // Check for tag: prefix search
        const tagMatch = query.match(/^tag:(.+)$/);
        if (tagMatch) {
            const tagQuery = tagMatch[1];
            const tags = data.tags || [];
            return tags.some(tag => tag.toLowerCase().includes(tagQuery));
        }

        const name = (data.name || '').toLowerCase();
        const label = (data.label || '').toLowerCase();
        const issuer = (data.issuer || '').toLowerCase();
        const username = (data.username || '').toLowerCase();
        const email = (data.email || '').toLowerCase();
        const websiteUrl = (data.website_url || '').toLowerCase();
        const content = (data.content || '').toLowerCase();
        const tags = data.tags || [];
        const tagsMatch = tags.some(tag => tag.toLowerCase().includes(query));

        return name.includes(query) ||
               label.includes(query) ||
               issuer.includes(query) ||
               username.includes(query) ||
               email.includes(query) ||
               websiteUrl.includes(query) ||
               content.includes(query) ||
               tagsMatch;
    },

    /**
     * Check if a folder matches a search query
     * @param {Object} folder - Decrypted folder object
     * @param {string} query - Lowercase search query
     * @returns {boolean}
     */
    matchFolder(folder, query) {
        if (query.match(/^tag:.+$/)) return false;
        const name = (folder.name || folder.decrypted_name || '').toLowerCase();
        return name.includes(query);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchUtils;
}
