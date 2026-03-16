/**
 * Crypto Worker - Isolated Cryptographic Operations
 *
 * SECURITY: This worker holds the encryption key in isolated memory.
 * The key NEVER leaves this worker. All crypto operations happen here.
 *
 * Main thread can only:
 * - Request key derivation (sends password, receives success/fail)
 * - Request encryption (sends plaintext, receives ciphertext)
 * - Request decryption (sends ciphertext, receives plaintext)
 * - Request lock (clears the key)
 */

// Import argon2 WASM
importScripts('/js/lib/argon2.min.js');

// ============================================================
// ISOLATED STATE - Never exposed to main thread
// ============================================================

let _encryptionKey = null;
let _verificationHash = null;
let _isUnlocked = false;

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    argon2: {
        memory: 65536,      // 64 MB
        iterations: 3,
        parallelism: 4,
        hashLength: 32,     // 256 bits for AES-256
        type: 2,            // Argon2id
    },
    // Minimum KDF params to prevent server-side downgrade attacks
    kdfMinimums: {
        memory: 32768,      // 32 MB minimum
        iterations: 2,
    },
    aes: {
        name: 'AES-GCM',
        length: 256,
        ivLength: 12,
        tagLength: 128,
    },
};

// ============================================================
// MESSAGE HANDLER
// ============================================================

self.onmessage = async function(event) {
    const { id, action, payload } = event.data;

    try {
        let result;

        switch (action) {
            case 'deriveKey':
                result = await handleDeriveKey(payload);
                break;

            case 'deriveKeyWithSalt':
                result = await handleDeriveKeyWithNewSalt(payload);
                break;

            case 'deriveKeyForVerification':
                result = await handleDeriveKeyForVerification(payload);
                break;

            case 'verifyKey':
                result = await handleVerifyKey(payload);
                break;

            case 'encrypt':
                result = await handleEncrypt(payload);
                break;

            case 'decrypt':
                result = await handleDecrypt(payload);
                break;

            case 'encryptObject':
                result = await handleEncryptObject(payload);
                break;

            case 'decryptObject':
                result = await handleDecryptObject(payload);
                break;

            case 'encryptFile':
                result = await handleEncryptFile(payload);
                break;

            case 'decryptFile':
                result = await handleDecryptFile(payload);
                break;

            case 'encryptField':
                result = await handleEncryptField(payload);
                break;

            case 'decryptField':
                result = await handleDecryptField(payload);
                break;

            case 'reEncryptWithNewKey':
                result = await handleReEncryptWithNewKey(payload);
                break;

            case 'reEncryptForExport':
                result = await handleReEncryptForExport(payload);
                break;

            case 'importDecrypt':
                result = await handleImportDecrypt(payload);
                break;

            case 'importReEncrypt':
                result = await handleImportReEncrypt(payload);
                break;

            case 'lock':
                result = handleLock();
                break;

            case 'isUnlocked':
                result = { unlocked: _isUnlocked };
                break;

            case 'getVerificationHash':
                result = { hash: _verificationHash };
                break;

            case 'compareHashes':
                result = { equal: timingSafeEqual(payload.a, payload.b) };
                break;

            case 'generateSalt':
                result = { salt: generateSalt() };
                break;

            case 'generateRecoveryCodes':
                result = await handleGenerateRecoveryCodes(payload);
                break;

            case 'recoverWithCode':
                result = await handleRecoverWithCode(payload);
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        self.postMessage({ id, success: true, result });

    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error.message || 'Crypto operation failed'
        });
    }
};

// ============================================================
// KEY DERIVATION
// ============================================================

