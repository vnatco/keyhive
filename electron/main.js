const { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage, protocol, session, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');


// ============================================================
// SECURITY HARDENING
// ============================================================

// Disable hardware acceleration if not needed (reduces attack surface)
// Uncomment if you experience issues: app.disableHardwareAcceleration();

// Prevent multiple instances (security + UX)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

// Register custom protocol scheme (must be before app ready)
// This is critical for Web Workers to function - file:// has origin 'null' which blocks workers.
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            allowServiceWorkers: true
        }
    }
]);

// Set custom user agent to identify KeyHive desktop app in sessions
app.userAgentFallback = app.userAgentFallback.replace('Chrome/', 'KeyHive/1.0 Chrome/');

let mainWindow;
let tray;

// Path to store settings (includes window state and app preferences)
const settingsFile = path.join(app.getPath('userData'), 'settings.json');

// Default settings
const defaultSettings = {
    windowState: null,
    shortcut: 'Ctrl+Alt+Z',
    runOnStartup: false
};

// Current settings in memory
let currentSettings = { ...defaultSettings };

// Load settings from file
function loadSettings() {
    try {
        if (fs.existsSync(settingsFile)) {
            const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            currentSettings = { ...defaultSettings, ...saved };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
        currentSettings = { ...defaultSettings };
    }
    return currentSettings;
}

// Save settings to file
function saveSettings() {
    try {
        fs.writeFileSync(settingsFile, JSON.stringify(currentSettings, null, 2));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}

// Load saved window state (from settings)
function loadWindowState() {
    return currentSettings.windowState;
}

// Save window state (to settings)
function saveWindowState() {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const bounds = mainWindow.getBounds();
    currentSettings.windowState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
    };

    saveSettings();
}

// Register the global shortcut for toggling window
function registerToggleShortcut(shortcut) {
    // Unregister all first to avoid conflicts
    globalShortcut.unregisterAll();

    if (!shortcut) return false;

    try {
        const success = globalShortcut.register(shortcut, () => {
            if (mainWindow?.isVisible() && mainWindow?.isFocused()) {
                mainWindow.hide();
            } else {
                mainWindow?.show();
                mainWindow?.focus();
            }
        });

        if (success) {
            console.log('[Settings] Registered shortcut:', shortcut);
        } else {
            console.error('[Settings] Failed to register shortcut:', shortcut);
        }

        return success;
    } catch (e) {
        console.error('[Settings] Error registering shortcut:', e);
        return false;
    }
}

// Set app to run on startup
function setAutoLaunch(enabled) {
    app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true
    });
}

// Validate shortcut format
function validateShortcut(shortcut) {
    if (!shortcut || typeof shortcut !== 'string') {
        return { valid: false, error: 'Shortcut must be a string' };
    }

    // Max length check
    if (shortcut.length > 50) {
        return { valid: false, error: 'Shortcut too long' };
    }

    const parts = shortcut.split('+').map(p => p.trim());

    if (parts.length < 2) {
        return { valid: false, error: 'Shortcut must include at least one modifier and a key' };
    }

    if (parts.length > 4) {
        return { valid: false, error: 'Too many keys in shortcut' };
    }

    // Valid modifiers (Electron accelerator format)
    const validModifiers = [
        'ctrl', 'control',
        'alt', 'option',
        'shift',
        'meta', 'command', 'cmd', 'super',
        'commandorcontrol', 'cmdorctrl'
    ];

    // Valid keys
    const validKeys = [
        // Letters
        ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
        // Numbers
        ...'0123456789'.split(''),
        // Function keys
        ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
        // Special keys
        'Space', 'Tab', 'Backspace', 'Delete', 'Insert',
        'Enter', 'Return', 'Esc', 'Escape',
        'Up', 'Down', 'Left', 'Right',
        'Home', 'End', 'PageUp', 'PageDown',
        'Plus', 'Minus', 'Equal',
        'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon',
        'Quote', 'Comma', 'Period', 'Slash', 'Backquote',
        'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide',
        'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4',
        'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9'
    ];

    // Check parts
    let hasModifier = false;
    let hasKey = false;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const partLower = part.toLowerCase();

        if (validModifiers.includes(partLower)) {
            hasModifier = true;
        } else if (validKeys.includes(part) || validKeys.map(k => k.toLowerCase()).includes(partLower)) {
            // Key must be last
            if (i !== parts.length - 1) {
                return { valid: false, error: 'Key must be at the end of the shortcut' };
            }
            hasKey = true;
        } else {
            return { valid: false, error: `Invalid key: ${part}` };
        }
    }

    if (!hasModifier) {
        return { valid: false, error: 'Shortcut must include at least one modifier (Ctrl, Alt, Shift)' };
    }

    if (!hasKey) {
        return { valid: false, error: 'Shortcut must include a key' };
    }

    // Block dangerous system shortcuts
    const dangerous = [
        'ctrl+alt+delete', 'ctrl+alt+del',
        'alt+f4', 'alt+tab', 'ctrl+esc',
        'ctrl+shift+esc', 'meta+l', 'cmd+q'
    ];

    if (dangerous.includes(shortcut.toLowerCase())) {
        return { valid: false, error: 'This shortcut is reserved by the system' };
    }

    return { valid: true };
}

