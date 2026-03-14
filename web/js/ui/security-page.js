/**
 * Security Page Component
 * Shows security analysis and suggestions:
 * - Overall security score
 * - Weak passwords
 * - Reused passwords
 * - Missing 2FA
 */

const SecurityPage = {
    analysis: {
        score: 0,
        totalPasswords: 0,
        totalTotps: 0,
        weakPasswords: [],
        reusedPasswords: [],
        breachedPasswords: [],
        missingTOTP: [],
        duplicateTotps: [],
        strongPasswords: 0
    },

    // Track if breach check is in progress
    _breachCheckInProgress: false,

    /**
     * Initialize the security page
     */
    init() {
        this.render();
        this.bindEvents();
    },

    /**
     * Render the security page
     */
    render() {
        const container = document.getElementById('securityPageContent');
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
            <div class="security-page" id="securityPage">
                <!-- Security Hero -->
                <div class="security-hero" id="securityHero" data-level="analyzing">
                    <div class="security-gauge">
                        <svg viewBox="0 0 200 120" class="gauge-svg">
                            <!-- Segmented background arcs -->
                            <path class="gauge-segment gauge-segment-red grey" d="M 20 100 A 80 80 0 0 1 43.43 43.43" />
                            <path class="gauge-segment gauge-segment-yellow grey" d="M 43.43 43.43 A 80 80 0 0 1 100 20" />
                            <path class="gauge-segment gauge-segment-orange grey" d="M 100 20 A 80 80 0 0 1 156.57 43.43" />
                            <path class="gauge-segment gauge-segment-green grey" d="M 156.57 43.43 A 80 80 0 0 1 180 100" />
                            <!-- Needle touches center, close to but not touching colors -->
                            <line class="gauge-needle" id="gaugeNeedle" x1="100" y1="88" x2="100" y2="24" style="transform: rotate(-90deg); transform-origin: 100px 100px;" />
                            <circle class="gauge-needle-dot" cx="100" cy="100" r="12" />
                        </svg>
                        <div class="gauge-particles" id="gaugeParticles"></div>
                    </div>
                    <div class="security-score-content">
                        <span class="security-score-number" id="scoreNumber">--</span>
                        <span class="security-score-label" id="scoreLabel">Analyzing</span>
                        <p class="security-score-message" id="scoreMessage">Analyzing your vault...</p>
                    </div>
                </div>

                <!-- Security Stats -->
                <div class="security-stats" id="securityStats">
                    <div class="stat-card stat-strong">
                        <span class="stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        </span>
                        <span class="stat-value" id="statStrong">0</span>
                        <span class="stat-label">Strong</span>
                    </div>
                    <div class="stat-card stat-weak">
                        <span class="stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        </span>
                        <span class="stat-value" id="statWeak">0</span>
                        <span class="stat-label">Weak</span>
                    </div>
                    <div class="stat-card stat-reused">
                        <span class="stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </span>
                        <span class="stat-value" id="statReused">0</span>
                        <span class="stat-label">Reused</span>
                    </div>
                    <div class="stat-card stat-breached">
                        <span class="stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </span>
                        <span class="stat-value" id="statBreached">
                            <span class="breach-checking" style="display: none;">...</span>
                            <span class="breach-count">0</span>
                        </span>
                        <span class="stat-label">Breached</span>
                    </div>
                </div>

                <!-- Security Issues -->
                <div class="security-issues" id="securityIssues">
                    <!-- Breached Passwords -->
                    <div class="issue-section issue-section-critical" id="breachedPasswordsSection" style="display: none;">
                        <div class="issue-header">
                            <h3 class="issue-title">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                Breached Passwords
                            </h3>
                            <span class="issue-count" id="breachedCount">0</span>
                        </div>
                        <p class="issue-description">These passwords have appeared in known data breaches. Change them immediately.</p>
                        <div class="issue-list" id="breachedList"></div>
                    </div>

                    <!-- Weak Passwords -->
                    <div class="issue-section" id="weakPasswordsSection" style="display: none;">
                        <div class="issue-header">
                            <h3 class="issue-title">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                    <line x1="12" y1="9" x2="12" y2="13"></line>
                                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                Weak Passwords
                            </h3>
                            <span class="issue-count" id="weakCount">0</span>
                        </div>
                        <p class="issue-description">These passwords are too short or simple. Consider updating them.</p>
                        <div class="issue-list" id="weakList"></div>
                    </div>

                    <!-- Reused Passwords -->
                    <div class="issue-section" id="reusedPasswordsSection" style="display: none;">
                        <div class="issue-header">
                            <h3 class="issue-title">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Reused Passwords
                            </h3>
                            <span class="issue-count" id="reusedCount">0</span>
                        </div>
                        <p class="issue-description">Using the same password for multiple accounts is risky.</p>
                        <div class="issue-list" id="reusedList"></div>
                    </div>

                    <!-- Missing 2FA -->
                    <div class="issue-section" id="missingTOTPSection" style="display: none;">
                        <div class="issue-header">
                            <h3 class="issue-title">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                                Missing 2FA
                            </h3>
                            <span class="issue-count" id="missingTOTPCount">0</span>
                        </div>
                        <p class="issue-description">Consider adding 2FA to these accounts for extra security.</p>
                        <div class="issue-list" id="missingTOTPList"></div>
                    </div>

                    <!-- Duplicate 2FAs -->
                    <div class="issue-section" id="duplicateTotpsSection" style="display: none;">
                        <div class="issue-header">
                            <h3 class="issue-title">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                Duplicate 2FA Codes
                            </h3>
                            <span class="issue-count" id="duplicateTotpsCount">0</span>
                        </div>
                        <p class="issue-description">These 2FA codes use the same secret key.</p>
                        <div class="issue-list" id="duplicateTotpsList"></div>
                    </div>

                    <!-- All Good State -->
                    <div class="all-good" id="allGood" style="display: none;">
                        <div class="all-good-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        </div>
                        <h3>Great job!</h3>
                        <p>No security issues found. Your vault is secure.</p>
                    </div>

                    <!-- Empty State -->
                    <div class="empty-state" id="emptyAnalysis" style="display: none;">
                        <div class="empty-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                        </div>
                        <h3 class="empty-title">No passwords to analyze</h3>
                        <p class="empty-text">Add some passwords to see your security score</p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Listen for vault updates
        window.addEventListener('vaultupdate', () => {
            this.analyze();
        });
    },

    /**
     * Analyze vault security
     * Only analyzes password items that have a folder_id (not abandoned)
     */
    async analyze() {
        // Re-render to ensure fresh DOM state (segments start with grey class)
        this.render();

        try {
            let items = [];

            if (typeof Vault !== 'undefined' && Vault.isUnlocked) {
                items = await Vault.getItems() || [];
            }

            // Filter: only password items with folder_id (not abandoned)
            const passwordItems = items.filter(i =>
                i.item_type === 'password' && i.folder_id !== null && i.folder_id !== undefined
            );

            if (passwordItems.length === 0) {
                this.showEmptyState();
                return;
            }

            // Initialize analysis
            this.analysis = {
                score: 0,
                totalPasswords: passwordItems.length,
                weakPasswords: [],
                reusedPasswords: [],
                breachedPasswords: [],
                missingTOTP: [],
                strongPasswords: 0
            };

            // Track items that need breach checking
            const itemsNeedingBreachCheck = [];

            const passwordMap = new Map(); // Map password hash -> items

            for (const item of passwordItems) {
                const data = item.data || {};
                const password = data.password || '';

                // Calculate score using SecurityAnalyzer.getScore() (1-10 scale)
                let score = 1;
                if (password && typeof SecurityAnalyzer !== 'undefined') {
                    score = SecurityAnalyzer.getScore(password);
                }

                // Categorize by score (1-10 scale)
                // Weak: 1-4, Strong: 5-10
                if (score <= 4) {
                    this.analysis.weakPasswords.push({
                        id: item.id,
                        name: data.name || 'Untitled',
                        score: score,
                        strengthLabel: this.getScoreLabel(score)
                    });
                } else {
                    this.analysis.strongPasswords++;
                }

                // Check for duplicates by comparing actual passwords
                if (password) {
                    // Use simple hash for grouping (not for security, just comparison)
                    const hash = await this.hashPassword(password);
                    if (!passwordMap.has(hash)) {
                        passwordMap.set(hash, []);
                    }
                    passwordMap.get(hash).push({
                        id: item.id,
                        name: data.name || 'Untitled'
                    });
                }

                // Check for missing 2FA (now embedded as attached_totp)
                if (!data.attached_totp) {
                    this.analysis.missingTOTP.push({
                        id: item.id,
                        name: data.name || 'Untitled'
                    });
                }

                // Check for breached passwords
                if (typeof BreachChecker !== 'undefined') {
                    // Check if we have existing breach data
                    if (data._breach && data._breach.count > 0) {
                        // Already known to be breached
                        this.analysis.breachedPasswords.push({
                            id: item.id,
                            name: data.name || 'Untitled',
                            field: 'Password',
                            count: data._breach.count
                        });
                    } else if (BreachChecker.needsCheck(data)) {
                        // Needs checking (no data or stale)
                        itemsNeedingBreachCheck.push({
                            item: item,
                            password: password
                        });
                    }

                    // Also check secret custom fields
                    if (data.custom_fields && Array.isArray(data.custom_fields)) {
                        for (const field of data.custom_fields) {
                            if (field.type === 'secret' && field._breach && field._breach.count > 0) {
                                this.analysis.breachedPasswords.push({
                                    id: item.id,
                                    name: data.name || 'Untitled',
                                    field: field.label || 'Secret Field',
                                    count: field._breach.count
                                });
                            }
                        }
                    }
                }
            }

            // Flatten duplicates (only groups with 2+ items)
            for (const [hash, items] of passwordMap) {
                if (items.length > 1) {
                    items.forEach(item => {
                        this.analysis.reusedPasswords.push({
                            ...item,
                            groupId: hash.substring(0, 8)
                        });
                    });
                }
            }

            // Sort weak passwords: Weak first, then Fair, then alphabetically
            this.analysis.weakPasswords.sort((a, b) => {
                // Sort by score ascending (lower = weaker = first)
                if (a.score !== b.score) {
                    return a.score - b.score;
                }
                // Then alphabetically by name
                return a.name.localeCompare(b.name);
            });

            // Sort reused passwords by groupId to keep duplicates together, then alphabetically
            this.analysis.reusedPasswords.sort((a, b) => {
                if (a.groupId !== b.groupId) {
                    return a.groupId.localeCompare(b.groupId);
                }
                return a.name.localeCompare(b.name);
            });

            // Sort breached passwords by count (most severe first)
            this.analysis.breachedPasswords.sort((a, b) => b.count - a.count);

            // Calculate overall security score
            this.calculateScore();

            // Update UI
            this.updateDisplay();

            // Trigger background breach checking for items that need it
            if (itemsNeedingBreachCheck.length > 0 && typeof BreachChecker !== 'undefined') {
                this.runBackgroundBreachCheck(itemsNeedingBreachCheck);
            }

        } catch (error) {
            console.error('Security analysis failed:', error);
        }
    },

    /**
     * Run breach checks in background and update UI as results come in
     * Also persists breach results back to the vault
     * @param {Array} items - Items to check [{item, password}]
     */
    async runBackgroundBreachCheck(items) {
        if (this._breachCheckInProgress) return;
        this._breachCheckInProgress = true;

        // Show checking indicator
        const checkingEl = document.querySelector('#statBreached .breach-checking');
        const countEl = document.querySelector('#statBreached .breach-count');
        if (checkingEl) checkingEl.style.display = 'inline';
        if (countEl) countEl.style.display = 'none';

        try {
            let newBreachesFound = 0;

            for (const { item, password } of items) {
                try {
                    const result = await BreachChecker.check(password);

                    if (result.breached) {
                        newBreachesFound++;
                        const data = item.data || {};

                        // Add to analysis
                        this.analysis.breachedPasswords.push({
                            id: item.id,
                            name: data.name || 'Untitled',
                            field: 'Password',
                            count: result.count
                        });

                        // Re-sort by count
                        this.analysis.breachedPasswords.sort((a, b) => b.count - a.count);

                        // Update display
                        this.updateBreachedSection();
                        this.recalculateAndUpdateScore();
                    }

                    // Persist breach result to vault (update item with _breach field)
                    if (typeof Vault !== 'undefined' && result.count !== undefined) {
                        try {
                            const updatedData = {
                                ...item.data,
                                _breach: {
                                    count: result.count,
                                    checked_at: result.checkedAt
                                }
                            };
                            await Vault.updateItem(item.id, updatedData, item.folder_id);
                        } catch (saveError) {
                            console.warn('[SecurityPage] Failed to persist breach data:', saveError);
                        }
                    }

                    // Small delay to avoid rate limiting
                    await new Promise(r => setTimeout(r, 150));

                } catch (checkError) {
                    console.warn('[SecurityPage] Breach check failed for item:', item.id, checkError);
                }
            }

            // If new breaches found, show notification
            if (newBreachesFound > 0) {
                if (typeof Toast !== 'undefined') {
                    Toast.warning(`Found ${newBreachesFound} breached password${newBreachesFound > 1 ? 's' : ''}`);
                }
            }

        } finally {
            this._breachCheckInProgress = false;

            // Hide checking indicator
            if (checkingEl) checkingEl.style.display = 'none';
            if (countEl) countEl.style.display = 'inline';
        }
    },

    /**
     * Update just the breached passwords section
     */
    updateBreachedSection() {
        const section = document.getElementById('breachedPasswordsSection');
        const count = document.getElementById('breachedCount');
        const list = document.getElementById('breachedList');
        const statBreached = document.querySelector('#statBreached .breach-count');

        if (statBreached) {
            statBreached.textContent = this.analysis.breachedPasswords.length;
        }

        if (!section || !count || !list) return;

        const items = this.analysis.breachedPasswords;

        if (items.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        count.textContent = items.length;

        const displayItems = items.slice(0, 5);
        list.innerHTML = displayItems.map(item => `
            <div class="issue-item" data-item-id="${item.id}">
                <span class="issue-item-name">${Utils.escapeHtml(item.name)}</span>
                <span class="issue-item-badge breach-badge">
                    ${item.field !== 'Password' ? Utils.escapeHtml(item.field) + ' · ' : ''}
                    ${typeof BreachChecker !== 'undefined' ? BreachChecker.formatCount(item.count) : item.count} exposures
                </span>
                <button class="issue-item-action" data-action="fix">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
        `).join('');

        if (items.length > 5) {
            list.innerHTML += `
                <button class="view-all-btn">View all ${items.length} items</button>
            `;

            list.querySelector('.view-all-btn').addEventListener('click', () => {
                this.showAllBreachedItems(items);
            });
        }

        // Bind click handlers
        list.querySelectorAll('.issue-item').forEach(el => {
            el.addEventListener('click', async () => {
                const itemId = el.dataset.itemId;
                const item = typeof Vault !== 'undefined' ? await Vault.getItem(itemId) : null;
                if (item) {
                    window.dispatchEvent(new CustomEvent('viewitem', {
                        detail: { item }
                    }));
                }
            });
        });

        // Update "all good" state
        this.updateAllGoodState();
    },

    /**
     * Show all breached items (expand from 5)
     */
    showAllBreachedItems(items) {
        const list = document.getElementById('breachedList');
        if (!list) return;

        list.innerHTML = items.map(item => `
            <div class="issue-item" data-item-id="${item.id}">
                <span class="issue-item-name">${Utils.escapeHtml(item.name)}</span>
                <span class="issue-item-badge breach-badge">
                    ${item.field !== 'Password' ? Utils.escapeHtml(item.field) + ' · ' : ''}
                    ${typeof BreachChecker !== 'undefined' ? BreachChecker.formatCount(item.count) : item.count} exposures
                </span>
                <button class="issue-item-action" data-action="fix">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
        `).join('');

        list.querySelectorAll('.issue-item').forEach(el => {
            el.addEventListener('click', async () => {
                const itemId = el.dataset.itemId;
                const item = typeof Vault !== 'undefined' ? await Vault.getItem(itemId) : null;
                if (item) {
                    window.dispatchEvent(new CustomEvent('viewitem', {
                        detail: { item }
                    }));
                }
            });
        });
    },

    /**
     * Recalculate score and update display
     */
    recalculateAndUpdateScore() {
        this.calculateScore();

        const scoreNumber = document.getElementById('scoreNumber');
        const scoreLabel = document.getElementById('scoreLabel');
        const scoreMessage = document.getElementById('scoreMessage');
        const hero = document.getElementById('securityHero');

        if (!scoreNumber) return;

        let level = 'critical';
        let label = 'Critical';
        let message = 'Your vault needs immediate attention';

        if (this.analysis.score >= 90) {
            level = 'excellent';
            label = 'Excellent';
            message = 'Your vault is very secure';
        } else if (this.analysis.score >= 70) {
            level = 'good';
            label = 'Good';
            message = 'Good security, minor improvements possible';
        } else if (this.analysis.score >= 50) {
            level = 'fair';
            label = 'Fair';
            message = 'Some security issues need attention';
        } else if (this.analysis.score >= 30) {
            level = 'weak';
            label = 'Weak';
            message = 'Several security issues found';
        }

        if (hero) hero.dataset.level = level;
        scoreNumber.textContent = this.analysis.score;
        if (scoreLabel) scoreLabel.textContent = label;
        if (scoreMessage) scoreMessage.textContent = message;

        // Update gauge without full animation
        const needle = document.getElementById('gaugeNeedle');
        if (needle) {
            const rotation = -90 + (this.analysis.score / 100) * 180;
            needle.style.transition = 'transform 0.3s ease';
            needle.style.transform = `rotate(${rotation}deg)`;
        }
    },

    /**
     * Update "all good" state visibility
     */
    updateAllGoodState() {
        const hasIssues = this.analysis.weakPasswords.length > 0 ||
                         this.analysis.reusedPasswords.length > 0 ||
                         this.analysis.breachedPasswords.length > 0 ||
                         this.analysis.missingTOTP.length > 0;

        const allGood = document.getElementById('allGood');
        if (allGood) {
            allGood.style.display = hasIssues ? 'none' : 'flex';
        }
    },

    /**
     * Get human-readable label for score
     */
    getScoreLabel(score) {
        if (score <= 2) return 'Weak';
        if (score <= 4) return 'Fair';
        if (score <= 6) return 'Good';
        if (score <= 8) return 'Strong';
        return 'Very Strong';
    },

    /**
     * Hash password for duplicate comparison (not for security storage)
     * @param {string} password
     * @returns {Promise<string>}
     */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Calculate overall security score (0-100)
     */
    calculateScore() {
        const total = this.analysis.totalPasswords;
        if (total === 0) {
            this.analysis.score = 100;
            return;
        }

        let score = 100;

        // Deduct for breached passwords (up to -60) - most severe
        const breachedRatio = this.analysis.breachedPasswords.length / total;
        score -= Math.min(60, breachedRatio * 120);

        // Deduct for weak passwords (up to -40)
        const weakRatio = this.analysis.weakPasswords.length / total;
        score -= Math.min(40, weakRatio * 80);

        // Deduct for reused passwords (up to -30)
        const reusedRatio = this.analysis.reusedPasswords.length / total;
        score -= Math.min(30, reusedRatio * 60);

        this.analysis.score = Math.max(0, Math.round(score));
    },

    /**
     * Update the display with analysis results
     */
    updateDisplay() {
        const hero = document.getElementById('securityHero');
        const scoreNumber = document.getElementById('scoreNumber');
        const scoreLabel = document.getElementById('scoreLabel');
        const scoreMessage = document.getElementById('scoreMessage');

        if (scoreNumber && scoreMessage) {
            // Determine level based on score
            let level = 'critical';
            let label = 'Critical';
            let message = 'Your vault needs immediate attention';

            if (this.analysis.score >= 90) {
                level = 'excellent';
                label = 'Excellent';
                message = 'Your vault is very secure';
            } else if (this.analysis.score >= 70) {
                level = 'good';
                label = 'Good';
                message = 'Good security, minor improvements possible';
            } else if (this.analysis.score >= 50) {
                level = 'fair';
                label = 'Fair';
                message = 'Some security issues need attention';
            } else if (this.analysis.score >= 30) {
                level = 'weak';
                label = 'Weak';
                message = 'Several security issues found';
            }

            // Update hero level for styling
            if (hero) {
                hero.dataset.level = level;
            }

            // Update gauge needle position
            this.updateGauge(this.analysis.score);

            scoreNumber.textContent = this.analysis.score;
            if (scoreLabel) scoreLabel.textContent = label;
            scoreMessage.textContent = message;
        }

        // Update stats
        document.getElementById('statStrong').textContent = this.analysis.strongPasswords;
        document.getElementById('statWeak').textContent = this.analysis.weakPasswords.length;
        document.getElementById('statReused').textContent = this.analysis.reusedPasswords.length;

        // Update breached stat
        const breachedCount = document.querySelector('#statBreached .breach-count');
        if (breachedCount) {
            breachedCount.textContent = this.analysis.breachedPasswords.length;
        }

        // Update issue sections
        this.updateBreachedSection();
        this.updateIssueSection('weakPasswords', 'weak', this.analysis.weakPasswords);
        this.updateIssueSection('reusedPasswords', 'reused', this.analysis.reusedPasswords);
        this.updateIssueSection('missingTOTP', 'missingTOTP', this.analysis.missingTOTP);

        // Hide unused sections
        const duplicateTotpsSection = document.getElementById('duplicateTotpsSection');
        if (duplicateTotpsSection) duplicateTotpsSection.style.display = 'none';

        // Show all good state if no issues
        const hasIssues = this.analysis.weakPasswords.length > 0 ||
                         this.analysis.reusedPasswords.length > 0 ||
                         this.analysis.breachedPasswords.length > 0 ||
                         this.analysis.missingTOTP.length > 0;

        document.getElementById('allGood').style.display = hasIssues ? 'none' : 'flex';
        document.getElementById('emptyAnalysis').style.display = 'none';
    },

    /**
     * Update an issue section
     * @param {string} type
     * @param {string} prefix
     * @param {Array} items
     */
    updateIssueSection(type, prefix, items) {
        const section = document.getElementById(`${type}Section`);
        const count = document.getElementById(`${prefix}Count`);
        const list = document.getElementById(`${prefix}List`);

        if (!section || !count || !list) return;

        if (items.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        count.textContent = items.length;

        // For reused passwords, determine chain position (first, middle, last in group)
        const displayItems = items.slice(0, 5);
        list.innerHTML = displayItems.map((item, index) => {
            let chainClass = '';
            if (item.groupId !== undefined) {
                const prevItem = displayItems[index - 1];
                const nextItem = displayItems[index + 1];
                const prevSameGroup = prevItem && prevItem.groupId === item.groupId;
                const nextSameGroup = nextItem && nextItem.groupId === item.groupId;

                if (!prevSameGroup && nextSameGroup) {
                    chainClass = 'chain-first';
                } else if (prevSameGroup && nextSameGroup) {
                    chainClass = 'chain-middle';
                } else if (prevSameGroup && !nextSameGroup) {
                    chainClass = 'chain-last';
                } else {
                    chainClass = 'chain-single';
                }
            }

            return `
            <div class="issue-item ${chainClass}" data-item-id="${item.id}" ${item.groupId ? `data-group="${item.groupId}"` : ''}>
                <span class="issue-item-name">${Utils.escapeHtml(item.name)}</span>
                ${item.strengthLabel !== undefined ? `<span class="issue-item-badge strength ${item.strengthLabel === 'Weak' ? 'strength-weak' : 'strength-fair'}">${item.strengthLabel}</span>` : ''}
                <button class="issue-item-action" data-action="fix">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
        `}).join('');

        if (items.length > 5) {
            list.innerHTML += `
                <button class="view-all-btn">View all ${items.length} items</button>
            `;

            list.querySelector('.view-all-btn').addEventListener('click', () => {
                this.showAllIssueItems(prefix, items);
            });
        }

        // Bind click handlers
        list.querySelectorAll('.issue-item').forEach(el => {
            el.addEventListener('click', async () => {
                const itemId = el.dataset.itemId;
                // Get full item from Vault
                const item = typeof Vault !== 'undefined' ? await Vault.getItem(itemId) : null;
                if (item) {
                    window.dispatchEvent(new CustomEvent('viewitem', {
                        detail: { item }
                    }));
                }
            });
        });
    },

    /**
     * Show all items for a generic issue section (expand from 5)
     */
    showAllIssueItems(prefix, items) {
        const list = document.getElementById(`${prefix}List`);
        if (!list) return;

        list.innerHTML = items.map((item, index) => {
            let chainClass = '';
            if (item.groupId !== undefined) {
                const prevItem = items[index - 1];
                const nextItem = items[index + 1];
                const prevSameGroup = prevItem && prevItem.groupId === item.groupId;
                const nextSameGroup = nextItem && nextItem.groupId === item.groupId;

                if (!prevSameGroup && nextSameGroup) {
                    chainClass = 'chain-first';
                } else if (prevSameGroup && nextSameGroup) {
                    chainClass = 'chain-middle';
                } else if (prevSameGroup && !nextSameGroup) {
                    chainClass = 'chain-last';
                } else {
                    chainClass = 'chain-single';
                }
            }

            return `
            <div class="issue-item ${chainClass}" data-item-id="${item.id}" ${item.groupId ? `data-group="${item.groupId}"` : ''}>
                <span class="issue-item-name">${Utils.escapeHtml(item.name)}</span>
                ${item.strengthLabel !== undefined ? `<span class="issue-item-badge strength ${item.strengthLabel === 'Weak' ? 'strength-weak' : 'strength-fair'}">${item.strengthLabel}</span>` : ''}
                <button class="issue-item-action" data-action="fix">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
        `}).join('');

        list.querySelectorAll('.issue-item').forEach(el => {
            el.addEventListener('click', async () => {
                const itemId = el.dataset.itemId;
                const item = typeof Vault !== 'undefined' ? await Vault.getItem(itemId) : null;
                if (item) {
                    window.dispatchEvent(new CustomEvent('viewitem', {
                        detail: { item }
                    }));
                }
            });
        });
    },

    /**
     * Reset gauge to initial state without animation or particles
     */
    resetGauge() {
        const needle = document.getElementById('gaugeNeedle');
        const segments = document.querySelectorAll('.gauge-segment');

        if (needle) {
            needle.style.transition = 'none';
            needle.style.transform = 'rotate(-90deg)';
        }

        segments.forEach(seg => {
            seg.classList.add('grey');
            seg.classList.remove('to-main-color', 'colored');
        });
    },

    /**
     * Update gauge needle based on score with animation sequence
     */
    updateGauge(score) {
        const needle = document.getElementById('gaugeNeedle');
        const segments = document.querySelectorAll('.gauge-segment');
        const hero = document.getElementById('securityHero');

        if (!needle || !segments.length) return;

        // Determine main color based on score
        let mainColor;
        if (score < 25) {
            mainColor = 'red';
        } else if (score < 50) {
            mainColor = 'yellow';
        } else if (score < 75) {
            mainColor = 'orange';
        } else {
            mainColor = 'green';
        }

        // Step 1: Reset everything - needle to start, segments to grey
        needle.style.transition = 'none';
        needle.style.transform = 'rotate(-90deg)';
        segments.forEach(seg => {
            // Remove all color classes first
            seg.classList.remove('to-main-color', 'colored', 'grey');
        });

        // Force reflow to ensure clean state
        needle.offsetHeight;
        segments[0]?.offsetHeight;

        // Now add grey class
        segments.forEach(seg => {
            seg.classList.add('grey');
        });
        if (hero) hero.dataset.mainColor = mainColor;

        // Force reflow again
        segments[0]?.offsetHeight;

        // Step 2: Start needle animation and transition segments to main color
        setTimeout(() => {
            needle.style.transition = 'transform 0.8s cubic-bezier(0.25, 1.15, 0.5, 1)';
            const rotation = -90 + (score / 100) * 180;
            needle.style.transform = `rotate(${rotation}deg)`;

            // Transition all segments to main color
            segments.forEach(seg => {
                seg.classList.add('to-main-color');
            });
        }, 100);

        // Step 3: Burst particles as needle is arriving
        setTimeout(() => {
            this.burstArcParticles(score, mainColor);
        }, 500);

        // Step 4: Hold the main color for a moment, then transition back to original colors
        setTimeout(() => {
            segments.forEach(seg => {
                seg.classList.remove('grey', 'to-main-color');
                seg.classList.add('colored');
            });
        }, 1280);
    },

    /**
     * Create particle burst along the entire arc
     */
    burstArcParticles(score, mainColor) {
        const container = document.getElementById('gaugeParticles');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const scale = containerRect.width / 200;

        // Arc center and radius to match SVG paths
        const centerX = 100;
        const centerY = 100;
        const arcRadius = 80;
        // Use middle of stroke as compromise (left needs +7, right needs +0)
        const particleRadius = arcRadius + 4;

        // Get the main color value
        const colorMap = {
            red: getComputedStyle(document.documentElement).getPropertyValue('--color-error').trim(),
            yellow: getComputedStyle(document.documentElement).getPropertyValue('--color-yellow').trim(),
            orange: getComputedStyle(document.documentElement).getPropertyValue('--color-warning').trim(),
            green: getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim()
        };
        const color = colorMap[mainColor];

        // Lots of particles for powerful burst
        const particleCount = 100 + Math.floor((score / 100) * 100);
        const burstPower = 70 + (score / 100) * 90;

        // Create particles along the entire arc
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'gauge-particle';

            // Position along the arc (0 to PI for semi-circle)
            const arcAngle = Math.PI - (i / particleCount) * Math.PI;
            // Interpolate radius: left (π) needs 84, right (0) needs 80
            const angleRatio = arcAngle / Math.PI; // 1 at left, 0 at right
            const adjustedRadius = 80 + (angleRatio * 4);
            const startX = (centerX + adjustedRadius * Math.cos(arcAngle)) * scale;
            const startY = (centerY - adjustedRadius * Math.sin(arcAngle)) * scale;

            // Burst outward from arc with more spread
            const burstAngle = arcAngle + (Math.random() - 0.5) * 0.8;
            const distance = burstPower + Math.random() * 50;
            const endX = Math.cos(burstAngle) * distance;
            const endY = -Math.sin(burstAngle) * distance;

            const size = 3 + Math.random() * 6;
            const delay = Math.random() * 100; // Stagger the burst

            particle.style.cssText = `
                left: ${startX}px;
                top: ${startY}px;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                --end-x: ${endX}px;
                --end-y: ${endY}px;
                animation-delay: ${delay}ms;
            `;

            container.appendChild(particle);
            setTimeout(() => particle.remove(), 600);
        }
    },

    /**
     * Show empty state
     */
    showEmptyState() {
        const hero = document.getElementById('securityHero');
        if (hero) hero.dataset.level = 'empty';

        // Reset gauge to start position without animation or particles
        this.resetGauge();

        document.getElementById('scoreNumber').textContent = '--';
        const scoreLabel = document.getElementById('scoreLabel');
        if (scoreLabel) scoreLabel.textContent = 'Empty';
        document.getElementById('scoreMessage').textContent = 'No passwords to analyze';

        document.getElementById('statStrong').textContent = '0';
        document.getElementById('statWeak').textContent = '0';
        document.getElementById('statReused').textContent = '0';

        const breachedCount = document.querySelector('#statBreached .breach-count');
        if (breachedCount) breachedCount.textContent = '0';

        document.getElementById('breachedPasswordsSection').style.display = 'none';
        document.getElementById('weakPasswordsSection').style.display = 'none';
        document.getElementById('reusedPasswordsSection').style.display = 'none';
        document.getElementById('missingTOTPSection').style.display = 'none';
        document.getElementById('duplicateTotpsSection').style.display = 'none';
        document.getElementById('allGood').style.display = 'none';
        document.getElementById('emptyAnalysis').style.display = 'flex';
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityPage;
}
