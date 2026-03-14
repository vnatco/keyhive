/**
 * Sidebar Component (Desktop)
 * - Logo
 * - Navigation: Home, Generator, Security, Settings
 * - User info
 *
 * Note: Vault selector and Add button are now in the Home page
 */

const Sidebar = {
    currentTab: 'home',

    /**
     * Initialize the sidebar
     */
    init() {
        this.render();
        this.bindEvents();
        this.updateUserInfo();
    },

    /**
     * Render the sidebar HTML
     */
    render() {
        const sidebarHTML = `
            <aside class="sidebar" id="sidebar">
                <!-- Logo -->
                <div class="sidebar-header">
                    <div class="sidebar-logo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <span>KeyHive</span>
                    </div>
                </div>

                <!-- Navigation -->
                <nav class="sidebar-nav">
                    <button class="nav-item active" data-tab="home">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                        <span class="nav-item-label">Home</span>
                    </button>
                    <button class="nav-item" data-tab="generator">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            <line x1="12" y1="15" x2="12" y2="17"></line>
                        </svg>
                        <span class="nav-item-label">Generator</span>
                    </button>
                    <button class="nav-item" data-tab="security">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        <span class="nav-item-label">Security</span>
                    </button>
                    <button class="nav-item" data-tab="settings">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                        <span class="nav-item-label">Settings</span>
                    </button>
                </nav>

                <!-- User -->
                <div class="sidebar-footer">
                    <div class="sidebar-user">
                        <div class="user-avatar" id="sidebarUserAvatar">U</div>
                        <div class="user-info">
                            <span class="user-name" id="sidebarUserName">User</span>
                            <span class="user-email" id="sidebarUserEmail">user@example.com</span>
                        </div>
                    </div>
                </div>
            </aside>
        `;

        // Insert at the beginning of #app
        const app = document.getElementById('app');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sidebarHTML;
        app.insertBefore(tempDiv.firstElementChild, app.firstChild);
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Navigation items
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.setTab(item.dataset.tab);
            });
        });

        // Listen for tab changes from other components
        window.addEventListener('tabchange', (e) => {
            this.setTab(e.detail.tab, false);
        });

        // Listen for search page events
        window.addEventListener('searchpage', (e) => {
            if (e.detail.active) this.showSearchTab();
            else this.hideSearchTab();
        });
    },

    showSearchTab() {
        if (document.querySelector('.sidebar-nav .nav-item[data-tab="search"]')) return;

        const homeBtn = document.querySelector('.sidebar-nav .nav-item[data-tab="home"]');
        if (!homeBtn) return;

        const searchBtn = document.createElement('button');
        searchBtn.className = 'nav-item';
        searchBtn.dataset.tab = 'search';
        searchBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span class="nav-item-label">Search</span>
        `;

        searchBtn.addEventListener('click', () => {
            this.setTab('search');
        });

        homeBtn.insertAdjacentElement('afterend', searchBtn);

        // Mark it active since we're on the search page
        this.setTab('search', false);
    },

    hideSearchTab() {
        const searchBtn = document.querySelector('.sidebar-nav .nav-item[data-tab="search"]');
        if (searchBtn) searchBtn.remove();
    },

    /**
     * Set current tab
     */
    setTab(tab, emit = true) {
        this.currentTab = tab;

        // Update nav items
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });

        // Emit event if needed
        if (emit) {
            window.dispatchEvent(new CustomEvent('tabchange', {
                detail: { tab }
            }));
        }
    },

    /**
     * Update user info
     */
    async updateUserInfo() {
        const user = App?.state?.user;
        const email = user?.email || 'user@example.com';
        const userName = user?.name || 'User';

        const nameEl = document.getElementById('sidebarUserName');
        const emailEl = document.getElementById('sidebarUserEmail');
        const avatarEl = document.getElementById('sidebarUserAvatar');

        if (nameEl) nameEl.textContent = userName;
        if (emailEl) emailEl.textContent = email;

        // Load and display avatar from IndexedDB
        if (avatarEl) {
            try {
                let userAvatar = null;
                if (typeof LocalDB !== 'undefined') {
                    userAvatar = await LocalDB.getUserAvatar();
                }

                if (userAvatar) {
                    const safeAvatarSrc = Utils.sanitizeImageSrc(`data:image/png;base64,${userAvatar}`);
                    avatarEl.innerHTML = safeAvatarSrc ? `<img src="${safeAvatarSrc}" alt="Avatar" class="user-avatar-img">` : '';
                    avatarEl.classList.add('has-image');
                } else {
                    avatarEl.textContent = userName.charAt(0).toUpperCase();
                    avatarEl.classList.remove('has-image');
                }
            } catch (e) {
                // Fallback to initial
                avatarEl.textContent = userName.charAt(0).toUpperCase();
                avatarEl.classList.remove('has-image');
            }
        }
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sidebar;
}
