/**
 * Global Dropdown Manager
 * Ensures only one dropdown is open at a time across the entire app.
 * When any dropdown opens, all others close.
 * When clicking outside any dropdown, all close.
 */

const DropdownManager = {
    // Track all registered dropdown close functions
    closeHandlers: new Map(),

    /**
     * Initialize the manager - call once on app start
     */
    init() {
        // Single document-level click listener
        document.addEventListener('click', (e) => {
            this.handleDocumentClick(e);
        });
    },

    /**
     * Handle document clicks - close dropdowns when clicking outside
     */
    handleDocumentClick(e) {
        // Check each registered dropdown
        this.closeHandlers.forEach((handler, id) => {
            const dropdown = handler.element;
            const trigger = handler.trigger;

            // If clicking outside both the dropdown and its trigger, close it
            const clickedInside = dropdown?.contains(e.target) || trigger?.contains(e.target);
            if (!clickedInside) {
                this.close(id);
            }
        });
    },

    /**
     * Register and open a dropdown
     * @param {string} id - Unique identifier for this dropdown
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.element - The dropdown element
     * @param {HTMLElement} options.trigger - The button/element that triggers the dropdown
     * @param {Function} options.onClose - Function to call when closing
     */
    open(id, options) {
        // Close all other dropdowns first (except ourselves if re-opening)
        this.closeHandlers.forEach((handler, handlerId) => {
            if (handlerId !== id && handler.onClose) {
                handler.onClose();
            }
        });
        this.closeHandlers.clear();

        // Register this dropdown
        this.closeHandlers.set(id, {
            element: options.element,
            trigger: options.trigger,
            onClose: options.onClose
        });
    },

    /**
     * Close a specific dropdown
     * @param {string} id - The dropdown identifier
     */
    close(id) {
        const handler = this.closeHandlers.get(id);
        if (handler) {
            if (handler.onClose) {
                handler.onClose();
            }
            this.closeHandlers.delete(id);
        }
    },

    /**
     * Close all dropdowns
     */
    closeAll() {
        this.closeHandlers.forEach((handler, id) => {
            if (handler.onClose) {
                handler.onClose();
            }
        });
        this.closeHandlers.clear();
    },

    /**
     * Check if a dropdown is open
     * @param {string} id - The dropdown identifier
     * @returns {boolean}
     */
    isOpen(id) {
        return this.closeHandlers.has(id);
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DropdownManager;
}
