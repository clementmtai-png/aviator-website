const Engine = {
    canvas: null,
    ctx: null,
    running: false,
    multiplier: 1.00,
    crashPoint: 0,
    startTime: 0,
    history: [],
    forcedCrash: null,
    testGoldenHour: false,

    // Betting System
    userBet: null, // { amount: number, status: 'betting' | 'cashed' | 'lost' }
    nextBetAmount: 10.00,

    init() {
        this.canvas = Utils.el('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.onresize = () => this.resize();

        Utils.el('action-btn').onclick = () => this.handleAction();
        // Secondary button also triggers action
        Utils.el('action-btn-2').onclick = () => this.handleAction();

        // Listen for bet amount changes
        Utils.el('bet-amount').onchange = (e) => {
            this.nextBetAmount = parseFloat(e.target.value) || 10.00;
        };

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

        // Reset betting status for next round
        if (this.userBet) {
            if (this.userBet.status === 'betting') {
                this.userBet.status = 'lost';
                UI.notify("Round Over: Better luck next time!", "error");
            }
            this.userBet = null;
        }

        this.updateButtonUI('BET');

        // Admin or Random crash point
        this.crashPoint = this.forcedCrash || this.generateCrashPoint();
        this.forcedCrash = null;

        Utils.hide('crash-msg');
        Utils.el('multiplier-value').className = '';
        Utils.el('multiplier-value').innerText = "1.00x";

        window.dispatchEvent(new CustomEvent('round-start'));

        // Start after small delay
        setTimeout(() => this.start(), 2000);
    },

    isGoldenHour() {
        if (this.testGoldenHour) return true;
        // Golden hour: first 2 minutes after every hour mark → runs above 20x
        const now = new Date();
        const min = now.getMinutes();
        const sec = now.getSeconds();
        const totalSecIntoHour = min * 60 + sec;
        return totalSecIntoHour < 120; // 0:00–1:59 of each hour
    },

    generateCrashPoint() {
        // Golden hour: after every hour mark, for 2 mins, crash points are above 20x
        if (this.isGoldenHour()) {
            const minCrash = 20;
            const maxCrash = 50 + Math.random() * 50; // 20–100x range
            return parseFloat((minCrash + Math.random() * (maxCrash - minCrash)).toFixed(2));
        }
        // Normal: realistic crash algorithm
        const r = Math.random();
        if (r < 0.03) return 1.00; // 3% instant crash
        return parseFloat(Math.max(1.01, (0.99 / (1 - Math.random())).toFixed(2)));
    },

    start() {
        this.startTime = Date.now();
        this.running = true;
        UI.notify("Round Started!", "info");
    },

    crash() {
        this.running = false;
        Utils.show('crash-msg');
        Utils.el('final-multiplier').innerText = this.multiplier.toFixed(2) + "x";
        Utils.el('multiplier-value').classList.add('crashed');

        if (this.userBet && this.userBet.status === 'betting') {
            this.userBet.status = 'lost';
            this.updateButtonUI('BET');
        }

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

    async handleAction() {
        if (!Auth.currentUser) {
            UI.showModal('login-modal');
            return;
        }

        // 1. PLACE BET (Before round starts or while waiting)
        if (!this.running && !this.userBet) {
            const amount = parseFloat(Utils.el('bet-amount').value);
            const ok = await Wallet.withdraw(amount);
            if (ok) {
                this.userBet = { amount: amount, status: 'betting' };
                this.updateButtonUI('WAITING');
                UI.notify(`Bet Placed: $${amount.toFixed(2)}`, "success");
            }
            return;
        }

        // 2. CASH OUT (During flight)
        if (this.running && this.userBet && this.userBet.status === 'betting') {
            const win = this.userBet.amount * this.multiplier;
            this.userBet.status = 'cashed';
            this.userBet.winAmount = win;
            await Wallet.addWin(win);
            this.updateButtonUI('BET');
            UI.notify(`Cashed Out: KES ${Utils.formatMoney(win)} @ ${this.multiplier.toFixed(2)}x`, "success");
            return;
        }
    },

    updateButtonUI(state) {
        const btn1 = Utils.el('action-btn');
        const btn2 = Utils.el('action-btn-2');

        if (state === 'BET') {
            btn1.innerText = 'BET';
            btn1.className = 'bet-btn main-action';
            btn1.disabled = false;
            btn2.innerText = 'BET';
            btn2.className = 'bet-btn secondary-action';
            btn2.disabled = false;
        } else if (state === 'WAITING') {
            btn1.innerText = 'WAITING';
            btn1.disabled = true;
            btn2.innerText = 'WAITING';
            btn2.disabled = true;
        } else if (state === 'CASHOUT') {
            const win = (this.userBet.amount * this.multiplier).toFixed(2);
            btn1.innerText = `CASH OUT\n$${win}`;
            btn1.className = 'bet-btn cashout-action';
            btn1.disabled = false;
            // For now, mirror boat buttons if one is used
            btn2.innerText = `CASH OUT\n$${win}`;
            btn2.className = 'bet-btn cashout-action';
            btn2.disabled = false;
        }
    },

    loop() {
        if (this.running) {
            const elapsed = (Date.now() - this.startTime) / 1000;
            this.multiplier = Math.pow(Math.E, 0.06 * elapsed);

            // Core UI update
            Utils.el('multiplier-value').innerText = this.multiplier.toFixed(2) + "x";

            // Update button if user is betting
            if (this.userBet && this.userBet.status === 'betting') {
                this.updateButtonUI('CASHOUT');
            }

            if (Math.floor(elapsed * 10) !== this._lastTick) {
                this._lastTick = Math.floor(elapsed * 10);
                window.dispatchEvent(new CustomEvent('game-tick', { detail: { multiplier: this.multiplier } }));
            }

            if (this.multiplier >= this.crashPoint) {
                this.crash();
            }
        }

        const goldenBadge = Utils.el('golden-hour-badge');
        if (goldenBadge) {
            if (this.isGoldenHour()) Utils.show('golden-hour-badge');
            else Utils.hide('golden-hour-badge');
        }

        this.draw();
        requestAnimationFrame(() => this.loop());
    },

    draw() {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.ctx.clearRect(0, 0, w, h);

        if (!this.running && this.multiplier === 1) return;

        // Draw flight path (curved line)
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.running ? '#d32f2f' : '#444';
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';

        const points = Math.min(100, (this.multiplier - 1) * 20); // Faster curve visual

        // Simple parabolic arc simulation
        this.ctx.moveTo(w * 0.05, h * 0.85); // Start bottom left

        for (let i = 1; i <= points; i++) {
            const tx = w * 0.05 + (i / 100) * w * 0.8;
            const ty = h * 0.85 - (Math.pow(i / 10, 2.2) * 2.5);
            this.ctx.lineTo(tx, ty);
        }
        this.ctx.stroke();

        // Draw Glow
        if (this.running) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = 'rgba(211, 47, 47, 0.6)';
        } else {
            this.ctx.shadowBlur = 0;
        }

        const px = w * 0.05 + (points / 100) * w * 0.8;
        const py = h * 0.85 - (Math.pow(points / 10, 2.2) * 2.5);

        // Draw Indicator (Glowing Dot instead of airplane)
        this.ctx.save();
        this.ctx.translate(px, py);

        // Outer glow
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
        gradient.addColorStop(0, 'rgba(211, 47, 47, 1)');
        gradient.addColorStop(0.4, 'rgba(211, 47, 47, 0.4)');
        gradient.addColorStop(1, 'rgba(211, 47, 47, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 15, 0, Math.PI * 2);
        this.ctx.fill();

        // Inner solid dot
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    },


};
