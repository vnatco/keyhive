<p align="center">
  <img src="electron/icons/icon.svg" width="80" height="80" alt="KeyHive">
</p>

<h1 align="center">KeyHive</h1>

<p align="center">
  Fast credential retrieval for developers and sysadmins.<br>
  Hotkey, search, copied to clipboard in under 2 seconds. Zero-knowledge, cross-platform.
</p>

<p align="center">
  <a href="https://keyhive.app">Website</a> &middot;
  <a href="https://web.keyhive.app">Web App</a> &middot;
  <a href="#getting-started">Getting Started</a> &middot;
  <a href="#security">Security</a>
</p>

---

## What is KeyHive?

A password manager where the server knows nothing. All encryption and decryption happens in your browser or native app using Argon2id + AES-256-GCM before anything touches the network. The server stores only encrypted blobs it cannot read.

No frameworks. No build tools. No bundlers. Vanilla JavaScript and Web Workers.

## Who is it for?

Developers and sysadmins who manage credentials that go way beyond website logins. Servers, SSH keys, API tokens, database passwords, internal tools, private IPs, router credentials, deployment keys - the kind of stuff that doesn't fit neatly into a browser autofill box.

If you have ever found yourself digging through notes, text files, or spreadsheets trying to find a password for a server you set up two years ago, this is for you.

The whole point is speed. Hit CTRL+ALT+Z from anywhere, type two or three letters, password is on your clipboard. Under two seconds. No switching apps, no browser extension, no autofill popup getting in your way. The shortcut is customizable but honestly you probably won't change it.

## Why I Built This

I have 100+ passwords. Servers, SSH keys, API tokens, credentials for every project I've ever touched. It never stops growing.

Back in 2012 I was using a web-based password manager and it was just too slow for the way I work. I don't want autofill. I don't want a browser extension. I want to hit a hotkey, type two letters, and have the password copied. That's the whole requirement.

So I built a C# app that sat in the system tray. CTRL+ALT+Z to pop it up, start typing, done. AES-256, local, no sync, no cloud. I used it daily for over 10 years.

The annoying part was every OS reinstall I had to move the vault manually and I was never careful about it. Eventually I had three or four copies floating around with different passwords in each one. Classic.

KeyHive is the rewrite I kept putting off. Same philosophy - keyboard first, fast retrieval, vault isolation per project, no browser extensions, no autofill, nothing you didn't ask for. But now it syncs, it's zero-knowledge so the server can't read your data even if it wanted to, it runs on every platform, and you can self-host the whole thing if you don't trust anyone else's server.

CTRL+ALT+Z still works. You can change it in settings, but why would you.

## Features

- **Global hotkey** - customizable shortcut summons the app from anywhere, type to search, password copied in under 2 seconds
- **Zero-knowledge architecture** - server stores only encrypted data and salts
- **Client-side encryption** - Argon2id key derivation + AES-256-GCM, all in Web Workers
- **Web, Desktop, and Mobile** - one codebase, three platforms
- **Offline mode** - encrypted vault cached locally, changes synced when back online
- **Vaults and folders** - organize passwords, TOTP codes, notes, websites, and files
- **Password generator** - customizable length, character sets, and passphrase mode
- **TOTP authenticator** - built-in two-factor code generator (no separate app needed)
- **Security dashboard** - breach detection, password strength analysis, reuse detection
- **Import/Export** - migrate from other password managers or back up your data
- **Biometric unlock** - Face ID / Touch ID / fingerprint on mobile (Keychain/Keystore backed)
- **Dark mode** - automatic or manual theme switching
- **Self-hostable** - run your own instance with full control

## How It Works

1. You enter your **master password** - it never leaves your device
2. **Argon2id** derives an encryption key (64 MB memory, 3 iterations) - resistant to GPU/ASIC attacks
3. **AES-256-GCM** encrypts your vault data before it's sent to the server
4. The server stores only the **encrypted blob** and the **salt** - nothing else
5. To read your data, you must have the master password - there is no recovery, no backdoor, no "forgot password"

