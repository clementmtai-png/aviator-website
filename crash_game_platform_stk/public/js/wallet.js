const Wallet = {
    init() {
        const payItems = document.querySelectorAll('.pay-item');
        const stkArea = Utils.el('stk-push-area');

        // Set initial state (M-PESA active by default in HTML)
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
        if (amount < CONFIG.MIN_DEPOSIT) {
            UI.notify(`Minimum deposit is KES ${CONFIG.MIN_DEPOSIT}`, 'error');
            return;
        }
        const email = (Utils.el('dep-email') && Utils.el('dep-email').value.trim()) || '';
        const phone = (Utils.el('dep-phone') && Utils.el('dep-phone').value.trim()) || '';
        const sandbox = Utils.el('dep-sandbox') ? Utils.el('dep-sandbox').checked : true;
        const apiBase = window.location.origin;

        // STK Push request if flag is set (we'll call this from a new button)
        const isStk = arguments[0] === true;

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
                    stk: isStk,
                    merchant_reference: 'dep-' + Date.now() + '-' + (Auth.currentUser ? Auth.currentUser.username : 'guest'),
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (isStk && data.order_tracking_id) {
                UI.notify('STK Push sent to your phone. Please enter your PIN.', 'info');
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
        // M-PESA: use STK link if set, else Pesapal API
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
            UI.notify('Use Pesapal or M-PESA to add real funds. Balance updates after payment.', 'info');
            return;
        }

        UI.hideModal('wallet-modal');
        Utils.el('dep-amount').value = '';
    },

    withdraw(amount) {
        if (!Auth.currentUser) {
            UI.notify("Please log in", "error");
            return false;
        }
        if (amount > Auth.currentUser.balance) {
            UI.notify(`Insufficient balance. You only have KES ${Utils.formatMoney(Auth.currentUser.balance)}`, "error");
            return false;
        }

        Auth.currentUser.balance -= amount;
        Auth.save();
        Auth.updateUI();
        return true;
    },

    addWin(amount) {
        Auth.currentUser.balance += amount;
        Auth.save();
        Auth.updateUI();
    }
};
