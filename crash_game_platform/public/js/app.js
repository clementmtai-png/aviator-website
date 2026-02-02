// UI is now handled in js/ui.js

// Start all systems
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    UI.init();
    Wallet.init();
    Chat.init();
    Engine.init();

    // Initialize real-time sync (if Realtime exists)
    if (typeof Realtime !== 'undefined') {
        Realtime.init();
    }

    // Extra: STK Push button in wallet
    const stkPushBtn = Utils.el('stk-push-btn');
    if (stkPushBtn) {
        stkPushBtn.onclick = () => Wallet.openPesapalPayment(true);
    }

    const pesapalLinkBtn = Utils.el('pesapal-payment-btn');
    if (pesapalLinkBtn) {
        pesapalLinkBtn.onclick = () => Wallet.openPesapalPayment(false);
    }
});