async function handleDeriveKey({ password, salt, kdf }) {
    if (!password || !salt) {
        throw new Error('Password and salt are required');
    }

    const saltBytes = base64ToArrayBuffer(salt);

    // Use provided KDF params or fall back to defaults, enforcing minimums
    const kdfMemory = Math.max(kdf?.memory || CONFIG.argon2.memory, CONFIG.kdfMinimums.memory);
    const kdfIterations = Math.max(kdf?.iterations || CONFIG.argon2.iterations, CONFIG.kdfMinimums.iterations);
    const kdfParallelism = kdf?.parallelism || CONFIG.argon2.parallelism;

    // Derive key using Argon2id
    const result = await argon2.hash({
        pass: password,
        salt: saltBytes,
        time: kdfIterations,
        mem: kdfMemory,
        parallelism: kdfParallelism,
        hashLen: CONFIG.argon2.hashLength,
        type: CONFIG.argon2.type,
    });

    const keyBytes = new Uint8Array(result.hash);

    // Create verification hash (SHA-256 of derived key)
    _verificationHash = await createVerificationHash(keyBytes);

    // Import as CryptoKey for AES operations (non-extractable!)
    _encryptionKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: CONFIG.aes.name },
        false,  // NOT extractable - critical for security
        ['encrypt', 'decrypt']
    );

    _isUnlocked = true;

    // Clear sensitive data from memory
    keyBytes.fill(0);

    return {
        success: true,
        verificationHash: _verificationHash
    };
}

async function handleDeriveKeyWithNewSalt({ password }) {
    if (!password) {
        throw new Error('Password is required');
    }

    const salt = generateSalt();
    const result = await handleDeriveKey({ password, salt });

    return {
        ...result,
        salt
    };
}

/**
 * Derive key for verification only - does NOT update cached key
 * Used to verify a password matches before sensitive operations
 */
async function handleDeriveKeyForVerification({ password, salt, kdf }) {
    if (!password || !salt) {
        throw new Error('Password and salt are required');
    }

    const saltBytes = base64ToArrayBuffer(salt);

    // Use provided KDF params or fall back to defaults, enforcing minimums
    const kdfMemory = Math.max(kdf?.memory || CONFIG.argon2.memory, CONFIG.kdfMinimums.memory);
    const kdfIterations = Math.max(kdf?.iterations || CONFIG.argon2.iterations, CONFIG.kdfMinimums.iterations);
    const kdfParallelism = kdf?.parallelism || CONFIG.argon2.parallelism;

    // Derive key using Argon2id
    const result = await argon2.hash({
        pass: password,
        salt: saltBytes,
        time: kdfIterations,
        mem: kdfMemory,
        parallelism: kdfParallelism,
        hashLen: CONFIG.argon2.hashLength,
        type: CONFIG.argon2.type,
    });

    const keyBytes = new Uint8Array(result.hash);

    // Create verification hash (SHA-256 of derived key)
    const verificationHash = await createVerificationHash(keyBytes);

    // Clear sensitive data from memory - DO NOT cache the key
    keyBytes.fill(0);

    return {
        success: true,
        verificationHash
    };
}

async function handleVerifyKey({ verificationHash }) {
    if (!_verificationHash) {
        throw new Error('No key loaded');
    }

    return {
        valid: timingSafeEqual(_verificationHash, verificationHash)
    };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
        return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

async function createVerificationHash(keyBytes) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ============================================================
// ENCRYPTION / DECRYPTION
// ============================================================

async function handleEncrypt({ plaintext }) {
    requireUnlocked();

    const iv = crypto.getRandomValues(new Uint8Array(CONFIG.aes.ivLength));
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
        {
            name: CONFIG.aes.name,
            iv: iv,
            tagLength: CONFIG.aes.tagLength,
        },
        _encryptionKey,
        data
    );

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return { ciphertext: arrayBufferToBase64(combined) };
}

async function handleDecrypt({ ciphertext }) {
    requireUnlocked();

    const combined = base64ToArrayBuffer(ciphertext);
    const iv = combined.slice(0, CONFIG.aes.ivLength);
    const data = combined.slice(CONFIG.aes.ivLength);

    const decrypted = await crypto.subtle.decrypt(
        {
            name: CONFIG.aes.name,
            iv: iv,
            tagLength: CONFIG.aes.tagLength,
        },
        _encryptionKey,
        data
    );

    const decoder = new TextDecoder();
    return { plaintext: decoder.decode(decrypted) };
}

async function handleEncryptObject({ obj }) {
    const json = JSON.stringify(obj);
    return handleEncrypt({ plaintext: json });
}

async function handleDecryptObject({ ciphertext }) {
    const { plaintext } = await handleDecrypt({ ciphertext });
    return { obj: JSON.parse(plaintext) };
}

