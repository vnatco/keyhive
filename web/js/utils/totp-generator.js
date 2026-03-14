/**
 * TOTP Generator
 * Generates Time-based One-Time Passwords using Web Crypto API
 */

const TOTPGenerator = {
    /**
     * Generate TOTP code
     * @param {string} secret - Base32 encoded secret
     * @param {Object} options - TOTP options
     * @returns {Promise<string>} - TOTP code
     */
    async generate(secret, options = {}) {
        const {
            digits = 6,
            period = 30,
            algorithm = 'SHA1',
            timestamp = Date.now(),
        } = options;

        // Decode base32 secret
        const secretBytes = this.base32Decode(secret);

        // Calculate counter
        const counter = Math.floor(timestamp / 1000 / period);

        // Generate HOTP
        return this.generateHOTP(secretBytes, counter, digits, algorithm);
    },

    /**
     * Generate HOTP (HMAC-based One-Time Password)
     * @param {Uint8Array} secret - Secret bytes
     * @param {number} counter - Counter value
     * @param {number} digits - Number of digits
     * @param {string} algorithm - Hash algorithm
     * @returns {Promise<string>}
     */
    async generateHOTP(secret, counter, digits, algorithm) {
        // Pack counter as 8-byte big-endian
        const counterBytes = new Uint8Array(8);
        for (let i = 7; i >= 0; i--) {
            counterBytes[i] = counter & 0xff;
            counter = Math.floor(counter / 256);
        }

        // Map algorithm names
        const hashName = {
            'SHA1': 'SHA-1',
            'SHA256': 'SHA-256',
            'SHA512': 'SHA-512',
        }[algorithm] || 'SHA-1';

        // Import key for HMAC
        const key = await crypto.subtle.importKey(
            'raw',
            secret,
            { name: 'HMAC', hash: hashName },
            false,
            ['sign']
        );

        // Calculate HMAC
        const signature = await crypto.subtle.sign('HMAC', key, counterBytes);
        const hash = new Uint8Array(signature);

        // Dynamic truncation
        const offset = hash[hash.length - 1] & 0x0f;
        const binary =
            ((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff);

        const otp = binary % Math.pow(10, digits);

        return otp.toString().padStart(digits, '0');
    },

    /**
     * Get time remaining until next code
     * @param {number} period - Period in seconds
     * @returns {number} - Seconds remaining
     */
    getTimeRemaining(period = 30) {
        return period - (Math.floor(Date.now() / 1000) % period);
    },

    /**
     * Get current period start timestamp
     * @param {number} period
     * @returns {number}
     */
    getPeriodStart(period = 30) {
        const now = Math.floor(Date.now() / 1000);
        return (now - (now % period)) * 1000;
    },

    /**
     * Parse otpauth URI
     * @param {string} uri - otpauth://totp/... URI
     * @returns {Object} - Parsed TOTP parameters
     */
    parseUri(uri) {
        const url = new URL(uri);

        if (url.protocol !== 'otpauth:') {
            throw new Error('Invalid otpauth URI');
        }

        const type = url.host; // 'totp' or 'hotp'
        const label = decodeURIComponent(url.pathname.substring(1));

        let issuer = '';
        let account = label;

        // Check for issuer:account format in label
        if (label.includes(':')) {
            [issuer, account] = label.split(':', 2);
        }

        const params = new URLSearchParams(url.search);

        return {
            type,
            issuer: params.get('issuer') || issuer,
            label: account,
            secret: params.get('secret'),
            algorithm: params.get('algorithm') || 'SHA1',
            digits: parseInt(params.get('digits') || '6', 10),
            period: parseInt(params.get('period') || '30', 10),
        };
    },

    /**
     * Generate otpauth URI
     * @param {Object} params - TOTP parameters
     * @returns {string}
     */
    generateUri(params) {
        const { issuer, label, secret, algorithm = 'SHA1', digits = 6, period = 30 } = params;

        const labelPart = issuer ? `${encodeURIComponent(issuer)}:${encodeURIComponent(label)}` : encodeURIComponent(label);

        let uri = `otpauth://totp/${labelPart}?secret=${secret}`;

        if (issuer) uri += `&issuer=${encodeURIComponent(issuer)}`;
        if (algorithm !== 'SHA1') uri += `&algorithm=${algorithm}`;
        if (digits !== 6) uri += `&digits=${digits}`;
        if (period !== 30) uri += `&period=${period}`;

        return uri;
    },

    /**
     * Base32 decode
     * @param {string} input - Base32 encoded string
     * @returns {Uint8Array}
     */
    base32Decode(input) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        input = input.toUpperCase().replace(/[^A-Z2-7]/g, '');

        let bits = '';
        for (const char of input) {
            const val = alphabet.indexOf(char);
            if (val >= 0) {
                bits += val.toString(2).padStart(5, '0');
            }
        }

        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substring(i, i + 8), 2));
        }

        return new Uint8Array(bytes);
    },

    /**
     * Base32 encode
     * @param {Uint8Array} input
     * @returns {string}
     */
    base32Encode(input) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

        let bits = '';
        for (const byte of input) {
            bits += byte.toString(2).padStart(8, '0');
        }

        let result = '';
        for (let i = 0; i < bits.length; i += 5) {
            const chunk = bits.substring(i, i + 5).padEnd(5, '0');
            result += alphabet[parseInt(chunk, 2)];
        }

        return result;
    },

    /**
     * Generate random TOTP secret
     * @param {number} length - Number of bytes (default 20)
     * @returns {string} - Base32 encoded secret
     */
    generateSecret(length = 20) {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        return this.base32Encode(bytes);
    },
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TOTPGenerator;
}
