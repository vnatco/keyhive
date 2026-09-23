/**
 * Honeycomb Background Animation
 *
 * Animated hexagonal particle system for auth pages.
 * Call Honeycomb.start() to create and animate, Honeycomb.stop() to destroy.
 * Adapts to theme (dark/light) and screen size.
 */
const Honeycomb = {
    _canvas: null,
    _overlay: null,
    _ctx: null,
    _cells: [],
    _mouse: { x: null, y: null },
    _animId: null,
    _resizeHandler: null,
    _mouseMoveHandler: null,
    _mouseLeaveHandler: null,
    _touchMoveHandler: null,
    _touchEndHandler: null,

    // Config
    COLOR: [255, 107, 107],

    /**
     * Start the honeycomb animation inside the given container
     * @param {HTMLElement} container - Element to render into (must have position: relative or similar)
     */
    start(container) {
        if (!container || this._canvas) return;

        // Create canvas
        this._canvas = document.createElement('canvas');
        this._canvas.className = 'honeycomb-canvas';
        container.insertBefore(this._canvas, container.firstChild);

        // Create overlay
        this._overlay = document.createElement('div');
        this._overlay.className = 'honeycomb-overlay';
        container.insertBefore(this._overlay, this._canvas.nextSibling);

        this._ctx = this._canvas.getContext('2d');
        this._container = container;

        // Precompute hex angles
        this._hexAngles = [];
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            this._hexAngles.push({ cos: Math.cos(a), sin: Math.sin(a) });
        }

        this._resize();
        this._buildGrid();

        // Event listeners
        this._resizeHandler = () => { this._resize(); this._buildGrid(); };
        this._mouseMoveHandler = (e) => {
            const r = this._container.getBoundingClientRect();
            this._mouse.x = e.clientX - r.left;
            this._mouse.y = e.clientY - r.top;
        };
        this._mouseLeaveHandler = () => { this._mouse.x = null; this._mouse.y = null; };
        this._touchMoveHandler = (e) => {
            const r = this._container.getBoundingClientRect();
            const t = e.touches[0];
            this._mouse.x = t.clientX - r.left;
            this._mouse.y = t.clientY - r.top;
        };
        this._touchEndHandler = () => { this._mouse.x = null; this._mouse.y = null; };

        window.addEventListener('resize', this._resizeHandler);
        this._container.addEventListener('mousemove', this._mouseMoveHandler);
        this._container.addEventListener('mouseleave', this._mouseLeaveHandler);
        this._container.addEventListener('touchmove', this._touchMoveHandler);
        this._container.addEventListener('touchend', this._touchEndHandler);

        this._animId = requestAnimationFrame((t) => this._draw(t));
    },

    /**
     * Stop animation and remove canvas + overlay
     */
    stop() {
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }

        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }
        if (this._container) {
            this._container.removeEventListener('mousemove', this._mouseMoveHandler);
            this._container.removeEventListener('mouseleave', this._mouseLeaveHandler);
            this._container.removeEventListener('touchmove', this._touchMoveHandler);
            this._container.removeEventListener('touchend', this._touchEndHandler);
        }

        if (this._canvas && this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }

        this._canvas = null;
        this._overlay = null;
        this._ctx = null;
        this._cells = [];
        this._container = null;
        this._mouse = { x: null, y: null };
    },

    _getConfig() {
        const isSmall = window.innerWidth < 500;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            hexRadius: isSmall ? 14 : 20,
            spacing: isSmall ? 36 : 52,
            skipChance: isSmall ? 0.25 : 0.35,
            mouseRadius: 220,
            pushForce: 10,
            pushReturn: 0.02,
            pushDamping: 0.94,
            baseOpacity: isDark ? 0.15 : 0.22,
            hoverOpacity: isDark ? 0.58 : 0.78,
            baseFill: isDark ? 0.05 : 0.07,
            hoverFill: isDark ? 0.24 : 0.34,
            floatAmp: 2,
            floatSpeed: 0.0005,
        };
    },

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        const w = this._container.clientWidth;
        const h = this._container.clientHeight;
        this._canvas.width = w * dpr;
        this._canvas.height = h * dpr;
        this._canvas.style.width = w + 'px';
        this._canvas.style.height = h + 'px';
        this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    _buildGrid() {
        this._cells = [];
        const cfg = this._getConfig();
        this._cfg = cfg;
        const w = this._container.clientWidth;
        const h = this._container.clientHeight;

        // Void zones
        const voidCount = Math.floor((w * h) / 120000) + 2;
        const voids = [];
        for (let v = 0; v < voidCount; v++) {
            voids.push({ x: Math.random() * w, y: Math.random() * h, rx: 50 + Math.random() * 90, ry: 40 + Math.random() * 70 });
        }
        const inVoid = (px, py) => {
            for (const vz of voids) {
                const dx = (px - vz.x) / vz.rx, dy = (py - vz.y) / vz.ry;
                if (dx * dx + dy * dy < 1) return true;
            }
            return false;
        };

        const colStep = cfg.spacing, rowStep = cfg.spacing * 0.866;
        const cols = Math.ceil(w / colStep) + 3, rows = Math.ceil(h / rowStep) + 3;

        for (let row = -1; row < rows; row++) {
            for (let col = -1; col < cols; col++) {
                const bx = col * colStep + (row % 2 ? colStep * 0.5 : 0);
                const by = row * rowStep;
                if (inVoid(bx, by) || Math.random() < cfg.skipChance) continue;
                this._cells.push({
                    bx, by, x: bx, y: by,
                    px: 0, py: 0, pvx: 0, pvy: 0,
                    radius: cfg.hexRadius * (0.6 + Math.random() * 0.5),
                    opacity: 0, fillOpacity: 0,
                    fp1: Math.random() * Math.PI * 2,
                    fp2: Math.random() * Math.PI * 2,
                    neighbors: [],
                    brighten: Math.random() * 0.1
                });
            }
        }

        const nd = cfg.spacing * 1.3;
        for (let i = 0; i < this._cells.length; i++) {
            for (let j = i + 1; j < this._cells.length; j++) {
                const dx = this._cells[i].bx - this._cells[j].bx;
                const dy = this._cells[i].by - this._cells[j].by;
                if (dx * dx + dy * dy < nd * nd) {
                    this._cells[i].neighbors.push(j);
                    this._cells[j].neighbors.push(i);
                }
            }
        }
    },

    _hexPath(cx, cy, r) {
        this._ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const hx = cx + r * this._hexAngles[i].cos;
            const hy = cy + r * this._hexAngles[i].sin;
            i === 0 ? this._ctx.moveTo(hx, hy) : this._ctx.lineTo(hx, hy);
        }
        this._ctx.closePath();
    },

    _draw(time) {
        if (!this._canvas) return;

        const ctx = this._ctx;
        const cfg = this._cfg;
        const cells = this._cells;
        const mouse = this._mouse;
        const COLOR = this.COLOR;
        const GLOW = [Math.min(255, COLOR[0]+30), Math.min(255, COLOR[1]+30), Math.min(255, COLOR[2]+30)];
        const w = this._container.clientWidth;
        const h = this._container.clientHeight;

        ctx.clearRect(0, 0, w, h);
        const hasMouse = mouse.x !== null;
        const lerp = (a, b, t) => a + (b - a) * t;

        // Update cells
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            const fx = Math.sin(time * cfg.floatSpeed + c.fp1) * cfg.floatAmp;
            const fy = Math.cos(time * cfg.floatSpeed * 0.8 + c.fp2) * cfg.floatAmp;
            let proximity = 0;
            if (hasMouse) {
                const dx = (c.bx + fx) - mouse.x, dy = (c.by + fy) - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < cfg.mouseRadius && dist > 0) {
                    proximity = 1 - dist / cfg.mouseRadius;
                    proximity = proximity * proximity * proximity;
                    c.pvx += (dx / dist) * cfg.pushForce * proximity * 0.025;
                    c.pvy += (dy / dist) * cfg.pushForce * proximity * 0.025;
                }
            }
            c.pvx += -c.px * cfg.pushReturn; c.pvy += -c.py * cfg.pushReturn;
            c.pvx *= cfg.pushDamping; c.pvy *= cfg.pushDamping;
            c.px += c.pvx; c.py += c.pvy;
            c.x = c.bx + fx + c.px; c.y = c.by + fy + c.py;
            c.opacity = lerp(c.opacity, cfg.baseOpacity + (cfg.hoverOpacity - cfg.baseOpacity) * proximity, 0.1);
            c.fillOpacity = lerp(c.fillOpacity, cfg.baseFill + (cfg.hoverFill - cfg.baseFill) * proximity, 0.1);
        }

        // Connections
        ctx.lineWidth = 0.5;
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            for (let n = 0; n < c.neighbors.length; n++) {
                const j = c.neighbors[n]; if (j <= i) continue;
                const c2 = cells[j];
                const po = Math.max(c.opacity, c2.opacity);
                if (po < 0.015) continue;
                const dx = c.x - c2.x, dy = c.y - c2.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > cfg.spacing * 1.5) continue;
                ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c2.x, c2.y);
                ctx.strokeStyle = `rgba(${COLOR[0]},${COLOR[1]},${COLOR[2]},${(1 - d / (cfg.spacing * 1.5)) * po * 0.5})`;
                ctx.stroke();
            }
        }

        // Hexagons
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i]; if (c.opacity < 0.005) continue;
            this._hexPath(c.x, c.y, c.radius);
            ctx.fillStyle = `rgba(${COLOR[0]},${COLOR[1]},${COLOR[2]},${c.fillOpacity})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(${COLOR[0]},${COLOR[1]},${COLOR[2]},${c.opacity + c.brighten})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        // Mouse glow
        if (hasMouse) {
            const mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, cfg.mouseRadius * 0.35);
            mg.addColorStop(0, `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},0.03)`);
            mg.addColorStop(1, `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},0)`);
            ctx.beginPath(); ctx.arc(mouse.x, mouse.y, cfg.mouseRadius * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = mg; ctx.fill();
        }

        this._animId = requestAnimationFrame((t) => this._draw(t));
    }
};
