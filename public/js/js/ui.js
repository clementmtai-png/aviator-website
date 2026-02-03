const UI = {
    init() {
        // Event Listeners for Forms
        Utils.el('register-form').onsubmit = (e) => {
            e.preventDefault();
            const user = Utils.el('reg-user').value;
            const phone = Utils.el('reg-phone').value;
            const pass = e.target.querySelector('input[type="password"]').value;
            Auth.register(user, phone, pass);
        };

        Utils.el('login-form').onsubmit = (e) => {
            e.preventDefault();
            const user = e.target.querySelector('input[type="text"]').value;
            const pass = e.target.querySelector('input[type="password"]').value;
            Auth.login(user, pass);
        };

        const goDeposit = () => {
            if (typeof Wallet !== 'undefined') {
                this.showModal('wallet-modal');
                Wallet.showDepositTab();
            }
        };
        const goWithdraw = () => {
            if (typeof Wallet !== 'undefined') {
                this.showModal('wallet-modal');
                Wallet.showWithdrawTab();
            }
        };

        const walletBtn = Utils.el('open-wallet-main');
        if (walletBtn) walletBtn.addEventListener('click', (e) => { e.preventDefault(); goDeposit(); });

        Utils.el('care-btn').onclick = () => {
            this.notify("Connecting to a live agent...", "info");
            setTimeout(() => this.notify("Agent 'Sarah' has joined the chat.", "info"), 2000);
        };

        // Logout button
        const logoutBtn = Utils.el('logout-btn-nav');
        if (logoutBtn) logoutBtn.onclick = () => Auth.logout();

        // Sound toggle placeholder
        const soundBtn = document.querySelector('.sound-toggle');
        if (soundBtn) soundBtn.onclick = () => {
            soundBtn.innerText = soundBtn.innerText === '🔊' ? '🔇' : '🔊';
        };

        // Sidebar Tabs logic
        const sidebarTabBtns = document.querySelectorAll('.sidebar-tabs button');
        sidebarTabBtns.forEach(btn => {
            btn.onclick = () => this.switchSidebarTab(btn.dataset.tab, btn);
        });

        this.checkMobile();
        window.addEventListener('resize', () => this.checkMobile());
    },

    checkMobile() {
        if (window.innerWidth <= 1024) {
            const tabEl = Utils.el('mobile-tabs');
            if (tabEl) tabEl.classList.remove('hidden');
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

    switchSidebarTab(tabId, btn) {
        document.querySelectorAll('.sidebar-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (tabId === 'live') {
            Utils.show('active-bets-list');
            Utils.hide('historical-bets-list');
            Utils.show('sidebar-list-header');
        } else {
            Utils.hide('active-bets-list');
            Utils.show('historical-bets-list');
            Utils.hide('sidebar-list-header');
        }
    },

    switchMobileTab(viewId, btn) {
        const views = ['game-view', 'sidebar-bets', 'sidebar-chat'];
        views.forEach(id => {
            const el = Utils.el(id);
            if (el) {
                if (id === viewId) el.classList.remove('mobile-hide');
                else el.classList.add('mobile-hide');
            }
        });
        document.querySelectorAll('.m-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }
};
