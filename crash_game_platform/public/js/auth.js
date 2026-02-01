const Auth = {
    currentUser: null,

    init() {
        const savedUser = Utils.load('aviator_user');
        if (savedUser) {
            this.currentUser = savedUser;
            this.currentUser.balance = 0; // Zero until payment is made
            this.updateUI();
        }
    },

    register(username) {
        this.currentUser = {
            username: username,
            balance: 0,
            isLoggedIn: true,
            isAdmin: username.toLowerCase().includes('admin')
        };
        this.save();
        this.updateUI();
        UI.hideModal('register-modal');
        UI.notify(`Welcome to the platform, ${username}!`);
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
            Utils.el('username-display').innerText = this.currentUser.username;
            Utils.el('user-balance').innerText = Utils.formatMoney(this.currentUser.balance);

            if (this.currentUser.isAdmin) {
                Utils.show('admin-access-btn');
                console.log("Admin access enabled.");
            } else {
                Utils.hide('admin-access-btn');
            }
        }
    }
};
