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

        const email = (Utils.el('dep-email') && Utils.el('dep-email').value.trim()) || '';
        const phone = (Utils.el('dep-phone') && Utils.el('dep-phone').value.trim()) || '';
        const sandbox = Utils.el('dep-sandbox') ? Utils.el('dep-sandbox').checked : true;
        const apiBase = window.location.origin;

        UI.notify('Initiating STK Push...', 'info');

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

            const data = await res.json();
            const trackingId = data.order_tracking_id || data.orderTrackingId;
            const redirectUrl = data.redirect_url || data.redirectUrl;

            if (trackingId) {
                // If it's M-PESA, we poll. If it's something else, we might still want to show the page.
                const activeMethod = document.querySelector('#wallet-deposit-panel .pay-item.active')?.getAttribute('data-method');

                if (activeMethod === 'mpesa') {
                    UI.notify('Please check your phone for the M-PESA PIN prompt.', 'info');
                    // We still open the redirect URL in a background tab if needed, 
                    // but for direct STK we just start polling.
                    if (redirectUrl) {
                        // Some merchants prefer to open it anyway to ensure it's triggered
                        window.open(redirectUrl, '_blank', 'noopener');
                    }
                    this.startPolling(trackingId);
                } else if (redirectUrl) {
                    window.open(redirectUrl, '_blank', 'noopener');
                    UI.notify('Redirecting to payment page...', 'info');
                }
                return;
            }

            const errMsg = data.error || (res.ok ? 'Payment initiation failed' : 'Request failed');
            UI.notify(errMsg, 'error');
        } catch (e) {
            console.error('Pesapal initiate error', e);
            UI.notify('Network error. Is the API running?', 'error');
        }
    },

    startPolling(trackingId) {
        if (this.pollingInterval) clearInterval(this.pollingInterval);

        let attempts = 0;
        const maxAttempts = 40; // ~2 minutes polling

        this.pollingInterval = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(this.pollingInterval);
                UI.notify('Payment timeout. If you paid, it will reflect shortly.', 'warning');
                return;
            }

            try {
                const res = await fetch(`${window.location.origin}/api/pesapal/check-status?orderTrackingId=${trackingId}`);
                const data = await res.json();

                // status_code: 1 = Completed
                if (data.status_code === 1 || data.payment_status_description === 'Completed') {
                    clearInterval(this.pollingInterval);
                    UI.notify('Payment Successful! Your balance has been updated.', 'success');
                    UI.hideModal('wallet-modal');
                    // The IPN should have updated the balance, but let's refresh manually too
                    Auth.checkSession();
                } else if (data.status_code === 2 || data.payment_status_description === 'Failed') {
                    clearInterval(this.pollingInterval);
                    UI.notify('Payment failed or cancelled.', 'error');
                }
            } catch (e) {
                console.error('Polling error', e);
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
