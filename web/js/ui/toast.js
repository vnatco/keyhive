/**
 * Toast Notification Component
 * Shows temporary notification messages
 */

const Toast = {
    container: null,
    queue: [],
    isShowing: false,
    _footerObserver: null,

    /**
     * Initialize the toast container
     */
    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);

        // Update footer visibility state
        this.updateFooterState();

        // Watch for DOM changes that might affect footer visibility
        this._setupFooterObserver();
    },

    /**
     * Check if footer is visible and not covered by overlays
     * @returns {boolean}
     */
    isFooterVisible() {
        const footer = document.querySelector('.footer');
        if (!footer) return false;

        // Check if footer is hidden via display/visibility
        const style = window.getComputedStyle(footer);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        // Check if there's an active popup overlay
        const popupOverlay = document.querySelector('.popup-overlay.active');
        if (popupOverlay) return false;

        // Check if there's an active page overlay (view page, add/edit page)
        const pageOverlay = document.querySelector('.page-overlay.active');
        if (pageOverlay) return false;

        return true;
    },

    /**
     * Update the footer state class on toast container
     */
    updateFooterState() {
        if (!this.container) return;

        const footerVisible = this.isFooterVisible();
        this.container.classList.toggle('footer-visible', footerVisible);
    },

    /**
     * Setup observer to watch for footer visibility changes
     */
    _setupFooterObserver() {
        if (this._footerObserver) return;

        // Use MutationObserver to watch for class/style changes
        this._footerObserver = new MutationObserver(() => {
            this.updateFooterState();
        });

        // Observe body for class changes and child list changes
        this._footerObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        // Also listen to custom events that affect overlays
        window.addEventListener('viewchange', () => this.updateFooterState());
    },

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in milliseconds (default: 3000)
     */
    show(message, type = 'info', duration = 3000) {
        this.init();

        // Update footer state before showing toast
        this.updateFooterState();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = this.getIcon(type);

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${Utils.escapeHtml(message)}</div>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        // Click anywhere on toast to dismiss
        toast.addEventListener('click', () => {
            this.dismiss(toast);
        });

        // Add to container
        this.container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(toast);
            }, duration);
        }

        return toast;
    },

    /**
     * Dismiss a toast
     * @param {HTMLElement} toast
     */
    dismiss(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.remove('show');
        toast.classList.add('hide');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    },

    /**
     * Get icon SVG for toast type
     * @param {string} type
     * @returns {string}
     */
    getIcon(type) {
        const icons = {
            success: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            `,
            error: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            `,
            warning: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
            `,
            info: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
            `
        };

        return icons[type] || icons.info;
    },

    /**
     * Show success toast
     * @param {string} message
     * @param {number} duration
     */
    success(message, duration = 2000) {
        return this.show(message, 'success', duration);
    },

    /**
     * Show error toast
     * @param {string} message
     * @param {number} duration
     */
    error(message, duration = 2500) {
        return this.show(message, 'error', duration);
    },

    /**
     * Show warning toast
     * @param {string} message
     * @param {number} duration
     */
    warning(message, duration = 2000) {
        return this.show(message, 'warning', duration);
    },

    /**
     * Show info toast
     * @param {string} message
     * @param {number} duration
     */
    info(message, duration = 2000) {
        return this.show(message, 'info', duration);
    },

    /**
     * Clear all toasts
     */
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Toast;
}