async function handleEncryptField({ value }) {
    return handleEncrypt({ plaintext: value });
}

async function handleDecryptField({ ciphertext }) {
    return handleDecrypt({ ciphertext });
}

// ============================================================
// FILE ENCRYPTION
// ============================================================

async function handleEncryptFile({ fileDataBase64 }) {
    requireUnlocked();

    const fileData = base64ToArrayBuffer(fileDataBase64);
    const iv = crypto.getRandomValues(new Uint8Array(CONFIG.aes.ivLength));

    const ciphertext = await crypto.subtle.encrypt(
        {
            name: CONFIG.aes.name,
            iv: iv,
            tagLength: CONFIG.aes.tagLength,
        },
        _encryptionKey,
        fileData
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return { encryptedFile: arrayBufferToBase64(combined) };
}

async function handleDecryptFile({ encryptedFile }) {
    requireUnlocked();

    const combined = base64ToArrayBuffer(encryptedFile);
    const iv = combined.slice(0, CONFIG.aes.ivLength);
    const data = combined.slice(CONFIG.aes.ivLength);

    const decrypted = await crypto.subtle.decrypt(
        {
            name: CONFIG.aes.name,
            iv: iv,
            tagLength: CONFIG.aes.tagLength,
        },
        _encryptionKey,
        data
    );

    return { fileDataBase64: arrayBufferToBase64(decrypted) };
}

// ============================================================
// RE-ENCRYPTION (for master password change)
// ============================================================

async function handleReEncryptWithNewKey({ items, newPassword, newSalt, newKdf }) {
    requireUnlocked();

    // First, decrypt all items with current key
    const decryptedItems = await Promise.all(
        items.map(async (item) => {
            const result = { ...item };

            // Decrypt encrypted_data (for items)
            if (item.encrypted_data) {
                const { obj } = await handleDecryptObject({ ciphertext: item.encrypted_data });
                result.decrypted_data = obj;
            }

            // Decrypt encrypted_name (for vaults/folders)
            if (item.encrypted_name) {
                const { plaintext } = await handleDecrypt({ ciphertext: item.encrypted_name });
                result.decrypted_name = plaintext;
            }

            // Decrypt encrypted_icon (for folders)
            if (item.encrypted_icon) {
                const { plaintext } = await handleDecrypt({ ciphertext: item.encrypted_icon });
                result.decrypted_icon = plaintext;
            }

            return result;
        })
    );

    // Derive new key with new password, salt, and optionally new KDF params
    await handleDeriveKey({ password: newPassword, salt: newSalt, kdf: newKdf });

    // Re-encrypt all items with new key
    const reEncryptedItems = await Promise.all(
        decryptedItems.map(async (item) => {
            const result = { id: item.id };

            // Re-encrypt encrypted_data
            if (item.decrypted_data !== undefined) {
                const { ciphertext } = await handleEncryptObject({ obj: item.decrypted_data });
                result.encrypted_data = ciphertext;
            }

            // Re-encrypt encrypted_name
            if (item.decrypted_name !== undefined) {
                const { ciphertext } = await handleEncrypt({ plaintext: item.decrypted_name });
                result.encrypted_name = ciphertext;
            }

            // Re-encrypt encrypted_icon
            if (item.decrypted_icon !== undefined) {
                const { ciphertext } = await handleEncrypt({ plaintext: item.decrypted_icon });
                result.encrypted_icon = ciphertext;
            }

            return result;
        })
    );

    return {
        items: reEncryptedItems,
        verificationHash: _verificationHash
    };
}

/**
 * Re-encrypt items for export WITHOUT switching the active key
 * This allows exporting with a different password while keeping the session intact
 */
async function handleReEncryptForExport({ items, newPassword, newSalt, newKdf }) {
    requireUnlocked();

    // First, decrypt all items with current key
    const decryptedItems = await Promise.all(
        items.map(async (item) => {
            const result = { ...item };

            // Decrypt encrypted_data (for items)
            if (item.encrypted_data) {
                const { obj } = await handleDecryptObject({ ciphertext: item.encrypted_data });
                result.decrypted_data = obj;
            }

            // Decrypt encrypted_name (for vaults/folders)
            if (item.encrypted_name) {
                const { plaintext } = await handleDecrypt({ ciphertext: item.encrypted_name });
                result.decrypted_name = plaintext;
            }

            // Decrypt encrypted_icon (for folders)
            if (item.encrypted_icon) {
                const { plaintext } = await handleDecrypt({ ciphertext: item.encrypted_icon });
                result.decrypted_icon = plaintext;
            }

            return result;
        })
    );

    // Derive NEW key temporarily (NOT stored in global state)
    const saltBytes = base64ToArrayBuffer(newSalt);
    const kdfMemory = Math.max(newKdf?.memory || CONFIG.argon2.memory, CONFIG.kdfMinimums.memory);
    const kdfIterations = Math.max(newKdf?.iterations || CONFIG.argon2.iterations, CONFIG.kdfMinimums.iterations);
    const kdfParallelism = newKdf?.parallelism || CONFIG.argon2.parallelism;

    const argonResult = await argon2.hash({
        pass: newPassword,
        salt: saltBytes,
        time: kdfIterations,
        mem: kdfMemory,
        parallelism: kdfParallelism,
        hashLen: CONFIG.argon2.hashLength,
        type: CONFIG.argon2.type,
    });

    const tempKeyBytes = new Uint8Array(argonResult.hash);

    // Import as temporary CryptoKey
    const tempKey = await crypto.subtle.importKey(
        'raw',
        tempKeyBytes,
        { name: CONFIG.aes.name },
        false,
        ['encrypt', 'decrypt']
    );
    tempKeyBytes.fill(0);

    // Re-encrypt all items with the TEMPORARY key
    const reEncryptedItems = await Promise.all(
        decryptedItems.map(async (item) => {
            const result = { id: item.id };

            // Re-encrypt encrypted_data using temp key
            if (item.decrypted_data !== undefined) {
                const iv = crypto.getRandomValues(new Uint8Array(CONFIG.aes.ivLength));
                const plaintext = JSON.stringify(item.decrypted_data);
                const encoded = new TextEncoder().encode(plaintext);
                const encrypted = await crypto.subtle.encrypt(
                    { name: CONFIG.aes.name, iv, tagLength: CONFIG.aes.tagLength },
                    tempKey,
                    encoded
                );
                const combined = new Uint8Array(iv.length + encrypted.byteLength);
                combined.set(iv);
                combined.set(new Uint8Array(encrypted), iv.length);
                result.encrypted_data = arrayBufferToBase64(combined);
            }

            // Re-encrypt encrypted_name using temp key
            if (item.decrypted_name !== undefined) {
                const iv = crypto.getRandomValues(new Uint8Array(CONFIG.aes.ivLength));
                const encoded = new TextEncoder().encode(item.decrypted_name);
                const encrypted = await crypto.subtle.encrypt(
                    { name: CONFIG.aes.name, iv, tagLength: CONFIG.aes.tagLength },
                    tempKey,
                    encoded
                );
                const combined = new Uint8Array(iv.length + encrypted.byteLength);
                combined.set(iv);
                combined.set(new Uint8Array(encrypted), iv.length);
                result.encrypted_name = arrayBufferToBase64(combined);
            }

            // Re-encrypt encrypted_icon using temp key
            if (item.decrypted_icon !== undefined) {
                const iv = crypto.getRandomValues(new Uint8Array(CONFIG.aes.ivLength));
                const encoded = new TextEncoder().encode(item.decrypted_icon);
                const encrypted = await crypto.subtle.encrypt(
                    { name: CONFIG.aes.name, iv, tagLength: CONFIG.aes.tagLength },
                    tempKey,
                    encoded
                );
                const combined = new Uint8Array(iv.length + encrypted.byteLength);
                combined.set(iv);
                combined.set(new Uint8Array(encrypted), iv.length);
                result.encrypted_icon = arrayBufferToBase64(combined);
            }

            return result;
        })
    );

    // tempKey goes out of scope and gets garbage collected
    // The active key (_encryptionKey) remains unchanged!

    return {
        items: reEncryptedItems
    };
}

// ============================================================
// IMPORT OPERATIONS
// ============================================================

/**
 * Decrypt data from an import file using a temporary key
 * This derives a key from the import password/salt, decrypts the data,
 * but does NOT replace the user's current key
 */
async function handleImportDecrypt({ items, password, salt, kdf }) {
    // We require the user's vault to be unlocked (so we can re-encrypt later)
    requireUnlocked();

    if (!password || !salt) {
        throw new Error('Password and salt are required');
    }

    // Derive temporary key from import file's password and salt
    const saltBytes = base64ToArrayBuffer(salt);
    const kdfMemory = Math.max(kdf?.memory || CONFIG.argon2.memory, CONFIG.kdfMinimums.memory);
    const kdfIterations = Math.max(kdf?.iterations || CONFIG.argon2.iterations, CONFIG.kdfMinimums.iterations);
    const kdfParallelism = kdf?.parallelism || CONFIG.argon2.parallelism;

    const argonResult = await argon2.hash({
        pass: password,
        salt: saltBytes,
        time: kdfIterations,
        mem: kdfMemory,
        parallelism: kdfParallelism,
        hashLen: CONFIG.argon2.hashLength,
        type: CONFIG.argon2.type,
    });

    const tempKeyBytes = new Uint8Array(argonResult.hash);

    // Import as temporary CryptoKey (NOT stored globally)
    const tempKey = await crypto.subtle.importKey(
        'raw',
        tempKeyBytes,
        { name: CONFIG.aes.name },
        false,
        ['encrypt', 'decrypt']
    );

    // Clear temp key bytes immediately
    tempKeyBytes.fill(0);

    // Decrypt all items using the temporary key
    const decryptedItems = [];
    const errors = [];

    for (const item of items) {
        try {
            const result = { ...item };

            // Decrypt encrypted_data (for items)
            if (item.encrypted_data) {
                const combined = base64ToArrayBuffer(item.encrypted_data);
                const iv = combined.slice(0, CONFIG.aes.ivLength);
                const data = combined.slice(CONFIG.aes.ivLength);

                const decrypted = await crypto.subtle.decrypt(
                    {
                        name: CONFIG.aes.name,
                        iv: iv,
                        tagLength: CONFIG.aes.tagLength,
                    },
                    tempKey,
                    data
                );

                const decoder = new TextDecoder();
                result.decrypted_data = JSON.parse(decoder.decode(decrypted));
            }

            // Decrypt encrypted_name (for vaults/folders)
            if (item.encrypted_name) {
                const combined = base64ToArrayBuffer(item.encrypted_name);
                const iv = combined.slice(0, CONFIG.aes.ivLength);
                const data = combined.slice(CONFIG.aes.ivLength);

                const decrypted = await crypto.subtle.decrypt(
                    {
                        name: CONFIG.aes.name,
                        iv: iv,
                        tagLength: CONFIG.aes.tagLength,
                    },
                    tempKey,
                    data
                );

                const decoder = new TextDecoder();
                result.decrypted_name = decoder.decode(decrypted);
            }

            // Decrypt encrypted_icon (for folders)
            if (item.encrypted_icon) {
                const combined = base64ToArrayBuffer(item.encrypted_icon);
                const iv = combined.slice(0, CONFIG.aes.ivLength);
                const data = combined.slice(CONFIG.aes.ivLength);

                const decrypted = await crypto.subtle.decrypt(
                    {
                        name: CONFIG.aes.name,
                        iv: iv,
                        tagLength: CONFIG.aes.tagLength,
                    },
                    tempKey,
                    data
                );

                const decoder = new TextDecoder();
                result.decrypted_icon = decoder.decode(decrypted);
            }

            decryptedItems.push(result);
        } catch (e) {
            errors.push({ id: item.id, error: e.message });
        }
    }

    // tempKey goes out of scope - the user's _encryptionKey is still intact

    return {
        items: decryptedItems,
        errors: errors.length > 0 ? errors : null
    };
}

/**
 * Re-encrypt already-decrypted data with the user's current key
 * Used during import to encrypt data that was decrypted from an import file
 */
async function handleImportReEncrypt({ items }) {
    requireUnlocked();

    // Re-encrypt all items with the user's current key
    const reEncryptedItems = await Promise.all(
        items.map(async (item) => {
            const result = { id: item.id };

            // Copy over any non-encrypted fields
            if (item.item_type !== undefined) result.item_type = item.item_type;
            if (item.folder_id !== undefined) result.folder_id = item.folder_id;
            if (item.is_favorite !== undefined) result.is_favorite = item.is_favorite;
            if (item.is_default !== undefined) result.is_default = item.is_default;
            if (item.parent_id !== undefined) result.parent_id = item.parent_id;
            if (item.icon !== undefined) result.icon = item.icon;

            // Re-encrypt decrypted_data
            if (item.decrypted_data !== undefined) {
                const { ciphertext } = await handleEncryptObject({ obj: item.decrypted_data });
                result.encrypted_data = ciphertext;
            }

            // Re-encrypt decrypted_name
            if (item.decrypted_name !== undefined) {
                const { ciphertext } = await handleEncrypt({ plaintext: item.decrypted_name });
                result.encrypted_name = ciphertext;
            }

            // Re-encrypt decrypted_icon
            if (item.decrypted_icon !== undefined) {
                const { ciphertext } = await handleEncrypt({ plaintext: item.decrypted_icon });
                result.encrypted_icon = ciphertext;
            }

            return result;
        })
    );

    return {
        items: reEncryptedItems
    };
}

// ============================================================
// RECOVERY
// ============================================================

/**
 * Recovery code KDF parameters - MAXIMUM SECURITY
 * Using Argon2id with high memory to make GPU attacks infeasible
 */
const RECOVERY_KDF = {
    memory: 131072,     // 128 MB - makes GPU attacks extremely expensive
    iterations: 4,      // 4 passes
    parallelism: 4,     // 4 threads
    hashLength: 32,     // 256-bit key
    type: 2,            // Argon2id
};

/**
 * Generate recovery codes with encrypted master key
 * Re-derives the key from password to get raw bytes (since stored key is non-extractable)
 *
 * SECURITY: Each recovery code has 160 bits of entropy (32 chars from 32-char alphabet)
 * Combined with Argon2id (128MB memory), brute-force is computationally infeasible
 */
async function handleGenerateRecoveryCodes({ password, salt, kdf, count = 8 }) {
    requireUnlocked();

    if (!password || !salt) {
        throw new Error('Password and salt are required');
    }

    // Re-derive key to get raw bytes
    const kdfParams = kdf || CONFIG.argon2;
    const saltBytes = base64ToArrayBuffer(salt);

    const result = await argon2.hash({
        pass: password,
        salt: saltBytes,
        time: kdfParams.iterations || CONFIG.argon2.iterations,
        mem: kdfParams.memory || CONFIG.argon2.memory,
        parallelism: kdfParams.parallelism || CONFIG.argon2.parallelism,
        hashLen: CONFIG.argon2.hashLength,
        type: CONFIG.argon2.type,
    });

    const keyBytes = new Uint8Array(result.hash);

    // Verify this matches our current key by checking verification hash
    const derivedVerificationHash = await createVerificationHash(keyBytes);
    if (!timingSafeEqual(derivedVerificationHash, _verificationHash)) {
        keyBytes.fill(0);
        throw new Error('Password verification failed');
    }

    // Generate recovery codes and encrypt key with each
    const codes = [];
    for (let i = 0; i < count; i++) {
        // Generate 32 random bytes for code (will become 32 chars = 160 bits entropy)
        const codeBytes = crypto.getRandomValues(new Uint8Array(32));
        const code = formatRecoveryCode(codeBytes);

        // Generate unique salt for this code (32 bytes)
        const codeSalt = crypto.getRandomValues(new Uint8Array(32));

        // Derive encryption key from recovery code using Argon2id (HIGH security)
        const recoveryKey = await deriveRecoveryKeySecure(code, codeSalt);

        // Encrypt the raw master key bytes with AES-256-GCM
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.aes.ivLength));
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: CONFIG.aes.name,
                iv: iv,
                tagLength: CONFIG.aes.tagLength,
            },
            recoveryKey,
            keyBytes
        );

        // Combine: salt (32) + iv (12) + ciphertext
        const combined = new Uint8Array(codeSalt.length + iv.length + ciphertext.byteLength);
        combined.set(codeSalt);
        combined.set(iv, codeSalt.length);
        combined.set(new Uint8Array(ciphertext), codeSalt.length + iv.length);

        // SHA-256 hash the code (server stores this, never sees plaintext)
        const codeHash = await hashRecoveryCode(code);

        codes.push({
            code: code,
            code_hash: codeHash,
            encrypted_key: arrayBufferToBase64(combined)
        });
    }

    // Clear sensitive data
    keyBytes.fill(0);

    return { codes };
}

