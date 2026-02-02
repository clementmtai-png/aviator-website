const Bets = {
    list: null,
    activeBets: [],

    init() {
        this.list = Utils.el('active-bets-list');
        this.list.innerHTML = ''; // Initial clear

        // Pre-create initial pool of rows to avoid constant creation
        for (let i = 0; i < 15; i++) {
            const bet = this.createRandomBet();
            bet.el = this.createRowElement(bet);
            this.activeBets.push(bet);
            this.list.appendChild(bet.el);
        }

        this.startSimulation();
        this.setupTabs();
    },

    setupTabs() {
        const tabBets = Utils.el('tab-bets');
        const tabHistory = Utils.el('tab-history');
        const listBets = Utils.el('active-bets-list');
        const listHistory = Utils.el('history-list');
        const headerBets = Utils.el('bets-header');
        const headerHistory = Utils.el('history-header');

        if (tabBets && tabHistory) {
            tabBets.onclick = () => {
                tabBets.classList.add('active');
                tabHistory.classList.remove('active');
                Utils.show('active-bets-list');
                Utils.hide('history-list');
                Utils.show('bets-header');
                Utils.hide('history-header');
            };
            tabHistory.onclick = () => {
                tabHistory.classList.add('active');
                tabBets.classList.remove('active');
                Utils.hide('active-bets-list');
                Utils.show('history-list');
                Utils.hide('bets-header');
                Utils.show('history-header');
            };
        }
    },

    createRowElement(bet) {
        const div = document.createElement('div');
        div.className = `bet-row`;
        div.innerHTML = `
            <span class="username">${bet.username}</span>
            <span class="stake">$${bet.stake}</span>
            <span class="cashout">--</span>
        `;
        return div;
    },

    updateRow(bet) {
        if (!bet.el) return;
        bet.el.className = `bet-row ${bet.cashedOut ? 'winner' : ''}`;
        const cashoutEl = bet.el.querySelector('.cashout');
        // Show Total Win Amount (Stake * Multiplier) instead of just multiplier
        const totalWin = (parseFloat(bet.stake) * bet.winMult);
        cashoutEl.innerText = bet.cashedOut ? '$' + totalWin.toFixed(2) : '--';
        if (bet.cashedOut) cashoutEl.classList.add('win-amount');
    },

    addHistoryRow(multiplier) {
        const list = Utils.el('history-list');
        if (!list) return;

        const div = document.createElement('div');
        div.className = 'bet-row history-row';
        const date = new Date();
        const timeStr = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');

        div.innerHTML = `
            <span class="round-id">#${Math.floor(Math.random() * 90000) + 10000}</span>
            <span class="result ${multiplier < 2 ? 'low' : (multiplier < 10 ? 'mid' : 'high')}">${multiplier.toFixed(2)}x</span>
            <span class="time">${timeStr}</span>
        `;
        list.prepend(div);
        if (list.children.length > 50) list.lastChild.remove();
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
