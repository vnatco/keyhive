/**
 * Dynamic Popup Utility
 * Reusable popup system for alerts, confirms, and prompts
 */

const Popup = {
    /**
     * Show an alert popup (single button)
     * @param {Object} options
     * @param {string} options.title - Popup title
     * @param {string} options.message - Popup message
     * @param {string} options.buttonText - Button text (default: "OK")
     * @param {string} options.buttonClass - Button class (default: "btn-primary")
     * @param {boolean} options.compact - If true, popup won't go fullscreen on mobile (default: true for alerts)
     * @returns {Promise<void>}
     */
    alert(options) {
        return this.show({
            title: options.title || 'Alert',
            message: options.message || '',
            compact: options.compact !== false, // Default to compact for alerts
            popupClass: options.popupClass || null,
            buttons: [
                {
                    text: options.buttonText || 'OK',
                    class: options.buttonClass || 'btn-primary',
                    value: true
                }
            ]
        });
    },

    /**
     * Show a confirm popup (two buttons)
     * @param {Object} options
     * @param {string} options.title - Popup title
     * @param {string} options.message - Popup message
     * @param {string} options.confirmText - Confirm button text (default: "Confirm")
     * @param {string} options.cancelText - Cancel button text (default: "Cancel")
     * @param {string} options.confirmClass - Confirm button class (default: "btn-primary")
     * @param {string} options.cancelClass - Cancel button class (default: "btn-secondary")
     * @param {boolean} options.danger - If true, confirm button is red
     * @param {boolean} options.compact - If true, popup won't go fullscreen on mobile (default: true for confirms)
     * @returns {Promise<boolean>}
     */
    confirm(options) {
        const confirmClass = options.danger ? 'btn-danger' : (options.confirmClass || 'btn-primary');

        return this.show({
            title: options.title || 'Confirm',
            message: options.message || '',
            compact: options.compact !== false, // Default to compact for confirms
            popupClass: options.popupClass || null,
            buttons: [
                {
                    text: options.cancelText || 'Cancel',
                    class: options.cancelClass || 'btn-secondary',
                    value: false
                },
                {
                    text: options.confirmText || 'Confirm',
                    class: confirmClass,
                    value: true
                }
            ]
        });
    },

    /**
     * Show a confirm popup with a required checkbox
     * @param {Object} options
     * @param {string} options.title - Popup title
     * @param {string} options.message - Popup message (supports HTML)
     * @param {string} options.checkboxLabel - Checkbox label text
     * @param {string} options.confirmText - Confirm button text (default: "Confirm")
     * @param {string} options.cancelText - Cancel button text (default: "Cancel")
     * @param {boolean} options.danger - If true, confirm button is red
     * @param {boolean} options.compact - If true, popup won't go fullscreen on mobile
     * @returns {Promise<boolean>}
     */
    confirmWithCheckbox(options) {
        return new Promise((resolve) => {
            document.body.classList.add('popup-open');

            const popup = document.createElement('div');
            popup.className = 'popup-overlay';
            if (options.compact !== false) {
                popup.classList.add('popup-compact');
            }

            const confirmClass = options.danger ? 'btn-danger' : 'btn-primary';

            popup.innerHTML = `
                <div class="popup">
                    <div class="popup-header">
                        <h3 class="popup-title">${Utils.escapeHtml(options.title || '')}</h3>
                        <button class="popup-close" id="popupClose">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="popup-body">
                        <div class="popup-message-html">${options.message || ''}</div>
                        <label class="custom-checkbox popup-checkbox">
                            <input type="checkbox" id="popupCheckbox">
                            <span class="checkmark"></span>
                            <span class="checkbox-text">${Utils.escapeHtml(options.checkboxLabel || 'I understand')}</span>
                        </label>
                    </div>
                    <div class="popup-footer">
                        <button class="btn btn-secondary" id="popupCancel">
                            ${Utils.escapeHtml(options.cancelText || 'Cancel')}
                        </button>
                        <button class="btn ${confirmClass}" id="popupConfirm" disabled>
                            ${Utils.escapeHtml(options.confirmText || 'Confirm')}
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(popup);
            requestAnimationFrame(() => popup.classList.add('active'));

            const checkbox = popup.querySelector('#popupCheckbox');
            const confirmBtn = popup.querySelector('#popupConfirm');

            // Enable/disable confirm button based on checkbox
            checkbox.addEventListener('change', () => {
                confirmBtn.disabled = !checkbox.checked;
            });

            const close = (value) => {
                popup.classList.remove('active');
                setTimeout(() => {
                    popup.remove();
                    if (!document.querySelector('.popup-overlay.active')) {
                        document.body.classList.remove('popup-open');
                    }
                }, 300);
                resolve(value);
            };

            popup.querySelector('#popupClose').addEventListener('click', () => close(false));
            popup.querySelector('#popupCancel').addEventListener('click', () => close(false));
            confirmBtn.addEventListener('click', () => {
                if (checkbox.checked) {
                    close(true);
                }
            });

            popup.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    close(false);
                }
            });
        });
    },

    /**
     * Show a prompt popup (input field + buttons)
     * @param {Object} options
     * @param {string} options.title - Popup title
     * @param {string} options.message - Popup message (optional)
     * @param {string} options.label - Input label
     * @param {string} options.placeholder - Input placeholder
     * @param {string} options.value - Initial input value
     * @param {string} options.type - Input type (default: "text")
     * @param {string} options.confirmText - Confirm button text (default: "OK")
     * @param {string} options.cancelText - Cancel button text (default: "Cancel")
     * @param {boolean} options.compact - If true, popup won't go fullscreen on mobile (default: true for prompts)
     * @returns {Promise<string|null>} - Returns input value or null if cancelled
     */
    prompt(options) {
        return this.show({
            title: options.title || 'Input',
            message: options.message || '',
            compact: options.compact !== false, // Default to compact for prompts
            input: {
                label: options.label || '',
                placeholder: options.placeholder || '',
                value: options.value || '',
                type: options.type || 'text'
            },
            buttons: [
                {
                    text: options.cancelText || 'Cancel',
                    class: 'btn-secondary',
                    value: null,
                    cancel: true
                },
                {
                    text: options.confirmText || 'OK',
                    class: 'btn-primary',
                    value: 'input',
                    submit: true
                }
            ]
        });
    },

    /**
     * Show a custom popup
     * @param {Object} options
     * @param {string} options.title - Popup title
     * @param {string} options.message - Popup message (supports HTML)
     * @param {Object} options.input - Input field config (optional)
     * @param {Array} options.buttons - Array of button configs
     * @param {boolean} options.compact - If true, popup won't go fullscreen on mobile
     * @param {string} options.popupClass - Additional class for the popup element
     * @returns {Promise<any>} - Returns the clicked button's value
     */
    show(options) {
        return new Promise((resolve) => {
            // Lock body scroll when popup opens
            document.body.classList.add('popup-open');

            // Create popup HTML
            const popup = document.createElement('div');
            popup.className = 'popup-overlay';
            if (options.compact) {
                popup.classList.add('popup-compact');
            }

            let inputHTML = '';
            if (options.input) {
                inputHTML = `
                    <div class="form-group">
                        ${options.input.label ? `<label class="form-label">${Utils.escapeHtml(options.input.label)}</label>` : ''}
                        <input type="${options.input.type || 'text'}"
                               class="form-input"
                               id="popupInput"
                               placeholder="${Utils.escapeHtml(options.input.placeholder || '')}"
                               value="${Utils.escapeHtml(options.input.value || '')}"
                               autocomplete="off">
                    </div>
                `;
            }

            const buttonsHTML = (options.buttons || []).map((btn, index) => `
                <button class="btn ${btn.class || 'btn-secondary'}"
                        data-popup-btn="${index}"
                        ${btn.submit ? 'data-submit="true"' : ''}
                        ${btn.cancel ? 'data-cancel="true"' : ''}>
                    ${Utils.escapeHtml(btn.text)}
                </button>
            `).join('');

            const popupClasses = ['popup', options.popupClass].filter(Boolean).join(' ');
            popup.innerHTML = `
                <div class="${popupClasses}">
                    <div class="popup-header">
                        <h3 class="popup-title">${Utils.escapeHtml(options.title || '')}</h3>
                        <button class="popup-close" id="popupClose">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    ${options.message || inputHTML ? `
                        <div class="popup-body">
                            ${options.message ? `<p class="popup-message">${Utils.escapeHtml(options.message)}</p>` : ''}
                            ${inputHTML}
                        </div>
                    ` : ''}
                    ${buttonsHTML ? `
                        <div class="popup-footer">
                            ${buttonsHTML}
                        </div>
                    ` : ''}
                </div>
            `;

            document.body.appendChild(popup);
            requestAnimationFrame(() => popup.classList.add('active'));

            // Focus input if present
            const input = popup.querySelector('#popupInput');
            if (input) {
                input.focus();
                input.select();
            }

            // Close function
            const close = (value) => {
                popup.classList.remove('active');
                setTimeout(() => {
                    popup.remove();
                    // Unlock body scroll if no other popups are open
                    if (!document.querySelector('.popup-overlay.active')) {
                        document.body.classList.remove('popup-open');
                    }
                }, 300);
                resolve(value);
            };

            // Close button
            popup.querySelector('#popupClose')?.addEventListener('click', () => {
                // Find cancel button value or return null/false
                const cancelBtn = options.buttons?.find(b => b.cancel);
                close(cancelBtn ? cancelBtn.value : (options.buttons?.length === 1 ? options.buttons[0].value : false));
            });

            // Button clicks
            popup.querySelectorAll('[data-popup-btn]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.dataset.popupBtn);
                    const buttonConfig = options.buttons[index];

                    let value = buttonConfig.value;

                    // If value is 'input', return the input value
                    if (value === 'input' && input) {
                        value = input.value;
                    }

                    close(value);
                });
            });

            // Enter key submits, Escape cancels
            popup.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const submitBtn = options.buttons?.find(b => b.submit);
                    if (submitBtn) {
                        let value = submitBtn.value;
                        if (value === 'input' && input) {
                            value = input.value;
                        }
                        close(value);
                    }
                } else if (e.key === 'Escape') {
                    const cancelBtn = options.buttons?.find(b => b.cancel);
                    close(cancelBtn ? cancelBtn.value : (options.buttons?.length === 1 ? options.buttons[0].value : false));
                }
            });
        });
    },

    /**
     * Open a popup with full control API
     * @param {Object} options
     * @param {string} options.title - Popup title
     * @param {string} options.body - Popup body HTML content
     * @param {boolean} options.closable - Can be closed via X button (default: true)
     * @param {boolean} options.closeOnEscape - Close on Escape key (default: true)
     * @param {boolean} options.closeOnOutsideClick - Close on overlay click (default: false)
     * @param {boolean} options.compact - Smaller on mobile (default: true)
     * @param {Array} options.buttons - Button configs: { text, type, isCancel, onClick, disabled, id }
     * @param {boolean} options.focusFirst - Focus first input on open (default: true)
     * @param {string} options.focusSelector - Specific selector to focus
     * @param {Function} options.onOpen - Called after popup opens with API
     * @param {Function} options.onClose - Called when popup closes
     * @returns {Object} Popup control API
     */
    open(options) {
        let closable = options.closable !== false;
        const closeOnEscape = options.closeOnEscape !== false;
        const closeOnOutsideClick = options.closeOnOutsideClick === true; // Default: false
        const compact = options.compact !== false;
        const focusFirst = options.focusFirst !== false;

        // State
        let closed = false;

        // Lock body scroll
        document.body.classList.add('popup-open');

        // Create popup element
        const popupOverlay = document.createElement('div');
        popupOverlay.className = 'popup-overlay';
        if (compact) {
            popupOverlay.classList.add('popup-compact');
        }

        // Build buttons HTML
        const buttonsHTML = (options.buttons || []).map((btn) => {
            const btnClass = btn.type === 'danger' ? 'btn-danger' :
                            btn.type === 'primary' ? 'btn-primary' : 'btn-secondary';
            const disabledAttr = btn.disabled ? 'disabled' : '';
            const idAttr = btn.id ? `id="${btn.id}"` : '';
            const cancelAttr = btn.isCancel ? 'data-cancel="true"' : '';

            return `
                <button class="btn ${btnClass}" ${idAttr} ${cancelAttr} ${disabledAttr}>
                    <span class="btn-text">${Utils.escapeHtml(btn.text)}</span>
                    <span class="btn-loading" style="display: none;">
                        <span class="spinner-inline"></span>
                    </span>
                </button>
            `;
        }).join('');

        // Build popup HTML
        const popupClasses = ['popup', options.popupClass].filter(Boolean).join(' ');
        popupOverlay.innerHTML = `
            <div class="${popupClasses}">
                <div class="popup-header">
                    <h3 class="popup-title">${Utils.escapeHtml(options.title || '')}</h3>
                    <button class="popup-close ${!closable ? 'disabled' : ''}" id="popupCloseBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                ${options.body ? `<div class="popup-body">${options.body}</div>` : ''}
                ${buttonsHTML ? `<div class="popup-footer">${buttonsHTML}</div>` : ''}
            </div>
        `;

        document.body.appendChild(popupOverlay);
        requestAnimationFrame(() => popupOverlay.classList.add('active'));

        // Focus after popup becomes visible (needs delay for CSS transition)
        if (focusFirst || options.focusSelector) {
            setTimeout(() => {
                const focusTarget = options.focusSelector
                    ? popupOverlay.querySelector(options.focusSelector)
                    : popupOverlay.querySelector('input, textarea, select, button:not(.popup-close)');
                if (focusTarget) {
                    focusTarget.focus();
                    if (focusTarget.select) focusTarget.select();
                }
            }, 50);
        }

        // Close function
        const close = () => {
            if (closed) return;
            if (!closable) return;
            forceClose();
        };

        const forceClose = () => {
            if (closed) return;
            closed = true;

            popupOverlay.classList.remove('active');
            setTimeout(() => {
                popupOverlay.remove();
                if (!document.querySelector('.popup-overlay.active')) {
                    document.body.classList.remove('popup-open');
                }
            }, 300);

            if (options.onClose) {
                options.onClose();
            }
        };

        // X button
        const closeBtn = popupOverlay.querySelector('#popupCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', close);
        }

        // Click outside
        if (closeOnOutsideClick) {
            popupOverlay.addEventListener('click', (e) => {
                if (e.target === popupOverlay) {
                    close();
                }
            });
        }

        // Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape' && closeOnEscape) {
                close();
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Clean up escape handler when popup closes
        const originalForceClose = forceClose;
        const wrappedForceClose = () => {
            document.removeEventListener('keydown', escapeHandler);
            originalForceClose();
        };

        // Button click handlers
        const buttons = options.buttons || [];
        buttons.forEach((btnConfig, index) => {
            // Find button by id or by index in footer
            let btn;
            if (btnConfig.id) {
                btn = popupOverlay.querySelector(`#${btnConfig.id}`);
            } else {
                // For buttons without id, find by index
                const footerBtns = popupOverlay.querySelectorAll('.popup-footer .btn');
                btn = footerBtns[index];
            }
            if (!btn) return;

            btn.addEventListener('click', async () => {
                if (btn.disabled) return;

                if (btnConfig.isCancel) {
                    close();
                    return;
                }

                if (btnConfig.onClick) {
                    // Lock popup during async onClick
                    const textEl = btn.querySelector('.btn-text');
                    const loadingEl = btn.querySelector('.btn-loading');
                    const wasClosable = closable;

                    btn.disabled = true;
                    if (textEl) textEl.style.display = 'none';
                    if (loadingEl) loadingEl.style.display = 'inline-flex';
                    closable = false;
                    const closeBtn = popupOverlay.querySelector('#popupCloseBtn');
                    if (closeBtn) closeBtn.classList.add('disabled');

                    // Disable other footer buttons, remember which were already disabled
                    const allFooterBtns = popupOverlay.querySelectorAll('.popup-footer .btn');
                    const prevDisabled = new Set();
                    allFooterBtns.forEach(b => {
                        if (b !== btn) {
                            if (b.disabled) prevDisabled.add(b);
                            b.disabled = true;
                        }
                    });

                    const restore = () => {
                        btn.disabled = false;
                        if (textEl) textEl.style.display = '';
                        if (loadingEl) loadingEl.style.display = 'none';
                        closable = wasClosable;
                        if (closeBtn) closeBtn.classList.toggle('disabled', !closable);
                        allFooterBtns.forEach(b => {
                            if (b !== btn && !prevDisabled.has(b)) b.disabled = false;
                        });
                    };

                    let result;
                    try {
                        result = await btnConfig.onClick();
                    } catch (e) {
                        restore();
                        return;
                    }

                    if (result === false) {
                        restore();
                        return;
                    }
                }

                // Close popup after successful onClick (or if no onClick)
                forceClose();
            });
        });

        // API object
        const api = {
            close: close,
            forceClose: wrappedForceClose,

            setButtonDisabled(id, disabled) {
                const btn = popupOverlay.querySelector(`#${id}`);
                if (btn) btn.disabled = disabled;
            },

            setButtonText(id, text) {
                const btn = popupOverlay.querySelector(`#${id}`);
                const textEl = btn?.querySelector('.btn-text');
                if (textEl) textEl.textContent = text;
            },

            setButtonLoading(id, loading) {
                const btn = popupOverlay.querySelector(`#${id}`);
                if (!btn) return;
                const textEl = btn.querySelector('.btn-text');
                const loadingEl = btn.querySelector('.btn-loading');
                if (textEl) textEl.style.display = loading ? 'none' : '';
                if (loadingEl) loadingEl.style.display = loading ? 'inline-flex' : 'none';
                btn.disabled = loading;
            },

            setBody(html) {
                const body = popupOverlay.querySelector('.popup-body');
                if (body) body.innerHTML = html;
            },

            setTitle(text) {
                const title = popupOverlay.querySelector('.popup-title');
                if (title) title.textContent = text;
            },

            getElement() {
                return popupOverlay;
            },

            querySelector(selector) {
                return popupOverlay.querySelector(selector);
            },

            isClosed() {
                return closed;
            },

            setClosable(value) {
                closable = value;
                const closeBtn = popupOverlay.querySelector('#popupCloseBtn');
                if (closeBtn) closeBtn.classList.toggle('disabled', !value);
            }
        };

        // onOpen callback
        if (options.onOpen) {
            options.onOpen(api);
        }

        return api;
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Popup;
}
