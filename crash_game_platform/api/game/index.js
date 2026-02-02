/**
 * Combined Game API
 * Handles: state, start, tick, history (optional), bet, cashout
 * Path: /api/game/index.js
 */

const { kv } = require('@vercel/kv');
const { broadcast } = require('../../lib/pusher');

function allowCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Calculate multiplier based on elapsed time
function calculateMultiplier(elapsedMs) {
    const growthRate = 0.00006;
    return Math.floor((Math.exp(growthRate * elapsedMs)) * 100) / 100;
}

// Generate crash point with house edge
function generateCrashPoint() {
    const houseEdge = 0.05;
    const random = Math.random();
    if (random < houseEdge) return 1.00;
    const crashPoint = 1 / (1 - random * (1 - houseEdge));
    return Math.min(Math.floor(crashPoint * 100) / 100, 1000);
}

module.exports = async function handler(req, res) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();

    const action = req.method === 'GET' ? req.query.action : req.body.action;

    try {
        let gameState = await kv.get('game:state');

        if (req.method === 'GET') {
            if (action === 'state') {
                return res.status(200).json(gameState || { phase: 'waiting' });
            }

            if (action === 'history') {
                const history = await kv.get('game:history') || [];
                return res.status(200).json({ success: true, history, count: history.length });
            }
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

            // BET ACTION
            if (action === 'bet') {
                const { username, amount } = body;
                if (!gameState || gameState.phase !== 'running') return res.status(400).json({ error: 'No active round' });

                // Deduct balance (calling internal logic since we can't easily fetch our own consolidated API)
                const redisKey = `balance:${username}`;
                const current = await kv.get(redisKey);
                const balance = typeof current === 'number' ? current : parseFloat(current) || 0;

                if (balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

                const newBalance = Math.round((balance - amount) * 100) / 100;
                await kv.set(redisKey, newBalance);

                // Add bet to round (optional, mostly for display)
                gameState.bets = gameState.bets || [];
                gameState.bets.push({ username, amount, multiplier: 0, status: 'betting' });
                await kv.set('game:state', gameState);

                return res.status(200).json({ success: true, balance: newBalance });
            }

            // CASHOUT ACTION
            if (action === 'cashout') {
                const { username } = body;
                if (!gameState || gameState.phase !== 'running') return res.status(400).json({ error: 'Round not active' });

                const elapsed = Date.now() - gameState.startTime;
                const currentMultiplier = calculateMultiplier(elapsed);

                // Check if already crashed conceptually
                if (currentMultiplier >= gameState.crashPoint) return res.status(400).json({ error: 'Game already crashed' });

                // Credit balance
                const redisKey = `balance:${username}`;
                const userBet = (gameState.bets || []).find(b => b.username === username && b.status === 'betting');
                if (!userBet) return res.status(400).json({ error: 'No active bet found' });

                const winnings = Math.floor(userBet.amount * currentMultiplier * 100) / 100;
                userBet.status = 'cashed';
                userBet.multiplier = currentMultiplier;
                userBet.winAmount = winnings;

                const currentBal = await kv.get(redisKey);
                const balance = typeof currentBal === 'number' ? currentBal : parseFloat(currentBal) || 0;
                const newBalance = Math.round((balance + winnings) * 100) / 100;

                await kv.set(redisKey, newBalance);
                await kv.set('game:state', gameState);

                return res.status(200).json({ success: true, balance: newBalance, winnings, cashoutMultiplier: currentMultiplier });
            }
        }

        return res.status(404).json({ error: 'Action not found' });
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Server error' });
    }
};
