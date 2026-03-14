/**
 * Password Generator Page Component
 * Dedicated page for generating secure passwords with customizable options
 */

const GeneratorPage = {
    options: {
        length: 16,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        excludeAmbiguous: false,
        excludeChars: '',
        minNumbers: 0,
        minSymbols: 0
    },
    generatedPassword: '',
    callback: null,

    // Slider breakpoints: [sliderValue, lengthValue]
    sliderBreakpoints: [[0, 4], [25, 16], [50, 32], [75, 64], [100, 128]],

    /**
     * Convert slider value (0-100) to length (4-128)
     * Uses piecewise linear interpolation between breakpoints
     */
    sliderToLength(sliderValue) {
        const bp = this.sliderBreakpoints;
        for (let i = 0; i < bp.length - 1; i++) {
            if (sliderValue <= bp[i + 1][0]) {
                const [s1, l1] = bp[i];
                const [s2, l2] = bp[i + 1];
                const t = (sliderValue - s1) / (s2 - s1);
                return Math.round(l1 + t * (l2 - l1));
            }
        }
        return bp[bp.length - 1][1];
    },

    /**
     * Convert length (4-128) to slider value (0-100)
     * Reverse of sliderToLength
     */
    lengthToSlider(length) {
        const bp = this.sliderBreakpoints;
        for (let i = 0; i < bp.length - 1; i++) {
            if (length <= bp[i + 1][1]) {
                const [s1, l1] = bp[i];
                const [s2, l2] = bp[i + 1];
                const t = (length - l1) / (l2 - l1);
                return Math.round(s1 + t * (s2 - s1));
            }
        }
        return bp[bp.length - 1][0];
    },

    /**
     * Set password length and update UI
     */
    setLength(length) {
        this.options.length = length;
        document.getElementById('lengthInput').value = length;
        this.updateLengthHighlight();
        this.generate();
    },

    /**
     * Update length highlight position and scroll to center
     */
    updateLengthHighlight() {
        const highlight = document.getElementById('lengthHighlight');
        const scrollContainer = document.getElementById('lengthChipsScroll');
        if (!highlight || !scrollContainer) return;

        const chips = scrollContainer.querySelectorAll('.length-chip');
        let activeChip = null;

        // Update active class on chips
        chips.forEach(chip => {
            const chipLength = parseInt(chip.dataset.length);
            const isActive = chipLength === this.options.length;
            chip.classList.toggle('active', isActive);
            if (isActive) {
                activeChip = chip;
            }
        });

        if (activeChip) {
            const chipLeft = activeChip.offsetLeft;
            const chipWidth = activeChip.offsetWidth;
            const scrollLeft = scrollContainer.scrollLeft;

            // Fixed highlight width: 32px for 1-digit, 34px for 2-digit numbers
            const length = parseInt(activeChip.dataset.length);
            const highlightWidth = length < 10 ? 32 : 34;

            // Center the highlight on the chip
            const chipCenter = chipLeft + chipWidth / 2;
            const highlightLeft = chipCenter - highlightWidth / 2;

            // Account for 4px padding in the presets container
            const padding = 4;

            // Position highlight relative to visible area (accounting for scroll)
            highlight.style.width = highlightWidth + 'px';
            highlight.style.transform = `translateX(${highlightLeft - scrollLeft + padding - 3}px)`;
            highlight.style.opacity = '1';

            // Scroll to center the active chip
            const containerCenter = scrollContainer.offsetWidth / 2;
            const scrollTarget = chipCenter - containerCenter;
            scrollContainer.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
        } else {
            // Hide highlight when no matching preset
            highlight.style.opacity = '0';
        }
    },

    /**
     * Initialize highlight position after render
     */
    initLengthHighlight() {
        // Multiple attempts to ensure DOM is fully rendered and visible
        requestAnimationFrame(() => {
            this.updateLengthHighlight();
            // Second attempt after a short delay for layout settling
            setTimeout(() => this.updateLengthHighlight(), 100);
        });
    },

    /**
     * Initialize the generator page
     */
    init() {
        this.render();
        this.bindEvents();
        this.generate();
        this.initLengthHighlight();
    },

    /**
     * Render the generator page
     */
    render() {
        const container = document.getElementById('generatorPageContent');
        if (container) {
            container.innerHTML = this.getHTML();
        }
    },

    /**
     * Get page HTML
     * @returns {string}
     */
    getHTML() {
        return `
            <div class="generator-page" id="generatorPage">
                <!-- Password Display with Animated Particles -->
                <div class="generator-hero strength-style-particles" id="generatorHero" data-strength="strong">
                    <div class="password-particles" id="passwordParticles"></div>
                    <div class="password-display" id="generatedPassword">
                        ${Utils.escapeHtml(this.generatedPassword) || 'Generate a password'}
                    </div>
                    <div class="password-feedback" id="passwordFeedback">
                        <svg class="feedback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span class="feedback-text">Copied!</span>
                    </div>
                    <div class="password-hint">
                        <span class="strength-label" id="strengthLabel">Strong</span>
                        <span class="hint-separator">•</span>
                        <span>tap to copy</span>
                        <span class="hint-separator">•</span>
                        <span>hold to refresh</span>
                    </div>
                </div>

                <!-- Generator Options -->
                <div class="generator-options">
                    <!-- Length Selector -->
                    <div class="option-group">
                        <div class="option-header">
                            <span class="option-label">Length</span>
                        </div>
                        <div class="length-selector">
                            <div class="length-presets" id="lengthPresets">
                                <div class="length-highlight" id="lengthHighlight"></div>
                                <div class="length-chips-scroll" id="lengthChipsScroll">
                                    <button class="length-chip" data-length="8">8</button>
                                    <button class="length-chip" data-length="12">12</button>
                                    <button class="length-chip" data-length="16">16</button>
                                    <button class="length-chip" data-length="20">20</button>
                                    <button class="length-chip" data-length="24">24</button>
                                    <button class="length-chip" data-length="32">32</button>
                                    <button class="length-chip" data-length="48">48</button>
                                    <button class="length-chip" data-length="64">64</button>
                                </div>
                            </div>
                            <div class="length-custom">
                                <input type="number" class="length-input" id="lengthInput"
                                       min="4" max="128" value="${this.options.length}"
                                       placeholder="16">
                                <span class="length-input-label">characters</span>
                            </div>
                        </div>
                    </div>

                    <!-- OLD SLIDER - PRESERVED FOR RESTORATION
                    <div class="option-group">
                        <div class="option-header">
                            <span class="option-label">Length</span>
                            <span class="option-value" id="lengthValue">${this.options.length}</span>
                        </div>
                        <div class="slider-container">
                            <input type="range" class="slider" id="lengthSlider"
                                   min="0" max="100" value="${this.lengthToSlider(this.options.length)}">
                            <div class="slider-marks slider-marks-custom">
                                <span style="left: 1.75%">4</span>
                                <span style="left: 25.75%">16</span>
                                <span style="left: 50%">32</span>
                                <span style="left: 74.25%">64</span>
                                <span style="left: 98.5%">128</span>
                            </div>
                        </div>
                    </div>
                    END OLD SLIDER -->

                    <!-- Character Types -->
                    <div class="option-group">
                        <span class="option-label">Character Types</span>

                        <label class="toggle-option">
                            <span class="toggle-label">
                                <span class="toggle-text">Uppercase (A-Z)</span>
                                <span class="toggle-chars">ABCDEFGHIJKLMNOPQRSTUVWXYZ</span>
                            </span>
                            <input type="checkbox" id="optUppercase" ${this.options.uppercase ? 'checked' : ''}>
                            <span class="toggle-switch"></span>
                        </label>

                        <label class="toggle-option">
                            <span class="toggle-label">
                                <span class="toggle-text">Lowercase (a-z)</span>
                                <span class="toggle-chars">abcdefghijklmnopqrstuvwxyz</span>
                            </span>
                            <input type="checkbox" id="optLowercase" ${this.options.lowercase ? 'checked' : ''}>
                            <span class="toggle-switch"></span>
                        </label>

                        <label class="toggle-option">
                            <span class="toggle-label">
                                <span class="toggle-text">Numbers (0-9)</span>
                                <span class="toggle-chars">0123456789</span>
                            </span>
                            <input type="checkbox" id="optNumbers" ${this.options.numbers ? 'checked' : ''}>
                            <span class="toggle-switch"></span>
                        </label>

                        <label class="toggle-option">
                            <span class="toggle-label">
                                <span class="toggle-text">Symbols</span>
                                <span class="toggle-chars">!@#$%^&*()_+-=[]{}|;:,.<>?</span>
                            </span>
                            <input type="checkbox" id="optSymbols" ${this.options.symbols ? 'checked' : ''}>
                            <span class="toggle-switch"></span>
                        </label>
                    </div>

                    <!-- Advanced Options -->
                    <div class="option-group">
                        <button class="collapsible-header" id="advancedToggle">
                            <span>Advanced Options</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div class="collapsible-content" id="advancedContent" style="display: none;">
                            <label class="toggle-option">
                                <span class="toggle-label">
                                    <span class="toggle-text">Exclude Ambiguous</span>
                                    <span class="toggle-chars">0 O l 1 I</span>
                                </span>
                                <input type="checkbox" id="optExcludeAmbiguous" ${this.options.excludeAmbiguous ? 'checked' : ''}>
                                <span class="toggle-switch"></span>
                            </label>

                            <div class="form-group">
                                <label class="form-label" for="excludeChars">Exclude Characters</label>
                                <input type="text" class="form-input" id="excludeChars"
                                       value="${Utils.escapeHtml(this.options.excludeChars)}"
                                       placeholder="Characters to exclude"
                                       autocomplete="off">
                            </div>

                            <div class="form-row-2">
                                <div class="form-group">
                                    <label class="form-label" for="minNumbers">Min Numbers</label>
                                    <input type="number" class="form-input" id="minNumbers"
                                           min="0" max="20" value="${this.options.minNumbers}"
                                           autocomplete="off">
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="minSymbols">Min Symbols</label>
                                    <input type="number" class="form-input" id="minSymbols"
                                           min="0" max="20" value="${this.options.minSymbols}"
                                           autocomplete="off">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Use Password Button (when opened from callback) -->
                <div class="generator-footer" id="generatorFooter" style="display: none;">
                    <button class="btn btn-primary btn-lg btn-block" id="usePassword">
                        Use This Password
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Password display interactions
        this.bindPasswordInteractions();

        // Length preset chips
        document.getElementById('lengthPresets')?.addEventListener('click', (e) => {
            const chip = e.target.closest('.length-chip');
            if (!chip) return;

            const length = parseInt(chip.dataset.length);
            this.setLength(length);
        });

        // Update highlight position when scroll container scrolls (for manual scrolling)
        document.getElementById('lengthChipsScroll')?.addEventListener('scroll', () => {
            // Reposition highlight to follow scroll
            const highlight = document.getElementById('lengthHighlight');
            const scrollContainer = document.getElementById('lengthChipsScroll');
            const activeChip = scrollContainer?.querySelector('.length-chip.active');

            if (highlight && scrollContainer && activeChip) {
                const chipLeft = activeChip.offsetLeft;
                const chipWidth = activeChip.offsetWidth;
                const scrollLeft = scrollContainer.scrollLeft;
                const padding = 4;

                // Fixed highlight width: 32px for 1-digit, 34px for 2-digit numbers
                const length = parseInt(activeChip.dataset.length);
                const highlightWidth = length < 10 ? 32 : 34;

                // Center the highlight on the chip
                const chipCenter = chipLeft + chipWidth / 2;
                const highlightLeft = chipCenter - highlightWidth / 2;

                highlight.style.width = highlightWidth + 'px';
                highlight.style.transform = `translateX(${highlightLeft - scrollLeft + padding - 4}px)`;
            }
        });

        // Length custom input
        document.getElementById('lengthInput')?.addEventListener('input', (e) => {
            let length = parseInt(e.target.value) || 4;
            length = Math.max(4, Math.min(128, length));
            // Update input if value was capped
            if (parseInt(e.target.value) > 128) {
                e.target.value = 128;
            }
            this.options.length = length;
            this.updateLengthHighlight();
            this.generate();
        });

        document.getElementById('lengthInput')?.addEventListener('blur', (e) => {
            // Ensure valid value on blur
            let length = parseInt(e.target.value) || 16;
            length = Math.max(4, Math.min(128, length));
            e.target.value = length;
            this.options.length = length;
            this.generate();
        });

        // Character type toggles
        document.getElementById('optUppercase')?.addEventListener('change', (e) => {
            this.options.uppercase = e.target.checked;
            this.validateOptions();
            this.generate();
        });

        document.getElementById('optLowercase')?.addEventListener('change', (e) => {
            this.options.lowercase = e.target.checked;
            this.validateOptions();
            this.generate();
        });

        document.getElementById('optNumbers')?.addEventListener('change', (e) => {
            this.options.numbers = e.target.checked;
            this.validateOptions();
            this.generate();
        });

        document.getElementById('optSymbols')?.addEventListener('change', (e) => {
            this.options.symbols = e.target.checked;
            this.validateOptions();
            this.generate();
        });

        // Advanced options toggle
        document.getElementById('advancedToggle')?.addEventListener('click', () => {
            const content = document.getElementById('advancedContent');
            const toggle = document.getElementById('advancedToggle');
            if (content && toggle) {
                const isOpen = content.style.display !== 'none';
                content.style.display = isOpen ? 'none' : 'block';
                toggle.classList.toggle('open', !isOpen);
            }
        });

        // Advanced options
        document.getElementById('optExcludeAmbiguous')?.addEventListener('change', (e) => {
            this.options.excludeAmbiguous = e.target.checked;
            this.generate();
        });

        document.getElementById('excludeChars')?.addEventListener('input', (e) => {
            this.options.excludeChars = e.target.value;
            this.generate();
        });

        document.getElementById('minNumbers')?.addEventListener('input', (e) => {
            this.options.minNumbers = Math.max(0, parseInt(e.target.value) || 0);
            this.generate();
        });

        document.getElementById('minSymbols')?.addEventListener('input', (e) => {
            this.options.minSymbols = Math.max(0, parseInt(e.target.value) || 0);
            this.generate();
        });

        // Use password button
        document.getElementById('usePassword')?.addEventListener('click', () => {
            this.usePassword();
        });

        // Listen for generator open events with callback
        window.addEventListener('opengenerator', (e) => {
            if (e.detail?.callback) {
                this.callback = e.detail.callback;
                this.showWithCallback();
            }
        });

        // Update highlight on resize (chip widths may change)
        window.addEventListener('resize', () => {
            requestAnimationFrame(() => this.updateLengthHighlight());
        });
    },

    /**
     * Bind password display interactions (tap to copy, hold to refresh)
     */
    bindPasswordInteractions() {
        const hero = document.getElementById('generatorHero');
        if (!hero) return;

        let pressTimer = null;
        let isLongPress = false;
        let isTouchActive = false;

        // Start long press detection
        const handleStart = () => {
            // Clear any existing timer first
            if (pressTimer) {
                clearTimeout(pressTimer);
            }

            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                this.regenerateWithAnimation();
            }, 500); // 500ms for long press
        };

        // End interaction - if not long press, copy
        const handleEnd = () => {
            clearTimeout(pressTimer);
            pressTimer = null;
            if (!isLongPress && this.generatedPassword) {
                this.copyWithFeedback();
            }
        };

        // Cancel on move (prevents accidental triggers while scrolling)
        const handleCancel = () => {
            clearTimeout(pressTimer);
            pressTimer = null;
        };

        // Touch events (primary on touch devices)
        hero.addEventListener('touchstart', (e) => {
            isTouchActive = true;
            handleStart();
        }, { passive: true });

        hero.addEventListener('touchend', (e) => {
            handleEnd();
            // Keep isTouchActive true briefly to block synthetic mouse events
            setTimeout(() => { isTouchActive = false; }, 100);
        });

        hero.addEventListener('touchmove', handleCancel, { passive: true });
        hero.addEventListener('touchcancel', handleCancel, { passive: true });

        // Mouse events (blocked during touch interactions)
        hero.addEventListener('mousedown', (e) => {
            if (isTouchActive) return;
            handleStart();
        });

        hero.addEventListener('mouseup', (e) => {
            if (isTouchActive) return;
            handleEnd();
        });

        hero.addEventListener('mouseleave', handleCancel);

        // Prevent text selection on the password
        hero.addEventListener('selectstart', (e) => e.preventDefault());
    },

    /**
     * Copy with visual feedback (auto-clears after 30 seconds)
     */
    async copyWithFeedback() {
        if (!this.generatedPassword) return;

        const success = await Clipboard.copy(this.generatedPassword, true);

        if (success) {
            // Show feedback
            const hero = document.getElementById('generatorHero');
            const feedback = document.getElementById('passwordFeedback');

            hero?.classList.add('copied');
            feedback?.classList.add('show');

            // Hide after animation
            setTimeout(() => {
                hero?.classList.remove('copied');
                feedback?.classList.remove('show');
            }, 1200);
        } else {
            Toast.error('Failed to copy');
        }
    },

    /**
     * Regenerate with jump animation
     */
    regenerateWithAnimation() {
        const display = document.getElementById('generatedPassword');

        // Old password jumps up and fades out
        display?.classList.add('shuffling');

        // Generate new password after old one is gone (200ms animation)
        setTimeout(() => {
            display?.classList.remove('shuffling');
            this.generate();
        }, 200);
    },

    /**
     * Validate options (at least one character type must be selected)
     */
    validateOptions() {
        const anySelected = this.options.uppercase || this.options.lowercase ||
                           this.options.numbers || this.options.symbols;

        if (!anySelected) {
            // Re-enable lowercase as default
            this.options.lowercase = true;
            document.getElementById('optLowercase').checked = true;
            Toast.warning('At least one character type must be selected');
        }
    },

    /**
     * Generate password
     */
    generate() {
        if (typeof PasswordGenerator !== 'undefined') {
            this.generatedPassword = PasswordGenerator.generate(this.options);
        } else {
            this.generatedPassword = this.fallbackGenerate();
        }

        this.updateDisplay();
        this.updateStrength();

        // Update highlight when generating (page might have just become visible)
        requestAnimationFrame(() => this.updateLengthHighlight());
    },

    /**
     * Fallback password generator
     * @returns {string}
     */
    fallbackGenerate() {
        let chars = '';
        if (this.options.uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (this.options.lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
        if (this.options.numbers) chars += '0123456789';
        if (this.options.symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

        if (this.options.excludeAmbiguous) {
            chars = chars.replace(/[0OlI1]/g, '');
        }

        if (this.options.excludeChars) {
            for (const c of this.options.excludeChars) {
                chars = chars.replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
            }
        }

        if (!chars) return '';

        const array = new Uint32Array(this.options.length);
        crypto.getRandomValues(array);

        return Array.from(array, num => chars[num % chars.length]).join('');
    },

    /**
     * Update password display with smooth height transition
     */
    updateDisplay() {
        const hero = document.getElementById('generatorHero');
        const display = document.getElementById('generatedPassword');
        if (!display) return;

        // Capture current height before content change
        const oldHeight = hero ? hero.offsetHeight : 0;

        // Update content
        let html = '';
        let i = 0;
        for (const char of this.generatedPassword) {
            let className = 'char-lower';
            if (/[A-Z]/.test(char)) className = 'char-upper';
            else if (/[0-9]/.test(char)) className = 'char-number';
            else if (/[^a-zA-Z0-9]/.test(char)) className = 'char-symbol';

            html += `<span class="char ${className}" style="--char-index: ${i}">${Utils.escapeHtml(char)}</span>`;
            i++;
        }
        display.innerHTML = html || '<span class="placeholder">Generate a password</span>';

        // Smooth height transition
        if (hero && oldHeight > 0) {
            const newHeight = hero.scrollHeight;
            if (oldHeight !== newHeight) {
                hero.style.height = oldHeight + 'px';
                hero.style.overflow = 'hidden';
                requestAnimationFrame(() => {
                    hero.style.transition = 'height 0.3s ease';
                    hero.style.height = newHeight + 'px';
                    setTimeout(() => {
                        hero.style.height = '';
                        hero.style.overflow = '';
                        hero.style.transition = '';
                    }, 300);
                });
            }
        }

        // Particles disabled - see generateParticles() method to re-enable
        // this.generateParticles();
    },

    /**
     * Generate floating particles for strength visualization
     */
    generateParticles() {
        const container = document.getElementById('passwordParticles');
        if (!container) return;

        // Number of particles based on strength
        const particleCount = 20;
        let html = '';
        for (let i = 0; i < particleCount; i++) {
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const delay = Math.random() * 3;
            const duration = 2 + Math.random() * 2;
            const size = 3 + Math.random() * 4;
            html += `<div class="particle" style="left:${x}%;top:${y}%;--delay:${delay}s;--duration:${duration}s;--size:${size}px"></div>`;
        }
        container.innerHTML = html;
    },

    /**
     * Update strength indicator
     */
    updateStrength() {
        // Use global password score function
        const strengthInfo = typeof SecurityAnalyzer !== 'undefined'
            ? SecurityAnalyzer.getStrengthLevel(this.generatedPassword)
            : this.fallbackStrength();

        const hero = document.getElementById('generatorHero');
        if (hero) {
            hero.dataset.strength = strengthInfo.level;
        }

        // Update strength label
        const label = document.getElementById('strengthLabel');
        if (label) {
            label.textContent = strengthInfo.label;
            label.className = 'strength-label strength-' + strengthInfo.level;
        }
    },

    /**
     * Fallback strength calculation if SecurityAnalyzer is not available
     */
    fallbackStrength() {
        let charsetSize = 0;
        if (this.options.uppercase) charsetSize += 26;
        if (this.options.lowercase) charsetSize += 26;
        if (this.options.numbers) charsetSize += 10;
        if (this.options.symbols) charsetSize += 32;

        const entropy = Math.floor(this.options.length * Math.log2(charsetSize || 1));

        if (entropy >= 128) return { score: 10, level: 'very-strong', label: 'Very Strong' };
        if (entropy >= 80) return { score: 8, level: 'strong', label: 'Strong' };
        if (entropy >= 60) return { score: 6, level: 'good', label: 'Good' };
        if (entropy >= 40) return { score: 4, level: 'fair', label: 'Fair' };
        return { score: 2, level: 'weak', label: 'Weak' };
    },

    /**
     * Copy password to clipboard (legacy method, now using copyWithFeedback)
     */
    async copyToClipboard() {
        await this.copyWithFeedback();
    },

    /**
     * Show generator with callback (from add/edit page)
     */
    showWithCallback() {
        // Show use password button
        const footer = document.getElementById('generatorFooter');
        if (footer) {
            footer.style.display = 'block';
        }

        // Switch to generator page
        if (typeof App !== 'undefined') {
            App.showView('generator');
        }

        // Generate fresh password
        this.generate();
    },

    /**
     * Use the generated password (call callback and close)
     */
    usePassword() {
        if (this.callback && this.generatedPassword) {
            this.callback(this.generatedPassword);
            this.callback = null;

            // Hide use password button
            const footer = document.getElementById('generatorFooter');
            if (footer) {
                footer.style.display = 'none';
            }

            // Go back to previous view
            history.back();
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeneratorPage;
}
