/**
 * KeyHive Open Source Build Script
 *
 * Copies web/ into {platform}/www/ and patches paths for each platform.
 *
 * Usage:
 *   node build.js              — build all (electron + capacitor)
 *   node build.js electron     — build electron only
 *   node build.js capacitor    — build capacitor only
 */

const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, 'web');
const API_URL = 'https://api.keyhive.app';

// ── Helpers ─────────────────────────────────────────────────────────

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
    }
}

function replaceIn(file, search, replace) {
    let content = fs.readFileSync(file, 'utf8');
    if (typeof search === 'string') content = content.split(search).join(replace);
    else content = content.replace(search, replace);
    fs.writeFileSync(file, content, 'utf8');
}

function copyWeb(wwwDir) {
    fs.rmSync(wwwDir, { recursive: true, force: true });
    copyDir(WEB, wwwDir);

    // Convert absolute paths to relative
    replaceIn(path.join(wwwDir, 'index.html'), 'href="/css/', 'href="./css/');
    replaceIn(path.join(wwwDir, 'index.html'), 'src="/js/', 'src="./js/');
    replaceIn(path.join(wwwDir, 'js', 'crypto', 'crypto-api.js'),
        "new Worker('/js/crypto/crypto-worker.js')",
        "new Worker('./js/crypto/crypto-worker.js')");
}

// ── Build Targets ───────────────────────────────────────────────────

function buildElectron() {
    const wwwDir = path.join(__dirname, 'electron', 'www');
    console.log('[electron] Building www/...');
    copyWeb(wwwDir);

    replaceIn(path.join(wwwDir, 'js', 'crypto', 'crypto-worker.js'),
        "importScripts('/js/lib/argon2.min.js')",
        "importScripts('app://local/js/lib/argon2.min.js')");

    console.log('[electron] Done!');
}

function buildCapacitor() {
    const wwwDir = path.join(__dirname, 'capacitor', 'www');
    console.log('[capacitor] Building www/...');
    copyWeb(wwwDir);

    replaceIn(path.join(wwwDir, 'js', 'crypto', 'crypto-worker.js'),
        "importScripts('/js/lib/argon2.min.js')",
        "importScripts('capacitor://localhost/js/lib/argon2.min.js')");

    // CSP meta tag
    replaceIn(path.join(wwwDir, 'index.html'), '<head>',
        '<head>\n    <meta http-equiv="Content-Security-Policy" content="' +
        "default-src 'self' capacitor://localhost; " +
        "script-src 'self' 'wasm-unsafe-eval' capacitor://localhost; " +
        "style-src 'self' 'unsafe-inline' capacitor://localhost; " +
        "img-src 'self' data: blob: capacitor://localhost; " +
        "connect-src 'self' "+ API_URL +" capacitor://localhost; " +
        "worker-src 'self' blob: capacitor://localhost" +
        '">');

    console.log('[capacitor] Done!');
}

// ── Main ────────────────────────────────────────────────────────────

if (!fs.existsSync(WEB)) {
    console.error('ERROR: web/ folder not found. Make sure you have the web/ directory.');
    process.exit(1);
}

const args = process.argv.slice(2).map(a => a.toLowerCase());
const validTargets = ['electron', 'capacitor'];
const targets = args.filter(a => validTargets.includes(a));
const buildAll = targets.length === 0;

if (buildAll || targets.includes('electron'))  buildElectron();
if (buildAll || targets.includes('capacitor')) buildCapacitor();

console.log('\nBuild complete!');
