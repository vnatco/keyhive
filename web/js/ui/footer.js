/**
 * Footer Tab Bar Component
 * iOS-style bottom navigation with:
 * - Home
 * - Password Generator
 * - Security
 * - Settings
 */

const Footer = {
    currentTab: 'home',
    tabs: [
        { id: 'home', label: 'Home', icon: 'home' },
        { id: 'generator', label: 'Generator', icon: 'key' },
        { id: 'security', label: 'Security', icon: 'shield' },
        { id: 'settings', label: 'Settings', icon: 'settings' }
    ],

    /**
     * Initialize the footer component
     */
    init() {
        this.render();
        this.bindEvents();
    },

    /**
     * Render the footer HTML
     */
    render() {
        const footerHTML = `
            <footer class="footer">
                <nav class="tab-bar">
                    ${this.tabs.map(tab => `
                        <button class="tab-item ${tab.id === this.currentTab ? 'active' : ''}" data-tab="${tab.id}">
                            <div class="tab-icon">
                                ${this.getIcon(tab.icon)}
                            </div>
                            <span class="tab-label">${tab.label}</span>
                        </button>
                    `).join('')}
                </nav>
            </footer>
        `;

        // Insert footer at the end of #app
        const app = document.getElementById('app');
        const footerContainer = document.createElement('div');
        footerContainer.innerHTML = footerHTML;
        app.appendChild(footerContainer.firstElementChild);
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        const tabItems = document.querySelectorAll('.tab-item');
        tabItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Listen for view changes from app
        window.addEventListener('viewchange', (e) => {
            const view = e.detail?.view;
            if (view && this.tabs.some(t => t.id === view)) {
                this.setActiveTab(view);
            }
        });
    },

    /**
     * Switch to a tab
     * @param {string} tabId
     */
    switchTab(tabId) {
        if (tabId === this.currentTab) return;

        this.setActiveTab(tabId);

        // Dispatch event for app to handle view change
        window.dispatchEvent(new CustomEvent('tabchange', {
            detail: { tab: tabId }
        }));
    },

    /**
     * Set active tab (visual only)
     * @param {string} tabId
     */
    setActiveTab(tabId) {
        this.currentTab = tabId;

        // Update visual state
        const tabItems = document.querySelectorAll('.tab-item');
        tabItems.forEach(item => {
            if (item.dataset.tab === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    },

    /**
     * Get current tab
     * @returns {string}
     */
    getCurrentTab() {
        return this.currentTab;
    },

    /**
     * Get SVG icon for tab
     * @param {string} iconName
     * @returns {string}
     */
    getIcon(iconName) {
        const icons = {
            home: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
            `,
            key: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                </svg>
            `,
            shield: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <path d="M9 12l2 2 4-4"></path>
                </svg>
            `,
            settings: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            `
        };

        return icons[iconName] || icons.home;
    },

    /**
     * Show/hide footer
     * @param {boolean} visible
     */
    setVisible(visible) {
        const footer = document.querySelector('.footer');
        if (footer) {
            footer.style.display = visible ? 'block' : 'none';
        }
    },

    /**
     * Update badge on a tab
     * @param {string} tabId
     * @param {number|string} badge
     */
    setBadge(tabId, badge) {
        const tabItem = document.querySelector(`.tab-item[data-tab="${tabId}"]`);
        if (!tabItem) return;

        // Remove existing badge
        const existingBadge = tabItem.querySelector('.tab-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Add new badge if value provided
        if (badge !== null && badge !== undefined && badge !== '' && badge !== 0) {
            const badgeEl = document.createElement('span');
            badgeEl.className = 'tab-badge';
            badgeEl.textContent = badge > 99 ? '99+' : badge;
            tabItem.querySelector('.tab-icon').appendChild(badgeEl);
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Footer;
}
