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

        // Game events
        this.channel.bind('game:waiting', (data) => {
            console.log('Waiting for next round:', data);
            Engine.prepareRound(); // Resets UI for next flight
        });

        this.channel.bind('game:start', (data) => {
            console.log('Game started:', data);
            Engine.onServerStart(data);
        });

        this.channel.bind('game:tick', (data) => {
            Engine.onServerTick(data);
        });

        this.channel.bind('game:crash', (data) => {
            console.log('Game crashed:', data);
            Engine.onServerCrash(data);
        });

        // Bet events
        this.channel.bind('bet:placed', (data) => {
            console.log('Bet placed:', data);
            Bets.onBetPlaced(data);
        });

        this.channel.bind('bet:cashout', (data) => {
            console.log('Cashout:', data);
            Bets.onCashout(data);
        });

        // User private events (Balance updates)
        if (Auth.currentUser && Auth.currentUser.username) {
            const userChannel = this.pusher.subscribe(`user-${Auth.currentUser.username}`);
            userChannel.bind('balance:update', (data) => {
                console.log('Balance updated:', data);
                if (data.balance !== undefined) {
                    Auth.currentUser.balance = data.balance;
                    Auth.updateUI();
                    UI.notify(`Deposit Received! New Balance: KES ${Utils.formatMoney(data.balance)}`, 'success');
                }
            });
        }

        // Connection status
        this.pusher.connection.bind('connected', () => {
            console.log('Connected to real-time server');
            this.isConnected = true;
        });

        this.pusher.connection.bind('disconnected', () => {
            console.log('Disconnected from real-time server');
            this.isConnected = false;
        });

        // Fetch current game state to sync with ongoing round
        this.fetchAndSync();
    },

    async fetchAndSync() {
        try {
            const res = await fetch('/api/game/state');
            const state = await res.json();
            Engine.syncState(state);

            // If game is already running, sync local animation
            if (state.phase === 'running') {
                this.startLocalTickLoop(state);
            }
        } catch (e) {
            console.error('Failed to fetch game state:', e);
        }
    },

    // For clients: run local tick animation synced to server time
    startLocalTickLoop(state) {
        if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);

        const startTime = state.startTime;

        this.gameLoopInterval = setInterval(() => {
            if (!Engine.running) {
                this.stopGameLoop();
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

    stopGameLoop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
    }
};
