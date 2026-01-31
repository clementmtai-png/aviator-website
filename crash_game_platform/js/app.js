const UI = {
    init() {
        // Event Listeners for Forms
        Utils.el('register-form').onsubmit = (e) => {
            e.preventDefault();
            const user = Utils.el('reg-user').value;
            Auth.register(user);
        };

        Utils.el('login-form').onsubmit = (e) => {
            e.preventDefault();
            const user = e.target.querySelector('input[type="text"]').value;
            const pass = e.target.querySelector('input[type="password"]').value;
            Auth.login(user, pass);
        };

        Utils.el('open-wallet').onclick = () => this.showModal('wallet-modal');

        Utils.el('care-btn').onclick = () => {
            this.notify("Connecting to a live agent...", "info");
            setTimeout(() => this.notify("Agent 'Sarah' has joined the chat.", "info"), 2000);
        };

        // Remove logo click trigger for admin
        document.querySelector('.logo').onclick = null;
    },

    showModal(id) {
        Utils.show(id);
    },

    hideModal(id) {
        Utils.hide(id);
    },

    adjustBet(factor) {
        const input = Utils.el('bet-amount');
        let val = parseFloat(input.value);
        input.value = (val * factor).toFixed(2);
    },

    notify(msg, type = 'success') {
        const div = document.createElement('div');
        div.className = `toast toast-${type}`;
        div.innerText = msg;
        document.body.appendChild(div);

        setTimeout(() => div.classList.add('visible'), 100);
        setTimeout(() => {
            div.classList.remove('visible');
            setTimeout(() => div.remove(), 500);
        }, 3000);
    }
};

// Start all systems
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    UI.init();
    Chat.init();
    Engine.init();
});