/**
 * Format random bytes as recovery code: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 * 32 characters from 32-char alphabet = 160 bits of entropy
 */
function formatRecoveryCode(bytes) {
    // Alphabet: 32 chars (A-Z excluding O,I + 2-9 excluding 0,1)
    // This avoids visually confusing characters
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < bytes.length; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += chars[bytes[i] % chars.length];
    }
    return code;
}

/**
 * SHA-256 hash a recovery code for server-side storage
 * Server only stores this hash - never the plaintext code
 */
async function hashRecoveryCode(code) {
    const data = new TextEncoder().encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive recovery key using Argon2id with HIGH security parameters
 * This makes brute-force attacks computationally infeasible
 */
async function deriveRecoveryKeySecure(recoveryCode, salt) {
    const encoder = new TextEncoder();
    const codeBytes = encoder.encode(recoveryCode);

    // Use Argon2id with 128MB memory - extremely expensive for attackers
    const result = await argon2.hash({
        pass: codeBytes,
        salt: salt,
        time: RECOVERY_KDF.iterations,
        mem: RECOVERY_KDF.memory,
        parallelism: RECOVERY_KDF.parallelism,
        hashLen: RECOVERY_KDF.hashLength,
        type: RECOVERY_KDF.type,
    });

    const keyBytes = new Uint8Array(result.hash);

    // Import as AES key
    const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: CONFIG.aes.name },
        false,
        ['encrypt', 'decrypt']
    );

    // Clear sensitive data
    keyBytes.fill(0);

    return key;
}

