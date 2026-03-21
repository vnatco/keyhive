/**
 * Shared Utility Functions
 * Common helpers used across the application
 */

const Utils = {
    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} - Escaped string
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Validate that a string is a safe image data URI (PNG, JPEG, GIF, WebP only)
     * Rejects javascript:, SVG data URIs, and other potentially dangerous schemes
     * @param {string} dataUri - The data URI to validate
     * @returns {string} - The data URI if safe, empty string otherwise
     */
    /**
     * Sanitize a URL for safe use in href attributes and window.open().
     * Only allows http:, https:, and mailto: schemes.
     * Prevents javascript:, data:, vbscript:, and other dangerous protocols.
     * @param {string} url - URL to sanitize
     * @returns {string} - Safe URL (prepends https:// if no safe scheme found)
     */
    sanitizeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();
        if (/^(https?|mailto):/i.test(trimmed)) return trimmed;
        // If no scheme or unrecognized scheme, prepend https://
        // This neutralizes javascript:, data:, vbscript:, etc.
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return ''; // Has a scheme but not allowed
        return 'https://' + trimmed;
    },

    sanitizeImageSrc(dataUri) {
        if (!dataUri || typeof dataUri !== 'string') return '';
        // Allow only base64-encoded image data URIs (no SVG)
        if (/^data:image\/(png|jpeg|jpg|gif|webp|bmp|ico|x-icon);base64,[A-Za-z0-9+/=]+$/.test(dataUri)) {
            return dataUri;
        }
        return '';
    },

    /**
     * Format file size in human-readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} - Formatted size string
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    /**
     * Get SVG icon for card type
     * @param {string} type - Item type (password, totp, note, website, file)
     * @returns {string} - SVG HTML string
     */
    getCardIcon(type) {
        const icons = {
            password: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>`,
            totp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>`,
            note: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>`,
            website: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>`,
            file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
            </svg>`
        };
        return icons[type] || icons.password;
    },

    /**
     * Format date for display
     * @param {string} dateStr - Date string
     * @returns {string} - Formatted date
     */
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    },

    /**
     * Convert URL-safe base64 string to ArrayBuffer (for WebAuthn)
     * @param {string} base64 - URL-safe base64 string
     * @returns {ArrayBuffer}
     */
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    },

    /**
     * Convert ArrayBuffer to URL-safe base64 string (for WebAuthn)
     * @param {ArrayBuffer} buffer
     * @returns {string}
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    },

    /**
     * Get human-readable label for item type
     * @param {string} type - Item type (password, totp, note, website, file)
     * @returns {string} Human-readable label
     */
    getTypeLabel(type) {
        const labels = {
            password: 'Password',
            totp: '2FA Code',
            note: 'Secure Note',
            website: 'Website',
            file: 'File'
        };
        return labels[type] || 'Item';
    },

    /**
     * Get item title based on type and data
     * @param {string} type - Item type
     * @param {Object} data - Item data
     * @returns {string} Item title
     */
    /**
     * Parse a lightweight markdown subset into safe HTML.
     * Supports: headers (##), bold (**), italic (*), links [text](url),
     * horizontal rules (---), and newlines → <br>.
     * All text is escaped first to prevent XSS.
     * @param {string} str - Markdown string
     * @returns {string} - Safe HTML
     */
    parseLightMarkdown(str) {
        if (!str) return '';
        const self = this;

        // Split into lines and process sequentially, grouping by type
        const lines = str.trim().split('\n');
        const output = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip blank lines (they separate paragraphs)
            if (!trimmed) { i++; continue; }

            // Horizontal rule
            if (/^---+$/.test(trimmed)) {
                output.push('<hr>');
                i++;
                continue;
            }

            // Header
            const headerMatch = trimmed.match(/^(#{1,3}) (.+)$/);
            if (headerMatch) {
                const level = headerMatch[1].length + 1;
                output.push(`<h${level}>${self._inlineMarkdown(headerMatch[2])}</h${level}>`);
                i++;
                continue;
            }

            // Unordered list - collect consecutive lines starting with -
            if (/^- /.test(trimmed)) {
                const items = [];
                while (i < lines.length && /^- /.test(lines[i].trim())) {
                    items.push(`<li>${self._inlineMarkdown(lines[i].trim().slice(2))}</li>`);
                    i++;
                }
                output.push(`<ul>${items.join('')}</ul>`);
                continue;
            }

            // Ordered list - collect consecutive lines starting with number.
            if (/^\d+\. /.test(trimmed)) {
                const items = [];
                while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
                    items.push(`<li>${self._inlineMarkdown(lines[i].trim().replace(/^\d+\. /, ''))}</li>`);
                    i++;
                }
                output.push(`<ol>${items.join('')}</ol>`);
                continue;
            }

            // Regular paragraph - collect consecutive non-special lines
            const pLines = [];
            while (i < lines.length && lines[i].trim() && !/^(#{1,3} |---+$|- |\d+\. )/.test(lines[i].trim())) {
                pLines.push(self._inlineMarkdown(lines[i]));
                i++;
            }
            output.push(`<p>${pLines.join('<br>')}</p>`);
        }

        return output.join('');
    },

    /**
     * Parse inline markdown (bold, italic, links) on a single line.
     * Escapes HTML first for XSS safety.
     */
    _inlineMarkdown(line) {
        let html = this.escapeHtml(line);

        // Bold (**text**)
        html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

        // Italic (*text*)
        html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');

        // Links [text](url)
        html = html.replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
            const safeUrl = this.sanitizeUrl(url);
            if (!safeUrl) return text;
            return `<a href="${this.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        });

        return html;
    },

    getItemTitle(type, data) {
        switch (type) {
            case 'password':
                return data?.name || 'Untitled';
            case 'totp':
                return data?.issuer || data?.label || 'Untitled';
            case 'note':
                return data?.label || 'Untitled Note';
            case 'website':
                return data?.label || 'Untitled';
            case 'file':
                return data?.name || 'Untitled File';
            default:
                return 'Untitled';
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
