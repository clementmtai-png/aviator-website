const Wallet = {
    pollingInterval: null,

    init() {
        // Wallet tabs: Deposit / Withdraw
        document.querySelectorAll('.w-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                const t = tab.getAttribute('data-wallet-tab');
                if (t === 'withdraw') Wallet.showWithdrawTab();
                else Wallet.showDepositTab();
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
        const amountInput = Utils.el('withdraw-amount');
        const amount = parseFloat(amountInput.value);

        if (!Auth.currentUser) {
            UI.notify('Please log in to withdraw', 'error');
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            UI.notify('Please enter a valid amount', 'error');
            return;
        }
        if (amount > Auth.currentUser.balance) {
            UI.notify(`Insufficient balance. You only have KES ${Utils.formatMoney(Auth.currentUser.balance)}`, 'error');
            return;
        }

        if (await Wallet.withdraw(amount)) {
            UI.hideModal('wallet-modal');
            UI.notify(`Withdrawal of KES ${Utils.formatMoney(amount)} requested.`, 'success');
            amountInput.value = '';
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

        const email = Auth.currentUser ? Auth.currentUser.email || 'customer@example.com' : 'customer@example.com';
        const phone = Auth.currentUser ? Auth.currentUser.username : ''; // Use username if it's a phone number
        const sandbox = false; // Always live as requested
        const apiBase = window.location.origin;
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isLocal) {
            UI.notify('Pesapal simulation mode…', 'info');
            setTimeout(() => {
                if (Auth.currentUser) {
                    Auth.currentUser.balance = (Auth.currentUser.balance || 0) + amount;
                    Auth.save();
                    Auth.updateUI();
                }
                UI.notify(`KES ${amount} credited (Simulation Mode).`, 'success');
                UI.hideModal('wallet-modal');
            }, 2000);
            return;
        }

        // Default to STK if amount is provided in this simple UI
        const isStk = true;

        try {
            const res = await fetch(apiBase + '/api/pesapal/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    currency: 'KES',
                    email,
                    phone: phone || undefined,
                    sandbox,
                    stk: isStk,
                    merchant_reference: 'dep-' + Date.now() + '-' + (Auth.currentUser ? Auth.currentUser.username : 'guest'),
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (data.order_tracking_id) {
                UI.notify('Payment initiated. Please complete on your phone.', 'info');
                this.pollTransactionStatus(data.order_tracking_id);
                return;
            }

            const redirectUrl = data.redirect_url || data.redirectUrl;
            if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.startsWith('http')) {
                UI.notify('Redirecting to Pesapal…', 'info');
                window.location.assign(redirectUrl);
                return;
            }
            const errMsg = data.error || (res.ok ? 'Payment initiation failed' : 'Request failed');
            UI.notify(errMsg, 'error');
        } catch (e) {
            console.error('Pesapal initiate error', e);
            UI.notify('Network error. Please try again later.', 'error');
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
        this.openPesapalPayment();
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
