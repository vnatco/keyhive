/**
 * KeyHive Capacitor Dev CLI
 *
 * Interactive helper to build or clean the mobile app.
 * Detects OS automatically: macOS → iOS, Windows/Linux → Android.
 *
 * Usage:
 *   node dev.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = __dirname;
const NODE_MODULES = path.join(ROOT, 'node_modules');
const IOS_DIR = path.join(ROOT, 'ios');
const ANDROID_DIR = path.join(ROOT, 'android');

const IS_MAC = process.platform === 'darwin';
const PLATFORM = IS_MAC ? 'ios' : 'android';
const PLATFORM_DIR = IS_MAC ? IOS_DIR : ANDROID_DIR;
const PLATFORM_LABEL = IS_MAC ? 'iOS' : 'Android';
const IDE_NAME = IS_MAC ? 'Xcode' : 'Android Studio';

// ── Helpers ─────────────────────────────────────────────────────────

function ask(rl, question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function choose(rl, title, options) {
    console.log(`\n  ${title}\n`);
    options.forEach((opt, i) => console.log(`    ${i + 1}) ${opt.label}`));
    console.log('');

    while (true) {
        const answer = (await ask(rl, '  > ')).trim();
        const num = parseInt(answer, 10);
        if (num >= 1 && num <= options.length) {
            return options[num - 1];
        }
        console.log(`  Please enter a number between 1 and ${options.length}`);
    }
}

function ensureDeps() {
    if (!fs.existsSync(NODE_MODULES)) {
        console.log('  Installing dependencies...');
        execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
    }
}

function ensurePlatform() {
    if (!fs.existsSync(PLATFORM_DIR)) {
        console.log(`\n  ${PLATFORM}/ not found. Adding platform...`);
        execSync(`npx cap add ${PLATFORM}`, { cwd: ROOT, stdio: 'inherit' });
    }
}

// ── iOS Setup (icon, Face ID, version — skips if already in place) ──

function setupIOS() {
    const IOS_APP = path.join(IOS_DIR, 'App', 'App');
    const IOS_PROJECT = path.join(IOS_DIR, 'App', 'App.xcodeproj', 'project.pbxproj');
    const INFO_PLIST = path.join(IOS_APP, 'Info.plist');
    const APPICONSET = path.join(IOS_APP, 'Assets.xcassets', 'AppIcon.appiconset');
    const ICON_SRC = path.join(ROOT, 'icons', '1024x1024.png');
    const VERSION_FILE = path.join(ROOT, '..', 'version.json');

    if (!fs.existsSync(INFO_PLIST)) {
        console.log('  SKIP  iOS setup (ios/ not initialized)');
        return;
    }

    console.log('  Configuring iOS project...');

    // 1. App icon
    if (fs.existsSync(ICON_SRC) && fs.existsSync(APPICONSET)) {
        const destIcon = path.join(APPICONSET, 'AppIcon-1024x1024.png');
        fs.copyFileSync(ICON_SRC, destIcon);
        const contents = {
            images: [{
                filename: 'AppIcon-1024x1024.png',
                idiom: 'universal',
                platform: 'ios',
                size: '1024x1024'
            }],
            info: { author: 'xcode', version: 1 }
        };
        fs.writeFileSync(path.join(APPICONSET, 'Contents.json'), JSON.stringify(contents, null, 2));
        console.log('    DONE  App icon');
    } else {
        console.log('    SKIP  App icon (missing source or target)');
    }

    // 2. Face ID permission
    let plist = fs.readFileSync(INFO_PLIST, 'utf8');
    if (!plist.includes('NSFaceIDUsageDescription')) {
        const entry = `\t<key>NSFaceIDUsageDescription</key>\n\t<string>Unlock your vault with Face ID</string>\n`;
        plist = plist.replace('</dict>\n</plist>', entry + '</dict>\n</plist>');
        fs.writeFileSync(INFO_PLIST, plist, 'utf8');
        console.log('    DONE  Face ID permission');
    } else {
        console.log('    SKIP  Face ID permission (already present)');
    }

    // 3. Version number
    if (fs.existsSync(VERSION_FILE) && fs.existsSync(IOS_PROJECT)) {
        const { version } = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
        let pbx = fs.readFileSync(IOS_PROJECT, 'utf8');
        const match = pbx.match(/MARKETING_VERSION = ([\d.]+);/);
        if (!match || match[1] !== version) {
            pbx = pbx.replace(/MARKETING_VERSION = [\d.]+;/g, `MARKETING_VERSION = ${version};`);
            fs.writeFileSync(IOS_PROJECT, pbx, 'utf8');
            console.log(`    DONE  Version → ${version}`);
        } else {
            console.log(`    SKIP  Version (already ${version})`);
        }
    } else {
        console.log('    SKIP  Version (missing version.json or project file)');
    }
}

// ── Actions ─────────────────────────────────────────────────────────

async function handleBuild() {
    console.log(`\n  Building ${PLATFORM_LABEL}...`);

    ensureDeps();
    ensurePlatform();

    if (IS_MAC) setupIOS();

    console.log(`\n  Syncing and opening ${IDE_NAME}...`);
    execSync(`npx cap sync ${PLATFORM}`, { cwd: ROOT, stdio: 'inherit' });
    execSync(`npx cap open ${PLATFORM}`, { cwd: ROOT, stdio: 'inherit' });
    return 'quit';
}

async function handleClean() {
    if (fs.existsSync(PLATFORM_DIR)) {
        fs.rmSync(PLATFORM_DIR, { recursive: true, force: true });
        console.log(`\n  Deleted ${PLATFORM}/`);
    } else {
        console.log(`\n  Nothing to clean — ${PLATFORM}/ does not exist`);
    }
}

// ── Main ────────────────────────────────────────────────────────────

function noteAppleEnv() {
    if (process.platform !== 'darwin') return;   // iOS signing only applies on macOS
    if (process.env.APPLE_TEAM_ID) return;        // already sourced -> stay quiet
    console.log('\n  NOTE: APPLE_TEAM_ID not detected - Xcode has no signing team,');
    console.log('  so the iOS build will fail. First, in a terminal, run:');
    console.log('    source /path/to/env_variables.env      (see env_variables.example)');
    console.log('  then run this again in the SAME terminal.\n');
}

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('\n  ===========================');
    console.log(`    KeyHive ${PLATFORM_LABEL} Dev`);
    console.log('  ===========================');

    noteAppleEnv();

    const menu = [
        { label: `Build (setup + sync + open ${IDE_NAME})`, handler: handleBuild },
        { label: `Clean (delete ${PLATFORM}/)`,             handler: handleClean },
    ];

    try {
        while (true) {
            const action = await choose(rl, 'What would you like to do?', menu);
            const result = await action.handler(rl);
            if (result === 'quit') break;
        }
    } catch (err) {
        if (err.message.includes('Exit code')) {
            console.error(`\n  Command failed (${err.message})`);
        } else {
            console.error(`\n  Error: ${err.message}`);
        }
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
