/**
 * Settings Router
 * Routes to the appropriate settings page based on current mode
 */

const Settings = {
    _currentSettings: null,

    /**
     * Initialize settings page
     * Automatically detects mode and shows appropriate settings
     */
    async init() {
        // Cleanup previous settings if any
        this.destroy();

        const isLocalMode = App?.state?.isLocalMode ||
                           localStorage.getItem('keyhive_mode') === 'local';

        if (isLocalMode) {
            this._currentSettings = SettingsLocal;
        } else {
            // Use the full-featured SettingsCloud for cloud mode
            this._currentSettings = SettingsCloud;
        }

        await this._currentSettings.init();
    },

    /**
     * Cleanup
     */
    destroy() {
        if (this._currentSettings) {
            if (typeof this._currentSettings.destroy === 'function') {
                this._currentSettings.destroy();
            }
            this._currentSettings = null;
        }
    }
};
