/**
 * Breach Checker
 * Checks passwords against Have I Been Pwned (HIBP) database
 *
 * Uses k-anonymity: Only the first 5 characters of the SHA-1 hash
 * are sent to our backend caching proxy (/api/breach/range/{prefix}).
 * The server never learns which password is being checked.
 */

const BreachChecker = {
    // Cache checked hashes in memory to avoid redundant API calls
    // Key: full SHA-1 hash, Value: { count, checkedAt }
    _cache: new Map(),

    // Cache TTL: 5 minutes (within session)
    _cacheTTL: 5 * 60 * 1000,

    /**
     * Check if a password has been breached
     * @param {string} password - The password to check
     * @returns {Promise<{breached: boolean, count: number, prefix: string, checkedAt: string}>}
     */
    async check(password) {
        if (!password) {
            return { breached: false, count: 0, prefix: null, checkedAt: DateUtils.now() };
        }

        try {
            // Compute SHA-1 hash
            const hash = await this.sha1(password);
            const prefix = hash.substring(0, 5).toUpperCase();
            const suffix = hash.substring(5).toUpperCase();

            // Check memory cache first
            const cached = this._getFromCache(hash);
            if (cached !== null) {
                return cached;
            }

            // Fetch suffixes from API or HIBP
            const suffixes = await this.fetchSuffixes(prefix);

            // Find our suffix in the response
            const count = this.findInSuffixes(suffix, suffixes);

            const result = {
                breached: count > 0,
                count: count,
                prefix: prefix,
                checkedAt: DateUtils.now()
            };

            // Cache the result
            this._setCache(hash, result);

            return result;

        } catch (error) {
            console.error('[BreachChecker] Check failed:', error);
            // Return safe default on error (don't block the user)
            return {
                breached: false,
                count: 0,
                prefix: null,
                checkedAt: DateUtils.now(),
                error: error.message
            };
        }
    },

    /**
     * Check all password fields in an item's data
     * Updates the data object with _breach fields
     * @param {Object} data - Decrypted item data
     * @returns {Promise<Object>} - Updated data with _breach fields
     */
    async checkItem(data) {
        if (!data) return data;

        const result = { ...data };
        const checks = [];

        // Check main password field
        if (data.password) {
            checks.push(
                this.check(data.password).then(breach => {
                    result._breach = {
                        count: breach.count,
                        checked_at: breach.checkedAt
                    };
                })
            );
        }

        // Check custom fields with type === 'secret'
        if (data.custom_fields && Array.isArray(data.custom_fields)) {
            result.custom_fields = [...data.custom_fields];

            data.custom_fields.forEach((field, index) => {
                if (field.type === 'secret' && field.value) {
                    checks.push(
                        this.check(field.value).then(breach => {
                            result.custom_fields[index] = {
                                ...field,
                                _breach: {
                                    count: breach.count,
                                    checked_at: breach.checkedAt
                                }
                            };
                        })
                    );
                }
            });
        }

        // Wait for all checks to complete
        await Promise.all(checks);

        return result;
    },

    /**
     * Check multiple passwords with rate limiting
     * @param {Array<{id: string, password: string}>} items - Items to check
     * @param {Function} onProgress - Progress callback (current, total)
     * @param {number} delayMs - Delay between checks (default 100ms)
     * @returns {Promise<Map<string, Object>>} - Map of id to breach result
     */
    async checkMultiple(items, onProgress = null, delayMs = 100) {
        const results = new Map();
        const total = items.length;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const result = await this.check(item.password);
            results.set(item.id, result);

            if (onProgress) {
                onProgress(i + 1, total);
            }

            // Rate limiting delay (skip for last item)
            if (i < items.length - 1 && delayMs > 0) {
                await this.delay(delayMs);
            }
        }

        return results;
    },

    /**
     * Get all breached fields from an item's data
     * @param {Object} data - Item data with _breach fields
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
     * Check if breach data is stale (older than specified days)
     * @param {string} checkedAt - ISO date string
     * @param {number} maxAgeDays - Maximum age in days (default 7)
     * @returns {boolean}
     */
    isStale(checkedAt, maxAgeDays = 7) {
        if (!checkedAt) return true;

        const checkedDate = new Date(checkedAt);
        const now = new Date();
        const ageMs = now - checkedDate;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        return ageDays > maxAgeDays;
    },

    /**
     * Check if item needs breach check (no data or stale)
     * @param {Object} data - Item data
     * @returns {boolean}
     */
    needsCheck(data) {
        // No password field
        if (!data.password) return false;

        // No breach data
        if (!data._breach) return true;

        // Stale data
        return this.isStale(data._breach.checked_at);
    },

    /**
     * Compute SHA-1 hash of a string
     * @param {string} str
     * @returns {Promise<string>} - Hex string
     */
    async sha1(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Fetch suffixes from our backend caching proxy
     * @param {string} prefix - 5-char hex prefix
     * @returns {Promise<string>} - Raw HIBP response
     */
    async fetchSuffixes(prefix) {
        const response = await ApiClient.get(`/breach/range/${prefix}`);

        if (!response.success) {
            throw new Error(response.message || 'Failed to fetch breach data');
        }

        return response.data.suffixes;
    },

    /**
     * Find suffix in HIBP response and return count
     * @param {string} suffix - 35-char hex suffix to find
     * @param {string} suffixes - Raw HIBP response
     * @returns {number} - Breach count (0 if not found)
     */
    findInSuffixes(suffix, suffixes) {
        // HIBP response format: "SUFFIX:COUNT\r\n"
        const lines = suffixes.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const [hashSuffix, countStr] = trimmed.split(':');
            if (hashSuffix === suffix) {
                return parseInt(countStr, 10) || 0;
            }
        }

        return 0;
    },

    /**
     * Get from memory cache
     * @param {string} hash
     * @returns {Object|null}
     */
    _getFromCache(hash) {
        const cached = this._cache.get(hash);
        if (!cached) return null;

        // Check TTL
        if (Date.now() - cached.timestamp > this._cacheTTL) {
            this._cache.delete(hash);
            return null;
        }

        return cached.result;
    },

    /**
     * Set memory cache
     * @param {string} hash
     * @param {Object} result
     */
    _setCache(hash, result) {
        this._cache.set(hash, {
            result,
            timestamp: Date.now()
        });

        // Clean old entries if cache gets too large
        if (this._cache.size > 1000) {
            this._cleanCache();
        }
    },

    /**
     * Clean expired cache entries
     */
    _cleanCache() {
        const now = Date.now();
        for (const [hash, entry] of this._cache) {
            if (now - entry.timestamp > this._cacheTTL) {
                this._cache.delete(hash);
            }
        }
    },

    /**
     * Clear all cached data
     */
    clearCache() {
        this._cache.clear();
    },

    /**
     * Delay helper
     * @param {number} ms
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Format breach count for display
     * @param {number} count
     * @returns {string}
     */
    formatCount(count) {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M';
        } else if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K';
        }
        return count.toString();
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BreachChecker;
}
