/**
 * View Item Page Component
 * Displays item details with copy functionality
 * - Password cards: name, username, password (hidden), website, custom fields
 * - TOTP cards: live code with countdown, issuer, label
 * - Note cards: label, content
 * - Website cards: label, URL
 * - File cards: name, download button
 */

const ViewPage = {
    item: null,
    itemData: null, // Decrypted item data (for easy access to attached items)
    isVisible: false,
    totpTimer: null,
    attachedTotpTimer: null,
    vaultUpdateHandler: null,

    /**
     * Show view page for an item
     * @param {Object} item
     */
    async show(item) {
        this.item = item;
        this.itemData = item.data || item.decrypted_data || {};
        this.render();
        this.open();
        this.startTotpTimer();
        this.startAttachedTotpTimer();
    },

    /**
     * Render the view page
     */
    render() {
        // Remove existing page if any
        const existing = document.getElementById('viewPage');
        if (existing) existing.remove();

        const data = this.item.data || this.item.decrypted_data || {};
        const type = this.item.item_type;
        const title = this.getItemTitle(type, data);
        const customIcon = data.custom_icon || null;

        // Render icon - custom or default
        const safeIcon = Utils.sanitizeImageSrc(customIcon);
        const iconHtml = safeIcon
            ? `<img src="${safeIcon}" alt="" class="card-icon-image">`
            : Utils.getCardIcon(type);

        const pageHTML = `
            <div class="page-overlay" id="viewPage">
                <div class="page-content">
                    <div class="page-container">
                        <div class="view-header">
                            <button class="view-back" id="closeView">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                            </button>
                            <div class="view-title-wrap">
                                <div class="card-icon ${type} ${customIcon ? 'has-custom-icon' : ''}">
                                    ${iconHtml}
                                </div>
                                <h2 class="view-title">${Utils.escapeHtml(title)}</h2>
                            </div>
                            <button class="btn btn-primary" id="editItem">Edit</button>
                        </div>
                        <div class="view-content">
                            ${this.renderContent(type, data)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', pageHTML);
        this.bindEvents();
    },

    /**
     * Get item title based on type
     */
    getItemTitle(type, data) {
        return Utils.getItemTitle(type, data);
    },

    /**
     * Render content based on item type
     */
    renderContent(type, data) {
        switch (type) {
            case 'password':
                return this.renderPasswordContent(data);
            case 'totp':
                return this.renderTotpContent(data);
            case 'note':
                return this.renderNoteContent(data);
            case 'website':
                return this.renderWebsiteContent(data);
            case 'file':
                return this.renderFileContent(data);
            default:
                return '<p class="view-empty">Unknown item type</p>';
        }
    },

    /**
     * Render password card content
     */
    renderPasswordContent(data) {
        let html = '';

        // Build breach lookup for inline hints
        const breachedFields = this.getBreachedFields(data);
        const passwordBreach = breachedFields.find(b => b.field === 'password');

        html += '<div class="view-compact">';

        // Row 1: Username | Website
        const hasUsername = !!data.username;
        const hasWebsite = !!data.website_url;
        if (hasUsername || hasWebsite) {
            html += '<div class="view-compact-row">';
            if (hasUsername) {
                html += this.renderCompactField('user', data.username);
            }
            if (hasWebsite) {
                html += this.renderCompactWebsite(data.website_url);
            }
            html += '</div>';
        }

        // Row 2: Password | 2FA
        const hasPassword = !!data.password;
        const has2FA = !!data.attached_totp;
        if (hasPassword || has2FA) {
            html += '<div class="view-compact-row">';
            if (hasPassword) {
                html += this.renderCompactPassword(data.password, passwordBreach);
            }
            if (has2FA) {
                html += this.renderCompactTotp(data.attached_totp);
            }
            html += '</div>';
        }

        // Notes (full width)
        if (data.notes) {
            html += `
                <div class="view-compact-notes">
                    <div class="view-compact-notes-content">${Utils.escapeHtml(data.notes)}</div>
                </div>
            `;
        }

        // Tags (full width)
        html += this.renderTags(data);

        html += '</div>';

        // Custom fields (if any)
        if (data.custom_fields && data.custom_fields.length > 0) {
            html += '<div class="view-section view-custom-fields-section"><h3 class="view-section-title">Custom Fields</h3><div class="view-compact-grid">';
            data.custom_fields.forEach(field => {
                const fieldBreach = breachedFields.find(b => b.field === (field.id || field.label));
                html += this.renderCompactCustomField(field, fieldBreach);
            });
            html += '</div></div>';
        }

        // Attachments section (TOTP, file)
        html += this.renderAttachmentsSection();

        return html;
    },

    /**
     * Render compact field (username, email, etc.)
     */
    renderCompactField(type, value) {
        if (!value) return '';

        const icons = {
            user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
            email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>'
        };

        return `
            <div class="view-compact-field">
                ${icons[type] || icons.user}
                <span class="view-compact-value">${Utils.escapeHtml(value)}</span>
                <button class="view-compact-copy" data-copy="${Utils.escapeHtml(value)}" title="Copy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
            </div>
        `;
    },

    /**
     * Render compact website field
     */
    renderCompactWebsite(url) {
        if (!url) return '';

        const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

        return `
            <a href="${Utils.escapeHtml(Utils.sanitizeUrl(url))}" class="view-compact-field view-compact-website" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span class="view-compact-value view-compact-link">${Utils.escapeHtml(displayUrl)}</span>
                <div class="view-compact-action">
                    <svg class="view-compact-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </div>
            </a>
        `;
    },

    /**
     * Render compact password field
     * @param {string} password
     * @param {Object|undefined} breach - {count: number} if breached
     */
    formatBreachCount(count) {
        if (typeof BreachChecker !== 'undefined') {
            return BreachChecker.formatCount(count);
        }
        if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
        if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
        return count.toString();
    },

    renderBreachBtn(count) {
        return `<button class="view-compact-copy view-compact-breach" data-breach-count="${Utils.escapeHtml(String(count))}" title="Compromised password">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                    </button>`;
    },

    renderCompactPassword(password, breach) {
        if (!password) return '';

        const sid = SecretStore.store(password);
        const masked = '•'.repeat(Math.min(password.length, 16));
        const breachBtn = breach ? this.renderBreachBtn(breach.count) : '';

        return `
            <div class="view-compact-field view-compact-secret" data-revealed="false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span class="view-compact-value view-compact-masked">${masked}</span>
                <span class="view-compact-value view-compact-revealed" style="display:none" data-secret-id="${sid}"></span>
                <div class="view-compact-actions">
                    ${breachBtn}
                    <button class="view-compact-toggle" data-secret-id="${sid}" title="Show">
                        <svg class="eye-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <svg class="eye-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                    </button>
                    <button class="view-compact-copy" data-copy-id="${sid}" title="Copy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Get list of breached fields from item data
     * @param {Object} data - Item data
     * @returns {Array<{field: string, label: string, count: number}>}
     */
    getBreachedFields(data) {
        const breached = [];

        // Check main password
        if (data._breach && data._breach.count > 0) {
            breached.push({
                field: 'password',
                label: 'Password',
                count: data._breach.count
            });
        }

        // Check custom fields
        if (data.custom_fields && Array.isArray(data.custom_fields)) {
            for (const field of data.custom_fields) {
                if (field._breach && field._breach.count > 0) {
                    breached.push({
                        field: field.id || field.label,
                        label: field.label,
                        count: field._breach.count
                    });
                }
            }
        }

        return breached;
    },

    /**
     * Render compact custom field (with label + value)
     */
    renderCompactCustomField(field, breach) {
        const { label, value, type } = field;
        if (!value) return '';

        if (type === 'secret') {
            const sid = SecretStore.store(value);
            const masked = '•'.repeat(Math.min(value.length, 12));
            const breachBtn = breach ? this.renderBreachBtn(breach.count) : '';
            return `
                <div class="view-compact-custom view-compact-custom-secret" data-revealed="false">
                    <span class="view-compact-custom-label">${Utils.escapeHtml(label)}</span>
                    <div class="view-compact-custom-row">
                        <span class="view-compact-custom-value view-compact-custom-masked">${masked}</span>
                        <span class="view-compact-custom-value view-compact-custom-revealed" style="display:none" data-secret-id="${sid}"></span>
                        <div class="view-compact-actions">
                            ${breachBtn}
                            <button class="view-compact-toggle" data-secret-id="${sid}" title="Show">
                                <svg class="eye-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                <svg class="eye-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                </svg>
                            </button>
                            <button class="view-compact-copy" data-copy-id="${sid}" title="Copy">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        if (type === 'website') {
            const displayUrl = value.replace(/^https?:\/\//, '').replace(/\/$/, '');
            return `
                <a href="${Utils.escapeHtml(Utils.sanitizeUrl(value))}" class="view-compact-custom view-compact-custom-link" target="_blank" rel="noopener">
                    <span class="view-compact-custom-label">${Utils.escapeHtml(label)}</span>
                    <div class="view-compact-custom-row">
                        <span class="view-compact-custom-value view-compact-custom-url">${Utils.escapeHtml(displayUrl)}</span>
                        <svg class="view-compact-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </div>
                </a>
            `;
        }

        // Default: text, email
        return `
            <div class="view-compact-custom">
                <span class="view-compact-custom-label">${Utils.escapeHtml(label)}</span>
                <div class="view-compact-custom-row">
                    <span class="view-compact-custom-value">${Utils.escapeHtml(value)}</span>
                    <button class="view-compact-copy" data-copy="${Utils.escapeHtml(value)}" title="Copy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render compact TOTP field
     */
    renderCompactTotp(totpData) {
        const secret = totpData.secret || '';
        const period = totpData.period || 30;
        const digits = totpData.digits || 6;
        const algorithm = totpData.algorithm || 'SHA1';

        const sid = SecretStore.store(secret);
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = period - (now % period);

        return `
            <div class="view-compact-field view-compact-totp" data-secret-id="${sid}" data-period="${Utils.escapeHtml(String(period))}" data-digits="${Utils.escapeHtml(String(digits))}" data-algorithm="${Utils.escapeHtml(algorithm)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span class="view-compact-value view-compact-totp-code">--- ---</span>
                <div class="view-compact-totp-timer">
                    <svg viewBox="0 0 36 36" class="view-compact-totp-ring">
                        <circle class="view-compact-totp-ring-bg" cx="18" cy="18" r="16" fill="none" stroke-width="2"/>
                        <circle class="view-compact-totp-ring-progress" cx="18" cy="18" r="16" fill="none" stroke-width="2"
                            stroke-dasharray="${(timeRemaining / period) * 100} 100" transform="rotate(-90 18 18)"/>
                    </svg>
                    <span class="view-compact-totp-time">${timeRemaining}</span>
                </div>
                <button class="view-compact-copy" data-action="copy-compact-totp" title="Copy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
            </div>
        `;
    },

    /**
     * Render attachments section (TOTP and File only)
     * Uses existing CSS classes (linked-*) for styling
     */
    renderAttachmentsSection() {
        const data = this.itemData || {};
        const hasTotp = !!data.attached_totp;
        const hasFile = !!data.attached_file;

        let html = '';

        // Show attached file display if present
        if (hasFile) {
            const fileData = data.attached_file;
            const fileName = fileData.name || 'Attached File';
            const fileSize = fileData.size ? Utils.formatFileSize(fileData.size) : '';
            html += `
                <div class="view-section view-linked-content">
                    <h3 class="view-section-title">Attached File</h3>
                    <div class="custom-field-file">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span class="custom-field-file-name">${Utils.escapeHtml(fileName)}</span>
                        ${fileSize ? `<span class="custom-field-file-size">${fileSize}</span>` : ''}
                        <button type="button" class="btn btn-sm btn-secondary" data-action="download-attached-file">Download</button>
                    </div>
                </div>
            `;
        }

        // Attachments management section (uses linked-* CSS classes for existing styling)
        html += '<div class="view-section view-linked-section"><h3 class="view-section-title">Attachments</h3><div class="view-linked-items-grid">';

        // Define attachment types (exclude file in local mode)
        const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';
        const attachTypes = [
            { type: 'totp', label: '2FA Code', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' },
            ...(!isLocalMode ? [{ type: 'file', label: 'File', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>' }] : [])
        ];

        attachTypes.forEach(({ type, label, icon }) => {
            const isAttached = type === 'totp' ? hasTotp : hasFile;

            html += `<div class="linked-item-compact" data-attach-type="${type}">`;
            html += `<span class="linked-item-label">${icon}${label}</span>`;

            if (isAttached) {
                html += `
                    <div class="linked-item-actions">
                        <button type="button" class="btn btn-sm btn-secondary" data-action="edit-attachment" data-type="${type}">Edit</button>
                        <button type="button" class="btn btn-sm btn-danger-outline" data-action="remove-attachment" data-type="${type}">Remove</button>
                    </div>
                `;
            } else {
                html += `<button type="button" class="btn btn-sm btn-secondary" data-action="add-attachment" data-type="${type}">Attach</button>`;
            }

            html += '</div>';
        });

        html += '</div></div>';
        return html;
    },

    /**
     * Render TOTP card content
     */
    renderTotpContent(data) {
        const secret = data.secret || '';
        const period = data.period || 30;
        const digits = data.digits || 6;
        const algorithm = data.algorithm || 'SHA1';

        // Calculate time remaining
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = period - (now % period);
        const isExpiring = timeRemaining <= 5;

        // Code will be updated async by updateTotpDisplay()
        return `
            <div class="view-fields">
                ${data.label ? this.renderField('Account', data.label, 'text') : ''}
            </div>

            <div class="view-totp-display" data-secret-id="${SecretStore.store(secret)}" data-period="${Utils.escapeHtml(String(period))}" data-digits="${Utils.escapeHtml(String(digits))}" data-algorithm="${Utils.escapeHtml(algorithm)}">
                <div class="view-totp-code-container ${isExpiring ? 'expiring' : ''}">
                    <span class="view-totp-code ${isExpiring ? 'blink' : ''}">--- ---</span>
                    <button class="view-totp-copy" data-action="copy-code" title="Copy code">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
                <div class="view-totp-countdown">
                    <svg viewBox="0 0 36 36" class="view-totp-ring">
                        <path class="view-totp-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="view-totp-ring-progress" stroke-dasharray="${(timeRemaining / period) * 100}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span class="view-totp-time">${timeRemaining}s</span>
                </div>
            </div>

            ${this.renderTags(data)}
        `;
    },

    /**
     * Render note card content
     */
    renderNoteContent(data) {
        return `
            <div class="view-fields">
                <div class="view-field view-field-note">
                    <div class="view-field-header">
                        <span class="view-field-label">Content</span>
                        <button class="view-field-copy" data-copy-id="${SecretStore.store(data.content || '')}" title="Copy">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="view-note-content">${Utils.escapeHtml(data.content || '')}</div>
                </div>
            </div>
            ${this.renderTags(data)}
        `;
    },

    /**
     * Render website card content
     */
    renderWebsiteContent(data) {
        return `
            <div class="view-fields">
                ${this.renderLinkField('URL', data.content || '')}
            </div>
            ${this.renderTags(data)}
        `;
    },

    /**
     * Render file card content
     */
    renderFileContent(data) {
        // Check if offline
        const isOffline = typeof Vault !== 'undefined' && Vault.isOffline();

        if (isOffline) {
            return `
                <div class="view-fields">
                    ${data.size ? this.renderField('Size', Utils.formatFileSize(data.size), 'text', false) : ''}
                    <div class="file-offline-notice">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                            <line x1="12" y1="20" x2="12.01" y2="20"></line>
                        </svg>
                        <span class="file-offline-notice-text">File content is not available offline.<br>Connect to the internet to download.</span>
                    </div>
                </div>
                ${this.renderTags(data)}
            `;
        }

        return `
            <div class="view-fields">
                ${data.size ? this.renderField('Size', Utils.formatFileSize(data.size), 'text', false) : ''}
                <div class="view-field-actions">
                    <button class="btn btn-primary btn-block" id="downloadFile">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download File
                    </button>
                </div>
            </div>
            ${this.renderTags(data)}
        `;
    },

    /**
     * Render tags section
     */
    renderTags(data) {
        if (!data.tags || !data.tags.length) return '';
        return `
            <div class="view-compact-tags">
                ${data.tags.map(tag => `<span class="view-tag">${Utils.escapeHtml(tag)}</span>`).join('')}
            </div>
        `;
    },

    /**
     * Render a standard text field
     */
    renderField(label, value, type = 'text', copyable = true) {
        if (!value) return '';

        return `
            <div class="view-field">
                <div class="view-field-header">
                    <span class="view-field-label">${Utils.escapeHtml(label)}</span>
                    ${copyable ? `
                        <button class="view-field-copy" data-copy="${Utils.escapeHtml(value)}" title="Copy">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
                <span class="view-field-value">${Utils.escapeHtml(value)}</span>
            </div>
        `;
    },

    /**
     * Render a secret (hidden) field with toggle
     */
    renderSecretField(label, value) {
        if (!value) return '';

        const sid = SecretStore.store(value);
        const maskedValue = '•'.repeat(Math.min(value.length, 20));

        return `
            <div class="view-field view-field-secret" data-revealed="false">
                <div class="view-field-header">
                    <span class="view-field-label">${Utils.escapeHtml(label)}</span>
                    <div class="view-field-actions-inline">
                        <button class="view-field-toggle" data-secret-id="${sid}" title="Show">
                            <svg class="eye-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <svg class="eye-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                        </button>
                        <button class="view-field-copy" data-copy-id="${sid}" title="Copy">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <span class="view-field-value view-field-masked">${maskedValue}</span>
                <span class="view-field-value view-field-revealed" style="display:none" data-secret-id="${sid}"></span>
            </div>
        `;
    },

    /**
     * Render a clickable link field
     */
    renderLinkField(label, url) {
        if (!url) return '';

        const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

        return `
            <div class="view-field">
                <div class="view-field-header">
                    <span class="view-field-label">${Utils.escapeHtml(label)}</span>
                    <button class="view-field-copy" data-copy="${Utils.escapeHtml(url)}" title="Copy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
                <div class="view-field-link-wrap">
                    <a href="${Utils.escapeHtml(Utils.sanitizeUrl(url))}" class="view-field-link" target="_blank" rel="noopener">
                        ${Utils.escapeHtml(displayUrl)}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                </div>
            </div>
        `;
    },

    /**
     * Render website field with custom clickable design
     */
    renderWebsiteField(url) {
        if (!url) return '';

        const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

        return `
            <a href="${Utils.escapeHtml(Utils.sanitizeUrl(url))}" class="custom-field-website" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span class="custom-field-website-url">${Utils.escapeHtml(displayUrl)}</span>
                <svg class="custom-field-website-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            </a>
        `;
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Close button
        document.getElementById('closeView')?.addEventListener('click', () => {
            this.hide();
        });

        // Edit button - opens edit overlay on top, view stays open
        document.getElementById('editItem')?.addEventListener('click', () => {
            // For file items, show simple name-edit popup
            if (this.item.item_type === 'file') {
                this.showEditFileNamePopup();
                return;
            }
            // Dispatch event to open edit mode (view page stays open beneath)
            window.dispatchEvent(new CustomEvent('edititem', { detail: { item: this.item } }));
        });

        // Listen for vault updates to refresh view when item is edited
        this.vaultUpdateHandler = () => {
            this.refreshItem();
        };
        window.addEventListener('vaultupdate', this.vaultUpdateHandler);

        // Bind copy buttons, secret toggles, and breach buttons
        this.bindCopyButtons();
        this.bindSecretToggles();
        this.bindBreachButtons();

        // Bind attachment actions
        this.bindAttachmentActions();

        // Download file button
        document.getElementById('downloadFile')?.addEventListener('click', () => {
            this.downloadFile();
        });
    },

    /**
     * Bind attachment action buttons
     */
    bindAttachmentActions() {
        const data = this.itemData || {};

        // Add attachment buttons
        document.querySelectorAll('#viewPage [data-action="add-attachment"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                this.showAttachmentPopup(type);
            });
        });

        // Edit attachment buttons
        document.querySelectorAll('#viewPage [data-action="edit-attachment"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const existingData = type === 'totp' ? data.attached_totp : data.attached_file;
                this.showAttachmentPopup(type, existingData);
            });
        });

        // Remove attachment buttons
        document.querySelectorAll('#viewPage [data-action="remove-attachment"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const type = btn.dataset.type;
                await this.removeAttachment(type);
            });
        });
    },

    /**
     * Copy text to clipboard (auto-clears after 30 seconds)
     */
    async copyToClipboard(text) {
        const success = await Clipboard.copy(text, true);
        if (success) {
            Toast.success('Copied to clipboard');
        } else {
            Toast.error('Failed to copy');
        }
    },

    /**
     * Get download filename with original extension
     * @param {string} name - User-given name
     * @param {string} originalName - Original filename with extension
     * @returns {string}
     */
    getDownloadFilename(name, originalName) {
        // Extract extension from original name
        const extMatch = originalName?.match(/\.[^/.]+$/);
        const extension = extMatch ? extMatch[0] : '';

        // Use user-given name, add extension if not already present
        const baseName = name || originalName || 'download';
        if (extension && !baseName.toLowerCase().endsWith(extension.toLowerCase())) {
            return baseName + extension;
        }
        return baseName;
    },

    /**
     * Download file
     */
    async downloadFile() {
        if (!this.item || this.item.item_type !== 'file') return;

        // Check if offline
        if (typeof Vault !== 'undefined' && Vault.isOffline()) {
            Toast.error('Files are not available offline');
            return;
        }

        const data = this.item.data || this.item.decrypted_data || {};
        const fileName = this.getDownloadFilename(data.name, data.original_name);
        const mimeType = data.mime_type || 'application/octet-stream';

        try {
            Toast.info('Downloading...');

            // Download and decrypt file
            const result = await Vault.downloadFile(this.item.id);

            if (!result || !result.content) {
                throw new Error('File content not available');
            }

            // Create blob from decrypted content
            const blob = new Blob([result.content], { type: mimeType });

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Toast.success('File downloaded');
        } catch (error) {
            console.error('Download failed:', error);
            Toast.error('Failed to download file');
        }
    },

    /**
     * Download attached file (embedded in password card)
     * File is stored by password item ID
     */
    async downloadAttachedFile() {
        if (!this.itemData?.attached_file) return;

        const fileData = this.itemData.attached_file;
        const passwordItemId = this.item.id; // File stored by password item ID
        const fileName = this.getDownloadFilename(fileData.name, fileData.original_name);
        const mimeType = fileData.mime_type || 'application/octet-stream';

        if (!passwordItemId) {
            Toast.error('File not found');
            return;
        }

        try {
            Toast.info('Downloading...');

            // Download and decrypt file using password item ID
            const result = await Vault.downloadFile(passwordItemId);

            if (!result || !result.content) {
                throw new Error('File content not available');
            }

            // Create blob from decrypted content
            const blob = new Blob([result.content], { type: mimeType });

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Toast.success('File downloaded');
        } catch (error) {
            console.error('Download failed:', error);
            Toast.error('Failed to download file');
        }
    },

    /**
     * Show popup to edit file name
     */
    showEditFileNamePopup() {
        if (!this.item || this.item.item_type !== 'file') return;

        const data = this.item.data || this.item.decrypted_data || {};
        const currentName = data.name || '';

        const save = async (api) => {
            const newName = api.querySelector('#fileNameInput').value.trim();
            if (!newName) {
                Toast.error('Name is required');
                return false;
            }

            try {
                const updatedData = { ...data, name: newName };
                await Vault.updateItem(this.item.id, updatedData, this.item.folder_id);

                this.item.data = updatedData;
                this.item.decrypted_data = updatedData;

                this.refreshItem();
                Toast.success('File renamed');
                return true;
            } catch (error) {
                console.error('Failed to rename file:', error);
                Toast.error('Failed to rename file');
                return false;
            }
        };

        const popup = Popup.open({
            title: 'Edit File Name',
            body: `
                <div class="form-group">
                    <label class="form-label" for="fileNameInput">Name</label>
                    <input type="text" class="form-input" id="fileNameInput" value="${Utils.escapeHtml(currentName)}" placeholder="File name" autocomplete="off">
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                { text: 'Save', type: 'primary', id: 'saveBtn', onClick: () => save(popup) }
            ],
            onOpen: (api) => {
                const input = api.querySelector('#fileNameInput');
                input.select();
                input.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter') {
                        if (await save(api)) {
                            api.forceClose();
                        }
                    }
                });
            }
        });
    },

    /**
     * Start TOTP countdown timer
     */
    startTotpTimer() {
        if (this.item?.item_type !== 'totp') return;

        this.stopTotpTimer();

        // Update immediately
        this.updateTotpDisplay();

        // Then update every second
        this.totpTimer = setInterval(() => {
            this.updateTotpDisplay();
        }, 1000);
    },

    /**
     * Stop TOTP countdown timer
     */
    stopTotpTimer() {
        if (this.totpTimer) {
            clearInterval(this.totpTimer);
            this.totpTimer = null;
        }
    },

    /**
     * Start attached TOTP timer (for password cards with attached 2FA)
     */
    startAttachedTotpTimer() {
        if (!this.itemData?.attached_totp) return;

        this.stopAttachedTotpTimer();

        // Update immediately
        this.updateCompactTotpDisplay();

        // Then update every second
        this.attachedTotpTimer = setInterval(() => {
            this.updateCompactTotpDisplay();
        }, 1000);
    },

    /**
     * Stop attached TOTP timer
     */
    stopAttachedTotpTimer() {
        if (this.attachedTotpTimer) {
            clearInterval(this.attachedTotpTimer);
            this.attachedTotpTimer = null;
        }
    },

    /**
     * Update compact TOTP display
     */
    async updateCompactTotpDisplay() {
        const display = document.querySelector('#viewPage .view-compact-totp');
        if (!display) return;

        const secret = SecretStore.get(display.dataset.secretId);
        const period = parseInt(display.dataset.period) || 30;
        const digits = parseInt(display.dataset.digits) || 6;
        const algorithm = display.dataset.algorithm || 'SHA1';

        if (!secret) return;

        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = period - (now % period);
        const isExpiring = timeRemaining <= 5;

        // Generate code
        let code = '------';
        if (typeof TOTPGenerator !== 'undefined') {
            try {
                code = await TOTPGenerator.generate(secret, { algorithm, digits, period });
            } catch (e) {
                console.error('Compact TOTP generation error:', e);
            }
        }

        const formattedCode = code.length === 6 ?
            code.substring(0, 3) + ' ' + code.substring(3) : code;

        // Update elements
        const codeEl = display.querySelector('.view-compact-totp-code');
        const timeEl = display.querySelector('.view-compact-totp-time');
        const progressEl = display.querySelector('.view-compact-totp-ring-progress');

        if (codeEl) {
            codeEl.textContent = formattedCode;
            codeEl.classList.toggle('expiring', isExpiring);
        }

        if (timeEl) {
            timeEl.textContent = timeRemaining;
            timeEl.classList.toggle('expiring', isExpiring);
        }

        if (progressEl) {
            progressEl.setAttribute('stroke-dasharray', `${(timeRemaining / period) * 100} 100`);
            progressEl.classList.toggle('expiring', isExpiring);
        }
    },

    /**
     * Update TOTP display
     */
    async updateTotpDisplay() {
        const display = document.querySelector('#viewPage .view-totp-display');
        if (!display) return;

        const secret = SecretStore.get(display.dataset.secretId);
        const period = parseInt(display.dataset.period) || 30;
        const digits = parseInt(display.dataset.digits) || 6;
        const algorithm = display.dataset.algorithm || 'SHA1';

        if (!secret) return;

        // Calculate time remaining
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = period - (now % period);
        const isExpiring = timeRemaining <= 5;

        // Generate code (async)
        let code = '------';
        if (typeof TOTPGenerator !== 'undefined') {
            try {
                code = await TOTPGenerator.generate(secret, { algorithm, digits, period });
            } catch (e) {
                console.error('TOTP generation error:', e);
            }
        }

        // Format code with space
        const formattedCode = code.length === 6 ?
            code.substring(0, 3) + ' ' + code.substring(3) : code;

        // Update elements
        const codeEl = display.querySelector('.view-totp-code');
        const timeEl = display.querySelector('.view-totp-time');
        const progressEl = display.querySelector('.view-totp-ring-progress');
        const container = display.querySelector('.view-totp-code-container');

        if (codeEl) {
            codeEl.textContent = formattedCode;
            codeEl.classList.toggle('blink', isExpiring);
        }

        if (timeEl) {
            timeEl.textContent = `${timeRemaining}s`;
        }

        if (progressEl) {
            progressEl.setAttribute('stroke-dasharray', `${(timeRemaining / period) * 100}, 100`);
        }

        if (container) {
            container.classList.toggle('expiring', isExpiring);
        }
    },

    /**
     * Open the page
     */
    open() {
        this.isVisible = true;
        // Lock body scroll when page overlay opens
        document.body.classList.add('popup-open');
        const page = document.getElementById('viewPage');
        if (page) {
            requestAnimationFrame(() => {
                page.classList.add('active');
            });
        }
    },

    /**
     * Refresh item data after edit
     */
    async refreshItem() {
        if (!this.item || !this.isVisible) return;

        // Get updated item from Vault
        if (typeof Vault !== 'undefined') {
            const updatedItem = await Vault.getItem(this.item.id);
            if (updatedItem) {
                this.item = updatedItem;
                this.itemData = updatedItem.data || updatedItem.decrypted_data || {};

                const data = this.itemData;
                const type = this.item.item_type;

                // Update the title in header
                const titleEl = document.querySelector('#viewPage .view-title');
                if (titleEl) {
                    titleEl.textContent = this.getItemTitle(type, data);
                }

                // Re-render the content
                const contentEl = document.querySelector('#viewPage .view-content');
                if (contentEl) {
                    contentEl.innerHTML = this.renderContent(type, data);
                    // Re-bind copy buttons
                    this.bindCopyButtons();
                    // Re-bind secret toggles
                    this.bindSecretToggles();
                    // Re-bind breach buttons
                    this.bindBreachButtons();
                    // Re-bind attachment actions
                    this.bindAttachmentActions();
                    // Restart TOTP timers if needed
                    this.startTotpTimer();
                    this.startAttachedTotpTimer();
                }
            }
        }
    },

    /**
     * Bind copy button events
     */
    bindCopyButtons() {
        // Standard view-field copy buttons
        document.querySelectorAll('#viewPage .view-field-copy').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const value = btn.dataset.copyId ? SecretStore.get(btn.dataset.copyId) : btn.dataset.copy;
                if (value) {
                    await this.copyToClipboard(value);
                }
            });
        });

        // Compact copy buttons
        document.querySelectorAll('#viewPage .view-compact-copy').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const value = btn.dataset.copyId ? SecretStore.get(btn.dataset.copyId) : btn.dataset.copy;
                if (value) {
                    await this.copyToClipboard(value);
                }
            });
        });

        // TOTP copy button (standalone TOTP cards)
        document.querySelector('#viewPage [data-action="copy-code"]')?.addEventListener('click', async () => {
            const display = document.querySelector('#viewPage .view-totp-display');
            if (display) {
                const secret = SecretStore.get(display.dataset.secretId);
                const period = parseInt(display.dataset.period) || 30;
                const digits = parseInt(display.dataset.digits) || 6;
                const algorithm = display.dataset.algorithm || 'SHA1';

                if (secret && typeof TOTPGenerator !== 'undefined') {
                    const code = await TOTPGenerator.generate(secret, { algorithm, digits, period });
                    await this.copyToClipboard(code);
                }
            }
        });

        // Compact TOTP copy button (in password cards)
        document.querySelector('#viewPage [data-action="copy-compact-totp"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const display = document.querySelector('#viewPage .view-compact-totp');
            if (display) {
                const secret = SecretStore.get(display.dataset.secretId);
                const period = parseInt(display.dataset.period) || 30;
                const digits = parseInt(display.dataset.digits) || 6;
                const algorithm = display.dataset.algorithm || 'SHA1';

                if (secret && typeof TOTPGenerator !== 'undefined') {
                    const code = await TOTPGenerator.generate(secret, { algorithm, digits, period });
                    await this.copyToClipboard(code);
                }
            }
        });

        // Download attached file button
        document.querySelector('#viewPage [data-action="download-attached-file"]')?.addEventListener('click', async () => {
            await this.downloadAttachedFile();
        });
    },

    /**
     * Bind secret field toggle events
     */
    bindSecretToggles() {
        // Standard view-field toggles
        document.querySelectorAll('#viewPage .view-field-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.closest('.view-field-secret');
                if (field) {
                    this.toggleSecretField(field, btn);
                }
            });
        });

        // Compact secret toggles
        document.querySelectorAll('#viewPage .view-compact-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const field = btn.closest('.view-compact-secret') || btn.closest('.view-compact-custom-secret');
                if (field) {
                    this.toggleCompactSecretField(field, btn);
                }
            });
        });
    },

    /**
     * Bind breach warning button click events
     */
    bindBreachButtons() {
        document.querySelectorAll('#viewPage .view-compact-breach').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const count = parseInt(btn.dataset.breachCount, 10);
                const formatted = this.formatBreachCount(count);
                Popup.open({
                    title: 'Compromised Password',
                    body: `<p class="popup-message">This password appeared in <strong>${Utils.escapeHtml(formatted)}</strong> known data breaches. You should change it immediately.</p>`,
                    popupClass: 'popup-sm',
                    closeOnOutsideClick: true,
                    buttons: []
                });
            });
        });
    },

    /**
     * Toggle standard secret field visibility
     */
    toggleSecretField(field, btn) {
        const isRevealed = field.dataset.revealed === 'true';
        field.dataset.revealed = (!isRevealed).toString();

        const masked = field.querySelector('.view-field-masked');
        const revealed = field.querySelector('.view-field-revealed');
        const eyeShow = btn.querySelector('.eye-show');
        const eyeHide = btn.querySelector('.eye-hide');

        if (isRevealed) {
            if (revealed) revealed.textContent = '';
            masked.style.display = '';
            if (revealed) revealed.style.display = 'none';
            eyeShow.style.display = '';
            eyeHide.style.display = 'none';
        } else {
            if (revealed && revealed.dataset.secretId) {
                revealed.textContent = SecretStore.get(revealed.dataset.secretId) || '';
            }
            masked.style.display = 'none';
            if (revealed) revealed.style.display = '';
            eyeShow.style.display = 'none';
            eyeHide.style.display = '';
        }
    },

    /**
     * Toggle compact secret field visibility
     */
    toggleCompactSecretField(field, btn) {
        const isRevealed = field.dataset.revealed === 'true';
        field.dataset.revealed = (!isRevealed).toString();

        // Support both main compact fields and custom compact fields
        const masked = field.querySelector('.view-compact-masked, .view-compact-custom-masked');
        const revealed = field.querySelector('.view-compact-revealed, .view-compact-custom-revealed');
        const eyeShow = btn.querySelector('.eye-show');
        const eyeHide = btn.querySelector('.eye-hide');

        if (isRevealed) {
            if (revealed) revealed.textContent = '';
            masked.style.display = '';
            if (revealed) revealed.style.display = 'none';
            eyeShow.style.display = '';
            eyeHide.style.display = 'none';
        } else {
            if (revealed && revealed.dataset.secretId) {
                revealed.textContent = SecretStore.get(revealed.dataset.secretId) || '';
            }
            masked.style.display = 'none';
            if (revealed) revealed.style.display = '';
            eyeShow.style.display = 'none';
            eyeHide.style.display = '';
        }
    },

    /**
     * Show popup for adding/editing attachment (TOTP or file)
     * @param {string} type - totp or file
     * @param {Object} existingData - Existing data for editing
     */
    showAttachmentPopup(type, existingData = null) {
        const isEdit = !!existingData;
        const typeLabel = type === 'totp' ? '2FA Code' : 'File';
        const title = isEdit ? `Edit ${typeLabel}` : `Attach ${typeLabel}`;

        let fieldsHTML = '';

        if (type === 'totp') {
            fieldsHTML = `
                <div class="form-group">
                    <label class="form-label" for="attachSecret">Secret Key *</label>
                    <input type="text" class="form-input" id="attachSecret" name="secret"
                           placeholder="Enter TOTP secret" value="${Utils.escapeHtml(existingData?.secret || '')}" required
                           autocomplete="off">
                </div>
                <div class="linked-popup-advanced">
                    <button type="button" class="collapsible-header" id="attachAdvancedToggle">
                        <span>Advanced Settings</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <div class="collapsible-content" id="attachAdvancedContent" style="display: none;">
                        <div class="form-row linked-popup-row">
                            <div class="form-group">
                                <label class="form-label" for="attachAlgorithm">Algorithm</label>
                                <select class="form-input form-select" id="attachAlgorithm" name="algorithm">
                                    <option value="SHA1" ${(existingData?.algorithm || 'SHA1') === 'SHA1' ? 'selected' : ''}>SHA1</option>
                                    <option value="SHA256" ${existingData?.algorithm === 'SHA256' ? 'selected' : ''}>SHA256</option>
                                    <option value="SHA512" ${existingData?.algorithm === 'SHA512' ? 'selected' : ''}>SHA512</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="attachDigits">Digits</label>
                                <select class="form-input form-select" id="attachDigits" name="digits">
                                    <option value="6" ${(existingData?.digits || 6) == 6 ? 'selected' : ''}>6</option>
                                    <option value="8" ${existingData?.digits == 8 ? 'selected' : ''}>8</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="attachPeriod">Period</label>
                                <select class="form-input form-select" id="attachPeriod" name="period">
                                    <option value="30" ${(existingData?.period || 30) == 30 ? 'selected' : ''}>30s</option>
                                    <option value="60" ${existingData?.period == 60 ? 'selected' : ''}>60s</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'file') {
            // When editing, only name is editable
            if (isEdit) {
                fieldsHTML = `
                    <div class="form-group">
                        <label class="form-label" for="attachFileName">Name</label>
                        <input type="text" class="form-input" id="attachFileName" name="name"
                               placeholder="e.g., backup-codes.txt" value="${Utils.escapeHtml(existingData?.name || '')}"
                               autocomplete="off">
                    </div>
                `;
            } else {
                fieldsHTML = `
                    <div class="form-group">
                        <label class="form-label" for="attachFileName">Name</label>
                        <input type="text" class="form-input" id="attachFileName" name="name"
                               placeholder="e.g., backup-codes.txt" value=""
                               autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label class="form-label">File *</label>
                        <div class="file-upload" id="attachFileUpload">
                            <input type="file" id="attachFile" name="file" class="file-input">
                            <div class="file-upload-content">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                <span>Click to upload</span>
                            </div>
                        </div>
                        <div class="linked-file-preview" id="attachFilePreview" style="display: none;">
                            <span class="linked-file-name" id="attachFileNameDisplay"></span>
                            <button type="button" class="btn-icon" id="attachFileRemove">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        const popup = document.createElement('div');
        popup.className = 'popup-overlay';
        popup.id = 'attachmentPopup';
        popup.innerHTML = `
            <div class="popup linked-item-popup">
                <div class="popup-header">
                    <h3 class="popup-title">${title}</h3>
                </div>
                <div class="popup-body">
                    <form id="attachmentForm">
                        ${fieldsHTML}
                    </form>
                </div>
                <div class="popup-footer">
                    <button class="btn btn-secondary" id="cancelAttachment">Cancel</button>
                    <button class="btn btn-primary" id="saveAttachment">
                        <span class="btn-text">${isEdit ? 'Update' : 'Attach'}</span>
                        <span class="btn-loading" style="display: none;">
                            <div class="spinner"></div>
                        </span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        requestAnimationFrame(() => popup.classList.add('active'));

        // Focus first input
        const firstInput = popup.querySelector('input, textarea');
        if (firstInput) firstInput.focus();

        // Bind popup events
        this.bindAttachmentPopupEvents(popup, type, isEdit, existingData);
    },

    /**
     * Bind events for attachment popup
     */
    bindAttachmentPopupEvents(popup, type, isEdit, existingData) {
        const close = () => {
            popup.classList.remove('active');
            setTimeout(() => popup.remove(), 300);
        };

        // Cancel button
        popup.querySelector('#cancelAttachment')?.addEventListener('click', close);

        // Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Advanced toggle for TOTP
        popup.querySelector('#attachAdvancedToggle')?.addEventListener('click', () => {
            const content = popup.querySelector('#attachAdvancedContent');
            const toggle = popup.querySelector('#attachAdvancedToggle');
            if (content) {
                const isOpen = content.style.display !== 'none';
                content.style.display = isOpen ? 'none' : 'block';
                toggle?.classList.toggle('open', !isOpen);
            }
        });

        // File upload handling
        if (type === 'file' && !isEdit) {
            const fileInput = popup.querySelector('#attachFile');
            const fileUpload = popup.querySelector('#attachFileUpload');
            const filePreview = popup.querySelector('#attachFilePreview');
            const fileNameDisplay = popup.querySelector('#attachFileNameDisplay');
            const fileRemove = popup.querySelector('#attachFileRemove');

            fileInput?.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    fileUpload.style.display = 'none';
                    filePreview.style.display = 'flex';
                    fileNameDisplay.textContent = file.name;
                    // Auto-fill name if empty (without extension)
                    const nameInput = popup.querySelector('#attachFileName');
                    if (nameInput && !nameInput.value) {
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                        nameInput.value = nameWithoutExt;
                    }
                }
            });

            fileRemove?.addEventListener('click', () => {
                fileInput.value = '';
                fileUpload.style.display = 'block';
                filePreview.style.display = 'none';
            });
        }

        // Save button
        const saveBtn = popup.querySelector('#saveAttachment');
        let isSaving = false;

        const setLoading = (loading) => {
            isSaving = loading;
            if (saveBtn) {
                saveBtn.disabled = loading;
                const text = saveBtn.querySelector('.btn-text');
                const loader = saveBtn.querySelector('.btn-loading');
                if (text) text.style.display = loading ? 'none' : 'inline';
                if (loader) loader.style.display = loading ? 'inline-flex' : 'none';
            }
        };

        saveBtn?.addEventListener('click', async () => {
            if (isSaving) return;
            setLoading(true);
            try {
                await this.saveAttachmentFromPopup(popup, type, isEdit, existingData, close);
            } finally {
                setLoading(false);
            }
        });

        // Enter key to save (except for textarea)
        popup.querySelector('form')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !isSaving) {
                e.preventDefault();
                saveBtn?.click();
            }
        });
    },

    /**
     * Save attachment from popup - embeds data directly in password item
     */
    async saveAttachmentFromPopup(popup, type, isEdit, existingData, closePopup) {
        const form = popup.querySelector('#attachmentForm');
        if (!form) return;

        const formData = new FormData(form);
        let attachmentData = {};

        if (type === 'totp') {
            const totpSecret = formData.get('secret')?.replace(/\s/g, '').toUpperCase() || '';
            if (!totpSecret) {
                Toast.error('Secret key is required');
                return;
            }
            attachmentData = {
                issuer: this.itemData?.name || 'Attached',
                secret: totpSecret,
                algorithm: formData.get('algorithm') || 'SHA1',
                digits: parseInt(formData.get('digits')) || 6,
                period: parseInt(formData.get('period')) || 30
            };
        } else if (type === 'file') {
            const fileInput = popup.querySelector('#attachFile');
            const file = fileInput?.files[0];
            const fileName = formData.get('name') || existingData?.name || file?.name || 'untitled';

            // For new files, file is required
            if (!isEdit && !file) {
                Toast.error('Please select a file');
                return;
            }

            // Check file size (10MB limit)
            if (file && file.size > 10 * 1024 * 1024) {
                Toast.error('File exceeds maximum size of 10MB');
                return;
            }

            attachmentData = {
                name: fileName,
                original_name: file?.name || existingData?.original_name || fileName,
                mime_type: file?.type || existingData?.mime_type || 'application/octet-stream',
                size: file?.size || existingData?.size || 0
            };

            this._pendingFileUpload = file;
        }

        try {
            // Update password item data with embedded attachment
            const updatedData = { ...this.itemData };

            if (type === 'totp') {
                updatedData.attached_totp = attachmentData;
            } else if (type === 'file') {
                updatedData.attached_file = attachmentData;
            }

            // Save the parent password item
            await Vault.updateItem(this.item.id, updatedData, this.item.folder_id);

            // Upload file content using password item ID
            if (type === 'file' && this._pendingFileUpload) {
                await this.uploadFileContent(this.item.id, this._pendingFileUpload);
            }

            this._pendingFileUpload = null;

            // Update local state
            this.item.data = updatedData;
            this.item.decrypted_data = updatedData;
            this.itemData = updatedData;

            closePopup();

            const typeLabel = type === 'totp' ? '2FA Code' : 'File';
            Toast.success(isEdit ? `${typeLabel} updated` : `${typeLabel} attached`);

            // Refresh the view
            this.refreshItem();
        } catch (error) {
            console.error('Failed to save attachment:', error);
            Toast.error(error.message || 'Failed to save attachment');
            this._pendingFileUpload = null;
        }
    },

    /**
     * Remove an attachment from the password item
     */
    async removeAttachment(type) {
        const typeLabel = type === 'totp' ? '2FA Code' : 'File';

        const confirmed = await Popup.confirm({
            title: `Remove ${typeLabel}?`,
            message: type === 'file'
                ? 'The attached file will be deleted permanently.'
                : 'The 2FA code will be removed from this item.',
            confirmText: 'Remove',
            danger: true
        });

        if (!confirmed) return;

        try {
            // Update password item data - remove the attachment
            const updatedData = { ...this.itemData };

            if (type === 'totp') {
                delete updatedData.attached_totp;
            } else if (type === 'file') {
                delete updatedData.attached_file;
                // Note: File content on server could be cleaned up separately
                // For now, we just remove the metadata
            }

            // Save the updated password item
            await Vault.updateItem(this.item.id, updatedData, this.item.folder_id);

            // Update local state
            this.item.data = updatedData;
            this.item.decrypted_data = updatedData;
            this.itemData = updatedData;

            Toast.success(`${typeLabel} removed`);

            // Refresh the view
            this.refreshItem();
        } catch (error) {
            console.error('Failed to remove attachment:', error);
            Toast.error('Failed to remove attachment');
        }
    },

    /**
     * Upload file content
     */
    async uploadFileContent(itemId, file) {
        if (!file || !itemId) return;

        // Use Vault.uploadFile which handles offline mode
        if (typeof Vault !== 'undefined') {
            const arrayBuffer = await file.arrayBuffer();
            await Vault.uploadFile(itemId, arrayBuffer);
        } else {
            // Fallback - only if not in local mode
            const isLocalMode = localStorage.getItem('keyhive_mode') === 'local';
            if (isLocalMode) {
                throw new Error('File uploads are not supported in local mode');
            }
            const arrayBuffer = await file.arrayBuffer();
            const encryptedContent = await Encryption.encryptFile(arrayBuffer);
            await ApiClient.uploadFile(itemId, encryptedContent, file.size);
        }
    },

    /**
     * Get human-readable type label
     */
    getTypeLabel(type) {
        return Utils.getTypeLabel(type);
    },

    /**
     * Hide the page
     */
    hide() {
        this.isVisible = false;
        this.stopTotpTimer();
        this.stopAttachedTotpTimer();
        this.itemData = null;

        // Remove vault update listener
        if (this.vaultUpdateHandler) {
            window.removeEventListener('vaultupdate', this.vaultUpdateHandler);
            this.vaultUpdateHandler = null;
        }

        const page = document.getElementById('viewPage');
        if (page) {
            page.classList.remove('active');
            setTimeout(() => {
                page.remove();
                // Unlock body scroll if no other overlays are open
                if (!document.querySelector('.popup-overlay.active') && !document.querySelector('.page-overlay.active')) {
                    document.body.classList.remove('popup-open');
                }
            }, 300);
        }
    },

};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewPage;
}
