const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC functions to the renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimize: () => ipcRenderer.send('window-minimize'),
    close: () => ipcRenderer.send('window-close'),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    setShortcut: (shortcut) => ipcRenderer.invoke('set-shortcut', shortcut),
    setRunOnStartup: (enabled) => ipcRenderer.invoke('set-run-on-startup', enabled),

    // Secure token storage (OS-level encryption via safeStorage)
    secureStorage: {
        set: (key, value) => ipcRenderer.invoke('secure-storage-set', key, value),
        get: (key) => ipcRenderer.invoke('secure-storage-get', key),
        delete: (key) => ipcRenderer.invoke('secure-storage-delete', key),
        clear: () => ipcRenderer.invoke('secure-storage-clear')
    }
});

// Dispatch event to activate desktop mode (no inline script needed)
// Use ipcRenderer directly here — contextBridge exposes to renderer, not preload
window.addEventListener('DOMContentLoaded', async () => {
    let settings = { shortcut: 'Ctrl+Alt+Z', runOnStartup: false };
    try {
        settings = await ipcRenderer.invoke('get-settings');
    } catch (e) {
        console.warn('[Electron] Failed to load settings:', e);
    }

    window.dispatchEvent(new CustomEvent('desktop-mode-init', {
        detail: { platform: 'electron', settings }
    }));
});