The master password and derived keys live inside an **isolated Web Worker** - they never touch the main thread, the DOM, or any browser extension.

```
┌─────────────────────────────────────────────────────┐
│                      Browser                        │
│                                                     │
│  ┌─────────────┐          ┌──────────────────────┐  │
│  │ Main Thread │          │     Web Worker       │  │
│  │             │  ------> │  Master password     │  │
│  │  UI / DOM   │          │  Argon2id derivation │  │
│  │  API calls  │ <------  │  AES-256-GCM encrypt │  │
│  │             │ encrypted│  AES-256-GCM decrypt │  │
│  └──────┬──────┘  data    └──────────────────────┘  │
│         │                                           │
│         │  encrypted only                           │
│         ▼                                           │
│  ┌─────────────┐                                    │
│  │  IndexedDB  │  (offline cache - encrypted)       │
│  └─────────────┘                                    │
└────────┬────────────────────────────────────────────┘
         │  HTTPS (encrypted blobs only)
         ▼
┌─────────────────┐
│     Server      │
│                 │
│  Encrypted data │
│  Salts          │
│  Email/metadata │
│                 │
│  NO master pwd  │
│  NO plaintext   │
│  NO derived key │
└─────────────────┘
```

## Getting Started

### Web App

The `web/` folder is the complete frontend - serve it with any static web server over HTTPS.

See **[web/README.md](web/README.md)** for hosting instructions with Apache/Nginx configs.

### Desktop App (Electron)

Build the Electron app from the web source, then run it:

```bash
node build.js electron     # copies web/ into electron/www/
cd electron
npm install                # first time only
npm start                  # run the app
```

On Windows, after building, double-click **`electron/run-windows.cmd`** - it handles everything.

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

> **Note:** For now, self-hosted instances use local storage only. Cloud sync requires an account on [keyhive.app](https://keyhive.app). If there is enough interest, I will open source the backend in Node.js with Docker support.

## Security

### Cryptography

| Layer | Algorithm | Parameters |
|-------|-----------|------------|
| Key derivation | Argon2id | 64 MB memory, 3 iterations, 32-byte key |
| Encryption | AES-256-GCM | Random 12-byte IV per operation |
| Master password | Never transmitted | Not hashed, not sent - used only locally for key derivation |

### Architecture

- **Web Worker isolation** - master password and encryption keys never touch the main thread
- **No server-side password verification** - your master password never reaches the server. Decryption succeeding on your device is the only proof it was correct.
- **Content Security Policy** - strict CSP on all platforms (web, Electron, Capacitor)
- **Electron sandboxing** - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- **Breach detection** - passwords checked against Have I Been Pwned using k-anonymity (only a 5-character SHA-1 prefix is sent, via a backend proxy)

### What an attacker gets from the server

- Encrypted blobs (AES-256-GCM ciphertext)
- Argon2id salts
- Email addresses and account metadata

That's it. No master password. No plaintext. No derived keys.

### Server-side integrity

- Independent watchdog servers continuously verify SHA-256 checksums of every served file against a known-good manifest
- Strict Content Security Policy on all platforms
- Desktop and mobile apps load files locally
- Open source - you can audit every line and self-host

## Tech Stack

- **Frontend**: Vanilla JavaScript (no frameworks, no bundlers)
- **Crypto**: Argon2id (WASM) + Web Crypto API (AES-256-GCM)
- **Desktop**: Electron
- **Mobile**: Capacitor (iOS + Android)

## Third-Party Libraries

This project uses the following open-source libraries (MIT licensed):

- **[argon2-browser](https://github.com/antelle/argon2-browser)** - Argon2 hashing compiled to WASM for client-side key derivation
- **[qrcodejs](https://github.com/davidshimjs/qrcodejs)** - QR code generation for TOTP setup

See `web/js/lib/` for the bundled files and their license headers.

## License

KeyHive is licensed under the [GNU Affero General Public License v3.0](LICENSE.txt).

You are free to use, modify, and distribute this software. If you run a modified version as a network service, you must make your source code available to its users.
