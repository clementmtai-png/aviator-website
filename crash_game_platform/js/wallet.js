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
        console.log('Wallet: Starting openPesapalPayment...');
        if (CONFIG.PESAPAL_PAYMENT_LINK) {
            console.log('Wallet: Using CONFIG.PESAPAL_PAYMENT_LINK');
            this.openPesapalLink();
            return;
        }
        const amount = parseFloat(Utils.el('dep-amount').value);
        if (isNaN(amount) || amount <= 0) {
            UI.notify('Please enter a valid amount', 'error');
            return;
        }
        const email = (Utils.el('dep-email') && Utils.el('dep-email').value.trim()) || '';
        const phone = (Utils.el('dep-phone') && Utils.el('dep-phone').value.trim()) || '';
        const sandbox = Utils.el('dep-sandbox') ? Utils.el('dep-sandbox').checked : true;
        const apiBase = window.location.origin;

        console.log('Wallet: Fetching /api/pesapal/initiate...');
        try {
            const res = await fetch(apiBase + '/api/pesapal/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    currency: 'KES',
                    email: email || 'customer@example.com',
                    phone: phone || undefined,
                    sandbox,
                    merchant_reference: 'dep-' + Date.now() + '-' + (Auth.currentUser ? Auth.currentUser.username : 'guest'),
                }),
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Wallet: API did not return JSON', text);
                UI.notify('Backend Error: The server is not responding correctly. Are you running on Vercel?', 'error');
                return;
            }

            const redirectUrl = data.redirect_url || data.redirectUrl;
            if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.startsWith('http')) {
                UI.notify('Redirecting to Pesapal…', 'info');
                window.open(redirectUrl, '_blank', 'noopener');
                return;
            }

            const errMsg = data.error || (res.ok ? 'Payment initiation failed' : 'Request failed');
            const hint = data.hint ? ' ' + data.hint : '';
            UI.notify(errMsg + hint, 'error');
            console.error('Pesapal initiate failed:', data);
        } catch (e) {
            console.error('Pesapal initiate network error', e);
            UI.notify('Network error. Ensure the backend API is running.', 'error');
        }
    },

    deposit() {
        const activeMethod = document.querySelector('#wallet-deposit-panel .pay-item.active')?.getAttribute('data-method');

        // Pesapal: use link if set, else API (redirect to Pesapal page)
        if (activeMethod === 'pesapal') {
            if (CONFIG.PESAPAL_PAYMENT_LINK) {
                this.openPesapalLink();
            } else {
                this.openPesapalPayment();
            }
            return;
        }
        // M-PESA: use STK link if set, else Pesapal API (which also redirects)
        if (activeMethod === 'mpesa') {
            if (CONFIG.STK_PAYMENT_LINK) {
                this.openStkPayment();
            } else {
                this.openPesapalPayment();
            }
            return;
        }
        // Card / Crypto: no local balance — must use Pesapal or M-PESA
        if (activeMethod === 'card' || activeMethod === 'crypto') {
            UI.notify('Redirecting to Pesapal for payment...', 'info');
            this.openPesapalPayment();
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
