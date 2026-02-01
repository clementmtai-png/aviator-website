const Wallet = {
    init() {
        const payItems = document.querySelectorAll('#wallet-deposit-panel .pay-item');
        const stkArea = Utils.el('stk-push-area');

        payItems.forEach((el) => {
            el.addEventListener('click', () => {
                payItems.forEach((p) => p.classList.remove('active'));
                el.classList.add('active');
                const method = el.getAttribute('data-method');
                if (method === 'mpesa') {
                    stkArea.classList.remove('hidden');
                    Utils.el('stk-payment-btn').style.display = CONFIG.STK_PAYMENT_LINK ? '' : 'none';
                } else {
                    stkArea.classList.add('hidden');
                }
            });
        });

        Utils.el('stk-payment-btn').addEventListener('click', () => Wallet.openStkPayment());
        Utils.el('pesapal-payment-btn').addEventListener('click', () => Wallet.openPesapalPayment());

        // Wallet tabs: Deposit / Withdraw
        document.querySelectorAll('.w-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                const t = tab.getAttribute('data-wallet-tab');
                if (t === 'withdraw') Wallet.showWithdrawTab();
                else Wallet.showDepositTab();
            });
        });

        // Withdraw panel payment method selection
        document.querySelectorAll('.withdraw-methods .pay-item').forEach((el) => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.withdraw-methods .pay-item').forEach((p) => p.classList.remove('active'));
                el.classList.add('active');
            });
        });
    },

    showDepositTab() {
        document.querySelectorAll('.w-tab').forEach((t) => t.classList.toggle('active', t.getAttribute('data-wallet-tab') === 'deposit'));
        const dep = document.getElementById('wallet-deposit-panel');
        const wit = document.getElementById('wallet-withdraw-panel');
        if (dep) dep.classList.remove('hidden');
        if (wit) wit.classList.add('hidden');
    },

    showWithdrawTab() {
        document.querySelectorAll('.w-tab').forEach((t) => t.classList.toggle('active', t.getAttribute('data-wallet-tab') === 'withdraw'));
        const dep = document.getElementById('wallet-deposit-panel');
        const wit = document.getElementById('wallet-withdraw-panel');
        if (dep) dep.classList.add('hidden');
        if (wit) wit.classList.remove('hidden');
    },

    async requestWithdraw() {
        if (!Auth.currentUser) {
            UI.notify('Please log in to withdraw', 'error');
            return;
        }
        const amount = parseFloat(Utils.el('withdraw-amount').value);
        if (isNaN(amount) || amount <= 0) {
            UI.notify('Please enter a valid amount', 'error');
            return;
        }
        const method = document.querySelector('.withdraw-methods .pay-item.active')?.getAttribute('data-wmethod') || 'card';
        if (await Wallet.withdraw(amount)) {
            UI.hideModal('wallet-modal');
            UI.notify(`Withdrawal of $${Utils.formatMoney(amount)} requested via ${method.toUpperCase()}. Funds will be sent to your selected method.`, 'success');
            Utils.el('withdraw-amount').value = '';
            Utils.el('withdraw-phone').value = '';
            Utils.el('withdraw-email').value = '';
        }
    },

    getStkPaymentUrl() {
        const amount = Utils.el('dep-amount').value;
        let url = CONFIG.STK_PAYMENT_LINK;
        if (amount && !isNaN(parseFloat(amount))) {
            const sep = url.indexOf('?') >= 0 ? '&' : '?';
            url = url + sep + 'amount=' + encodeURIComponent(amount);
        }
        return url;
    },

    openStkPayment() {
        if (!CONFIG.STK_PAYMENT_LINK) {
            UI.notify('STK Push link not configured. Set CONFIG.STK_PAYMENT_LINK in config.js.', 'error');
            return;
        }
        window.open(Wallet.getStkPaymentUrl(), '_blank', 'noopener');
        UI.notify('Complete payment on your phone, then click Confirm Deposit.', 'info');
    },

    openPesapalLink() {
        if (!CONFIG.PESAPAL_PAYMENT_LINK) {
            UI.notify('Pesapal link not configured. Set CONFIG.PESAPAL_PAYMENT_LINK in config.js.', 'error');
            return;
        }
        const amount = Utils.el('dep-amount').value;
        let url = CONFIG.PESAPAL_PAYMENT_LINK;
        if (amount && !isNaN(parseFloat(amount))) {
            const sep = url.indexOf('?') >= 0 ? '&' : '?';
            url = url + sep + 'amount=' + encodeURIComponent(amount);
        }
        window.open(url, '_blank', 'noopener');
        UI.notify('Redirecting to Pesapal...', 'info');
    },

    async openPesapalPayment() {
        if (CONFIG.PESAPAL_PAYMENT_LINK) {
            this.openPesapalLink();
            return;
        }
        const amount = parseFloat(Utils.el('dep-amount').value);
        if (isNaN(amount) || amount <= 0) {
            UI.notify('Please enter a valid amount', 'error');
            return;
        }
        const email = (Utils.el('dep-email') && Utils.el('dep-email').value.trim()) || '';
        const apiBase = window.location.origin;
        try {
            const res = await fetch(apiBase + '/api/pesapal/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    currency: 'KES',
                    email: email || 'customer@example.com',
                    merchant_reference: 'dep-' + Date.now() + '-' + (Auth.currentUser ? Auth.currentUser.username : 'guest'),
                }),
            });
            const data = await res.json();
            if (data.redirect_url) {
                window.location.href = data.redirect_url;
                UI.notify('Redirecting to Pesapal…', 'info');
            } else {
                UI.notify(data.error || 'Payment initiation failed', 'error');
            }
        } catch (e) {
            UI.notify('Network error. Check backend and env.', 'error');
        }
    },

    deposit() {
        const activeMethod = document.querySelector('.pay-item.active')?.getAttribute('data-method');

        if (activeMethod === 'pesapal' && CONFIG.PESAPAL_PAYMENT_LINK) {
            this.openPesapalLink();
            return;
        }
        if (activeMethod === 'mpesa' && CONFIG.STK_PAYMENT_LINK) {
            this.openStkPayment();
            return;
        }

        const amount = parseFloat(Utils.el('dep-amount').value);
        if (isNaN(amount) || amount < CONFIG.MIN_DEPOSIT) {
            UI.notify(`Minimum deposit is $${CONFIG.MIN_DEPOSIT}`, "error");
            return;
        }

        // Real money: only Pesapal/IPN credits balance. Card/crypto "Confirm" without payment link = no balance change.
        if (activeMethod === 'card' || activeMethod === 'crypto') {
            UI.notify('Use Pesapal or M-PESA to add real funds. Balance updates after payment.', 'info');
            return;
        }

        UI.hideModal('wallet-modal');
        Utils.el('dep-amount').value = '';
    },

    async withdraw(amount) {
        if (!Auth.currentUser || !Auth.currentUser.username) {
            UI.notify("Please log in", "error");
            return false;
        }
        try {
            const res = await fetch(`${window.location.origin}/api/user/debit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: Auth.currentUser.username, amount }),
            });
            const data = await res.json();
            if (data.balance !== undefined) {
                Auth.currentUser.balance = data.balance;
                Auth.save();
                Auth.updateUI();
                return true;
            }
            UI.notify(data.error || 'Withdrawal failed', 'error');
            return false;
        } catch (e) {
            UI.notify('Network error', 'error');
            return false;
        }
    },

    async addWin(amount) {
        if (!Auth.currentUser || !Auth.currentUser.username) return;
        try {
            const res = await fetch(`${window.location.origin}/api/user/credit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: Auth.currentUser.username, amount }),
            });
            const data = await res.json();
            if (data.balance !== undefined) {
                Auth.currentUser.balance = data.balance;
                Auth.save();
                Auth.updateUI();
            }
        } catch (e) { /* keep UI in sync via next fetch */ }
    }
};
