const Wallet = {
    deposit() {
        const amount = parseFloat(Utils.el('dep-amount').value);
        if (isNaN(amount) || amount <= 0) {
            UI.notify("Please enter a valid amount", "error");
            return;
        }

        Auth.currentUser.balance += amount;
        Auth.save();
        Auth.updateUI();

        UI.hideModal('wallet-modal');
        UI.notify(`Successfully deposited $${Utils.formatMoney(amount)}`);

        // Clear input
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
