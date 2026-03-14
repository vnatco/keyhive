<p align="center">
  <img src="electron/icons/icon.svg" width="80" height="80" alt="KeyHive">
</p>

<h1 align="center">KeyHive</h1>

<p align="center">
  Zero-knowledge password manager with client-side encryption.<br>
  Your passwords never leave your device unencrypted.
</p>

<p align="center">
  <a href="https://keyhive.app">Website</a> &middot;
  <a href="https://web.keyhive.app">Web App</a> &middot;
  <a href="#getting-started">Getting Started</a> &middot;
  <a href="#security">Security</a>
</p>

---

## What is KeyHive?

KeyHive is a password manager where **the server knows nothing**. All encryption and decryption happens in your browser (or native app) before anything is sent to the server. Even if the server is fully compromised -database, files, everything -an attacker gets only encrypted blobs they cannot decrypt.

No frameworks. No build tools. No bundlers. Just vanilla JavaScript, Web Workers, and battle-tested cryptography.

## Features

- **Zero-knowledge architecture** -server stores only encrypted data and salts
- **Client-side encryption** -Argon2id key derivation + AES-256-GCM, all in Web Workers
- **Web, Desktop, and Mobile** -one codebase, three platforms
- **Offline mode** -encrypted vault cached locally, changes synced when back online
- **Vaults and folders** -organize passwords, TOTP codes, notes, websites, and files
- **Password generator** -customizable length, character sets, and passphrase mode
- **TOTP authenticator** -built-in two-factor code generator (no separate app needed)
- **Security dashboard** -breach detection, password strength analysis, reuse detection
- **Import/Export** -migrate from other password managers or back up your data
- **Biometric unlock** -Face ID / Touch ID / fingerprint on mobile (Keychain/Keystore backed)
- **Dark mode** -automatic or manual theme switching
- **Self-hostable** -run your own instance with full control

## How It Works

1. You enter your **master password** -it never leaves your device
2. **Argon2id** derives an encryption key (64 MB memory, 3 iterations) -resistant to GPU/ASIC attacks
3. **AES-256-GCM** encrypts your vault data before it's sent to the server
4. The server stores only the **encrypted blob** and the **salt** -nothing else
5. To read your data, you must have the master password -there is no recovery, no backdoor, no "forgot password"

The master password and derived keys live inside an **isolated Web Worker** -they never touch the main thread, the DOM, or any browser extension.

## Project Structure

```
keyhive/
├── web/                 # Web frontend (the core app)
│   ├── index.html       # Single-page app entry point
│   ├── css/             # Modular stylesheets
│   ├── js/
│   │   ├── app.js       # App initialization and routing
│   │   ├── config.js    # API URLs and settings
│   │   ├── api/         # API client with token refresh
│   │   ├── crypto/      # Web Worker encryption (Argon2id + AES-256-GCM)
│   │   ├── storage/     # Vault state and IndexedDB cache
│   │   ├── ui/          # Page renderers and components
│   │   ├── utils/       # Platform detection, breach checker, generators
│   │   └── lib/         # Third-party (Argon2 WASM)
│   └── README.md
│
├── electron/            # Desktop app (Windows, macOS, Linux)
│   ├── main.js          # Electron main process
│   ├── preload.js       # IPC bridge
│   ├── package.json     # Dependencies and build config
│   ├── icons/           # App icons (SVG, PNG, ICO)
│   ├── installer/       # NSIS installer scripts (Windows)
│   ├── run-windows.cmd  # Quick-launch for Windows
│   └── README.md
│
├── capacitor/           # Mobile app (iOS, Android)
│   ├── capacitor.config.json
│   ├── package.json
│   └── README.md
│
├── build.js             # Build script -copies web/ into platform apps
├── LICENSE.txt          # AGPLv3
└── README.md            # You are here
```

## Getting Started

### Web App

The `web/` folder is the complete frontend -serve it with any static web server over HTTPS.

See **[web/README.md](web/README.md)** for hosting instructions with Apache/Nginx configs.

### Desktop App (Electron)

Build the Electron app from the web source, then run it:

