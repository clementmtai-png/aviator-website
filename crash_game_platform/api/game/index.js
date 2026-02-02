/**
 * Combined Game API
 * Handles: state, history, bet, cashout
 * Path: /api/game/index.js
 */

const { kv } = require('@vercel/kv');
const { broadcast, broadcastUser } = require('../../lib/pusher');
const { generateCrashPoint, calculateMultiplier } = require('../../lib/game');

function allowCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

            if (action === 'bet') {
                const { username, amount } = body;
                if (!gameState || gameState.phase !== 'waiting') {
                    return res.status(400).json({ error: 'Bets are only allowed in the waiting phase.' });
                }

                const redisKey = `balance:${username}`;
                const current = await kv.get(redisKey);
                const balance = typeof current === 'number' ? current : parseFloat(current) || 0;

                if (balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

                const newBalance = Math.round((balance - amount) * 100) / 100;
                await kv.set(redisKey, newBalance);

                gameState.bets = gameState.bets || [];
                gameState.bets.push({ username, amount, multiplier: 0, status: 'betting' });
                await kv.set('game:state', gameState);

                await broadcastUser(username, 'balance:update', { balance: newBalance });
                return res.status(200).json({ success: true, balance: newBalance });
            }

            if (action === 'cashout') {
                const { username } = body;
                if (!gameState || gameState.phase !== 'running') return res.status(400).json({ error: 'Round not active' });

                const elapsed = Date.now() - gameState.startTime;
                const currentMultiplier = calculateMultiplier(elapsed);

                if (currentMultiplier >= gameState.crashPoint) return res.status(400).json({ error: 'Game already crashed' });

                const userBetIndex = (gameState.bets || []).findIndex(b => b.username === username && b.status === 'betting');
                if (userBetIndex === -1) return res.status(400).json({ error: 'No active bet found' });

                const userBet = gameState.bets[userBetIndex];
                const winnings = Math.floor(userBet.amount * currentMultiplier * 100) / 100;

                userBet.status = 'cashed';
                userBet.multiplier = currentMultiplier;
                userBet.winAmount = winnings;

                const redisKey = `balance:${username}`;
                const currentBal = await kv.get(redisKey);
                const balance = typeof currentBal === 'number' ? currentBal : parseFloat(currentBal) || 0;
                const newBalance = Math.round((balance + winnings) * 100) / 100;

                await kv.set(redisKey, newBalance);
                await kv.set('game:state', gameState);

                await broadcastUser(username, 'balance:update', { balance: newBalance });
                await broadcast('game:cashout', { username, winnings, multiplier: currentMultiplier });

                return res.status(200).json({ success: true, balance: newBalance, winnings, cashoutMultiplier: currentMultiplier });
            }
        }

        return res.status(404).json({ error: 'Action not found' });
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Server error' });
    }
};
