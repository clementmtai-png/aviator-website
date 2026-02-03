const UI = {
    init() {
        // Event Listeners for Forms
        Utils.el('register-form').onsubmit = (e) => {
            e.preventDefault();
            const user = Utils.el('reg-user').value;
            const code = Utils.el('reg-country-code').value;
            const phone = Utils.el('reg-phone').value.replace(/^0+/, ''); // Remove leading zeros
            Auth.register(user, code + phone);
        };

        Utils.el('login-form').onsubmit = (e) => {
            e.preventDefault();
            const code = Utils.el('login-country-code').value;
            const phone = Utils.el('login-phone').value.replace(/^0+/, ''); // Remove leading zeros
            const pass = Utils.el('login-pass').value;
            Auth.login(code + phone, pass);
        };

        const goDeposit = () => {
            if (CONFIG.DEPOSIT_LINK) {
                window.open(CONFIG.DEPOSIT_LINK, '_blank', 'noopener');
            } else {
                this.showModal('wallet-modal');
                if (typeof Wallet !== 'undefined') Wallet.showDepositTab();
            }
        };
        const goWithdraw = () => {
            this.showModal('wallet-modal');
            if (typeof Wallet !== 'undefined') Wallet.showWithdrawTab();
        };
        Utils.el('open-wallet').addEventListener('click', (e) => { e.preventDefault(); goDeposit(); });
        const depositLink = document.getElementById('deposit-link');
        if (depositLink) depositLink.addEventListener('click', (e) => { e.preventDefault(); goDeposit(); });
        const openWithdraw = document.getElementById('open-withdraw');
        if (openWithdraw) openWithdraw.addEventListener('click', (e) => { e.preventDefault(); goWithdraw(); });
        const withdrawLink = document.getElementById('withdraw-link');
        if (withdrawLink) withdrawLink.addEventListener('click', (e) => { e.preventDefault(); goWithdraw(); });

        Utils.el('care-btn').onclick = () => {
            this.notify("Connecting to a live agent...", "info");
            setTimeout(() => this.notify("Agent 'Sarah' has joined the chat.", "info"), 2000);
        };

        // Logout button
        const logoutBtn = Utils.el('logout-btn');
        if (logoutBtn) logoutBtn.onclick = () => Auth.logout();

        // Navbar Logo Admin Toggle (Legacy, but kept logic clean)
        document.querySelector('.logo').onclick = null;

        // Mobile responsiveness check on load
        this.checkMobile();
        window.addEventListener('resize', () => this.checkMobile());
    },

    checkMobile() {
        if (window.innerWidth <= 1024) {
            const tabEl = Utils.el('mobile-tabs');
            if (tabEl) tabEl.classList.remove('hidden');
            // On mobile ensure only game view is visible by default
            const gameView = Utils.el('game-view');
            const sidebarBets = Utils.el('sidebar-bets');
            const sidebarChat = Utils.el('sidebar-chat');
            if (gameView) gameView.classList.remove('mobile-hide');
            if (sidebarBets) sidebarBets.classList.add('mobile-hide');
            if (sidebarChat) sidebarChat.classList.add('mobile-hide');
        } else {
            const tabEl = Utils.el('mobile-tabs');
            if (tabEl) tabEl.classList.add('hidden');
            ['game-view', 'sidebar-bets', 'sidebar-chat'].forEach(id => {
                const el = Utils.el(id);
                if (el) el.classList.remove('mobile-hide');
            });
        }
    },

    showModal(id) {
        Utils.show(id);
    },

    hideModal(id) {
        Utils.hide(id);
    },

    adjustBet(factor) {
        const input = Utils.el('bet-amount');
        let val = parseFloat(input.value);
        input.value = (val * factor).toFixed(2);
    },

    notify(msg, type = 'success') {
        const div = document.createElement('div');
        div.className = `toast toast-${type}`;
        div.innerText = msg;
        document.body.appendChild(div);

        setTimeout(() => div.classList.add('visible'), 100);
        setTimeout(() => {
            div.classList.remove('visible');
            setTimeout(() => div.remove(), 500);
        }, 3000);
    },

    switchMobileTab(viewId, btn) {
        // Hide all mobile views
        const views = ['game-view', 'sidebar-bets', 'sidebar-chat'];
        views.forEach(id => {
            const el = Utils.el(id);
            if (el) {
                if (id === viewId) {
                    el.classList.remove('mobile-hide');
                } else {
                    el.classList.add('mobile-hide');
                }
            }
        });

        // Update tab buttons
        document.querySelectorAll('.m-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    },

    switchSidebarTab(tabId, btn) {
        // Get panels
        const liveBetsPanel = Utils.el('live-bets-panel');
        const historyPanel = Utils.el('history-panel');

        // Toggle visibility based on tabId
        if (tabId === 'live-bets') {
            if (liveBetsPanel) liveBetsPanel.classList.remove('hidden');
            if (historyPanel) historyPanel.classList.add('hidden');
        } else if (tabId === 'history') {
            if (liveBetsPanel) liveBetsPanel.classList.add('hidden');
            if (historyPanel) historyPanel.classList.remove('hidden');
        }

        // Update tab buttons
        document.querySelectorAll('.sidebar-tab-btn').forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }
};

// Start all systems
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    UI.init();
    Wallet.init();
    Chat.init();
    Engine.init();
});
