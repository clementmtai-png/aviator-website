const CONFIG = {
    ADMIN_COMMAND: 'admin.pro.aviator', // Hidden trigger
    DEFAULT_BALANCE: 1000.00,
    // Deposit button: if set, nav "Deposit" opens that URL (new tab); else opens wallet modal
    DEPOSIT_LINK: '',
    // STK Push / M-Pesa payment: set your payment page or gateway URL (amount is appended as ?amount=XXX)
    STK_PAYMENT_LINK: '', // e.g. 'https://your-site.com/pay' or 'https://paybill.example.com/123456'
    PESAPAL_PAYMENT_LINK: '', // Your direct Pesapal payment link
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
