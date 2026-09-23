/**
 * Edge-swipe-back for the full-screen card overlays (view / add / edit) on iOS.
 *
 * A swipe that starts near the left edge and moves right triggers the active overlay's
 * back button — so ALL existing back behaviour runs unchanged (e.g. the "unsaved changes"
 * confirmation shown when adding/editing). It never closes anything directly; it just
 * clicks the same back button a tap would.
 */
const SwipeBack = {
    EDGE_ZONE: 30,      // px from the left edge where the gesture may start
    MIN_DISTANCE: 70,   // min horizontal travel to count as a "back" swipe
    MAX_VERTICAL: 60,   // reject mostly-vertical swipes (those are scrolls)

    init() {
        // iOS only — Android has its own system edge-back gesture.
        if (typeof Platform === 'undefined' || Platform.getPlatform() !== 'ios') return;

        let startX = 0, startY = 0, active = false;

        document.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            active = !!(t && t.clientX <= this.EDGE_ZONE && this.topOverlay());
            if (active) { startX = t.clientX; startY = t.clientY; }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!active) return;
            active = false;
            const t = e.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - startX;
            const dy = Math.abs(t.clientY - startY);
            if (dx >= this.MIN_DISTANCE && dy <= this.MAX_VERTICAL) {
                const overlay = this.topOverlay();
                const back = overlay && overlay.querySelector('.edit-back, .view-back');
                if (back) back.click();   // defer entirely to the back button's own handler
            }
        }, { passive: true });
    },

    /** The topmost open card overlay (add/edit stacks above view). */
    topOverlay() {
        return document.querySelector('#addEditPage.active')
            || document.querySelector('#viewPage.active')
            || document.querySelector('.page-overlay.active');
    }
};

SwipeBack.init();
