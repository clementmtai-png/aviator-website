const Bets = {
    list: null,
    activeBets: [],

    init() {
        this.lists = document.querySelectorAll('.stats-list-area');
        if (this.lists.length > 0) {
            this.lists.forEach(list => list.innerHTML = '');
        }

        // Pre-create initial pool
        for (let i = 0; i < 15; i++) {
            const bet = this.createRandomBet();
            this.activeBets.push(bet);
        }

        this.refreshList();
        this.startSimulation();
        this.setupTabs();
    },

    setupTabs() {
        const tabs = document.querySelectorAll('.s-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // For simulation purposes, we just refresh the random list
                this.refreshList();
            };
        });
    },

    refreshList() {
        if (!this.lists || this.lists.length === 0) return;
        this.lists.forEach(list => {
            list.innerHTML = '';
            this.activeBets.forEach(b => {
                const el = this.createRowElement(b);
                b.els = b.els || [];
                b.els.push(el);
                list.appendChild(el);
            });
        });
    },

    createRowElement(bet) {
        const div = document.createElement('div');
        div.className = `bet-row`;
        div.innerHTML = `
            <span class="username">${bet.username}</span>
            <span class="stake">KES ${bet.stake}</span>
            <span class="mult">--</span>
            <span class="win">--</span>
        `;
        return div;
    },

    updateRow(bet) {
        if (!bet.els) return;
        bet.els.forEach(el => {
            el.className = `bet-row ${bet.cashedOut ? 'winner' : ''}`;
            const multEl = el.querySelector('.mult');
            const winEl = el.querySelector('.win');

            if (bet.cashedOut) {
                multEl.innerText = bet.winMult.toFixed(2) + 'x';
                multEl.style.color = '#32d74b';
                const totalWin = (parseFloat(bet.stake) * bet.winMult);
                winEl.innerText = 'KES ' + totalWin.toFixed(2);
            } else {
                multEl.innerText = '--';
                winEl.innerText = '--';
            }
        });
    },

    addHistoryRow(multiplier) {
        const list = Utils.el('history-pills'); // Targeted historical pills container
        if (!list) return;

        const div = document.createElement('div');
        const type = multiplier < 2 ? 'low' : (multiplier < 10 ? 'mid' : (multiplier < 50 ? 'high' : 'epic'));
        div.className = `h-pill ${type}`;
        div.innerText = multiplier.toFixed(2) + 'x';

        list.prepend(div);
        if (list.children.length > 20) list.lastChild.remove();
    },

    startSimulation() {
        setInterval(() => {
            if (Math.random() > 0.8) {
                // Cycle one bet: remove last, add to top
                const old = this.activeBets.pop();
                if (old.els) old.els.forEach(el => el.remove());

                const newBet = this.createRandomBet();
                newBet.els = [];
                this.lists.forEach(list => {
                    const el = this.createRowElement(newBet);
                    newBet.els.push(el);
                    list.prepend(el);
                });
                this.activeBets.unshift(newBet);
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
            els: []
        };
        this.lists.forEach(list => {
            const el = this.createRowElement(bet);
            bet.els.push(el);
            list.prepend(el);
        });
        this.activeBets.unshift(bet);

        // Keep list manageable
        if (this.activeBets.length > 20) {
            const old = this.activeBets.pop();
            if (old.els) old.els.forEach(el => el.remove());
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