// Check if window bounds are visible on any screen
function isPositionValid(x, y, width, height) {
    const displays = screen.getAllDisplays();
    
    for (const display of displays) {
        const { x: dx, y: dy, width: dw, height: dh } = display.bounds;
        
        const overlapX = Math.max(0, Math.min(x + width, dx + dw) - Math.max(x, dx));
        const overlapY = Math.max(0, Math.min(y + height, dy + dh) - Math.max(y, dy));
        
        if (overlapX >= 100 && overlapY >= 100) {
            return true;
        }
    }
    
    return false;
}

// Get centered position on primary display
function getCenteredBounds(width, height) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    return {
        x: Math.round((screenWidth - width) / 2),
        y: Math.round((screenHeight - height) / 2),
        width,
        height
    };
}

// Get app icon path
function getIconPath() {
    const pngPath = path.join(__dirname, 'icons', 'icon.png');
    const svgPath = path.join(__dirname, 'icons', 'icon.svg');

    if (fs.existsSync(pngPath)) {
        return pngPath;
    }
    return svgPath;
}

// Create app icon (for window and tray)
function createAppIcon(size = 256) {
    const iconPath = getIconPath();

    if (fs.existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath);
        if (size && size !== 256) {
            return icon.resize({ width: size, height: size });
        }
        return icon;
    }

    // Fallback: create icon programmatically
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="none">
            <circle cx="128" cy="128" r="120" fill="#1a1a2e"/>
            <rect x="64" y="112" width="128" height="96" rx="16" ry="16" fill="none" stroke="#ff6b6b" stroke-width="12"/>
            <path d="M88 112V80a40 40 0 0 1 80 0v32" fill="none" stroke="#ff6b6b" stroke-width="12" stroke-linecap="round"/>
            <circle cx="128" cy="152" r="12" fill="#ff6b6b"/>
            <rect x="122" y="152" width="12" height="24" rx="4" fill="#ff6b6b"/>
        </svg>
    `;
    const base64 = Buffer.from(svg).toString('base64');
    return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${base64}`);
}

// Create tray icon
function createTrayIcon() {
    return createAppIcon(16);
}

// Create system tray
function createTray() {
    const trayIcon = createTrayIcon();
    
    tray = new Tray(trayIcon);
    tray.setToolTip('KeyHive');
    
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Show KeyHive', 
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            }
        },
        { type: 'separator' },
        { 
            label: 'Quit', 
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
        if (mainWindow?.isVisible() && mainWindow?.isFocused()) {
            mainWindow.hide();
        } else {
            mainWindow?.show();
            mainWindow?.focus();
        }
    });
}

