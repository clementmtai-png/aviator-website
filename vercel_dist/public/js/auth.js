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

    register(username, phone) {
        this.currentUser = {
            username: username,
            phone: phone,
            balance: 0,
            isLoggedIn: true,
            isAdmin: username.toLowerCase().includes('admin')
        };
        this.save();
        this.updateUI();
        UI.hideModal('register-modal');
        UI.notify(`Welcome to the platform, ${username}!`);
        this.fetchBalance();
    },

    login(username, password) {
        const isAdmin = username.toLowerCase() === 'admin' && password === 'root';

        this.currentUser = {
            username: username || 'User',
            balance: 0,
            isLoggedIn: true,
            isAdmin: isAdmin
        };
        this.save();
        this.updateUI();
        UI.hideModal('login-modal');
        this.fetchBalance();

        if (isAdmin) {
            UI.notify("Admin access granted!");
            UI.showModal('admin-modal');
            Admin.refresh();
        } else {
            UI.notify("Login successful!");
        }
    },

    save() {
        Utils.save('aviator_user', this.currentUser);
    },

    updateUI() {
        if (this.currentUser) {
            Utils.hide('auth-nav');
            Utils.show('user-nav');
            Utils.show('balance-area');
            const usernameEl = Utils.el('username-display');
            if (usernameEl) usernameEl.innerText = this.currentUser.username;
            Utils.el('user-balance').innerText = Utils.formatMoney(this.currentUser.balance);

            if (this.currentUser.isAdmin) {
                Utils.show('admin-access-btn');
                console.log("Admin access enabled.");
            } else {
                Utils.hide('admin-access-btn');
            }
        } else {
            Utils.show('auth-nav');
            Utils.hide('user-nav');
            Utils.hide('balance-area');
        }
    },

    logout() {
        this.currentUser = null;
        Utils.save('aviator_user', null);
        this.updateUI();
        UI.notify("Logged out successfully", "info");
    }
};
