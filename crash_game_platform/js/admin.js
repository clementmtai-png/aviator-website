const Admin = {
    refresh() {
        const list = Utils.el('admin-user-list');
        list.innerHTML = '';

        // Map current user and some simulated ones
        const users = [
            Auth.currentUser,
            { username: "MoonShot", balance: 5420.50 },
            { username: "LuckyStrike", balance: 120.00 },
            { username: "KenyaEagle", balance: 890.10 }
        ];

        users.forEach(u => {
            if (!u) return;
            const item = document.createElement('div');
            item.className = 'admin-user-item';
            item.innerHTML = `<span>${u.username}</span> <strong>$${Utils.formatMoney(u.balance)}</strong>`;
            list.appendChild(item);
        });

        // Show next round info
        Utils.el('admin-live-stats').innerHTML = `
            <p>Next Random Crash: <strong>${Engine.crashPoint}x</strong></p>
            <p>Active Bets: 12</p>
            <p>Total Pool: $420.00</p>
        `;
    },

    setNextCrash() {
        const val = parseFloat(Utils.el('next-crash-input').value);
        if (!isNaN(val) && val >= 1) {
            Engine.forcedCrash = val;
            UI.notify(`Success: Next crash forced to ${val}x`, "success");
            this.refresh();
        } else {
            UI.notify("Invalid multiplier", "error");
        }
    },

    showForcePopup() {
        const val = prompt("Enter Force Multiplier (e.g. 2.50):");
        if (val !== null) {
            const num = parseFloat(val);
            if (!isNaN(num) && num >= 1) {
                Engine.forcedCrash = num;
                UI.notify(`Success: Next crash forced to ${num}x`, "success");
                this.refresh();
            } else {
                UI.notify("Invalid multiplier entered", "error");
            }
        }
    }
};
