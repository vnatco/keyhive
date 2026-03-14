/**
 * Platform — Detection & Native App Integration
 *
 * Single source of truth for "what platform are we running on?"
 * All platform checks in the codebase MUST go through Platform.
 *
 * Platforms:
 *   'web'       — browser (default)
 *   'electron'  — Electron desktop app (activated via enableDesktopMode)
 *   'tauri'     — Tauri desktop app (activated via enableDesktopMode)
 *   'ios'       — Capacitor iOS (detected via Capacitor runtime)
 *   'android'   — Capacitor Android (detected via Capacitor runtime)
 *
 * Usage:
 *   Platform.getPlatform()  → 'web' | 'electron' | 'ios' | 'android' | ...
 *   Platform.isDesktop()    → true for electron, tauri
 *   Platform.isMobile()     → true for ios, android
 *   Platform.isNative()     → true for any non-web platform
 *   Platform.isWeb()        → true only for browser
 */

const Platform = {
    // Platform state
    platform: 'web',

    // Desktop-specific state
    isDesktopMode: false,
    ipc: null,
    settings: null,
    api: null,

    // ===========================================
    // Initialization
    // ===========================================

    /**
     * Initialize platform detection
     * Detects Capacitor platforms immediately, exposes hook for desktop activation
     */
    init() {
        // Expose the enable function globally for desktop apps to call
        window.enableDesktopMode = this.enableDesktopMode.bind(this);

        // Backward compat: Electron preload scripts reference window.AppFrame
        window.AppFrame = this;

        // Detect Capacitor mobile platforms immediately
        // (Capacitor global is available synchronously before any JS runs)
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            const cap = Capacitor.getPlatform(); // 'ios', 'android', or 'web'
            if (cap === 'ios' || cap === 'android') {
                this.platform = cap;
                console.log(`[Platform] Capacitor detected: ${this.platform}`);
            }
        }

        // Also check for Electron preload (electronAPI available before enableDesktopMode)
        if (typeof window.electronAPI !== 'undefined') {
            this.platform = 'electron';
            // Desktop mode will be fully activated when enableDesktopMode() is called
        }

        // Listen for desktop-mode-init event from Electron preload
        window.addEventListener('desktop-mode-init', (e) => {
            const { platform: plat, settings } = e.detail;
            this.enableDesktopMode({
                platform: plat,
                settings,
                ipc: {
                    minimize: () => window.electronAPI.minimize(),
                    close: () => window.electronAPI.close()
                },
                api: {
                    getSettings: () => window.electronAPI.getSettings(),
                    setShortcut: (shortcut) => window.electronAPI.setShortcut(shortcut),
                    setRunOnStartup: (enabled) => window.electronAPI.setRunOnStartup(enabled)
                }
            });
        });
    },

    // ===========================================
    // Platform Queries (the canonical API)
    // ===========================================

    /**
     * Get the current platform identifier
     * @returns {string} 'web' | 'electron' | 'tauri' | 'ios' | 'android'
     */
    getPlatform() {
        return this.platform;
    },

    /**
     * Running in a desktop app (Electron, Tauri)?
     * @returns {boolean}
     */
    isDesktop() {
        return this.isDesktopMode;
    },

    /**
     * Running on a mobile device via Capacitor (iOS or Android)?
     * @returns {boolean}
     */
    isMobile() {
        return this.platform === 'ios' || this.platform === 'android';
    },

    /**
     * Running inside any native wrapper (desktop or mobile)?
     * Native apps use localStorage for tokens instead of cookies.
     * @returns {boolean}
     */
    isNative() {
        return this.platform !== 'web';
    },

    /**
     * Running in a plain browser with no native wrapper?
     * @returns {boolean}
     */
    isWeb() {
        return this.platform === 'web';
    },

    // ===========================================
    // Desktop Mode Activation (called by Electron/Tauri preload)
    // ===========================================

    /**
     * Enable desktop mode — called by the native app's preload/renderer script
     * @param {Object} options
     * @param {string} options.platform - 'electron', 'tauri', etc.
     * @param {Object} options.ipc - IPC interface { minimize(), close() }
     * @param {Object} options.settings - App settings { shortcut, runOnStartup }
     * @param {Object} options.api - API for updating settings { setShortcut, setRunOnStartup, getSettings }
     */
    enableDesktopMode(options = {}) {
        if (this.isDesktopMode) return;

        this.isDesktopMode = true;
        this.platform = options.platform || 'electron';
        this.ipc = options.ipc || null;
        this.settings = options.settings || { shortcut: 'Ctrl+Alt+Z', runOnStartup: false };
        this.api = options.api || null;

        // Add desktop mode class to html and body
        document.documentElement.classList.add('desktop-mode');
        document.body.classList.add('desktop-mode');

        // Create and inject title bar
        this.createTitleBar();

        // Remove sidebar header (redundant with title bar)
        this.removeSidebarHeader();

        // Disable context menu in desktop mode (optional)
        if (options.disableContextMenu) {
            document.addEventListener('contextmenu', e => e.preventDefault());
        }

        console.log(`[Platform] Desktop mode enabled (${this.platform})`);
    },

    // ===========================================
    // Desktop Title Bar & Window Controls
    // ===========================================

    /**
     * Remove sidebar header (since title bar shows the logo/name)
     */
    removeSidebarHeader() {
        const sidebarHeader = document.querySelector('.sidebar-header');
        if (sidebarHeader) {
            sidebarHeader.remove();
        }

        // Also observe for sidebar re-renders and remove header again
        const observer = new MutationObserver(() => {
            const header = document.querySelector('.sidebar-header');
            if (header) {
                header.remove();
            }
        });

        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            observer.observe(sidebar, { childList: true, subtree: true });
        } else {
            // Sidebar not yet created, watch for it
            const bodyObserver = new MutationObserver(() => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    const header = document.querySelector('.sidebar-header');
                    if (header) header.remove();
                    observer.observe(sidebar, { childList: true, subtree: true });
                    bodyObserver.disconnect();
                }
            });
            bodyObserver.observe(document.body, { childList: true, subtree: true });
        }
    },

    /**
     * Create the custom title bar
     */
    createTitleBar() {
        const titleBar = document.createElement('div');
        titleBar.id = 'appTitleBar';
        titleBar.className = 'app-title-bar';
        titleBar.innerHTML = `
            <div class="app-title-bar-drag">
                <div class="app-title-bar-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <span class="app-title-bar-text">KeyHive</span>
            </div>
            <div class="app-title-bar-controls">
                <button class="app-title-bar-btn" id="titleBarRefresh" title="Refresh">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="17 1 21 5 17 9"></polyline>
                        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                        <polyline points="7 23 3 19 7 15"></polyline>
                        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                    </svg>
                </button>
                <button class="app-title-bar-btn" id="titleBarMinimize" title="Minimize to tray">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
                <button class="app-title-bar-btn app-title-bar-btn-close" id="titleBarClose" title="Close to tray">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;

        // Insert at the very beginning of body
        document.body.insertBefore(titleBar, document.body.firstChild);

        // Bind window control events
        this.bindTitleBarEvents();
    },

    /**
     * Bind title bar button events
     */
    bindTitleBarEvents() {
        document.getElementById('titleBarRefresh')?.addEventListener('click', () => {
            window.location.reload();
        });

        document.getElementById('titleBarMinimize')?.addEventListener('click', () => {
            this.minimizeWindow();
        });

        document.getElementById('titleBarClose')?.addEventListener('click', () => {
            this.closeWindow();
        });
    },

    /**
     * Minimize the window
     */
    minimizeWindow() {
        if (this.ipc && typeof this.ipc.minimize === 'function') {
            this.ipc.minimize();
        } else {
            console.log('[Platform] Minimize window - IPC not configured');
        }
    },

    /**
     * Close the window
     */
    closeWindow() {
        if (this.ipc && typeof this.ipc.close === 'function') {
            this.ipc.close();
        } else {
            console.log('[Platform] Close window - IPC not configured');
        }
    },

    // ===========================================
    // Desktop App Settings
    // ===========================================

    /**
     * Get desktop app settings
     * @returns {Object|null}
     */
    getSettings() {
        return this.settings;
    },

    /**
     * Update the global shortcut
     * @param {string} shortcut - e.g. 'Ctrl+Alt+Z'
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async setShortcut(shortcut) {
        if (!this.api?.setShortcut) {
            return { success: false, error: 'API not available' };
        }

        const result = await this.api.setShortcut(shortcut);
        if (result.success) {
            this.settings.shortcut = shortcut;
        }
        return result;
    },

    /**
     * Update the run on startup setting
     * @param {boolean} enabled
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async setRunOnStartup(enabled) {
        if (!this.api?.setRunOnStartup) {
            return { success: false, error: 'API not available' };
        }

        const result = await this.api.setRunOnStartup(enabled);
        if (result.success) {
            this.settings.runOnStartup = enabled;
        }
        return result;
    },

    /**
     * Refresh settings from the app
     * @returns {Promise<Object>}
     */
    async refreshSettings() {
        if (!this.api?.getSettings) {
            return this.settings;
        }

        try {
            this.settings = await this.api.getSettings();
        } catch (e) {
            console.error('[Platform] Failed to refresh settings:', e);
        }
        return this.settings;
    }
};

// Backward compat alias — existing Electron apps call window.AppFrame
const AppFrame = Platform;

// Auto-initialize
Platform.init();
