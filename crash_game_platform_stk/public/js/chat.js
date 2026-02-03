const Chat = {
    box: null,

    init() {
        this.box = Utils.el('chat-box');
        this.startSimulation();
    },

    startSimulation() {
        const tick = () => {
            if (Math.random() > 0.7) {
                this.addMessage(
                    Utils.randomItem(CONFIG.USERNAMES),
                    Utils.randomItem(CONFIG.CHAT_MESSAGES)
                );
            }
            setTimeout(tick, Utils.randomRange(1000, 4000));
        };
        tick();
    },

    addMessage(user, text) {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `<span class="user-tag">${user}:</span> ${text}`;
        this.box.appendChild(div);

        // Auto scroll
        this.box.scrollTop = this.box.scrollHeight;

        // Limit messages
        if (this.box.children.length > 50) this.box.firstChild.remove();
    }
};