/**
 * Recover master key using recovery code
 * Decrypts the raw key bytes and imports them as the new encryption key
 */
async function handleRecoverWithCode({ code, encrypted_key }) {
    if (!code || !encrypted_key) {
        throw new Error('Recovery code and encrypted key are required');
    }

    const combined = base64ToArrayBuffer(encrypted_key);

    // Extract: salt (32) + iv (12) + ciphertext
    const codeSalt = combined.slice(0, 32);
    const iv = combined.slice(32, 32 + CONFIG.aes.ivLength);
    const ciphertext = combined.slice(32 + CONFIG.aes.ivLength);

    // Derive key from recovery code using Argon2id (same params as generation)
    const recoveryKey = await deriveRecoveryKeySecure(code, codeSalt);

    // Decrypt the master key bytes
    let keyBytes;
    try {
        const decrypted = await crypto.subtle.decrypt(
            {
                name: CONFIG.aes.name,
                iv: iv,
                tagLength: CONFIG.aes.tagLength,
            },
            recoveryKey,
            ciphertext
        );
        keyBytes = new Uint8Array(decrypted);
    } catch (e) {
        throw new Error('Invalid recovery code');
    }

    // Import as the new encryption key
    _encryptionKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: CONFIG.aes.name },
        false,
        ['encrypt', 'decrypt']
    );

    // Create verification hash
    _verificationHash = await createVerificationHash(keyBytes);
    _isUnlocked = true;

    // Clear sensitive data
    keyBytes.fill(0);

    return {
        success: true,
        verificationHash: _verificationHash
    };
}

// ============================================================
// LOCK / CLEAR
// ============================================================

function handleLock() {
    _encryptionKey = null;
    _verificationHash = null;
    _isUnlocked = false;

    return { success: true };
}

// ============================================================
// UTILITIES
// ============================================================

function requireUnlocked() {
    if (!_isUnlocked || !_encryptionKey) {
        throw new Error('Vault is locked');
    }
}

function generateSalt() {
    const saltBytes = crypto.getRandomValues(new Uint8Array(32));
    return arrayBufferToBase64(saltBytes);
}

function arrayBufferToBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Signal ready
self.postMessage({ ready: true });
