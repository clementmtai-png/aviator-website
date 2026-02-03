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

    // Betting System
    userBet: null, // { amount: number, status: 'betting' | 'cashed' | 'lost' }
    nextBetAmount: 10.00,

    init() {
        this.canvas = Utils.el('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.multiplierValue = Utils.el('multiplier-value');

        this.resize();
        window.onresize = () => this.resize();

        Utils.el('action-btn').onclick = () => this.handleAction();
        // action-btn-2 removed in new UI layout


        // Listen for bet amount changes
        Utils.el('bet-amount').onchange = (e) => {
            this.nextBetAmount = parseFloat(e.target.value) || 10.00;
        };

        // Load game history from server
        this.loadHistory();

        this.prepareRound();
        this.loop();
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

    generateCrashPoint() {
        // Use deterministic logic from logic.js (included in index.html)
        if (typeof getDeterministicCrashPoint !== 'undefined') {
            const now = Date.now();
            const cycleTime = now % (typeof ROUND_CYCLE !== 'undefined' ? ROUND_CYCLE : 20000);
            const roundId = now - cycleTime;
            return getDeterministicCrashPoint(roundId);
        }

        // Fallback (should not happen if logic.js is loaded)
        const now = new Date();
        const minutes = now.getMinutes();
        if (minutes < 2) return parseFloat((20.00 + (Math.random() * 60.00)).toFixed(2));
        const r = Math.random();
        if (r < 0.03) return 1.00;
        return Math.max(1.00, (0.99 / (1 - Math.random())).toFixed(2));
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

        // Also update sidebar history if available
        if (typeof Bets !== 'undefined' && Bets.addHistoryRow) {
            Bets.addHistoryRow(val);
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

                    // Also populate sidebar history
                    if (typeof Bets !== 'undefined' && Bets.addHistoryRow) {
                        Bets.addHistoryRow(val);
                    }
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
            UI.notify(`Cashed Out: $${win.toFixed(2)} @ ${this.multiplier.toFixed(2)}x`, "success");
            return;
        }
    },

    updateButtonUI(state) {
        const btn1 = Utils.el('action-btn');

        if (state === 'BET') {
            const val = parseFloat(Utils.el('bet-amount').value) || 10.00;
            btn1.innerHTML = `BET <span id="btn-amount-display">${val.toFixed(2)} KES</span>`;
            btn1.className = 'bet-btn main-action large-btn';
            btn1.disabled = false;
        } else if (state === 'WAITING') {
            btn1.innerText = 'WAITING';
            btn1.disabled = true;
        } else if (state === 'CASHOUT') {
            const win = (this.userBet.amount * this.multiplier).toFixed(2);
            btn1.innerHTML = `CASH OUT<br><span style="font-size: 14px;">${win} KES</span>`;
            btn1.className = 'bet-btn cashout-action large-btn';
            btn1.disabled = false;
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

        this.draw();
        requestAnimationFrame(() => this.loop());
    },

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (!this.running && this.multiplier === 1) return;

        const startX = w * 0.05;
        const startY = h * 0.85;

        // Path calculation
        const progress = Math.min(1.2, (this.multiplier - 1) / 15); // Adjust scale to match height better
        const px = startX + progress * (w * 0.8);
        const py = startY - Math.pow(progress, 1.4) * (h * 0.7);

        // Draw shadow/fill under path
        this.ctx.beginPath();
        this.ctx.fillStyle = 'rgba(211, 47, 47, 0.15)';
        this.ctx.moveTo(startX, startY);
        this.ctx.quadraticCurveTo(startX + (px - startX) / 2, startY, px, py);
        this.ctx.lineTo(px, startY);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw flight path (curved line)
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.running ? 'rgba(211, 47, 47, 0.8)' : 'rgba(211, 47, 47, 0.3)';
        this.ctx.lineWidth = 5;
        this.ctx.lineCap = 'round';
        this.ctx.moveTo(startX, startY);
        this.ctx.quadraticCurveTo(startX + (px - startX) / 2, startY, px, py);
        this.ctx.stroke();

        // Calculate angle for airplane
        const angle = Math.atan2(py - (startY - Math.pow(progress - 0.01, 1.4) * (h * 0.7)),
            px - (startX + (progress - 0.01) * (w * 0.8)));

        this.drawAirplane(px, py, angle);

        if (this.running && this.multiplier > 1.01) {
            this.drawTrail(px, py, angle);
        }
    },

    drawAirplane(x, y, angle) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        // Body Glow
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = 'rgba(211, 47, 47, 0.8)';

        // Draw Airplane Body
        this.ctx.fillStyle = '#ff1744'; // Bright Red
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Cockpit
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.beginPath();
        this.ctx.ellipse(6, -2, 4, 2, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Wings (Rounded)
        this.ctx.fillStyle = '#d50000';
        this.ctx.beginPath();
        this.ctx.moveTo(-4, 0);
        this.ctx.quadraticCurveTo(-10, -18, 2, -18);
        this.ctx.lineTo(6, 0);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.moveTo(-4, 0);
        this.ctx.quadraticCurveTo(-10, 18, 2, 18);
        this.ctx.lineTo(6, 0);
        this.ctx.closePath();
        this.ctx.fill();

        // Tail
        this.ctx.beginPath();
        this.ctx.moveTo(-12, 0);
        this.ctx.lineTo(-18, -10);
        this.ctx.lineTo(-15, 0);
        this.ctx.lineTo(-18, 10);
        this.ctx.closePath();
        this.ctx.fill();

        // Animated Propeller
        const spin = (Date.now() % 100) / 100;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(18, -10 * Math.cos(spin * Math.PI * 2));
        this.ctx.lineTo(18, 10 * Math.cos(spin * Math.PI * 2));
        this.ctx.stroke();

        this.ctx.restore();
    },

    drawTrail(x, y, angle) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        // Dynamic fiery trail
        const length = 60 + Math.sin(Date.now() / 50) * 10;
        const gradient = this.ctx.createLinearGradient(-15, 0, -length, 0);
        gradient.addColorStop(0, 'rgba(211, 47, 47, 0.8)');
        gradient.addColorStop(0.5, 'rgba(211, 47, 47, 0.2)');
        gradient.addColorStop(1, 'rgba(211, 47, 47, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.moveTo(-15, -4);
        this.ctx.bezierCurveTo(-30, -10, -length / 2, -5, -length, 0);
        this.ctx.bezierCurveTo(-length / 2, 5, -30, 10, -15, 4);
        this.ctx.fill();

        this.ctx.restore();
    },

    // === Server Sync Methods (for real-time multiplayer) ===

    syncState(state) {
        // Called when client connects to sync with current game
        if (state.phase === 'running') {
            this.running = true;
            this.startTime = state.startTime;
            this.multiplier = state.multiplier || 1.00;
            Utils.hide('crash-msg');
        } else if (state.phase === 'crashed') {
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
