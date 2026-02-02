const Bets = {
    list: null,
    activeBets: [],

    init() {
        this.list = Utils.el('active-bets-list');
        this.historySidebar = Utils.el('historical-bets-list');
        this.historyPills = Utils.el('history-pills');

        if (this.list) this.list.innerHTML = '';
        if (this.historySidebar) this.historySidebar.innerHTML = '';
        if (this.historyPills) this.historyPills.innerHTML = '';

        // Pre-create initial pool of rows
        for (let i = 0; i < 15; i++) {
            const bet = this.createRandomBet();
            bet.el = this.createRowElement(bet);
            this.activeBets.push(bet);
            if (this.list) this.list.appendChild(bet.el);
        }

        this.startSimulation();
        this.fetchHistory();
    },

    createRowElement(data) {
        const row = document.createElement('div');
        row.className = 'bet-row';
        row.id = `bet-${data.username}`;
        const stakeValue = data.stake || data.amount || 0;
        row.innerHTML = `
            <span class="stake">${parseFloat(stakeValue).toFixed(2)}</span>
            <span class="cashout">-</span>
        `;
        return row;
    },

    updateRow(bet) {
        if (!bet.el) return;
        bet.el.className = `bet-row ${bet.cashedOut ? 'winner' : ''}`;
        const cashoutEl = bet.el.querySelector('.cashout');
        if (bet.cashedOut) {
            const stake = parseFloat(bet.stake || 0);
            const winAmount = stake * bet.winMult;
            cashoutEl.innerText = `KES ${winAmount.toFixed(2)}`;
            cashoutEl.innerHTML = `<span class="win-amount">KES ${winAmount.toFixed(2)}</span><span class="win-mult">@ ${bet.winMult.toFixed(2)}x</span>`;
        } else {
            cashoutEl.innerText = '--';
        }
    },

    startSimulation() {
        setInterval(() => {
            if (Math.random() > 0.8) {
                // Cycle one bet: remove last, add to top
                const old = this.activeBets.pop();
                if (old.el) old.el.remove();

                const newBet = this.createRandomBet();
                newBet.el = this.createRowElement(newBet);
                this.activeBets.unshift(newBet);
                this.list.prepend(newBet.el);
            }
        }, 1500);

        window.addEventListener('round-start', () => {
            this.activeBets.forEach(b => {
                b.cashedOut = false;
                this.updateRow(b);
            });
        });

        window.addEventListener('game-tick', (e) => {
            const mult = e.detail.multiplier;

            // Update real user row if exists
            if (Engine.userBet && Engine.userBet.status === 'betting') {
                this.updateUserRow(mult);
            } else if (Engine.userBet && Engine.userBet.status === 'cashed') {
                this.updateUserRow(Engine.userBet.winMult, true);
            }

            this.activeBets.forEach(b => {
                if (!b.cashedOut && Math.random() < 0.02 && mult > 1.2) {
                    b.cashedOut = true;
                    b.winMult = mult;
                    this.updateRow(b);
                }
            });
        });
    },

    updateUserRow(val, isFinal = false) {
        // If we want to show the user at the top, we'd need to manage an element for them
        // For simplicity, let's just make sure UI notifications are the primary feedback
        // as the list is mostly for 'organic' simulation.
    },

    async fetchHistory() {
        try {
            const res = await fetch('/api/game/history');
            const data = await res.json();
            if (data.success && data.history) {
                data.history.forEach(item => {
                    this.addHistory(item.crashPoint, item.roundId || '0000');
                });
            }
        } catch (e) {
            console.error("Failed to fetch history:", e);
        }
    },

    addHistory(crashPoint, roundId) {
        // 1. Add Top Pill
        if (this.historyPills) {
            const pill = document.createElement('div');
            const type = crashPoint < 2 ? 'low' : (crashPoint < 10 ? 'mid' : 'high');
            pill.className = `pill ${type}`;
            pill.innerText = crashPoint.toFixed(2) + 'x';
            this.historyPills.prepend(pill);

            // Limit pills
            if (this.historyPills.children.length > 20) {
                this.historyPills.lastChild.remove();
            }
        }

        // 2. Add Sidebar Card
        if (this.historySidebar) {
            const card = document.createElement('div');
            card.className = 'history-card';
            const typeColor = crashPoint < 2 ? 'var(--text-dim)' : (crashPoint < 10 ? 'var(--accent)' : 'var(--primary-green)');
            card.innerHTML = `
                <div class="history-card-header">
                    <span>Round Finished</span>
                    <span class="round-id">#${roundId.toString().slice(-4)}</span>
                </div>
                <div class="history-card-body">
                    <span class="mult" style="color: ${typeColor}">${crashPoint.toFixed(2)}x</span>
                    <span class="time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
            this.historySidebar.prepend(card);

            // Limit sidebar history
            if (this.historySidebar.children.length > 50) {
                this.historySidebar.lastChild.remove();
            }
        }
    },

    createRandomBet() {
        return {
            username: Utils.randomItem(CONFIG.USERNAMES),
            stake: Utils.randomRange(10, 500).toFixed(0),
            cashedOut: false,
            winMult: 0,
            el: null
        };
    },

    // === Real-time event handlers ===

    onBetPlaced(data) {
        // Add real bet from another player to the list
        const bet = {
            username: data.username,
            stake: data.amount.toFixed(0),
            cashedOut: false,
            winMult: 0,
            el: null
        };
        bet.el = this.createRowElement(bet);
        this.activeBets.unshift(bet);
        this.list.prepend(bet.el);

        // Keep list manageable
        if (this.activeBets.length > 20) {
            const old = this.activeBets.pop();
            if (old.el) old.el.remove();
        }
    },

    onCashout(data) {
        // Find the bet and mark as cashed out
        const bet = this.activeBets.find(b => b.username === data.username && !b.cashedOut);
        if (bet) {
            bet.cashedOut = true;
            bet.winMult = data.cashoutMultiplier;
            this.updateRow(bet);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Bets.init());
