/**
 * POST /api/game/bet
 * Place a bet on the current round
 * Body: { username, amount }
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
        const { username, amount } = body;

        if (!username || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid bet' });
        }

        // Check game state
        const gameState = await kv.get('game:state');
        if (!gameState || gameState.phase !== 'running') {
            return res.status(400).json({ error: 'No active round to bet on' });
        }

        // Check user balance
        const balanceKey = `balance:${username}`;
        const currentBalance = (await kv.get(balanceKey)) || 0;

        if (currentBalance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deduct balance
        const newBalance = currentBalance - amount;
        await kv.set(balanceKey, newBalance);

        // Add bet to game state
        const bet = {
            username,
            amount,
            placedAt: gameState.multiplier,
            cashedOut: false,
            cashoutMultiplier: null
        };

        gameState.bets = gameState.bets || [];
        gameState.bets.push(bet);
        await kv.set('game:state', gameState);

        // Broadcast bet to all players
        await broadcast('bet:placed', {
            username,
            amount,
            placedAt: gameState.multiplier
        });

        return res.status(200).json({
            success: true,
            balance: newBalance,
            bet: bet
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
