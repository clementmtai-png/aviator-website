/**
 * Real-time game sync using Pusher
 * Clients are now observers only - game is controlled by server-side cron
 */

const Realtime = {
    pusher: null,
    channel: null,
    isConnected: false,

    // Pusher config
    config: {
        key: '9dfe84259794e05476a7',
        cluster: 'ap2'
    },

    init() {
        if (typeof Pusher === 'undefined') {
            console.error('Pusher library not loaded');
            return;
        }

        this.pusher = new Pusher(this.config.key, {
            cluster: this.config.cluster,
            forceTLS: true
        });

        this.channel = this.pusher.subscribe('crash-game');
        this.isConnected = true;

        // Persistent heartbeat to keep server advancing (needed for Hobby accounts)
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.fetchAndSync(); // Hits /api/game/state -> calls advanceGame() on server
            }
        }, 5000);

        // Game events
        this.channel.bind('game:waiting', (data) => {
            console.log('Waiting for next round:', data);
            Engine.prepareRound();
        });

        this.channel.bind('game:start', (data) => {
            console.log('Game started:', data);
            Engine.onServerStart(data);
            this.startLocalLoop(data);
        });

        this.channel.bind('game:tick', (data) => {
            Engine.onServerTick(data);
        });

        this.channel.bind('game:crash', (data) => {
            console.log('Game crashed:', data);
            Engine.onServerCrash(data);
            this.stopLocalLoop();
        });

        // ... rest of event bindings ...
        this.channel.bind('bet:placed', (data) => {
            Bets.onBetPlaced(data);
        });

        this.channel.bind('bet:cashout', (data) => {
            Bets.onCashout(data);
        });

        if (Auth.currentUser && Auth.currentUser.username) {
            const userChannel = this.pusher.subscribe(`user-${Auth.currentUser.username}`);
            userChannel.bind('balance:update', (data) => {
                if (data.balance !== undefined) {
                    Auth.currentUser.balance = data.balance;
                    Auth.updateUI();
                    UI.notify(`Deposit Received! New Balance: KES ${Utils.formatMoney(data.balance)}`, 'success');
                }
            });
        }

        this.pusher.connection.bind('connected', () => { this.isConnected = true; });
        this.pusher.connection.bind('disconnected', () => { this.isConnected = false; });

        this.fetchAndSync();
    },

    async fetchAndSync() {
        try {
            const res = await fetch('/api/game/state');
            const state = await res.json();
            Engine.syncState(state);

            if (state.phase === 'running') {
                this.startLocalLoop(state);
            }
        } catch (e) { }
    },

    startLocalLoop(state) {
        if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
        const startTime = state.startTime;

        this.gameLoopInterval = setInterval(() => {
            if (!Engine.running) {
                this.stopLocalLoop();
                return;
            }

            const elapsed = Date.now() - startTime;
            const multiplier = Math.floor((Math.exp(0.00006 * elapsed)) * 100) / 100;

            Engine.multiplier = multiplier;
            const el = document.getElementById('multiplier-value');
            if (el) el.innerText = multiplier.toFixed(2) + 'x';

            if (Engine.userBet && Engine.userBet.status === 'betting') {
                Engine.updateButtonUI('CASHOUT');
            }
        }, 50);
    },

    stopLocalLoop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
    }
};