```bash
node build.js electron     # copies web/ into electron/www/
cd electron
npm install                # first time only
npm start                  # run the app
```

On Windows, after building, double-click **`electron/run-windows.cmd`** -it handles everything.

To build distributable installers:

```bash
npm run build:win          # Windows (.exe)
npm run build:mac          # macOS (.dmg)
npm run build:linux        # Linux (.AppImage)
```

See **[electron/README.md](electron/README.md)** for details on the desktop app architecture, system tray, global shortcuts, and installer customization.

### Mobile App (Capacitor)

Build the Capacitor app from the web source, then add native platforms:

```bash
node build.js capacitor    # copies web/ into capacitor/www/
cd capacitor
npm install                # first time only
npx cap add ios            # one-time: generates Xcode project (Mac only)
npx cap add android        # one-time: generates Android Studio project
npx cap sync               # copies www/ into native projects
npx cap open ios           # opens Xcode
npx cap open android       # opens Android Studio
```

See **[capacitor/README.md](capacitor/README.md)** for platform-specific setup, biometric unlock, and build instructions.

### Build All Platforms at Once

```bash
node build.js              # builds both electron and capacitor
```

## Configuration

By default, the app connects to the official KeyHive servers at `api.keyhive.app`. To self-host, edit `web/js/config.js` before building:

```javascript
APP_DOMAIN: 'your-domain.com',             // shown to users (no protocol)
APP_URL:    'https://your-domain.com',     // used for external links
API_URL:    'https://api.your-domain.com'  // backend API endpoint
```

Then run `node build.js` to propagate the changes to Electron and Capacitor.

## Security

### Cryptography

| Layer | Algorithm | Parameters |
|-------|-----------|------------|
| Key derivation | Argon2id | 64 MB memory, 3 iterations, 32-byte key |
| Encryption | AES-256-GCM | Random 12-byte IV per operation |
| Master password | Never transmitted | Not hashed, not sent -used only locally for key derivation |

### Architecture

- **Web Worker isolation** -master password and encryption keys never touch the main thread
- **No server-side password verification** -the server cannot check if your master password is correct. Only successful decryption proves it.
- **Content Security Policy** -strict CSP on all platforms (web, Electron, Capacitor)
- **Electron sandboxing** -`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- **Breach detection** -passwords checked against Have I Been Pwned using k-anonymity (only a 5-character SHA-1 prefix is sent, via a backend proxy)

### What if the server is compromised?

An attacker with **full database access** gets:
- Encrypted blobs (AES-256-GCM ciphertext)
- Argon2id salts
- Email addresses and account metadata

They **cannot**:
- Decrypt any vault data without the master password
- Offline brute-force master passwords (Argon2id with 64 MB memory makes this extremely expensive)
- Recover master passwords from any stored data (the server never receives them)

### What if the entire server is compromised?

An attacker with **full server access** could:
- Serve malicious JavaScript to new sessions (this is the main threat for any web-based password manager)

Mitigations:
- Independent watchdog servers continuously verify the SHA-256 hash of every served file against a known-good manifest. Any unauthorized change triggers an instant alert and automatic response.
- Strict Content Security Policy prevents inline script injection
- Desktop and mobile apps load files locally - not affected by server compromise
- Open source - you can audit every line and self-host

## Tech Stack

- **Frontend**: Vanilla JavaScript (no frameworks, no bundlers)
- **Crypto**: Argon2id (WASM) + Web Crypto API (AES-256-GCM)
- **Desktop**: Electron
- **Mobile**: Capacitor (iOS + Android)
- **Backend**: PHP (not included in this repository)

## Third-Party Libraries

This project uses the following open-source libraries (MIT licensed):

- **[argon2-browser](https://github.com/antelle/argon2-browser)** - Argon2 hashing compiled to WASM for client-side key derivation
- **[qrcodejs](https://github.com/davidshimjs/qrcodejs)** - QR code generation for TOTP setup

See `web/js/lib/` for the bundled files and their license headers.

## License

KeyHive is licensed under the [GNU Affero General Public License v3.0](LICENSE.txt).

You are free to use, modify, and distribute this software. If you run a modified version as a network service, you must make your source code available to its users.
