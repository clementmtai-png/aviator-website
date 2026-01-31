const Engine = {
    canvas: null,
    ctx: null,
    running: false,
    multiplier: 1.00,
    crashPoint: 0,
    startTime: 0,
    history: [],
    forcedCrash: null,

    init() {
        this.canvas = Utils.el('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.onresize = () => this.resize();

        Utils.el('action-btn').onclick = () => this.handleAction();
        this.loop();

        // Initial round
        setTimeout(() => this.prepareRound(), 2000);
    },

    resize() {
        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    },

    prepareRound() {
        this.multiplier = 1.00;
        this.running = false;
        this.history = [];

        // Admin or Random crash point
        this.crashPoint = this.forcedCrash || this.generateCrashPoint();
        this.forcedCrash = null;

        Utils.hide('crash-msg');
        Utils.el('multiplier-value').className = '';
        Utils.el('multiplier-value').innerText = "1.00x";

        // Start after small delay
        setTimeout(() => this.start(), 1000);
    },

    generateCrashPoint() {
        // Realistic crash algorithm
        const r = Math.random();
        if (r < 0.05) return 1.00; // 5% instant crash
        return Math.max(1.00, (0.99 / (1 - Math.random())).toFixed(2));
    },

    start() {
        this.startTime = Date.now();
        this.running = true;
        UI.notify("Round started!", "info");
    },

    crash() {
        this.running = false;
        Utils.show('crash-msg');
        Utils.el('final-multiplier').innerText = this.multiplier.toFixed(2) + "x";
        Utils.el('multiplier-value').classList.add('crashed');

        // Record history
        this.addHistory(this.multiplier);

        // Prepare next round
        setTimeout(() => this.prepareRound(), CONFIG.GAME_COOLDOWN);
    },

    addHistory(val) {
        const pill = document.createElement('div');
        pill.className = `pill ${val < 2 ? 'low' : (val < 10 ? 'mid' : 'high')}`;
        pill.innerText = val.toFixed(2) + "x";
        const container = Utils.el('history-pills');
        container.prepend(pill);
        if (container.children.length > 20) container.lastChild.remove();
    },

    handleAction() {
        if (!Auth.currentUser) {
            UI.showModal('login-modal');
            return;
        }
        // Logic for bet/cashout here
        UI.notify("Bet placed!", "info");
    },

    loop() {
        if (this.running) {
            const elapsed = (Date.now() - this.startTime) / 1000;
            this.multiplier = Math.pow(Math.E, 0.06 * elapsed);

            // Core UI update - lightweight
            Utils.el('multiplier-value').innerText = this.multiplier.toFixed(2) + "x";

            // Throttle thick dispatch to 10hz to save main thread but keeps engine at 60hz
            if (Math.floor(elapsed * 10) !== this._lastTick) {
                this._lastTick = Math.floor(elapsed * 10);
                window.dispatchEvent(new CustomEvent('game-tick', { detail: { multiplier: this.multiplier } }));
            }

            if (this.multiplier >= this.crashPoint) {
                this.crash();
            }
        }

        this.draw();

        // Use requestAnimationFrame for a buttery 60FPS
        requestAnimationFrame(() => this.loop());
    },

    draw() {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.ctx.clearRect(0, 0, w, h);

        if (!this.running && this.multiplier === 1) return;

        // Draw flight path
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.running ? '#d32f2f' : '#444';
        this.ctx.lineWidth = 4;

        // Simple parabolic arc simulation
        const points = Math.min(100, (this.multiplier - 1) * 50);
        for (let i = 0; i < points; i++) {
            const tx = (i / 100) * w * 0.8;
            const ty = h - (Math.pow(i / 10, 2) + 20);
            if (i === 0) this.ctx.moveTo(tx, ty);
            else this.ctx.lineTo(tx, ty);
        }
        this.ctx.stroke();

        // Draw Plane Sprite (Simplified as a red triangle for now)
        const px = (points / 100) * w * 0.8;
        const py = h - (Math.pow(points / 10, 2) + 20);

        this.ctx.fillStyle = '#d32f2f';
        this.ctx.beginPath();
        this.ctx.moveTo(px, py);
        this.ctx.lineTo(px - 20, py + 5);
        this.ctx.lineTo(px - 15, py - 10);
        this.ctx.closePath();
        this.ctx.fill();

        // Action glow
        if (this.running) {
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = 'rgba(211, 47, 47, 0.5)';
        }
    }
};
