const Engine = {
    canvas: null,
    ctx: null,
    running: false,
    multiplier: 1.00,
    crashPoint: 0,
    startTime: 0,
    history: [],
    forcedCrash: null,
    historyLoaded: false,
    isServerDriven: false, // Now deterministic local logic drives it
    serverTimeOffset: 0,

    // Style & Anim state
    particles: [],
    gridOffset: 0,
    wobble: 0,

    // Time constants (from lib/game.js concept)
    ROUND_CYCLE: 20000,
    BETTING_TIME: 5000,
    COOLDOWN_TIME: 3000,

    // Betting System
    userBet: null, // { amount: number, status: 'betting' | 'cashed' | 'lost' }
    nextBetAmount: 10.00,

    init() {
        this.canvas = Utils.el('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.onresize = () => this.resize();

        Utils.el('action-btn').onclick = () => this.handleAction();
        Utils.el('action-btn-2').onclick = () => this.handleAction();

        Utils.el('bet-amount').onchange = (e) => {
            this.nextBetAmount = parseFloat(e.target.value) || 10.00;
        };

        this.loadHistory();
        this.loop();

        // Safety timeout: If no sync after 10s, fallback to local
        setTimeout(() => {
            if (!this.running && this.isServerDriven && !this._firstSyncDone) {
                console.warn("[Engine] No server sync detected. Falling back to local simulation...");
                this.isServerDriven = false;
                this.prepareRound();
            }
        }, 10000);
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

        // Admin or Random crash point (Local only)
        if (!this.isServerDriven) {
            this.crashPoint = this.forcedCrash || this.generateCrashPoint();
            this.forcedCrash = null;

            window.dispatchEvent(new CustomEvent('round-start'));

            // Start after small delay
            setTimeout(() => this.start(), 2000);
        }

        Utils.hide('crash-msg');
        Utils.el('multiplier-value').className = '';
        Utils.el('multiplier-value').innerText = "1.00x";
    },

    generateCrashPoint() {
        // Realistic crash algorithm
        const r = Math.random();
        if (r < 0.03) return 1.00; // 3% instant crash
        return Math.max(1.01, (0.99 / (1 - Math.random())).toFixed(2));
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

        // Prepare next round (Local only)
        if (!this.isServerDriven) {
            setTimeout(() => this.prepareRound(), CONFIG.GAME_COOLDOWN);
        }
    },

    addHistory(val) {
        const now = Date.now() + this.serverTimeOffset;
        const roundId = now - (now % this.ROUND_CYCLE);
        if (typeof Bets !== 'undefined') {
            Bets.addHistory(val, roundId);
        }
    },

    async loadHistory() {
        try {
            const res = await fetch('/api/game?action=history');
            const data = await res.json();

            if (data.success && data.history && data.history.length > 0) {
                const container = Utils.el('history-pills');
                container.innerHTML = '';

                const recentHistory = data.history.slice(0, 20);
                recentHistory.reverse().forEach(round => {
                    const pill = document.createElement('div');
                    const val = round.crashPoint;
                    pill.className = `pill ${val < 2 ? 'low' : (val < 10 ? 'mid' : 'high')}`;
                    pill.innerText = val.toFixed(2) + "x";
                    container.appendChild(pill);
                });

                this.historyLoaded = true;
                console.log(`Loaded ${data.history.length} rounds from history`);
            }
        } catch (e) {
            console.error('Failed to load game history:', e);
        }
    },

    async handleAction() {
        if (!Auth.currentUser) {
            UI.showModal('login-modal');
            return;
        }

        const now = Date.now() + this.serverTimeOffset;
        const cycleTime = now % this.ROUND_CYCLE;

        // 1. PLACE BET (During betting phase)
        if (cycleTime < this.BETTING_TIME && !this.userBet) {
            const amount = parseFloat(Utils.el('bet-amount').value);
            // Verify balance and place bet via API
            try {
                const res = await fetch('/api/game', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'bet', username: Auth.currentUser.username, amount })
                });
                const data = await res.json();
                if (data.success) {
                    this.userBet = { amount, status: 'betting' };
                    Auth.currentUser.balance = data.balance;
                    Auth.updateUI();
                    this.updateButtonUI('WAITING');
                    UI.notify(`Bet Placed: KES ${amount.toFixed(2)}`, "success");
                } else {
                    UI.notify(data.error || 'Bet failed', 'error');
                }
            } catch (e) { UI.notify('Network error', 'error'); }
            return;
        }

        // 2. CASH OUT (During flight)
        if (this.running && this.userBet && this.userBet.status === 'betting') {
            try {
                const res = await fetch('/api/game', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'cashout', username: Auth.currentUser.username })
                });
                const data = await res.json();
                if (data.success) {
                    this.userBet.status = 'cashed';
                    Auth.currentUser.balance = data.balance;
                    Auth.updateUI();
                    this.updateButtonUI('BET');
                    UI.notify(`Cashed Out: KES ${data.winnings.toFixed(2)} @ ${data.cashoutMultiplier.toFixed(2)}x`, "success");
                } else {
                    UI.notify(data.error || 'Cashout failed', 'error');
                }
            } catch (e) { UI.notify('Network error', 'error'); }
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
        const now = Date.now() + this.serverTimeOffset;
        const cycleTime = now % this.ROUND_CYCLE;
        const roundStartTime = now - cycleTime + this.BETTING_TIME;

        if (cycleTime < this.BETTING_TIME) {
            // PHASE: BETTING
            if (this.running) {
                this.running = false;
                this.updateButtonUI('BET');
            }
            this.multiplier = 1.00;
            Utils.el('multiplier-value').innerText = "BETTING...";
            Utils.hide('crash-msg');
            Utils.el('multiplier-value').classList.remove('crashed');

            // Clean up old bet if it was lost/cashed
            if (this.userBet && this.userBet.status !== 'betting') {
                this.userBet = null;
            }
        } else {
            // PHASE: FLIGHT or COOLDOWN
            const crashPoint = typeof getDeterministicCrashPoint !== 'undefined' ? getDeterministicCrashPoint(now - cycleTime) : 2.0;
            const elapsed = now - roundStartTime;
            const currentMult = Math.exp(0.00006 * Math.max(0, elapsed));

            if (currentMult >= crashPoint) {
                // PHASE: CRASHED
                if (this.running || this.multiplier < crashPoint) {
                    this.running = false;
                    this.multiplier = crashPoint;
                    this.crash();
                }
            } else {
                // PHASE: RUNNING
                this.running = true;
                this.startTime = roundStartTime;
                this.crashPoint = crashPoint;
                this.multiplier = currentMult;

                Utils.el('multiplier-value').innerText = this.multiplier.toFixed(2) + "x";
                Utils.hide('crash-msg');
                Utils.el('multiplier-value').classList.remove('crashed');

                if (this.userBet && this.userBet.status === 'betting') {
                    this.updateButtonUI('CASHOUT');
                }
            }
        }

        this.draw();
        requestAnimationFrame(() => this.loop());
    },

    /**
     * Particle System
     */
    addParticle(x, y) {
        if (!this.particles) this.particles = []; // Initialize if not present
        this.particles.push({
            x, y,
            vx: Utils.randomRange(-1.5, -0.5),
            vy: Utils.randomRange(-0.5, 0.5),
            life: 1.0,
            size: Utils.randomRange(2, 6)
        });
    },

    updateParticles() {
        if (!this.particles) return;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    },

    drawGrid(w, h) {
        this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
        this.ctx.lineWidth = 1;

        const gridSize = 60;
        const scrollFactor = (this.multiplier - 1) * 200 % gridSize;

        this.ctx.beginPath();
        // Verticals
        for (let x = -gridSize; x < w + gridSize; x += gridSize) {
            this.ctx.moveTo(x - scrollFactor, 0);
            this.ctx.lineTo(x - scrollFactor, h);
        }
        // Horizontals
        for (let y = -gridSize; y < h + gridSize; y += gridSize) {
            this.ctx.moveTo(0, y + scrollFactor);
            this.ctx.lineTo(w, y + scrollFactor);
        }
        this.ctx.stroke();

        // Radar Scan Line
        const scanY = (Date.now() / 50) % h;
        const scanGrd = this.ctx.createLinearGradient(0, scanY, 0, scanY + 100);
        scanGrd.addColorStop(0, 'rgba(99, 102, 241, 0.1)');
        scanGrd.addColorStop(0.5, 'rgba(99, 102, 241, 0)');
        this.ctx.fillStyle = scanGrd;
        this.ctx.fillRect(0, scanY, w, 100);
    },

    draw() {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }

        this.ctx.clearRect(0, 0, w, h);

        // 1. Draw Background Grid
        this.drawGrid(w, h);

        if (!this.running && this.multiplier === 1) return;

        // 2. Update & Draw Particles
        if (this.running) {
            this.updateParticles();
        }

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        if (this.particles) { // Check if particles array exists
            this.particles.forEach(p => {
                this.ctx.globalAlpha = p.life;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
        this.ctx.globalAlpha = 1.0;

        // 3. Draw Flight Path
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.running ? 'var(--primary-red)' : '#444';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);

        const points = Math.min(100, (this.multiplier - 1) * 20);
        this.ctx.moveTo(w * 0.05, h * 0.85);

        for (let i = 1; i <= points; i++) {
            const tx = w * 0.05 + (i / 100) * w * 0.8;
            const ty = h * 0.85 - (Math.pow(i / 10, 2.2) * 2.5);
            this.ctx.lineTo(tx, ty);
        }
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset dash

        // 4. Draw Plane
        const px = w * 0.05 + (points / 100) * w * 0.8;
        const py = h * 0.85 - (Math.pow(points / 10, 2.2) * 2.5);

        if (this.running) {
            this.addParticle(px, py);
            this.wobble = Math.sin(Date.now() / 100) * 2;
        } else {
            this.wobble = 0; // Reset wobble when not running
        }

        this.ctx.save();
        this.ctx.translate(px, py + this.wobble);

        // Tilt based on climb
        const tilt = -Math.min(0.5, (this.multiplier - 1) * 0.1);
        this.ctx.rotate(tilt);

        // Draw Stylized Jet (High-End)
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = 'var(--primary-red)';

        // Flame
        if (this.running) {
            const flameGrd = this.ctx.createRadialGradient(-15, 0, 0, -15, 0, 10);
            flameGrd.addColorStop(0, '#fff');
            flameGrd.addColorStop(1, 'transparent');
            this.ctx.fillStyle = flameGrd;
            this.ctx.beginPath();
            this.ctx.arc(-15, 0, 8 + Math.random() * 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Body
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.moveTo(20, 0); // Nose
        this.ctx.lineTo(-10, -8); // Wing top
        this.ctx.lineTo(-5, 0); // Back center
        this.ctx.lineTo(-10, 8); // Wing bottom
        this.ctx.closePath();
        this.ctx.fill();

        // Cockpit
        this.ctx.fillStyle = 'var(--accent)';
        this.ctx.beginPath();
        this.ctx.ellipse(8, 0, 6, 3, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    },

    // === Server Sync Methods (for real-time multiplayer) ===

    syncState(state, serverTime) {
        this._firstSyncDone = true;
        if (serverTime) {
            this.serverTimeOffset = serverTime - Date.now();
            console.log(`[Sync] Server time offset calculated: ${this.serverTimeOffset}ms`);
        }

        if (state.phase === 'running') {
            const now = Date.now() + this.serverTimeOffset;
            const elapsed = now - state.startTime;
            console.log(`[Sync] Syncing to active round. Elapsed: ${elapsed}ms`);
            this.running = true;
            this.startTime = state.startTime;
            this.crashPoint = 99999;
            Utils.hide('crash-msg');
        } else if (state.phase === 'waiting') {
            console.log("[Sync] Waiting for round to start...");
            this.running = false;
            this.multiplier = 1.00;
            Utils.el('multiplier-value').innerText = "1.00x";
        } else if (state.phase === 'crashed') {
            console.log("[Sync] Current round is crashed.");
            this.running = false;
            this.multiplier = state.multiplier || 1.00;
        }
    },

    onServerStart(data) {
        // New round started by server
        this.multiplier = 1.00;
        this.startTime = data.startTime;
        this.running = true;
        this.userBet = null;

        Utils.hide('crash-msg');
        Utils.el('multiplier-value').className = '';
        Utils.el('multiplier-value').innerText = "1.00x";
        this.updateButtonUI('BET');
        UI.notify("Round Started!", "info");

        window.dispatchEvent(new CustomEvent('round-start'));
    },

    onServerTick(data) {
        // Multiplier update from server
        // To prevent lag/stutter, ONLY sync if deviation is significant (> 50ms drift)
        if (!this.running) {
            this.multiplier = data.multiplier;
            Utils.el('multiplier-value').innerText = this.multiplier.toFixed(2) + "x";
            return;
        }

        const elapsed = Date.now() - this.startTime;
        const localMult = Math.floor((Math.exp(0.00006 * elapsed)) * 100) / 100;
        const diff = Math.abs(localMult - data.multiplier);

        // Only hard-sync if we are off by more than 0.1x or if it's a huge drift
        if (diff > 0.1) {
            console.log('Syncing clock drift...');
            this.multiplier = data.multiplier;
            // Adjust start time to match server
            // data.multiplier ~ exp(0.00006 * elapsed) -> ln(m) / 0.00006 = elapsed
            const serverElapsed = Math.log(data.multiplier) / 0.00006;
            this.startTime = Date.now() - serverElapsed;
        }

        // Dispatch tick event regardless
        window.dispatchEvent(new CustomEvent('game-tick', { detail: { multiplier: this.multiplier } }));
    },

    onServerCrash(data) {
        // Game crashed - broadcast from server
        this.running = false;
        this.multiplier = data.crashPoint;

        Utils.show('crash-msg');
        Utils.el('final-multiplier').innerText = this.multiplier.toFixed(2) + "x";
        Utils.el('multiplier-value').classList.add('crashed');

        if (this.userBet && this.userBet.status === 'betting') {
            this.userBet.status = 'lost';
            UI.notify("Round Over: Better luck next time!", "error");
        }

        this.addHistory(this.multiplier);
        this.updateButtonUI('BET');
        this.userBet = null;
    },

    // Modified action handler for server-backed betting
    async handleActionServer() {
        if (!Auth.currentUser) {
            UI.showModal('login-modal');
            return;
        }

        // Place bet via server
        if (this.running && !this.userBet) {
            const amount = parseFloat(Utils.el('bet-amount').value);
            try {
                const res = await fetch('/api/game', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'bet', username: Auth.currentUser.username, amount })
                });
                const data = await res.json();
                if (data.success) {
                    this.userBet = { amount, status: 'betting' };
                    Auth.currentUser.balance = data.balance;
                    Auth.updateUI();
                    this.updateButtonUI('CASHOUT');
                    UI.notify(`Bet Placed: KES ${amount.toFixed(2)}`, "success");
                } else {
                    UI.notify(data.error || 'Bet failed', 'error');
                }
            } catch (e) {
                UI.notify('Network error', 'error');
            }
            return;
        }

        // Cash out via server
        if (this.running && this.userBet && this.userBet.status === 'betting') {
            try {
                const res = await fetch('/api/game', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'cashout', username: Auth.currentUser.username })
                });
                const data = await res.json();
                if (data.success) {
                    this.userBet.status = 'cashed';
                    Auth.currentUser.balance = data.balance;
                    Auth.updateUI();
                    this.updateButtonUI('BET');
                    UI.notify(`Cashed Out: KES ${data.winnings.toFixed(2)} @ ${data.cashoutMultiplier.toFixed(2)}x`, "success");
                } else {
                    UI.notify(data.error || 'Cashout failed', 'error');
                }
            } catch (e) {
                UI.notify('Network error', 'error');
            }
        }
    }

};
