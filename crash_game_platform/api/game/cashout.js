/**
 * POST /api/game/cashout
 * Cash out during an active round
 * Body: { username }
 */

const { kv } = require('@vercel/kv');
const { broadcast } = require('./pusher');

function allowCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { username } = body;

        if (!username) {
            return res.status(400).json({ error: 'Username required' });
        }

        // Check game state
        const gameState = await kv.get('game:state');
        if (!gameState || gameState.phase !== 'running') {
            return res.status(400).json({ error: 'No active round' });
        }

        // Find user's bet
        const betIndex = gameState.bets.findIndex(b => b.username === username && !b.cashedOut);
        if (betIndex === -1) {
            return res.status(400).json({ error: 'No active bet found' });
        }

        const bet = gameState.bets[betIndex];
        const cashoutMultiplier = gameState.multiplier;
        const winnings = Math.floor(bet.amount * cashoutMultiplier * 100) / 100;

        // Mark bet as cashed out
        gameState.bets[betIndex].cashedOut = true;
        gameState.bets[betIndex].cashoutMultiplier = cashoutMultiplier;
        await kv.set('game:state', gameState);

        // Credit winnings to user
        const balanceKey = `balance:${username}`;
        const currentBalance = (await kv.get(balanceKey)) || 0;
        const newBalance = currentBalance + winnings;
        await kv.set(balanceKey, newBalance);

        // Broadcast cashout to all players
        await broadcast('bet:cashout', {
            username,
            amount: bet.amount,
            cashoutMultiplier,
            winnings
        });

        return res.status(200).json({
            success: true,
            winnings,
            balance: newBalance,
            cashoutMultiplier
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
