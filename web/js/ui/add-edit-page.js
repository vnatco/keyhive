/**
 * Add/Edit Item Page Component
 * Handles creating and editing vault items:
 * - Password cards
 * - TOTP cards
 * - Note cards
 * - Website cards
 * - File cards
 */

const AddEditPage = {
    mode: 'add', // 'add' or 'edit'
    itemType: 'password',
    item: null,
    customFields: {}, // Changed to object with unique IDs as keys
    isVisible: false,
    currentFolderId: null, // Current folder context for new items
    hasChanges: false, // Track if form has unsaved changes
    navigationHandler: null, // Handler for intercepting navigation
    customIcon: null, // Custom icon (base64) for password/website cards

    /**
     * Show add page for a specific item type
     * @param {string} type
     * @param {string} folderId - Optional folder ID to create item in
     * @param {Object} prefillData - Optional data to prefill the form with (for duplication)
     */
    showAdd(type = 'password', folderId = null, prefillData = null) {
        this.mode = 'add';
        this.itemType = type;
        this.item = null;
        // Start with empty object - populateFormWithData will add fields via addCustomField()
        this.customFields = {};
        this.currentFolderId = folderId;
        this.hasChanges = false;
        this.prefillData = prefillData;
        this.customIcon = prefillData?.custom_icon || null;

        this.render();
        this.show();
        // If we have prefill data, populate the form
        if (prefillData) {
            this.populateFormWithData(prefillData);
        }
        this.setupChangeTracking();
        this.setupNavigationGuard();
    },

    /**
     * Show edit page for an existing item
     * @param {Object} item
     */
    showEdit(item) {
        this.mode = 'edit';
        this.itemType = item.item_type;
        this.item = item;
        // Handle both data and decrypted_data structures
        const data = item.data || item.decrypted_data || {};
        // Start with empty object - populateForm will add fields via addCustomField()
        this.customFields = {};
        this.hasChanges = false;
        this.customIcon = data.custom_icon || null;
        this.render();
        this.show();
        this.populateForm();
        this.updateIconPreview();
        this.setupChangeTracking();
        this.setupNavigationGuard();
    },

    /**
     * Render the add/edit page
     */
    render() {
        // Remove existing page if any
        const existing = document.getElementById('addEditPage');
        if (existing) existing.remove();

        const title = this.mode === 'add' ? `New ${this.getTypeLabel(this.itemType)}` : `Edit ${this.getTypeLabel(this.itemType)}`;

        const pageHTML = `
            <div class="page-overlay" id="addEditPage">
                <div class="page-content">
                    <div class="page-container">
                        <div class="edit-header">
                            <button class="edit-back" id="closeAddEdit">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                            </button>
                            <h2 class="edit-title">${title}</h2>
                            <button class="btn btn-primary" id="saveItem">
                                <span class="btn-text">Save</span>
                                <span class="btn-loading" style="display: none;">
                                    <div class="spinner"></div>
                                </span>
                            </button>
                        </div>
                        <form id="itemForm" class="item-form">
                            ${this.renderFormFields()}
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', pageHTML);
        this.bindEvents();
    },

    /**
     * Render form fields based on item type
     * @returns {string}
     */
    renderFormFields() {
        switch (this.itemType) {
            case 'password':
                return this.renderPasswordFields();
            case 'totp':
                return this.renderTOTPFields();
            case 'note':
                return this.renderNoteFields();
            case 'website':
                return this.renderWebsiteFields();
            case 'file':
                return this.renderFileFields();
            default:
                return this.renderPasswordFields();
        }
    },

    /**
     * Render password card form fields
     * @returns {string}
     */
    renderPasswordFields() {
        return `
            <!-- Row 1: Name | Website URL -->
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label" for="itemName">Name *</label>
                    <input type="text" class="form-input" id="itemName" name="name"
                           placeholder="e.g., Google Account" required
                           autocomplete="off">
                </div>
                <div class="form-group">
                    <label class="form-label" for="itemWebsiteUrl">Website</label>
                    <input type="url" class="form-input" id="itemWebsiteUrl" name="website_url"
                           placeholder="https://example.com"
                           autocomplete="off">
                </div>
            </div>

            <!-- Row 2: Password | Username -->
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label" for="itemPassword">Password</label>
                    <div class="input-with-actions">
                        <input type="password" class="form-input" id="itemPassword" name="password"
                               placeholder="Enter password"
                               autocomplete="off">
                        <button type="button" class="input-action" id="togglePassword" title="Show password">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <button type="button" class="input-action" id="generatePassword" title="Generate password">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="password-strength" id="passwordStrength"></div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="itemUsername">Username / Email</label>
                    <input type="text" class="form-input" id="itemUsername" name="username"
                           placeholder="e.g., user@example.com"
                           autocomplete="off">
                </div>
            </div>

            <!-- Notes (full width) -->
            <div class="form-group">
                <label class="form-label" for="itemNotes">Notes</label>
                <textarea class="form-input form-textarea" id="itemNotes" name="notes"
                          rows="4" placeholder="Additional notes..."></textarea>
            </div>

            <!-- Tags (full width) -->
            <div class="form-group">
                <label class="form-label" for="itemTags">Tags</label>
                <input type="text" class="form-input" id="itemTags" name="tags"
                       placeholder="work, personal, important (comma separated)"
                       autocomplete="off">
            </div>

            <!-- Custom Fields Section -->
            <div class="form-section">
                <div class="form-section-header">
                    <h3 class="form-section-title">Custom Fields</h3>
                    <div class="add-field-container">
                        <button type="button" class="btn btn-sm btn-secondary" id="addCustomField">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Field
                        </button>
                        <div class="add-field-menu" id="addFieldMenu">
                            <button type="button" class="add-field-item" data-type="text">
                                <span class="add-field-icon text">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="4 7 4 4 20 4 20 7"></polyline>
                                        <line x1="9" y1="20" x2="15" y2="20"></line>
                                        <line x1="12" y1="4" x2="12" y2="20"></line>
                                    </svg>
                                </span>
                                <span>Text</span>
                            </button>
                            <button type="button" class="add-field-item" data-type="secret">
                                <span class="add-field-icon secret">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </span>
                                <span>Secret</span>
                            </button>
                            <button type="button" class="add-field-item" data-type="email">
                                <span class="add-field-icon email">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                        <polyline points="22,6 12,13 2,6"></polyline>
                                    </svg>
                                </span>
                                <span>Email</span>
                            </button>
                            <button type="button" class="add-field-item" data-type="url">
                                <span class="add-field-icon url">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                    </svg>
                                </span>
                                <span>URL</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="custom-fields-list" id="customFieldsList">
                    <!-- Custom fields will be added here -->
                </div>
            </div>

            <!-- Card Icon Section -->
            <div class="form-group" id="iconSection">
                <label class="form-label">Card Icon</label>
                <div class="icon-row">
                    <div class="icon-preview" id="iconPreview">
                        <div class="icon-preview-placeholder" id="iconPlaceholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <img id="iconImage" class="icon-preview-image" style="display: none;" alt="Card icon">
                    </div>
                    <div class="icon-row-actions">
                        <button type="button" class="btn btn-sm btn-secondary" id="pullIconBtn" title="Pull from Website">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Fetch
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary" id="uploadIconBtn" title="Upload Icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            Upload
                        </button>
                        <button type="button" class="btn btn-sm btn-danger-outline" id="removeIconBtn" style="display: none;" title="Remove Icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                        <input type="file" id="iconFileInput" accept="image/*" style="display: none;">
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render TOTP card form fields
     * @returns {string}
     */
    renderTOTPFields() {
        return `
            <!-- Issuer -->
            <div class="form-group">
                <label class="form-label" for="itemIssuer">Issuer *</label>
                <input type="text" class="form-input" id="itemIssuer" name="issuer"
                       placeholder="e.g., Google, GitHub" required
                       autocomplete="off">
            </div>

            <!-- Label -->
            <div class="form-group">
                <label class="form-label" for="itemLabel">Account Label</label>
                <input type="text" class="form-input" id="itemLabel" name="label"
                       placeholder="e.g., user@example.com"
                       autocomplete="off">
            </div>

            <!-- Secret -->
            <div class="form-group">
                <label class="form-label" for="itemSecret">Secret Key *</label>
                <div class="input-with-actions">
                    <input type="text" class="form-input" id="itemSecret" name="secret"
                           placeholder="Enter TOTP secret or scan QR code" required
                           autocomplete="off">
                    <button type="button" class="input-action" id="scanQR" title="Scan QR code">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Tags -->
            <div class="form-group">
                <label class="form-label" for="itemTags">Tags</label>
                <input type="text" class="form-input" id="itemTags" name="tags"
                       placeholder="work, personal, important (comma separated)"
                       autocomplete="off">
            </div>

            <!-- Advanced TOTP Settings -->
            <div class="form-group collapsible">
                <button type="button" class="collapsible-header" id="advancedTOTPToggle">
                    <span>Advanced Settings</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="collapsible-content" id="advancedTOTPContent" style="display: none;">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="itemAlgorithm">Algorithm</label>
                            <select class="form-input form-select" id="itemAlgorithm" name="algorithm">
                                <option value="SHA1" selected>SHA1</option>
                                <option value="SHA256">SHA256</option>
                                <option value="SHA512">SHA512</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="itemDigits">Digits</label>
                            <select class="form-input form-select" id="itemDigits" name="digits">
                                <option value="6" selected>6</option>
                                <option value="8">8</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="itemPeriod">Period</label>
                            <select class="form-input form-select" id="itemPeriod" name="period">
                                <option value="30" selected>30 sec</option>
                                <option value="60">60 sec</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render note card form fields
     * @returns {string}
     */
    renderNoteFields() {
        return `
            <!-- Label -->
            <div class="form-group">
                <label class="form-label" for="itemLabel">Title *</label>
                <input type="text" class="form-input" id="itemLabel" name="label"
                       placeholder="e.g., Important Notes" required
                       autocomplete="off">
            </div>

            <!-- Content -->
            <div class="form-group">
                <label class="form-label" for="itemContent">Content</label>
                <textarea class="form-input form-textarea" id="itemContent" name="content"
                          rows="10" placeholder="Enter your secure note..."></textarea>
            </div>

            <!-- Tags -->
            <div class="form-group">
                <label class="form-label" for="itemTags">Tags</label>
                <input type="text" class="form-input" id="itemTags" name="tags"
                       placeholder="work, personal, important (comma separated)"
                       autocomplete="off">
            </div>
        `;
    },

    /**
     * Render website card form fields
     * @returns {string}
     */
    renderWebsiteFields() {
        return `
            <!-- Label -->
            <div class="form-group">
                <label class="form-label" for="itemLabel">Name *</label>
                <input type="text" class="form-input" id="itemLabel" name="label"
                       placeholder="e.g., Company Portal" required
                       autocomplete="off">
            </div>

            <!-- URL -->
            <div class="form-group">
                <label class="form-label" for="itemContent">URL *</label>
                <input type="url" class="form-input" id="itemContent" name="content"
                       placeholder="https://example.com" required
                       autocomplete="off">
            </div>

            <!-- Tags -->
            <div class="form-group">
                <label class="form-label" for="itemTags">Tags</label>
                <input type="text" class="form-input" id="itemTags" name="tags"
                       placeholder="work, personal, important (comma separated)"
                       autocomplete="off">
            </div>

            <!-- Card Icon Section -->
            <div class="form-group" id="iconSection">
                <label class="form-label">Card Icon</label>
                <div class="icon-row">
                    <div class="icon-preview" id="iconPreview">
                        <div class="icon-preview-placeholder" id="iconPlaceholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="2" y1="12" x2="22" y2="12"></line>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                            </svg>
                        </div>
                        <img id="iconImage" class="icon-preview-image" style="display: none;" alt="Card icon">
                    </div>
                    <div class="icon-row-actions">
                        <button type="button" class="btn btn-sm btn-secondary" id="pullIconBtn" title="Pull from Website">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Fetch
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary" id="uploadIconBtn" title="Upload Icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            Upload
                        </button>
                        <button type="button" class="btn btn-sm btn-danger-outline" id="removeIconBtn" style="display: none;" title="Remove Icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                        <input type="file" id="iconFileInput" accept="image/*" style="display: none;">
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render file card form fields
     * @returns {string}
     */
    renderFileFields() {
        return `
            <!-- Name -->
            <div class="form-group">
                <label class="form-label" for="itemName">Name *</label>
                <input type="text" class="form-input" id="itemName" name="name"
                       placeholder="e.g., passport.pdf" required
                       autocomplete="off">
            </div>

            <!-- File Upload -->
            <div class="form-group">
                <label class="form-label">File</label>
                <div class="file-upload" id="fileUpload">
                    <input type="file" id="itemFile" name="file" class="file-input">
                    <div class="file-upload-content">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span>Click to upload or drag and drop</span>
                        <span class="file-hint">Max size: 10MB</span>
                    </div>
                </div>
                <div class="file-preview" id="filePreview" style="display: none;">
                    <span class="file-name" id="fileName"></span>
                    <span class="file-size" id="fileSize"></span>
                    <button type="button" class="btn-icon" id="removeFile">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Tags -->
            <div class="form-group">
                <label class="form-label" for="itemTags">Tags</label>
                <input type="text" class="form-input" id="itemTags" name="tags"
                       placeholder="work, personal, important (comma separated)"
                       autocomplete="off">
            </div>
        `;
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Close button
        document.getElementById('closeAddEdit')?.addEventListener('click', () => {
            this.tryClose();
        });

        // Save button
        document.getElementById('saveItem')?.addEventListener('click', () => {
            this.save();
        });

        // Password toggle
        document.getElementById('togglePassword')?.addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        // Generate password
        document.getElementById('generatePassword')?.addEventListener('click', () => {
            this.openPasswordGenerator();
        });

        // Password strength
        document.getElementById('itemPassword')?.addEventListener('input', (e) => {
            this.updatePasswordStrength(e.target.value);
        });

        // Add custom field dropdown
        const addFieldBtn = document.getElementById('addCustomField');
        const addFieldMenu = document.getElementById('addFieldMenu');

        addFieldBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            addFieldMenu?.classList.toggle('open');
        });

        // Field type selection
        addFieldMenu?.querySelectorAll('.add-field-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.dataset.type;
                addFieldMenu.classList.remove('open');
                this.promptCustomFieldLabel(type);
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            addFieldMenu?.classList.remove('open');
        });

        // Advanced TOTP toggle
        document.getElementById('advancedTOTPToggle')?.addEventListener('click', () => {
            const content = document.getElementById('advancedTOTPContent');
            if (content) {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            }
        });

        // File upload
        document.getElementById('itemFile')?.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        document.getElementById('removeFile')?.addEventListener('click', () => {
            this.removeFile();
        });

        // Icon management buttons
        document.getElementById('pullIconBtn')?.addEventListener('click', () => {
            this.pullIconFromWebsite();
        });

        document.getElementById('uploadIconBtn')?.addEventListener('click', () => {
            document.getElementById('iconFileInput')?.click();
        });

        document.getElementById('iconFileInput')?.addEventListener('change', (e) => {
            this.handleIconUpload(e.target.files[0]);
        });

        document.getElementById('removeIconBtn')?.addEventListener('click', () => {
            this.removeIcon();
        });
    },

    /**
     * Populate form with existing item data
     */
    populateForm() {
        if (!this.item) return;

        // Handle both data and decrypted_data structures
        const data = this.item.data || this.item.decrypted_data;
        if (!data) return;

        switch (this.itemType) {
            case 'password':
                this.setInputValue('itemName', data.name);
                this.setInputValue('itemWebsiteUrl', data.website_url);
                this.setInputValue('itemPassword', data.password);
                this.setInputValue('itemUsername', data.username);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                this.setInputValue('itemNotes', data.notes);
                break;
            case 'totp':
                this.setInputValue('itemIssuer', data.issuer);
                this.setInputValue('itemLabel', data.label);
                this.setInputValue('itemSecret', data.secret);
                this.setInputValue('itemAlgorithm', data.algorithm);
                this.setInputValue('itemDigits', data.digits);
                this.setInputValue('itemPeriod', data.period);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                break;
            case 'note':
                this.setInputValue('itemLabel', data.label);
                this.setInputValue('itemContent', data.content);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                break;
            case 'website':
                this.setInputValue('itemLabel', data.label);
                this.setInputValue('itemContent', data.content);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                break;
            case 'file':
                this.setInputValue('itemName', data.name);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                // Show existing file info
                break;
        }

        // Render custom fields (mark as initial load so it doesn't trigger hasChanges)
        if (data.custom_fields && data.custom_fields.length > 0) {
            data.custom_fields.forEach(field => {
                this.addCustomField(field.type, field.label, field.value, true);
            });
        }

        // Update password strength if present
        if (data.password) {
            this.updatePasswordStrength(data.password);
        }
    },

    /**
     * Populate form with data (for duplication)
     * @param {Object} data - The data to populate the form with
     */
    populateFormWithData(data) {
        if (!data) return;

        switch (this.itemType) {
            case 'password':
                this.setInputValue('itemName', data.name);
                this.setInputValue('itemWebsiteUrl', data.website_url);
                this.setInputValue('itemPassword', data.password);
                this.setInputValue('itemUsername', data.username);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                this.setInputValue('itemNotes', data.notes);
                break;
            case 'totp':
                this.setInputValue('itemIssuer', data.issuer);
                this.setInputValue('itemLabel', data.label);
                this.setInputValue('itemSecret', data.secret);
                this.setInputValue('itemAlgorithm', data.algorithm);
                this.setInputValue('itemDigits', data.digits);
                this.setInputValue('itemPeriod', data.period);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                break;
            case 'note':
                this.setInputValue('itemLabel', data.label);
                this.setInputValue('itemContent', data.content);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                break;
            case 'website':
                this.setInputValue('itemLabel', data.label);
                this.setInputValue('itemContent', data.content);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                break;
            case 'file':
                this.setInputValue('itemName', data.name);
                this.setInputValue('itemTags', (data.tags || []).join(', '));
                break;
        }

        // Render custom fields (mark as initial load so it doesn't trigger hasChanges)
        if (data.custom_fields && data.custom_fields.length > 0) {
            data.custom_fields.forEach(field => {
                this.addCustomField(field.type, field.label, field.value, true);
            });
        }

        // Update password strength if present
        if (data.password) {
            this.updatePasswordStrength(data.password);
        }
    },

    /**
     * Set input value helper
     * @param {string} id
     * @param {any} value
     */
    setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el && value !== undefined) {
            el.value = value;
        }
    },

    /**
     * Toggle password visibility
     */
    togglePasswordVisibility() {
        const input = document.getElementById('itemPassword');
        const btn = document.getElementById('togglePassword');
        if (!input || !btn) return;

        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
            `;
        } else {
            input.type = 'password';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            `;
        }
    },

    /**
     * Open password generator
     */
    openPasswordGenerator() {
        const options = (typeof GeneratorPage !== 'undefined') ? GeneratorPage.options : {};
        const password = (typeof PasswordGenerator !== 'undefined')
            ? PasswordGenerator.generate(options)
            : '';
        if (!password) return;

        const input = document.getElementById('itemPassword');
        if (input) {
            input.value = password;
            input.type = 'text';
            this.updatePasswordStrength(password);
            // Update toggle icon to "hide" state
            const btn = document.getElementById('togglePassword');
            if (btn) {
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                `;
            }
        }
    },

    /**
     * Update password strength indicator using global SecurityAnalyzer
     * @param {string} password
     */
    updatePasswordStrength(password) {
        SecurityAnalyzer.renderStrengthBar('#passwordStrength', password);
    },

    /**
     * Prompt for custom field label
     * @param {string} type
     */
    promptCustomFieldLabel(type) {
        const popup = Popup.open({
            title: 'Field Label',
            body: `
                <div class="form-group">
                    <label class="form-label" for="fieldLabel">Label</label>
                    <input type="text" class="form-input" id="fieldLabel" placeholder="e.g., Recovery Email" autocomplete="off">
                </div>
            `,
            buttons: [
                { text: 'Cancel', type: 'secondary', isCancel: true, id: 'cancelBtn' },
                { text: 'Add', type: 'primary', id: 'addBtn', onClick: () => {
                    const label = popup.querySelector('#fieldLabel').value.trim();
                    if (label) {
                        this.addCustomField(type, label);
                        return true; // Close popup
                    }
                    return false; // Keep popup open
                }}
            ],
            onOpen: (api) => {
                const input = api.querySelector('#fieldLabel');
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const label = input.value.trim();
                        if (label) {
                            this.addCustomField(type, label);
                            api.forceClose();
                        }
                    }
                });
            }
        });
    },

    /**
     * Add a custom field to the form
     * @param {string} type
     * @param {string} label
     * @param {string} value
     * @param {boolean} isInitialLoad - If true, don't mark as changed (used when loading existing data)
     */
    addCustomField(type, label, value = '', isInitialLoad = false) {
        const list = document.getElementById('customFieldsList');
        if (!list) return;

        // Generate unique ID for this field
        const fieldId = `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Store in object with unique ID
        this.customFields[fieldId] = { type, label, value };

        const fieldHTML = `
            <div class="custom-field" data-field-id="${fieldId}" id="${fieldId}">
                <div class="custom-field-header">
                    <span class="custom-field-label">${Utils.escapeHtml(label)}</span>
                    <span class="custom-field-type">${Utils.escapeHtml(type)}</span>
                    <button type="button" class="btn-icon remove-field-btn" data-field-id="${fieldId}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                ${this.renderCustomFieldInput(type, fieldId, value)}
            </div>
        `;

        list.insertAdjacentHTML('beforeend', fieldHTML);

        // Mark as having changes when field is added (but not during initial load)
        if (!isInitialLoad) {
            this.hasChanges = true;
        }

        // Bind remove handler
        const fieldEl = document.getElementById(fieldId);
        const removeBtn = fieldEl?.querySelector('.remove-field-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.currentTarget.dataset.fieldId;
                this.removeCustomField(id);
            });
        }

        // Bind toggle handler for secret fields
        const toggleBtn = fieldEl?.querySelector('.toggle-secret');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleCustomFieldSecret(fieldId);
            });
        }

        // Bind generate handler for secret fields
        const generateBtn = fieldEl?.querySelector('.generate-secret');
        if (generateBtn) {
            generateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.generateCustomFieldSecret(fieldId);
            });
        }

        // Bind input change handler for custom field
        const input = fieldEl?.querySelector('.custom-field-input');
        if (input) {
            input.addEventListener('input', () => {
                this.hasChanges = true;
            });
        }
    },

    /**
     * Generate password for a custom secret field
     * @param {string} fieldId - Unique field ID
     */
    generateCustomFieldSecret(fieldId) {
        const fieldEl = document.getElementById(fieldId);
        if (!fieldEl) return;

        const options = (typeof GeneratorPage !== 'undefined') ? GeneratorPage.options : {};
        const password = (typeof PasswordGenerator !== 'undefined')
            ? PasswordGenerator.generate(options)
            : '';
        if (!password) return;

        const input = fieldEl.querySelector('.custom-field-input');
        if (input) {
            input.value = password;
            input.type = 'text';
            this.hasChanges = true;
            // Update toggle icon to "hide" state
            const btn = fieldEl.querySelector('.toggle-secret');
            if (btn) {
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                `;
            }
        }
    },

    /**
     * Toggle visibility for a custom secret field
     * @param {string} fieldId - Unique field ID
     */
    toggleCustomFieldSecret(fieldId) {
        const fieldEl = document.getElementById(fieldId);
        if (!fieldEl) return;

        const input = fieldEl.querySelector('.custom-field-input');
        const btn = fieldEl.querySelector('.toggle-secret');
        if (!input || !btn) return;

        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
            `;
        } else {
            input.type = 'password';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            `;
        }
    },

    /**
     * Render custom field input based on type
     * @param {string} type
     * @param {string} fieldId - Unique field ID
     * @param {string} value
     * @returns {string}
     */
    renderCustomFieldInput(type, fieldId, value = '') {
        const escapedValue = Utils.escapeHtml(value);

        switch (type) {
            case 'text':
            case 'email':
            case 'url':
            case 'website': // backward compatibility
                return `<input type="${type === 'email' ? 'email' : (type === 'url' || type === 'website') ? 'url' : 'text'}"
                               class="form-input custom-field-input"
                               value="${escapedValue}"
                               placeholder="Enter value"
                               autocomplete="off">`;
            case 'secret':
                return `
                    <div class="input-with-actions">
                        <input type="password"
                               class="form-input custom-field-input"
                               value="${escapedValue}"
                               placeholder="Enter secret value"
                               autocomplete="off">
                        <button type="button" class="input-action toggle-secret">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <button type="button" class="input-action generate-secret" title="Generate password">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                            </svg>
                        </button>
                    </div>
                `;
            case 'file':
                return `
                    <div class="file-field">
                        <input type="file" class="file-input">
                        <button type="button" class="btn btn-secondary btn-sm">Choose File</button>
                        <span class="file-name">${Utils.escapeHtml(value) || 'No file selected'}</span>
                    </div>
                `;
            default:
                return `<input type="text"
                               class="form-input custom-field-input"
                               value="${escapedValue}"
                               autocomplete="off">`;
        }
    },

    /**
     * Remove a custom field
     * @param {string} fieldId - Unique field ID
     */
    removeCustomField(fieldId) {
        // Remove DOM element
        const field = document.getElementById(fieldId);
        if (field) {
            field.remove();
        }
        // Remove from object
        delete this.customFields[fieldId];
        // Mark as having changes
        this.hasChanges = true;
    },

    /**
     * Handle file selection
     * @param {File} file
     */
    handleFileSelect(file) {
        if (!file) return;

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            Toast.error('File size exceeds 10MB limit');
            return;
        }

        const upload = document.getElementById('fileUpload');
        const preview = document.getElementById('filePreview');
        const nameEl = document.getElementById('fileName');
        const sizeEl = document.getElementById('fileSize');

        if (upload && preview && nameEl && sizeEl) {
            upload.style.display = 'none';
            preview.style.display = 'flex';
            nameEl.textContent = file.name;
            sizeEl.textContent = Utils.formatFileSize(file.size);

            // Update name field if empty (without extension)
            const nameInput = document.getElementById('itemName');
            if (nameInput && !nameInput.value) {
                // Remove extension from filename
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                nameInput.value = nameWithoutExt;
            }
        }
    },

    /**
     * Remove selected file
     */
    removeFile() {
        const upload = document.getElementById('fileUpload');
        const preview = document.getElementById('filePreview');
        const fileInput = document.getElementById('itemFile');

        if (upload) upload.style.display = 'block';
        if (preview) preview.style.display = 'none';
        if (fileInput) fileInput.value = '';
    },

    /**
     * Update icon preview UI based on customIcon state
     */
    updateIconPreview() {
        const placeholder = document.getElementById('iconPlaceholder');
        const iconImage = document.getElementById('iconImage');
        const removeBtn = document.getElementById('removeIconBtn');

        if (!placeholder || !iconImage) return;

        if (this.customIcon) {
            placeholder.style.display = 'none';
            iconImage.style.display = 'block';
            iconImage.src = Utils.sanitizeImageSrc(this.customIcon) || '';
            if (removeBtn) removeBtn.style.display = 'inline-flex';
        } else {
            placeholder.style.display = 'flex';
            iconImage.style.display = 'none';
            iconImage.src = '';
            if (removeBtn) removeBtn.style.display = 'none';
        }
    },

    /**
     * Pull icon from website URL
     */
    async pullIconFromWebsite() {
        // Get website URL from form
        let websiteUrl = document.getElementById('itemWebsiteUrl')?.value ||
                         document.getElementById('itemContent')?.value;

        if (!websiteUrl) {
            Toast.error('Please enter a website URL first');
            return;
        }

        // Show loading state
        const pullBtn = document.getElementById('pullIconBtn');
        const originalText = pullBtn?.innerHTML;
        if (pullBtn) {
            pullBtn.disabled = true;
            pullBtn.innerHTML = `
                <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"></circle>
                </svg>
                Fetching...
            `;
        }

        try {
            if (typeof FaviconFetcher !== 'undefined') {
                const icon = await FaviconFetcher.fetch(websiteUrl);
                if (icon) {
                    this.customIcon = icon;
                    this.hasChanges = true;
                    this.updateIconPreview();
                    Toast.success('Icon fetched successfully');
                } else {
                    Toast.error('Could not fetch icon from this website');
                }
            } else {
                Toast.error('Favicon fetcher not available');
            }
        } catch (e) {
            console.error('Failed to fetch icon:', e);
            Toast.error('Failed to fetch icon');
        } finally {
            if (pullBtn) {
                pullBtn.disabled = false;
                pullBtn.innerHTML = originalText;
            }
        }
    },

    /**
     * Handle icon file upload
     * @param {File} file
     */
    async handleIconUpload(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            Toast.error('Please select an image file');
            return;
        }

        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
            Toast.error('Icon file must be less than 5MB');
            return;
        }

        try {
            if (typeof FaviconFetcher !== 'undefined') {
                const icon = await FaviconFetcher.fromFile(file);
                if (icon) {
                    this.customIcon = icon;
                    this.hasChanges = true;
                    this.updateIconPreview();
                    Toast.success('Icon uploaded successfully');
                } else {
                    Toast.error('Failed to process image');
                }
            }
        } catch (e) {
            console.error('Failed to upload icon:', e);
            Toast.error('Failed to upload icon');
        }

        // Clear the input
        const input = document.getElementById('iconFileInput');
        if (input) input.value = '';
    },

    /**
     * Remove custom icon
     */
    removeIcon() {
        this.customIcon = null;
        this.hasChanges = true;
        this.updateIconPreview();
        Toast.success('Icon removed');
    },


    /**
     * Save the item
     */
    async save() {
        const form = document.getElementById('itemForm');
        if (!form) return;

        const saveBtn = document.getElementById('saveItem');

        // Prevent double-click
        if (saveBtn?.disabled) return;

        // Collect form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Validate required fields
        if (!this.validateForm(data)) {
            return;
        }

        // Set loading state
        this.setSaveLoading(true);

        // Build item data based on type
        let itemData = {};

        switch (this.itemType) {
            case 'password':
                // Auto-fetch favicon for new items if website is present and no custom icon (skip if offline)
                if (this.mode === 'add' && data.website_url && !this.customIcon && typeof FaviconFetcher !== 'undefined' && !Vault.isOffline()) {
                    try {
                        const fetchedIcon = await FaviconFetcher.fetch(data.website_url);
                        if (fetchedIcon) {
                            this.customIcon = fetchedIcon;
                        }
                    } catch (e) {
                        console.log('Auto-fetch favicon failed:', e.message);
                    }
                }

                // Get existing attached items from current item (if editing)
                const existingData = this.item?.data || this.item?.decrypted_data || {};

                itemData = {
                    type: 'password',
                    name: data.name,
                    website_url: data.website_url || '',
                    password: data.password || '',
                    username: data.username || '',
                    tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : [],
                    notes: data.notes || '',
                    custom_fields: this.collectCustomFields(),
                    custom_icon: this.customIcon
                };

                // Preserve existing attachments when editing
                if (existingData.attached_totp) {
                    itemData.attached_totp = existingData.attached_totp;
                }
                if (existingData.attached_file) {
                    itemData.attached_file = existingData.attached_file;
                }
                break;
            case 'totp':
                const totpSecret = data.secret ? data.secret.replace(/\s/g, '').toUpperCase() : '';

                itemData = {
                    type: 'totp',
                    issuer: data.issuer,
                    label: data.label || '',
                    secret: totpSecret,
                    algorithm: data.algorithm || 'SHA1',
                    digits: parseInt(data.digits) || 6,
                    period: parseInt(data.period) || 30,
                    tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : []
                };
                break;
            case 'note':
                itemData = {
                    type: 'note',
                    label: data.label,
                    content: data.content || '',
                    tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : []
                };
                break;
            case 'website':
                // Auto-fetch favicon for new items if no custom icon (skip if offline)
                if (this.mode === 'add' && data.content && !this.customIcon && typeof FaviconFetcher !== 'undefined' && !Vault.isOffline()) {
                    try {
                        const fetchedIcon = await FaviconFetcher.fetch(data.content);
                        if (fetchedIcon) {
                            this.customIcon = fetchedIcon;
                        }
                    } catch (e) {
                        console.log('Auto-fetch favicon failed:', e.message);
                    }
                }

                itemData = {
                    type: 'website',
                    label: data.label,
                    content: data.content,
                    custom_icon: this.customIcon,
                    tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : []
                };
                break;
            case 'file':
                // Get the file from input
                const fileInput = document.getElementById('itemFile');
                const file = fileInput?.files[0];

                // For new items, file is required
                if (this.mode === 'add' && !file) {
                    Toast.error('Please select a file');
                    return;
                }

                // Check file size (10MB limit)
                if (file && file.size > 10 * 1024 * 1024) {
                    Toast.error('File exceeds maximum size of 10MB');
                    return;
                }

                itemData = {
                    type: 'file',
                    name: data.name,
                    original_name: file?.name || this.item?.data?.original_name || data.name,
                    mime_type: file?.type || this.item?.data?.mime_type || 'application/octet-stream',
                    size: file?.size || this.item?.data?.size || 0,
                    tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : []
                };

                // Store file for upload after item creation
                this._pendingFileUpload = file;
                break;
        }

        // Check for breached passwords (password items only)
        // This runs in background and doesn't block save
        if (this.itemType === 'password' && typeof BreachChecker !== 'undefined') {
            try {
                // Check main password and secret custom fields
                const checkedData = await BreachChecker.checkItem(itemData);

                // Copy breach results to itemData
                if (checkedData._breach) {
                    itemData._breach = checkedData._breach;
                }
                if (checkedData.custom_fields) {
                    itemData.custom_fields = checkedData.custom_fields;
                }
            } catch (breachError) {
                // Don't block save on breach check failure
                console.warn('[AddEditPage] Breach check failed:', breachError);
            }
        }

        try {
            // Determine folder ID based on mode
            let folderId = null;
            if (this.mode === 'add') {
                // For new items, use current folder context or fall back to current vault (which IS a root folder)
                folderId = this.currentFolderId;
                if (!folderId && typeof Vault !== 'undefined') {
                    const currentVault = Vault.getCurrentVault() || await Vault.getDefaultVault();
                    if (currentVault) {
                        // Vault IS the root folder, use its ID directly
                        folderId = currentVault.id;
                    }
                }
            } else {
                // For editing, keep existing folder
                folderId = this.item?.folder_id || null;
            }

            let result;
            if (this.mode === 'add') {
                if (typeof Vault !== 'undefined') {
                    result = await Vault.createItem(this.itemType, itemData, folderId);
                }
            } else {
                if (typeof Vault !== 'undefined') {
                    result = await Vault.updateItem(this.item.id, itemData, folderId);
                }
            }

            // Upload file content for file type items
            if (this.itemType === 'file' && this._pendingFileUpload && result?.id) {
                try {
                    await this.uploadFileContent(result.id, this._pendingFileUpload);
                } catch (uploadError) {
                    console.error('File upload failed:', uploadError);
                    Toast.error('Item saved but file upload failed');
                    this._pendingFileUpload = null;
                    this.hide();
                    window.dispatchEvent(new CustomEvent('vaultupdate'));
                    return;
                }
            }
            this._pendingFileUpload = null;

            Toast.success(this.mode === 'add' ? 'Item created' : 'Item updated');
            this.setSaveLoading(false);
            this.hide();

            // Refresh home page
            window.dispatchEvent(new CustomEvent('vaultupdate'));
        } catch (error) {
            console.error('Failed to save item:', error);
            Toast.error('Failed to save item');
            this._pendingFileUpload = null;
            this.setSaveLoading(false);
        }
    },

    /**
     * Set save button loading state
     * @param {boolean} loading
     */
    setSaveLoading(loading) {
        const btn = document.getElementById('saveItem');
        if (!btn) return;

        const text = btn.querySelector('.btn-text');
        const loader = btn.querySelector('.btn-loading');

        btn.disabled = loading;

        if (text) text.style.display = loading ? 'none' : 'inline';
        if (loader) loader.style.display = loading ? 'inline-flex' : 'none';
    },

    /**
     * Validate form data
     * @param {Object} data
     * @returns {boolean}
     */
    validateForm(data) {
        switch (this.itemType) {
            case 'password':
                if (!data.name || !data.name.trim()) {
                    Toast.error('Name is required');
                    return false;
                }
                break;
            case 'totp':
                if (!data.issuer || !data.issuer.trim()) {
                    Toast.error('Issuer is required');
                    return false;
                }
                if (!data.secret || !data.secret.trim()) {
                    Toast.error('Secret key is required');
                    return false;
                }
                break;
            case 'note':
            case 'website':
                if (!data.label || !data.label.trim()) {
                    Toast.error('Title/Name is required');
                    return false;
                }
                if (this.itemType === 'website' && (!data.content || !data.content.trim())) {
                    Toast.error('URL is required');
                    return false;
                }
                break;
            case 'file':
                if (!data.name || !data.name.trim()) {
                    Toast.error('Name is required');
                    return false;
                }
                break;
        }
        return true;
    },

    /**
     * Collect custom field values
     * @returns {Array}
     */
    collectCustomFields() {
        const fields = [];
        Object.entries(this.customFields).forEach(([fieldId, field]) => {
            const fieldEl = document.getElementById(fieldId);
            const input = fieldEl?.querySelector('.custom-field-input');
            if (input && field) {
                fields.push({
                    type: field.type,
                    label: field.label,
                    value: input.value
                });
            }
        });
        return fields;
    },

    /**
     * Show the page
     */
    show() {
        this.isVisible = true;
        // Lock body scroll when page overlay opens
        document.body.classList.add('popup-open');
        const page = document.getElementById('addEditPage');
        if (page) {
            requestAnimationFrame(() => {
                page.classList.add('active');
            });
        }
    },

    /**
     * Hide the page
     */
    hide() {
        this.isVisible = false;
        this.hasChanges = false;
        this.removeNavigationGuard();

        const page = document.getElementById('addEditPage');
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

    /**
     * Try to close - shows confirmation if there are unsaved changes
     */
    async tryClose() {
        if (this.hasChanges) {
            const shouldDiscard = await Popup.confirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to discard them?',
                confirmText: 'Discard',
                cancelText: 'Keep Editing',
                danger: true
            });

            if (shouldDiscard) {
                this.hide();
            }
        } else {
            this.hide();
        }
    },

    /**
     * Setup change tracking on form inputs
     */
    setupChangeTracking() {
        const form = document.getElementById('itemForm');
        if (!form) return;

        // Track input changes
        form.addEventListener('input', () => {
            this.hasChanges = true;
        });

        // Track select changes
        form.addEventListener('change', () => {
            this.hasChanges = true;
        });
    },

    /**
     * Setup navigation guard to intercept navigation attempts
     */
    setupNavigationGuard() {
        // Remove any existing handler
        this.removeNavigationGuard();

        // Create handler for navigation events
        this.navigationHandler = async (e) => {
            // Don't intercept if page is not visible
            if (!this.isVisible) return;

            // Check if click is outside the edit page content
            const page = document.getElementById('addEditPage');
            const pageContent = page?.querySelector('.page-content');

            if (page && !pageContent?.contains(e.target) && page.contains(e.target)) {
                // Click on backdrop - ignore (don't close on backdrop click)
                return;
            }

            // Check if click is on sidebar nav items or other navigation
            const navItem = e.target.closest('.nav-item, .sidebar-nav-item, .vault-item, .footer-nav-item');
            if (navItem) {
                if (this.hasChanges) {
                    e.preventDefault();
                    e.stopPropagation();

                    const shouldDiscard = await Popup.confirm({
                        title: 'Unsaved Changes',
                        message: 'You have unsaved changes. Are you sure you want to leave?',
                        confirmText: 'Leave',
                        cancelText: 'Stay',
                        danger: true
                    });

                    if (shouldDiscard) {
                        this.hide();
                        // Re-trigger the click after closing
                        setTimeout(() => navItem.click(), 350);
                    }
                } else {
                    // No changes, just close
                    this.hide();
                }
            }
        };

        // Add listener with capture to intercept before other handlers
        document.addEventListener('click', this.navigationHandler, true);
    },

    /**
     * Remove navigation guard
     */
    removeNavigationGuard() {
        if (this.navigationHandler) {
            document.removeEventListener('click', this.navigationHandler, true);
            this.navigationHandler = null;
        }
    },

    /**
     * Upload encrypted file content
     * @param {string} itemId - The file item ID
     * @param {File} file - The file to upload
     */
    async uploadFileContent(itemId, file) {
        if (!file || !itemId) return;

        try {
            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            // Upload via Vault (which handles encryption)
            if (typeof Vault !== 'undefined') {
                await Vault.uploadFile(itemId, arrayBuffer);
            }
        } catch (error) {
            console.error('File upload failed:', error);
            throw new Error('Failed to upload file: ' + (error.message || 'Unknown error'));
        }
    },

    /**
     * Get type label
     * @param {string} type
     * @returns {string}
     */
    getTypeLabel(type) {
        return Utils.getTypeLabel(type);
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AddEditPage;
}
