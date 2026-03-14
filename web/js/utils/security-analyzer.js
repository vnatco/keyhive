/**
 * Security Analyzer
 * Analyzes password strength with scoring from 1-10
 */

const SecurityAnalyzer = {
    /**
     * Get password score from 1 to 10
     * This is the global function to be used throughout the app
     * @param {string} password
     * @returns {number} Score from 1 to 10
     */
    getScore(password) {
        if (!password) return 1;

        const details = {
            length: password.length,
            hasLower: /[a-z]/.test(password),
            hasUpper: /[A-Z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSymbol: /[^a-zA-Z0-9]/.test(password),
            hasCommonPattern: this.hasCommonPattern(password),
            hasRepeating: this.hasRepeatingChars(password),
            hasSequential: this.hasSequentialChars(password),
            entropy: this.calculateEntropy(password)
        };

        let score = 0;

        // Length scoring (up to 3 points)
        if (password.length >= 20) {
            score += 3;
        } else if (password.length >= 16) {
            score += 2.5;
        } else if (password.length >= 12) {
            score += 2;
        } else if (password.length >= 8) {
            score += 1;
        } else if (password.length >= 6) {
            score += 0.5;
        }

        // Character variety (up to 4 points)
        if (details.hasLower) score += 1;
        if (details.hasUpper) score += 1;
        if (details.hasNumber) score += 1;
        if (details.hasSymbol) score += 1;

        // Entropy bonus (up to 2 points)
        if (details.entropy >= 80) {
            score += 2;
        } else if (details.entropy >= 60) {
            score += 1.5;
        } else if (details.entropy >= 40) {
            score += 1;
        } else if (details.entropy >= 20) {
            score += 0.5;
        }

        // Penalties
        if (details.hasCommonPattern) score -= 2;
        if (details.hasRepeating) score -= 1;
        if (details.hasSequential) score -= 0.5;

        // Clamp to 1-10
        return Math.max(1, Math.min(10, Math.round(score)));
    },

    /**
     * Get strength level from password score
     * @param {string} password
     * @returns {Object} { score, level, label }
     */
    getStrengthLevel(password) {
        const score = this.getScore(password);

        if (score <= 2) {
            return { score, level: 'weak', label: 'Weak' };
        } else if (score <= 4) {
            return { score, level: 'fair', label: 'Fair' };
        } else if (score <= 6) {
            return { score, level: 'good', label: 'Good' };
        } else if (score <= 8) {
            return { score, level: 'strong', label: 'Strong' };
        } else {
            return { score, level: 'very-strong', label: 'Very Strong' };
        }
    },

    /**
     * Analyze password strength
     * Returns score 0-4: 0=very weak, 1=weak, 2=fair, 3=strong, 4=very strong
     * @param {string} password
     * @returns {Object} { score, feedback, details }
     */
    analyzeStrength(password) {
        if (!password) {
            return { score: 0, label: 'None', feedback: 'No password', details: {} };
        }

        const details = {
            length: password.length,
            hasLower: /[a-z]/.test(password),
            hasUpper: /[A-Z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSymbol: /[^a-zA-Z0-9]/.test(password),
            hasCommonPattern: this.hasCommonPattern(password),
            hasRepeating: this.hasRepeatingChars(password),
            hasSequential: this.hasSequentialChars(password),
            entropy: this.calculateEntropy(password)
        };

        // Calculate score
        let score = 0;
        const feedback = [];

        // Length scoring
        if (password.length >= 16) {
            score += 1.5;
        } else if (password.length >= 12) {
            score += 1;
        } else if (password.length >= 8) {
            score += 0.5;
        } else {
            feedback.push('Use at least 8 characters');
        }

        // Character variety
        const varietyCount = [details.hasLower, details.hasUpper, details.hasNumber, details.hasSymbol]
            .filter(Boolean).length;

        if (varietyCount >= 4) {
            score += 1.5;
        } else if (varietyCount >= 3) {
            score += 1;
        } else if (varietyCount >= 2) {
            score += 0.5;
        } else {
            feedback.push('Mix uppercase, lowercase, numbers, and symbols');
        }

        // Entropy bonus
        if (details.entropy >= 60) {
            score += 1;
        } else if (details.entropy >= 40) {
            score += 0.5;
        }

        // Penalties
        if (details.hasCommonPattern) {
            score -= 1;
            feedback.push('Avoid common patterns');
        }

        if (details.hasRepeating) {
            score -= 0.5;
            feedback.push('Avoid repeating characters');
        }

        if (details.hasSequential) {
            score -= 0.5;
            feedback.push('Avoid sequential characters');
        }

        // Clamp score
        score = Math.max(0, Math.min(4, Math.round(score)));

        const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

        return {
            score,
            label: labels[score],
            feedback: feedback.length > 0 ? feedback : ['Good password'],
            details
        };
    },

    /**
     * Check for common password patterns
     */
    hasCommonPattern(password) {
        const lower = password.toLowerCase();
        const commonPatterns = [
            'password', 'qwerty', 'abc123', '123456', 'letmein',
            'welcome', 'monkey', 'dragon', 'master', 'login',
            'admin', 'passw0rd', 'p@ssword', 'p@ssw0rd'
        ];

        return commonPatterns.some(p => lower.includes(p));
    },

    /**
     * Check for repeating characters (e.g., 'aaa', '111')
     */
    hasRepeatingChars(password) {
        return /(.)\1{2,}/.test(password);
    },

    /**
     * Check for sequential characters (e.g., 'abc', '123', 'xyz')
     */
    hasSequentialChars(password) {
        const lower = password.toLowerCase();
        const sequences = [
            'abcdefghijklmnopqrstuvwxyz',
            '0123456789',
            'qwertyuiop',
            'asdfghjkl',
            'zxcvbnm'
        ];

        for (const seq of sequences) {
            for (let i = 0; i <= seq.length - 3; i++) {
                const pattern = seq.substring(i, i + 3);
                if (lower.includes(pattern) || lower.includes(pattern.split('').reverse().join(''))) {
                    return true;
                }
            }
        }

        return false;
    },

    /**
     * Calculate password entropy (bits)
     */
    calculateEntropy(password) {
        if (!password) return 0;

        let charsetSize = 0;
        if (/[a-z]/.test(password)) charsetSize += 26;
        if (/[A-Z]/.test(password)) charsetSize += 26;
        if (/[0-9]/.test(password)) charsetSize += 10;
        if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

        return Math.round(password.length * Math.log2(charsetSize || 1));
    },

    /**
     * Get color for strength score
     * @param {number} score - Score from 0-4
     * @returns {string} CSS color variable
     */
    getStrengthColor(score) {
        switch (score) {
            case 0:
            case 1:
                return 'var(--color-danger)';
            case 2:
                return 'var(--color-warning)';
            case 3:
            case 4:
                return 'var(--color-success)';
            default:
                return 'var(--color-danger)';
        }
    },

    /**
     * Render password strength bar into a container
     * @param {HTMLElement|string} container - Container element or selector
     * @param {string} password - Password to analyze
     */
    renderStrengthBar(container, password) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) return;

        if (!password) {
            el.innerHTML = '';
            return;
        }

        const analysis = this.analyzeStrength(password);
        const color = this.getStrengthColor(analysis.score);
        const percentage = (analysis.score / 4) * 100;

        el.innerHTML = `
            <div class="strength-bar">
                <div class="strength-fill" style="width: ${percentage}%; background: ${color};"></div>
            </div>
            <span class="strength-label" style="color: ${color};">${analysis.label}</span>
        `;
    },

    /**
     * Bind input to auto-update strength bar
     * @param {HTMLInputElement|string} input - Input element or selector
     * @param {HTMLElement|string} container - Container element or selector
     */
    bindStrengthBar(input, container) {
        const inputEl = typeof input === 'string' ? document.querySelector(input) : input;
        const containerEl = typeof container === 'string' ? document.querySelector(container) : container;

        if (!inputEl || !containerEl) return;

        const handler = () => this.renderStrengthBar(containerEl, inputEl.value);
        inputEl.addEventListener('input', handler);

        // Initial render if input has value
        if (inputEl.value) handler();

        // Return cleanup function
        return () => inputEl.removeEventListener('input', handler);
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityAnalyzer;
}