function createWindow() {
    const defaultWidth = 1200;
    const defaultHeight = 800;
    const minWidth = 380;
    const minHeight = 660;
    
    let windowState = loadWindowState();
    let bounds;
    
    if (windowState) {
        if (isPositionValid(windowState.x, windowState.y, windowState.width, windowState.height)) {
            bounds = {
                x: windowState.x,
                y: windowState.y,
                width: Math.max(windowState.width, minWidth),
                height: Math.max(windowState.height, minHeight)
            };
        } else {
            bounds = getCenteredBounds(
                Math.max(windowState.width || defaultWidth, minWidth),
                Math.max(windowState.height || defaultHeight, minHeight)
            );
        }
    } else {
        bounds = getCenteredBounds(defaultWidth, defaultHeight);
    }
    
    mainWindow = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        minWidth: minWidth,
        minHeight: minHeight,
        frame: false,
        autoHideMenuBar: true,
        icon: createAppIcon(),
        webPreferences: {
            // ============================================================
            // SECURITY: All critical settings explicitly defined
            // ============================================================
            nodeIntegration: false,         // CRITICAL: No Node.js in renderer
            contextIsolation: true,         // CRITICAL: Isolate preload from renderer
            sandbox: true,                  // CRITICAL: Sandbox renderer process
            webSecurity: true,              // CRITICAL: Enforce same-origin policy
            allowRunningInsecureContent: false,  // Block mixed content
            experimentalFeatures: false,    // Disable experimental APIs
            enableBlinkFeatures: '',        // Disable extra Blink features
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // ============================================================
    // SECURITY: Block navigation to external URLs
    // ============================================================
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('app://local/')) return;
        event.preventDefault();
        if (/^https?:\/\//i.test(url)) {
            shell.openExternal(url);
        } else {
            console.warn('[Security] Blocked navigation to:', url);
        }
    });

    // Open external links in default browser, block everything else
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) {
            shell.openExternal(url);
        } else {
            console.warn('[Security] Blocked popup:', url);
        }
        return { action: 'deny' };
    });

    // ============================================================
    // SECURITY: Block dangerous keyboard shortcuts
    // ============================================================
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // Block refresh (Ctrl+R, Ctrl+Shift+R, F5)
        if (input.key === 'F5' ||
            (input.control && (input.key === 'r' || input.key === 'R'))) {
            event.preventDefault();
            return;
        }

        // Block DevTools (Ctrl+Shift+I, Ctrl+Shift+J, F12)
        if (input.key === 'F12' ||
            (input.control && input.shift && (input.key === 'I' || input.key === 'i')) ||
            (input.control && input.shift && (input.key === 'J' || input.key === 'j'))) {
            event.preventDefault();
            return;
        }

        // Block View Source (Ctrl+U)
        if (input.control && (input.key === 'u' || input.key === 'U')) {
            event.preventDefault();
            return;
        }

        // Block address bar / URL navigation (Ctrl+L, Alt+D, F6)
        if (input.key === 'F6' ||
            (input.control && (input.key === 'l' || input.key === 'L')) ||
            (input.alt && (input.key === 'd' || input.key === 'D'))) {
            event.preventDefault();
            return;
        }

        // Block print (Ctrl+P)
        if (input.control && (input.key === 'p' || input.key === 'P')) {
            event.preventDefault();
            return;
        }

        // Block find (Ctrl+F, Ctrl+G) — not a web browser
        if (input.control && !input.shift && (input.key === 'f' || input.key === 'F' ||
            input.key === 'g' || input.key === 'G')) {
            event.preventDefault();
            return;
        }

        // Block zoom (Ctrl+Plus, Ctrl+Minus, Ctrl+0)
        if (input.control && (input.key === '+' || input.key === '-' || input.key === '=' || input.key === '0')) {
            event.preventDefault();
            return;
        }
    });

    // Load the app
    mainWindow.loadURL('app://local/index.html');

    // ============================================================
    // DevTools — DISABLED (uncomment for debugging)
    // mainWindow.webContents.openDevTools();
    // ============================================================

    // Minimize to tray instead of taskbar
    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });

    // Hide to tray on close (unless quitting)
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        saveWindowState();
    });

    // Save state on move/resize (debounced)
    let saveTimeout;
    const debouncedSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveWindowState, 500);
    };
    
    mainWindow.on('resize', debouncedSave);
    mainWindow.on('move', debouncedSave);

    // Register global shortcut from settings
    registerToggleShortcut(currentSettings.shortcut);

    // Apply auto-launch setting
    setAutoLaunch(currentSettings.runOnStartup);
}

// IPC handlers for window controls
ipcMain.on('window-minimize', () => {
    mainWindow?.hide();
});

ipcMain.on('window-close', () => {
    app.isQuitting = true;
    app.quit();
});

// IPC handlers for settings
ipcMain.handle('get-settings', () => {
    return {
        shortcut: currentSettings.shortcut,
        runOnStartup: currentSettings.runOnStartup
    };
});

ipcMain.handle('set-shortcut', (event, shortcut) => {
    // Validate shortcut format
    if (!shortcut || typeof shortcut !== 'string') {
        return { success: false, error: 'Invalid shortcut' };
    }

    // Validate shortcut structure
    const validationResult = validateShortcut(shortcut);
    if (!validationResult.valid) {
        return { success: false, error: validationResult.error };
    }

    // Try to register the new shortcut
    const success = registerToggleShortcut(shortcut);

    if (success) {
        currentSettings.shortcut = shortcut;
        saveSettings();
        return { success: true };
    } else {
        // Restore previous shortcut
        registerToggleShortcut(currentSettings.shortcut);
        return { success: false, error: 'Failed to register shortcut. It may be in use by another application.' };
    }
});

