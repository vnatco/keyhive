/**
 * KeyHive Electron Dev CLI
 *
 * Interactive helper to build or run the Electron app.
 *
 * Usage:
 *   node dev.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = __dirname;
const NODE_MODULES = path.join(ROOT, 'node_modules');

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

function run(cmd, opts = {}) {
    console.log(`\n  Running: ${cmd}\n`);
    const child = spawn(cmd, { shell: true, stdio: 'inherit', cwd: ROOT, ...opts });
    return new Promise((resolve, reject) => {
        child.on('close', code => code === 0 ? resolve() : reject(new Error(`Exit code ${code}`)));
        child.on('error', reject);
    });
}

function ensureDeps() {
    if (!fs.existsSync(NODE_MODULES)) {
        console.log('  Installing dependencies...');
        execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
    }
}

// ── Actions ─────────────────────────────────────────────────────────

let _savedAppleCreds = {};

async function handleRun(rl) {
    ensureDeps();
    await run('npm start');
}

async function handleBuild(rl) {
    const os = process.platform;
    const options = [];
    if (os === 'win32')  options.push({ label: 'Windows — unsigned (.exe)', value: 'win' });
    if (os === 'linux')  options.push({ label: 'Linux — unsigned (.deb)', value: 'linux' });
    if (os === 'darwin') {
        options.push({ label: 'macOS — unsigned (.dmg)', value: 'mac-unsigned' });
        options.push({ label: 'macOS — signed (.dmg)', value: 'mac-signed' });
        options.push({ label: 'macOS — custom signed + notarized (.dmg)', value: 'mac-custom' });
    }

    const platform = options.length === 1
        ? (console.log(`\n  Building for ${options[0].label}...`), options[0])
        : await choose(rl, 'Build for which platform?', options);

    ensureDeps();

    // Disable auto code signing for unsigned builds
    if (['win', 'linux', 'mac-unsigned', 'mac-custom'].includes(platform.value)) {
        process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    }

    // For custom signed builds, collect Apple credentials for manual notarization
    if (platform.value === 'mac-custom') {
        _savedAppleCreds = {
            id: process.env.APPLE_ID,
            password: process.env.APPLE_APP_SPECIFIC_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
        };
        if (!_savedAppleCreds.id) {
            _savedAppleCreds.id = (await ask(rl, '  Apple ID (email): ')).trim();
        }
        if (!_savedAppleCreds.password) {
            _savedAppleCreds.password = (await ask(rl, '  App-specific password: ')).trim();
        }
        if (!_savedAppleCreds.id || !_savedAppleCreds.password) {
            console.log('\n  Notarization will be skipped (missing credentials)');
        }
    }

    // For unsigned/custom mac builds, clear Apple credentials so afterSign hook skips notarization
    if (['mac-unsigned', 'mac-custom'].includes(platform.value)) {
        delete process.env.APPLE_ID;
        delete process.env.APPLE_APP_SPECIFIC_PASSWORD;
        delete process.env.APPLE_TEAM_ID;
    }

    if (platform.value === 'win') {
        await run('npm run build:win');
    } else if (platform.value === 'linux') {
        await run('npm run build:linux');
    } else if (platform.value === 'mac-unsigned') {
        await run('npx electron-builder --mac --config.mac.identity=null');
    } else if (platform.value === 'mac-signed') {
        await run('npm run build:mac');
    } else if (platform.value === 'mac-custom') {
        await buildMacCustomSigned();
    }

    // Show exact output location
    const distDir = path.join(ROOT, 'dist');
    if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir).filter(f => /\.(exe|dmg|deb|AppImage|snap)$/i.test(f));
        if (files.length) {
            console.log('\n  Output:');
            files.forEach(f => console.log(`    ${path.join(distDir, f)}`));
        } else {
            console.log(`\n  Build output: ${distDir}`);
        }
    }
    console.log('');
    return 'quit';
}

async function buildMacCustomSigned() {
    // Save Apple credentials before handleBuild clears them (for step 4 notarization)
    const appleId = _savedAppleCreds.id;
    const applePassword = _savedAppleCreds.password;
    const teamId = _savedAppleCreds.teamId;

    const IDENTITY = process.env.APPLE_SIGNING_IDENTITY;
    const ENTITLEMENTS = path.join(ROOT, 'entitlements.mac.plist');
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const APP = path.join(ROOT, 'dist', 'mac-arm64', 'KeyHive.app');
    const DMG = path.join(ROOT, 'dist', `KeyHive-${pkg.version}-arm64.dmg`);

    // Step 1: Build fully unsigned (afterSign hook skips because Apple env vars were cleared)
    console.log('\n  [1/4] Building unsigned app...');
    await run('npx electron-builder --mac --config.mac.identity=null');

    if (!fs.existsSync(APP)) {
        throw new Error(`App not found at ${APP}. Check build output.`);
    }

    // Step 2: Sign all binaries (inner first, outer last)
    console.log('\n  [2/4] Signing with Developer ID...');

    const sign = (target) => {
        execSync(
            `codesign --sign "${IDENTITY}" --force --timestamp --options runtime --entitlements "${ENTITLEMENTS}" "${target}"`,
            { cwd: ROOT, stdio: 'inherit' }
        );
    };

    // Sign dylibs and shared objects
    const dylibs = execSync(`find "${APP}" -type f \\( -name "*.dylib" -o -name "*.so" \\)`, { encoding: 'utf8' }).trim();
    if (dylibs) dylibs.split('\n').forEach(sign);

    // Sign executables in Frameworks
    const frameworkBins = execSync(
        `find "${APP}/Contents/Frameworks" -type f -perm +111 ! -name "*.dylib" ! -name "*.so" ! -name "*.plist" ! -name "*.dat" ! -name "*.pak" ! -name "*.bin" ! -name "*.json" ! -name "*.png" ! -name "*.icns" ! -name "*.lproj" 2>/dev/null || true`,
        { encoding: 'utf8' }
    ).trim();
    if (frameworkBins) frameworkBins.split('\n').filter(Boolean).forEach(sign);

    // Sign frameworks
    const frameworks = execSync(`find "${APP}/Contents/Frameworks" -name "*.framework" -maxdepth 1 2>/dev/null || true`, { encoding: 'utf8' }).trim();
    if (frameworks) frameworks.split('\n').filter(Boolean).forEach(sign);

    // Sign helper apps
    const helpers = execSync(`find "${APP}/Contents/Frameworks" -name "*.app" -maxdepth 2 2>/dev/null || true`, { encoding: 'utf8' }).trim();
    if (helpers) helpers.split('\n').filter(Boolean).forEach(sign);

    // Sign the main app bundle
    sign(APP);
    execSync(`codesign --verify --deep --strict "${APP}"`, { cwd: ROOT, stdio: 'inherit' });
    console.log('  Signature OK');

    // Step 3: Create DMG with Applications link
    console.log('\n  [3/4] Creating DMG...');
    const staging = path.join(ROOT, 'dist', 'dmg-staging');
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(staging, { recursive: true });
    execSync(`cp -R "${APP}" "${staging}/"`, { stdio: 'inherit' });
    execSync(`ln -s /Applications "${staging}/Applications"`, { stdio: 'inherit' });
    if (fs.existsSync(DMG)) fs.unlinkSync(DMG);
    execSync(`hdiutil create -volname "KeyHive" -srcfolder "${staging}" -ov -format UDZO "${DMG}"`, { stdio: 'inherit' });
    fs.rmSync(staging, { recursive: true, force: true });

    // Sign the DMG itself
    execSync(
        `codesign --sign "${IDENTITY}" --timestamp "${DMG}"`,
        { cwd: ROOT, stdio: 'inherit' }
    );
    console.log(`  Created and signed: ${DMG}`);

    // Step 4: Notarize
    if (appleId && applePassword && teamId) {
        console.log('\n  [4/4] Submitting for notarization...');
        const notarizeOutput = execSync(
            `xcrun notarytool submit "${DMG}" --apple-id "${appleId}" --password "${applePassword}" --team-id "${teamId}"`,
            { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
        );
        console.log(notarizeOutput);
        const idMatch = notarizeOutput.match(/id:\s+([a-f0-9-]+)/);
        const submissionId = idMatch ? idMatch[1] : 'SUBMISSION_ID';
        console.log('  Submitted! Run these to verify and finalize:\n');
        console.log(`  1. Check status:`);
        console.log(`     xcrun notarytool info ${submissionId} --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"\n`);
        console.log(`  2. Staple (after status is "Accepted"):`);
        console.log(`     xcrun stapler staple "${DMG}"\n`);
        console.log(`  3. Verify app signature:`);
        console.log(`     spctl --assess --verbose "${APP}"\n`);
        console.log(`  4. Verify DMG signature:`);
        console.log(`     codesign --verify --verbose "${DMG}"\n`);
    } else {
        console.log('\n  [4/4] SKIP notarization (credentials not provided)\n');
        console.log(`  Verify app signature:`);
        console.log(`     spctl --assess --verbose "${APP}"\n`);
        console.log(`  Verify DMG signature:`);
        console.log(`     codesign --verify --verbose "${DMG}"\n`);
    }
}

async function handleClean() {
    const distDir = path.join(ROOT, 'dist');
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
        console.log('\n  Deleted dist/');
    } else {
        console.log('\n  Nothing to clean — dist/ does not exist');
    }
}

// ── Main ────────────────────────────────────────────────────────────

function noteAppleEnv() {
    if (process.platform !== 'darwin') return;   // Apple signing only applies on macOS
    if (process.env.APPLE_TEAM_ID) return;        // already sourced -> stay quiet
    console.log('\n  NOTE: Apple signing vars not detected (APPLE_TEAM_ID is unset).');
    console.log('  Signing/notarization will fail. First, in a terminal, run:');
    console.log('    source /path/to/env_variables.env      (see env_variables.example)');
    console.log('  then run this again in the SAME terminal.\n');
}

const MENU = [
    { label: 'Run the app',         handler: handleRun },
    { label: 'Build installer',     handler: handleBuild },
    { label: 'Clean (delete dist/)', handler: handleClean },
];

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('\n  ===========================');
    console.log('    KeyHive Electron Dev');
    console.log('  ===========================');

    noteAppleEnv();

    try {
        while (true) {
            const action = await choose(rl, 'What would you like to do?', MENU);
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
