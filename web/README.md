# KeyHive Web Frontend

The web frontend for [KeyHive](https://keyhive.app) -a zero-knowledge password manager with client-side encryption. This is the core UI that runs in the browser and is also used by the Electron and Capacitor apps.

## Files

| File/Dir | Purpose |
|----------|---------|
| `index.html` | Single-page app entry point -loads all CSS and JS |
| `css/` | Modular stylesheets -`base.css`, `layout.css`, `components.css`, `pages.css` |
| `js/app.js` | App initialization, routing, and session management |
| `js/config.js` | API URLs, app domain, and feature flags |
| `js/api/` | API client with automatic token refresh and error handling |
| `js/crypto/` | Web Worker-based encryption -Argon2id key derivation, AES-256-GCM |
| `js/storage/` | Vault state management and IndexedDB local cache |
| `js/ui/` | Page renderers -home, view, add/edit, settings, import/export |
| `js/utils/` | Platform detection, connectivity, breach checker, biometrics |
| `js/lib/` | Third-party libraries (Argon2 WASM) |

## How It Works

KeyHive is a single-page application built with vanilla JavaScript -no frameworks, no build tools, no bundlers. Everything runs directly in the browser.

All encryption and decryption happens client-side using Web Workers. The master password and derived keys never touch the main thread. The server only stores encrypted blobs and the salt for key derivation -it cannot decrypt your data.

### Security Model

- **Argon2id** key derivation (64MB memory, 3 iterations) -resistant to GPU/ASIC attacks
- **AES-256-GCM** encryption -authenticated encryption for all vault data
- **Web Worker isolation** -master password and keys live in a separate thread
- **Zero-knowledge** -server never receives the master password or any hash of it
- **If the database is compromised** -attacker gets only encrypted blobs and salts, cannot offline brute-force master passwords

## Hosting

Copy the contents of this folder to your web server's document root. The app is purely static -no server-side processing required. HTTPS is mandatory (Web Workers and crypto APIs won't work over plain HTTP).

By default, the app connects to the KeyHive servers. To self-host, edit `js/config.js`:

```javascript
APP_DOMAIN: 'your-domain.com',            // shown to users (no protocol)
APP_URL:    'https://your-domain.com',    // used for external links
API_URL:    'https://api.your-domain.com' // backend API endpoint
```

### Apache

Enable required modules: `a2enmod rewrite ssl headers`

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    RewriteEngine on
    RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent]
</VirtualHost>

<VirtualHost *:443>
    ServerName   your-domain.com
    DocumentRoot /var/www/your-domain.com

    <Directory /var/www/your-domain.com>
        Options -Indexes -MultiViews +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Block PHP execution -static files only
    <FilesMatch "\.php$">
        Require all denied
    </FilesMatch>

    # Block hidden and sensitive files (.git, .env, .htpasswd, etc.)
    <FilesMatch "(^\.|\.(git|env|bak|sql|log|ini|yml|yaml|conf|lock|sh))$">
        Require all denied
    </FilesMatch>

    # Restrict HTTP methods to what the app actually needs
    <Location />
        <LimitExcept GET HEAD POST>
            Require all denied
        </LimitExcept>
    </Location>

    # Security headers
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"
    Header always set X-Content-Type-Options    "nosniff"
    Header always set X-Frame-Options           "DENY"
    Header always set Referrer-Policy           "strict-origin-when-cross-origin"
    Header always set Permissions-Policy        "geolocation=(), microphone=(), camera=(), payment=()"
    # Update connect-src below if you changed API_URL in js/config.js
    Header always set Content-Security-Policy   "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-qdXJjEG/5WNJAz52BRfAkidW5L2+qDXJ8zrJoaq9WAQ='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://api.keyhive.app; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
    Header always unset X-Powered-By
    Header always unset Server

    # SSL -adjust paths to your certificate
    SSLEngine on
    SSLCertificateFile    /etc/letsencrypt/live/your-domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/your-domain.com/privkey.pem
</VirtualHost>
```

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    root /var/www/your-domain.com;
    index index.html;

    # Block PHP execution -static files only
    location ~ \.php$ { deny all; }

    # Block hidden and sensitive files
    location ~ /\. { deny all; }

    # Restrict HTTP methods
    if ($request_method !~ ^(GET|HEAD|POST)$) { return 405; }

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "DENY" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy        "geolocation=(), microphone=(), camera=(), payment=()" always;
    # Update connect-src below if you changed API_URL in js/config.js
    add_header Content-Security-Policy   "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-qdXJjEG/5WNJAz52BRfAkidW5L2+qDXJ8zrJoaq9WAQ='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://api.keyhive.app; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;

    # Hide server version
    server_tokens off;

    # SSL -adjust paths to your certificate
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
}
```
