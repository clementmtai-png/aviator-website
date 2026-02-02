const { advanceGame } = require('../lib/game-engine');

module.exports = async function handler(req, res) {
    // Basic auth check
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.NODE_ENV === 'production') return res.status(401).end();
    }

    try {
        await advanceGame();
        return res.status(200).json({ status: 'done' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
