// UI is now loaded from ui.js

// Start all systems
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    UI.init();
    Wallet.init();
    Chat.init();
    Engine.init();

    // Extra: STK Push button in wallet
    const stkPushBtn = Utils.el('stk-push-btn');
    if (stkPushBtn) {
        stkPushBtn.onclick = () => Wallet.openPesapalPayment(true);
    }

    const pesapalLinkBtn = Utils.el('pesapal-payment-btn');
    if (pesapalLinkBtn) {
        pesapalLinkBtn.onclick = () => Wallet.openPesapalPayment(false);
    }

    // Input listener for bet amount
    const betInput = Utils.el('bet-amount');
    if (betInput) {
        betInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            UI.updateBtnText(val);
        });
    }
});
