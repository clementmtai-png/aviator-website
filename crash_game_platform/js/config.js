const CONFIG = {
    ADMIN_COMMAND: 'admin.pro.aviator', // Hidden trigger
    DEFAULT_BALANCE: 0, // Balance stays 0 until a payment is made (Pesapal/IPN credits the account)
    // Deposit button: if set, nav "Deposit" opens that URL (new tab); else opens wallet modal
    DEPOSIT_LINK: 'https://store.pesapal.com/stakebet',
    // STK Push / M-Pesa payment: set your payment page or gateway URL (amount is appended as ?amount=XXX)
    STK_PAYMENT_LINK: '', // e.g. 'https://your-site.com/pay'
    PESAPAL_PAYMENT_LINK: 'https://store.pesapal.com/stakebet', // Your direct Pesapal payment link
    MIN_DEPOSIT: 500,
    CHAT_MESSAGES: [
        "Big win incoming!",
        "Let's goooo 🚀",
        "Wait for 2x guys",
        "Just cashed out @ 1.8x, lucky me",
        "Flew away too fast :(",
        "Anyone betting on this round?",
        "This is crazy!",
        "Predictor v14 is working well",
        "Just deposited, feeling lucky",
        "Don't get greedy friends"
    ],
    USERNAMES: ["RocketMan", "SkyKing", "AviatorQueen", "MoonShot", "BigBettor", "CasualGamer", "LuckyStike", "ProfitHunter", "KenyaEagle", "ZimFalcon"],
    MIN_BET: 1.00,
    GAME_COOLDOWN: 5000, // 5 seconds between rounds
};
