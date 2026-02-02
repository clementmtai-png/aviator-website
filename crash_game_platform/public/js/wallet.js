const Wallet = {
    pollingInterval: null,

    init() {
        const payItems = document.querySelectorAll('#wallet-deposit-panel .pay-item');
        const stkArea = Utils.el('stk-push-area');

        // Set initial state (M-PESA active by default)
        if (stkArea) stkArea.classList.remove('hidden');

        payItems.forEach((el) => {
            el.addEventListener('click', () => {
                payItems.forEach((p) => p.classList.remove('active'));
                el.classList.add('active');
                const method = el.getAttribute('data-method');

                if (method === 'mpesa' || method === 'pesapal') {
                    stkArea.classList.remove('hidden');
                } else {
                    stkArea.classList.add('hidden');
                }
            });
        });

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
        if (isNaN(amount) || amount <= 0) {
            UI.notify('Please enter a valid amount', 'error');
            return;
        }
        if (amount < CONFIG.MIN_WITHDRAWAL) {
            UI.notify(`Minimum withdrawal is KES ${CONFIG.MIN_WITHDRAWAL}`, 'error');
            return;
        }
        if (amount > Auth.currentUser.balance) {
            UI.notify(`Insufficient balance. You only have KES ${Utils.formatMoney(Auth.currentUser.balance)}`, 'error');
            return;
        }
        const method = document.querySelector('.withdraw-methods .pay-item.active')?.getAttribute('data-wmethod') || 'card';
        if (await Wallet.withdraw(amount)) {
            UI.hideModal('wallet-modal');
            UI.notify(`Withdrawal of KES ${Utils.formatMoney(amount)} requested via ${method.toUpperCase()}.`, 'success');
            Utils.el('withdraw-amount').value = '';
        }
    },

    async openPesapalPayment() {
        const amount = parseFloat(Utils.el('dep-amount').value);
        if (isNaN(amount) || amount <= 0) {
            UI.notify('Please enter a valid amount', 'error');
            return;
        }
        if (amount < CONFIG.MIN_DEPOSIT) {
            UI.notify(`Minimum deposit is KES ${CONFIG.MIN_DEPOSIT}`, 'error');
            return;
        }

        // No phone number required for redirect flow
        const sandbox = false; // Forced FALSE for live production
        const apiBase = window.location.origin;

        // Redirect flow (isStk = false)
        const isStk = false;

        try {
            const res = await fetch(apiBase + '/api/pesapal/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    currency: 'KES',
                    email: 'customer@stakebets.com',
                    // No phone needed for redirect
                    sandbox,
                    stk: isStk,
                    merchant_reference: 'dep-' + Date.now() + '-' + (Auth.currentUser ? Auth.currentUser.username : 'guest'),
                }),
            });
            const data = await res.json().catch(() => ({}));

            // Handle redirect
            const redirectUrl = data.redirect_url || data.redirectUrl;
            if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.startsWith('http')) {
                UI.notify('Redirecting to Pesapal…', 'info');
                window.location.assign(redirectUrl);
                return;
            }
            const errMsg = data.error || (res.ok ? 'Payment initiation failed' : 'Request failed');
            const hint = data.hint ? ' ' + data.hint : '';
            const details = data.details?.message ? ' ' + data.details.message : '';
            UI.notify(errMsg + hint + details, 'error');
            if (!res.ok) console.error('Pesapal initiate:', res.status, data);
        } catch (e) {
            console.error('Pesapal initiate error', e);
            UI.notify('Network error. Is the API running at ' + apiBase + '?', 'error');
        }
    },

    async pollTransactionStatus(orderTrackingId) {
        const apiBase = window.location.origin;
        let attempts = 0;
        const maxAttempts = 20; // 60 seconds (3s interval)

        const interval = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(interval);
                UI.notify('Payment polling timed out. Please check your balance in a moment.', 'warning');
                return;
            }

            try {
                const res = await fetch(`${apiBase}/api/pesapal/check-status?orderTrackingId=${orderTrackingId}`);
                const data = await res.json();

                // Pesapal 3.0: 1 = COMPLETED, 2 = FAILED, 0 = INVALID, 3 = REVERSED
                if (data.status === 1 || data.payment_status === 'COMPLETED') {
                    clearInterval(interval);
                    UI.notify('Payment COMPLETED! Your balance has been updated.', 'success');
                    Auth.fetchBalance();
                    UI.hideModal('wallet-modal');
                } else if (data.status === 2 || data.payment_status === 'FAILED') {
                    clearInterval(interval);
                    UI.notify('Payment FAILED or was cancelled.', 'error');
                }
            } catch (e) {
                console.error("Polling error:", e);
            }
        }, 3000);
    },

    deposit() {
        // Use redirect flow instead of STK push
        this.openPesapalPayment(false);
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
        } catch (e) { /* silent */ }
    }
};
