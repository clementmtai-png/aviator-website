const Auth = {
    currentUser: null,

    async fetchBalance() {
        if (!this.currentUser || !this.currentUser.username) return;
        try {
            const res = await fetch(`${window.location.origin}/api/user?action=balance&username=${encodeURIComponent(this.currentUser.username)}`);
            const data = await res.json();
            if (data.balance !== undefined) {
                this.currentUser.balance = data.balance;
                this.save();
                this.updateUI();
            }
        } catch (e) { /* keep current balance on error */ }
    },

    init() {
        const savedUser = Utils.load('aviator_user');
        if (savedUser) {
            this.currentUser = savedUser;
            this.currentUser.balance = 0; // Show 0 until fetchBalance() returns server balance (updated after payment)
            this.updateUI();
            this.fetchBalance();
        }
    },

    async register(username, phone, password) {
        try {
            const res = await fetch(`${window.location.origin}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'register', username, phone, password })
            });
            const data = await res.json();

            if (data.success) {
                this.currentUser = {
                    ...data.user,
                    isLoggedIn: true
                };
                this.save();
                this.updateUI();
                UI.hideModal('register-modal');
                UI.notify(`Welcome to StakeBets, ${data.user.username}!`, 'success');
                this.fetchBalance();
            } else {
                UI.notify(data.error || 'Registration failed', 'error');
            }
        } catch (e) {
            UI.notify('Network error', 'error');
        }
    },

    async login(username, password) {
        try {
            const res = await fetch(`${window.location.origin}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username, password })
            });
            const data = await res.json();

            if (data.success) {
                this.currentUser = {
                    ...data.user,
                    isLoggedIn: true
                };
                this.save();
                this.updateUI();
                UI.hideModal('login-modal');

                if (this.currentUser.isAdmin) {
                    UI.notify("Admin access granted!", 'success');
                    UI.showModal('admin-modal');
                    Admin.refresh();
                } else {
                    UI.notify("Login successful!", 'success');
                }
                this.fetchBalance();
            } else {
                UI.notify(data.error || 'Invalid credentials', 'error');
            }
        } catch (e) {
            UI.notify('Network error', 'error');
        }
    },

    save() {
        Utils.save('aviator_user', this.currentUser);
    },

    updateUI() {
        if (this.currentUser) {
            Utils.show('balance-area');
            Utils.show('logout-btn-nav');
            Utils.show('open-wallet'); // Deposit button
            Utils.show('open-withdraw-nav');

            const balEl = Utils.el('user-balance');
            if (balEl) balEl.innerText = Utils.formatMoney(this.currentUser.balance);

            if (this.currentUser.isAdmin) {
                console.log("Admin access enabled.");
                // We could add an admin indicator or button here if needed
            }
        } else {
            Utils.hide('balance-area');
            Utils.hide('logout-btn-nav');
            Utils.hide('open-wallet');
            Utils.hide('open-withdraw-nav');
        }
    },

    logout() {
        this.currentUser = null;
        Utils.save('aviator_user', null);
        this.updateUI();
        UI.notify("Logged out successfully", "info");
    }
};
