const Wallet = {
    init() {
        const payItems = document.querySelectorAll('.pay-item');
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
        const phone = (Utils.el('dep-phone') && Utils.el('dep-phone').value.trim()) || '';
        const sandbox = Utils.el('dep-sandbox') ? Utils.el('dep-sandbox').checked : true;
        const apiBase = window.location.origin;
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
        if (Auth.currentUser.balance < amount) {
            UI.notify("Insufficient balance", "error");
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
