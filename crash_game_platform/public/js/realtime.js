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
        }, 3000);

        // Game events
        this.channel.bind('game:waiting', (data) => {
            console.log('Waiting for next round:', data);
            Engine.prepareRound();
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
            Engine.syncState(state, state.serverTime);
        } catch (e) { }
    },

    stopLocalLoop() {
        // No longer needed as Engine handles the main loop
    }
};
