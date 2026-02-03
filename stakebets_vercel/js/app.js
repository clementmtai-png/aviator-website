const UI = {
    init() {
        // Event Listeners for Forms
        Utils.el('register-form').onsubmit = (e) => {
            e.preventDefault();
            const user = Utils.el('reg-user').value;
            const phone = Utils.el('reg-phone').value;
            Auth.register(user, phone);
        };

        Utils.el('login-form').onsubmit = (e) => {
            e.preventDefault();
            const user = e.target.querySelector('input[type="text"]').value;
            const pass = e.target.querySelector('input[type="password"]').value;
            Auth.login(user, pass);
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
        const logo = document.querySelector('.aviator-logo');
        if (logo) logo.onclick = null;

        // Mobile responsiveness check on load
        this.checkMobile();
        window.addEventListener('resize', () => this.checkMobile());
    },

    checkMobile() {
        if (window.innerWidth <= 1024) {
            const tabEl = Utils.el('mobile-tabs');
            if (tabEl) tabEl.classList.remove('hidden');
        } else {
            const tabEl = Utils.el('mobile-tabs');
            if (tabEl) tabEl.classList.add('hidden');
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
        if (Math.abs(factor) === 1) {
            val += factor * 10; // Increment by 10 for +/- buttons
        } else {
            val = val * factor;
        }
        if (val < 1) val = 1;
        input.value = val.toFixed(2);
        this.updateBtnText(val);
    },

    setBet(amount) {
        const input = Utils.el('bet-amount');
        input.value = amount.toFixed(2);
        this.updateBtnText(amount);
    },

    updateBtnText(val) {
        const span = Utils.el('btn-amount-display');
        if (span) span.innerText = val.toFixed(2) + " KES";
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
        // Obsolete sidebars removed in redesign.
        // We can keep this for future expansion or just notify.
        console.log("Switching to", viewId);

        // Update tab buttons
        document.querySelectorAll('.m-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }
};

// Start all systems
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    UI.init();
    Wallet.init();
    Chat.init();
    Engine.init();

    // Extra: STK Push button in wallet
    const stkPushBtn = Utils.el('stk-push-btn');
    if (stkPushBtn) {
        stkPushBtn.onclick = () => Wallet.openPesapalPayment(true);
    }

    const pesapalLinkBtn = Utils.el('pesapal-payment-btn');
    if (pesapalLinkBtn) {
        pesapalLinkBtn.onclick = () => Wallet.openPesapalPayment(false);
    }

    // Input listener for bet amount
    const betInput = Utils.el('bet-amount');
    if (betInput) {
        betInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            UI.updateBtnText(val);
        });
    }
});
