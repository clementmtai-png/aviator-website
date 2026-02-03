const Bets = {
    list: null,
    listMobile: null,
    historyList: null,
    activeBets: [],
    history: [],
    roundNumber: 1000,

    init() {
        this.list = Utils.el('active-bets-list');
        this.listMobile = Utils.el('active-bets-list-mobile');
        this.historyList = Utils.el('history-bets-list');
        if (this.list) this.list.innerHTML = '';
        if (this.listMobile) this.listMobile.innerHTML = '';
        if (this.historyList) this.historyList.innerHTML = '';

        // Initialize with some sample history
        this.initSampleHistory();

        for (let i = 0; i < 15; i++) {
            const bet = this.createRandomBet();
            bet.el = this.createRowElement(bet);
            bet.elMobile = this.listMobile ? this.createRowElement(bet) : null;
            this.activeBets.push(bet);
            if (this.list) this.list.appendChild(bet.el);
            if (bet.elMobile && this.listMobile) this.listMobile.appendChild(bet.elMobile);
        }

        this.startSimulation();
    },

    initSampleHistory() {
        const sampleHistory = [
            { round: '#999', stake: 50, won: true, result: '+125.00' },
            { round: '#998', stake: 100, won: false, result: '-100.00' },
            { round: '#997', stake: 25, won: true, result: '+62.50' },
            { round: '#996', stake: 200, won: false, result: '-200.00' },
            { round: '#995', stake: 75, won: true, result: '+187.50' },
            { round: '#994', stake: 30, won: true, result: '+45.00' },
            { round: '#993', stake: 150, won: false, result: '-150.00' },
            { round: '#992', stake: 50, won: true, result: '+100.00' },
        ];

        sampleHistory.forEach(h => this.addHistoryRow(h));
    },

    addHistoryRow(data) {
        if (!this.historyList) return;

        const div = document.createElement('div');
        div.className = `history-row ${data.won ? 'won' : 'lost'}`;
        div.innerHTML = `
            <span class="round-id">${data.round}</span>
            <span class="stake">$${data.stake}</span>
            <span class="result">${data.result}</span>
        `;
        this.historyList.prepend(div);

        // Keep history limited
        while (this.historyList.children.length > 50) {
            this.historyList.lastChild.remove();
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
        const updateOne = (el) => {
            if (!el) return;
            el.className = `bet-row ${bet.cashedOut ? 'winner' : ''}`;
            const cashoutEl = el.querySelector('.cashout');
            if (cashoutEl) cashoutEl.innerText = bet.cashedOut ? bet.winMult.toFixed(2) + 'x' : '--';
        };
        updateOne(bet.el);
        updateOne(bet.elMobile);
    },

    startSimulation() {
        setInterval(() => {
            if (Math.random() > 0.8) {
                const old = this.activeBets.pop();
                if (old.el) old.el.remove();
                if (old.elMobile) old.elMobile.remove();

                const newBet = this.createRandomBet();
                newBet.el = this.createRowElement(newBet);
                newBet.elMobile = this.listMobile ? this.createRowElement(newBet) : null;
                this.activeBets.unshift(newBet);
                if (this.list) this.list.prepend(newBet.el);
                if (newBet.elMobile && this.listMobile) this.listMobile.prepend(newBet.elMobile);
            }
        }, 1500);

        window.addEventListener('round-start', () => {
            this.roundNumber++;
            this.activeBets.forEach(b => {
                b.cashedOut = false;
                b.winMult = 0;
                b.targetCashout = parseFloat((1.1 + Math.random() * 4.9).toFixed(2));
                this.updateRow(b);
            });
        });

        window.addEventListener('round-end', (e) => {
            // Add a random entry to history when round ends
            const stake = Utils.randomRange(10, 200);
            const won = Math.random() > 0.4;
            const multiplier = e.detail?.crashPoint || (1 + Math.random() * 5);
            this.addHistoryRow({
                round: `#${this.roundNumber}`,
                stake: stake,
                won: won,
                result: won ? `+${(stake * multiplier).toFixed(2)}` : `-${stake.toFixed(2)}`
            });
        });

        window.addEventListener('game-tick', (e) => {
            const mult = e.detail.multiplier;

            if (Engine.userBet && Engine.userBet.status === 'betting') {
                this.updateUserRow(mult);
            } else if (Engine.userBet && Engine.userBet.status === 'cashed') {
                this.updateUserRow(Engine.userBet.winMult, true);
            }

            this.activeBets.forEach(b => {
                if (b.cashedOut) return;
                if (b.targetCashout != null && mult >= b.targetCashout) {
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
        const targetCashout = 1.1 + Math.random() * 4.9;
        return {
            username: Utils.randomItem(CONFIG.USERNAMES),
            stake: Utils.randomRange(10, 500).toFixed(0),
            cashedOut: false,
            winMult: 0,
            targetCashout: parseFloat(targetCashout.toFixed(2)),
            el: null,
            elMobile: null
        };
    }
};

document.addEventListener('DOMContentLoaded', () => Bets.init());
