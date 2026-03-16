/**
 * Client Notice System
 *
 * Handles notices from the server health check (update alerts, security warnings).
 * Three modes:
 *   - Required + non-dismissable: Blocking popup, wipes session & cloud cache, user must update
 *   - Required + dismissable: Update prompt with Skip button, user can defer
 *   - Informational (dismissable=true): Can be closed, remembered in localStorage
 */

const ClientNotice = {
    STORAGE_KEY: 'keyhive_dismissed_notices',

    /**
     * Handle a notice from the server health check
     * @param {Object} notice
     */
    handle(notice) {
        if (!notice || !notice.id) return;

        // Skip already-dismissed notices
        if (notice.dismissable && this._isDismissed(notice.id)) return;

        // Non-dismissable required update: wipe session & cloud data before showing popup
        if (notice.update_required && !notice.dismissable) {
            this._wipeSensitiveData();
        }

        this._showPopup(notice);
    },

    /**
     * Check if a notice has been dismissed
     */
    _isDismissed(noticeId) {
        const dismissed = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        return dismissed.includes(noticeId);
    },

    /**
     * Mark a notice as dismissed
     */
    _dismiss(noticeId) {
        const dismissed = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        if (!dismissed.includes(noticeId)) {
            dismissed.push(noticeId);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dismissed));
        }
    },

    /**
     * Wipe session tokens and all cloud IndexedDB caches.
     * Called on non-dismissable required updates to ensure a clean slate.
     * Preserves: local IndexedDB, device_token, user preferences.
     */
    async _wipeSensitiveData() {
        // Clear auth tokens (session + localStorage, but NOT device_token)
        if (typeof ApiClient !== 'undefined') {
            ApiClient.clearAuth();
        }

        // Clear in-memory vault state
        if (typeof Vault !== 'undefined') {
            Vault.reset();
        }

        // Lock crypto (clear derived keys from memory)
        if (typeof CryptoAPI !== 'undefined') {
            try { await CryptoAPI.lock(); } catch (e) { /* best effort */ }
        }

        // Delete all cloud IndexedDB databases (keyhive_cloud_*), preserve keyhive_local
        if (typeof LocalDB !== 'undefined') {
            try {
                const databases = await LocalDB.listDatabases();
                for (const dbName of databases) {
                    if (dbName.startsWith('keyhive_cloud_')) {
                        const userId = dbName.replace('keyhive_cloud_', '');
                        await LocalDB.deleteCloudUserDatabase(userId);
                    }
                }
            } catch (e) {
                console.warn('[ClientNotice] Failed to wipe cloud databases:', e);
            }
        }

        console.log('[ClientNotice] Wiped session and cloud data for mandatory update');
    },

    /**
     * Show the notice popup
     */
    _showPopup(notice) {
        const buttons = [];

        if (notice.update_required) {
            if (notice.dismissable) {
                buttons.push({
                    text: 'Skip',
                    type: 'secondary',
                    isCancel: true
                });
            }
            // SECURITY: Currently hardcoded to Config.UPDATE_URL for all platforms.
            // Server sends platform-specific update_link (from update_links DB column),
            // but we don't trust it yet — a DB compromise could inject malicious URLs.
            // Once we have a secure delivery mechanism (e.g. signed links), uncomment below:
            //
            // const updateUrl = notice.update_link || Config.UPDATE_URL;
            const updateUrl = Config.UPDATE_URL;

            buttons.push({
                text: 'Update Now',
                type: 'primary',
                onClick: () => {
                    window.open(updateUrl, '_blank');
                    // Non-dismissable popups must NEVER close
                    if (!notice.dismissable) return false;
                }
            });
        } else {
            buttons.push({
                text: 'OK',
                type: 'primary',
                isCancel: true
            });
        }

        Popup.open({
            title: notice.title || 'Notice',
            body: `<div class="popup-message">${Utils.parseLightMarkdown(notice.description || '')}</div>`,
            closable: notice.dismissable,
            closeOnEscape: notice.dismissable,
            closeOnOutsideClick: false,
            compact: false,
            buttons,
            onClose: () => {
                if (notice.dismissable && notice.id) {
                    this._dismiss(notice.id);
                }
            }
        });
    }
};
