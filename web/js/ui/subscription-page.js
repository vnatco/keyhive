/**
 * Subscription Page
 * Full-screen auth-level view shown when subscription is expired/inactive.
 * Platform-aware: shows payment UI on web/electron, limited view on iOS/Android.
 */

const SubscriptionPage = {
    /**
     * Get subscription data from App state
     * @returns {Object}
     */
    getSubscriptionData() {
        return App?.state?.subscription || {};
    },

    /**
     * Render the subscription page HTML
     * @returns {string}
     */
    getHTML() {
        if (Platform.isMobile()) {
            return this.getMobileHTML();
        }
        return this.getDesktopHTML();
    },

    /**
     * iOS/Android view - no payment links (Apple/Google compliance)
     */
    getMobileHTML() {
        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <div class="auth-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <h1 class="auth-title">Account Access Inactive</h1>
                        <p class="auth-subtitle">Visit <a href="${Config.APP_URL}" target="_blank" style="color: var(--accent); font-weight: 600; text-decoration: none;">${Config.APP_DOMAIN}</a> to manage your account.</p>
                    </div>

                    <div class="auth-footer">
                        <p><a href="#" id="subSwitchToLocal">Switch to Local Mode</a></p>
                        <p><a href="#" id="subLogout">Logout</a></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Web/Electron view - full subscription UI with payment options
     */
    getDesktopHTML() {
        const sub = this.getSubscriptionData();
        const status = sub.status || 'expired';
        const trialDaysRemaining = sub.trial_days_remaining || 0;
        const hasStripeCustomer = sub.has_stripe_customer || false;
        const trialDays = Config.TRIAL_DAYS || 0;
        const isTrialing = status === 'trialing' && trialDaysRemaining > 0;
        const isNewRegistration = this._isNewRegistration || false;

        // Format trial end date for button text
        let trialEndFormatted = '';
        if (isTrialing && sub.trial_ends_at) {
            const d = new Date(sub.trial_ends_at);
            trialEndFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        let statusMessage = '';
        if (isNewRegistration && trialDays > 0) {
            statusMessage = `<div class="subscription-status-banner trial">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>You have a <strong>${trialDays}-day free trial</strong>. Choose a plan to continue after your trial, or skip for now.</span>
            </div>`;
        } else if (isTrialing) {
            statusMessage = `<div class="subscription-status-banner trial">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Your trial ends in <strong>${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''}</strong>. Subscribe now - you won't be charged until your trial ends.</span>
            </div>`;
        } else if (status === 'trialing' || (status === 'expired' && !sub.current_period_end)) {
            statusMessage = `<div class="subscription-status-banner expired">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Your free trial has expired</span>
            </div>`;
        } else if (status === 'past_due') {
            statusMessage = `<div class="subscription-status-banner expired">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Your payment is past due. Please update your payment method.</span>
            </div>`;
        } else if (status === 'canceled' || status === 'expired') {
            statusMessage = `<div class="subscription-status-banner expired">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Your subscription has expired</span>
            </div>`;
        }

        // Subscribe button text
        const subscribeBtnText = isTrialing
            ? `Subscribe - Free until ${trialEndFormatted}`
            : 'Subscribe';

        const manageLink = hasStripeCustomer
            ? `<p class="auth-mode-switch"><a href="#" id="subManage">Manage Existing Subscription</a></p>`
            : '';

        // Show "Skip for now" during active trial or new registration with trial enabled
        const canSkip = isTrialing || (isNewRegistration && trialDays > 0);
        const skipLink = canSkip
            ? `<p class="auth-mode-switch"><a href="#" id="subSkipTrial">Continue with free trial</a></p>`
            : '';

        return `
            <div class="auth-page">
                <div class="auth-container auth-container-wide">
                    <div class="auth-header">
                        <div class="auth-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <h1 class="auth-title">Choose Your Plan</h1>
                        <p class="auth-subtitle">${isTrialing
                            ? 'Subscribe to keep your vault after the trial. You won\'t be charged until your trial ends.'
                            : 'Subscribe to access your encrypted vault across all devices'}</p>
                    </div>

                    ${statusMessage}

                    <div class="subscription-plans">
                        <div class="subscription-plan-card selectable" id="planMonthly" data-plan="monthly">
                            <div class="plan-check">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <div class="plan-header">
                                <h3 class="plan-name">Monthly</h3>
                                <div class="plan-price">
                                    <span class="plan-amount">$3</span>
                                    <span class="plan-period">/month</span>
                                </div>
                            </div>
                            <ul class="plan-features">
                                <li>Unlimited passwords</li>
                                <li>Cross-device sync</li>
                                <li>End-to-end encryption</li>
                                <li>File attachments</li>
                                <li>Cancel anytime</li>
                            </ul>
                        </div>

                        <div class="subscription-plan-card selectable selected" id="planYearly" data-plan="yearly">
                            <div class="plan-badge">Best Value</div>
                            <div class="plan-check">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <div class="plan-header">
                                <h3 class="plan-name">Yearly</h3>
                                <div class="plan-price">
                                    <span class="plan-amount">$24</span>
                                    <span class="plan-period">/year</span>
                                </div>
                                <div class="plan-savings">Save 33%</div>
                            </div>
                            <ul class="plan-features">
                                <li>Everything in Monthly</li>
                                <li>4 months free</li>
                                <li>Priority support</li>
                            </ul>
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block" id="subSubscribe" style="margin-top: var(--space-3);">
                        <span class="btn-text">${subscribeBtnText}</span>
                        <span class="btn-loading" style="display: none;"><div class="spinner"></div></span>
                    </button>

                    <div class="auth-footer">
                        ${manageLink}
                        ${skipLink}
                        <p class="auth-mode-switch"><a href="#" id="subSwitchToLocal">Switch to Local Mode</a></p>
                        <p><a href="#" id="subLogout">Logout</a></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Currently selected plan
     */
    _selectedPlan: 'yearly',

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Plan card selection
        document.querySelectorAll('.subscription-plan-card.selectable').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.subscription-plan-card.selectable').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this._selectedPlan = card.dataset.plan;
            });
        });

        // Single subscribe button
        document.getElementById('subSubscribe')?.addEventListener('click', () => {
            this.handleCheckout(this._selectedPlan);
        });

        // Manage subscription
        document.getElementById('subManage')?.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await ApiClient.createPortal();
                if (response.success && response.data.portal_url) {
                    window.open(response.data.portal_url, '_blank');
                }
            } catch (err) {
                Toast.error('Failed to open subscription portal');
            }
        });

        // Skip trial - advance registration step or continue to vault
        document.getElementById('subSkipTrial')?.addEventListener('click', async (e) => {
            e.preventDefault();
            this._isNewRegistration = false;
            try {
                // If in registration flow, advance to next step
                const response = await ApiClient.confirmSubscriptionStep();
                if (response.success && response.data.registration_step) {
                    App.showRegistrationStep(response.data.registration_step);
                    return;
                }
            } catch (err) {
                // Not in registration flow - just go to vault
            }
            App.showView('vault');
        });

        // Switch to local mode
        document.getElementById('subSwitchToLocal')?.addEventListener('click', async (e) => {
            e.preventDefault();
            // Logout from cloud and switch to local
            try {
                await ApiClient.logout();
            } catch (err) {
                // Ignore logout errors
            }
            ApiClient.clearAuth();
            localStorage.setItem('keyhive_mode', 'local');
            App.showView('setup-master-local');
        });

        // Logout
        document.getElementById('subLogout')?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (typeof App !== 'undefined') {
                await App.logout();
            }
        });
    },

    /**
     * Handle checkout button click
     * @param {string} plan - 'monthly' or 'yearly'
     */
    async handleCheckout(plan) {
        const btn = document.getElementById('subSubscribe');
        if (!btn) return;

        // Show loading state
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = '';
        btn.disabled = true;

        try {
            // Get the price ID from server - we send plan type, server resolves to Stripe price ID
            const response = await ApiClient.createCheckout(plan);
            if (response.success && response.data.checkout_url) {
                window.location.href = response.data.checkout_url;
                return; // Don't reset button - we're navigating away
            }
            Toast.error('Failed to create checkout session');
        } catch (err) {
            if (err.status !== 402) {
                Toast.error(err.message || 'Failed to start checkout');
            }
        }

        // Reset button
        if (btnText) btnText.style.display = '';
        if (btnLoading) btnLoading.style.display = 'none';
        btn.disabled = false;
    },
};
