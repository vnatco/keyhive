/**
 * Custom Select Component
 * Centralized initialization for custom dropdown selects
 */

const CustomSelect = {
    /**
     * Initialize custom selects within a container
     * @param {HTMLElement|string} container - Container element or selector (default: document)
     * @param {Function} onChange - Callback when selection changes (selectId, value) => void
     */
    init(container = document, onChange = null) {
        const root = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!root) return;

        const customSelects = root.querySelectorAll('.custom-select');

        customSelects.forEach(select => {
            // Skip if already initialized
            if (select._customSelectInit) return;
            select._customSelectInit = true;

            const trigger = select.querySelector('.custom-select-trigger');
            const options = select.querySelectorAll('.custom-select-option');
            const valueDisplay = select.querySelector('.custom-select-value');

            // Toggle dropdown on trigger click
            trigger?.addEventListener('click', (e) => {
                e.stopPropagation();

                // Close all other dropdowns in this container
                customSelects.forEach(s => {
                    if (s !== select) s.classList.remove('open');
                });

                select.classList.toggle('open');
            });

            // Handle option selection
            options.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();

                    const value = option.dataset.value;
                    const text = option.textContent;

                    // Update active state
                    options.forEach(o => o.classList.remove('active'));
                    option.classList.add('active');

                    // Update display and data value
                    if (valueDisplay) {
                        valueDisplay.textContent = text;
                    }
                    select.dataset.value = value;

                    // Close dropdown
                    select.classList.remove('open');

                    // Trigger change callback
                    if (typeof onChange === 'function') {
                        onChange(select.id, value);
                    }
                });
            });
        });

        // Close dropdowns when clicking outside (only add once per container)
        if (!root._customSelectClickHandler) {
            root._customSelectClickHandler = () => {
                customSelects.forEach(s => s.classList.remove('open'));
            };

            // For document, add to document; for other containers, add to container
            if (root === document) {
                document.addEventListener('click', root._customSelectClickHandler);
            } else {
                // Also close on document click for popups
                document.addEventListener('click', root._customSelectClickHandler);
            }
        }
    },

    /**
     * Set value programmatically
     * @param {HTMLElement|string} select - Select element or selector
     * @param {string} value - Value to set
     */
    setValue(select, value) {
        const el = typeof select === 'string' ? document.querySelector(select) : select;
        if (!el) return;

        const option = el.querySelector(`.custom-select-option[data-value="${value}"]`);
        if (option) {
            el.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');

            const valueDisplay = el.querySelector('.custom-select-value');
            if (valueDisplay) {
                valueDisplay.textContent = option.textContent;
            }
            el.dataset.value = value;
        }
    },

    /**
     * Get current value
     * @param {HTMLElement|string} select - Select element or selector
     * @returns {string} Current value
     */
    getValue(select) {
        const el = typeof select === 'string' ? document.querySelector(select) : select;
        return el?.dataset.value || '';
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.CustomSelect = CustomSelect;
}