ipcMain.handle('set-run-on-startup', (event, enabled) => {
    // Validate boolean
    if (typeof enabled !== 'boolean') {
        return { success: false, error: 'Invalid value' };
    }

    try {
        setAutoLaunch(enabled);
        currentSettings.runOnStartup = enabled;
        saveSettings();
        return { success: true };
    } catch (e) {
        console.error('Failed to set auto-launch:', e);
        return { success: false, error: e.message };
    }
});

// ============================================================
// Secure Token Storage (safeStorage — OS-level encryption)
// ============================================================
const secureStoreFile = path.join(app.getPath('userData'), 'secure-tokens.json');

function readSecureStore() {
    try {
        if (fs.existsSync(secureStoreFile)) {
            return JSON.parse(fs.readFileSync(secureStoreFile, 'utf8'));
        }
    } catch (e) {
        console.error('[SecureStorage] Failed to read store:', e);
    }
    return {};
}

function writeSecureStore(store) {
    try {
        fs.writeFileSync(secureStoreFile, JSON.stringify(store));
    } catch (e) {
        console.error('[SecureStorage] Failed to write store:', e);
    }
}

const ALLOWED_STORAGE_KEYS = new Set(['access_token', 'refresh_token', 'device_token']);

ipcMain.handle('secure-storage-set', (event, key, value) => {
    if (typeof key !== 'string' || !ALLOWED_STORAGE_KEYS.has(key)) {
        return { success: false, error: 'Invalid storage key' };
    }
    if (typeof value !== 'string' || value.length > 8192) {
        return { success: false, error: 'Invalid storage value' };
    }
    if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'Encryption not available' };
    }
    try {
        const encrypted = safeStorage.encryptString(value);
        const store = readSecureStore();
        store[key] = encrypted.toString('base64');
        writeSecureStore(store);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('secure-storage-get', (event, key) => {
    if (typeof key !== 'string' || !ALLOWED_STORAGE_KEYS.has(key)) {
        return { success: false, error: 'Invalid storage key' };
    }
    if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'Encryption not available' };
    }
    try {
        const store = readSecureStore();
        if (!(key in store)) return { success: true, value: null };
        const decrypted = safeStorage.decryptString(Buffer.from(store[key], 'base64'));
        return { success: true, value: decrypted };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('secure-storage-delete', (event, key) => {
    if (typeof key !== 'string' || !ALLOWED_STORAGE_KEYS.has(key)) {
        return { success: false, error: 'Invalid storage key' };
    }
    try {
        const store = readSecureStore();
        delete store[key];
        writeSecureStore(store);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('secure-storage-clear', () => {
    try {
        if (fs.existsSync(secureStoreFile)) {
            fs.unlinkSync(secureStoreFile);
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Handle second instance (show existing window)
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

app.whenReady().then(() => {
    // Load settings first
    loadSettings();

    // ============================================================
    // SECURITY: Content Security Policy
    // ============================================================
    const CSP = [
        "default-src 'self' app:",
        "script-src 'self' 'wasm-unsafe-eval' 'sha256-qdXJjEG/5WNJAz52BRfAkidW5L2+qDXJ8zrJoaq9WAQ=' app:",
        "style-src 'self' 'unsafe-inline' app:",
        "img-src 'self' data: blob: app:",
        "media-src 'self' blob: app:",
        "frame-src blob: app:",
        "font-src 'self' app:",
        "connect-src 'self' https://api.keyhive.app app:",
        "worker-src 'self' blob: app:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (details.url.startsWith('app://')) {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [CSP]
                }
            });
        } else {
            callback({ responseHeaders: details.responseHeaders });
        }
    });


    // Register custom protocol handler to serve files from www/
    protocol.registerFileProtocol('app', (request, callback) => {
        let url = request.url.replace('app://local/', '').replace('app://local', '');
        url = url.replace(/^(\.\/|\/)+|\/+$/g, '');
        if (url === '') {
            url = 'index.html';
        }
        url = decodeURIComponent(url);
        
        // SECURITY: Prevent path traversal
        const filePath = path.join(__dirname, 'www', url);
        const normalizedPath = path.normalize(filePath);
        const wwwDir = path.join(__dirname, 'www');
        
        if (!normalizedPath.startsWith(wwwDir)) {
            console.error('[Security] Path traversal attempt blocked:', url);
            callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
            return;
        }
        
        callback({ path: normalizedPath });
    });

    createTray();
    createWindow();
});

app.on('window-all-closed', () => {
    // Don't quit, keep in tray
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    } else {
        mainWindow?.show();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
    app.isQuitting = true;
});
