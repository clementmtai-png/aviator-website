/**
 * Combined Game API
 * Handles: state, history, bet, cashout
 * Path: /api/game/index.js
 */

const { kv } = require('@vercel/kv');
const { broadcast, broadcastUser } = require('../../lib/pusher');
const { getDeterministicCrashPoint, calculateMultiplier, ROUND_CYCLE, BETTING_TIME } = require('../../public/js/logic');

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
        // 1. Calculate virtual state
        const now = Date.now();
        const cycleTime = now % ROUND_CYCLE;
        const roundId = now - cycleTime;
        const crashPoint = getDeterministicCrashPoint(roundId);

        let phase = 'running';
        if (cycleTime < BETTING_TIME) phase = 'waiting';
        else if (calculateMultiplier(cycleTime - BETTING_TIME) >= crashPoint) phase = 'crashed';

        const virtualState = {
            phase,
            roundId: `round-${roundId}`,
            startTime: roundId + BETTING_TIME,
            crashPoint: phase === 'crashed' ? crashPoint : undefined,
            multiplier: phase === 'running' ? calculateMultiplier(cycleTime - BETTING_TIME) : 1.00
        };

        if (req.method === 'GET') {
            if (action === 'state') {
                return res.status(200).json({ ...virtualState, serverTime: now });
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
                if (phase !== 'waiting') {
                    return res.status(400).json({ error: 'Bets are only allowed in the waiting phase.' });
                }

                const redisKey = `balance:${username}`;
                const current = await kv.get(redisKey);
                const balance = typeof current === 'number' ? current : parseFloat(current) || 0;

                if (balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

                const newBalance = Math.round((balance - amount) * 100) / 100;
                await kv.set(redisKey, newBalance);

                // Store bet in round-specific key
                const betKey = `game:bets:${virtualState.roundId}`;
                const bets = await kv.get(betKey) || [];
                const existing = bets.find(b => b.username === username);
                if (existing) return res.status(400).json({ error: 'Already placed a bet' });

                const newBet = { username, amount, multiplier: 0, status: 'betting' };
                bets.push(newBet);
                await kv.set(betKey, bets);

                await broadcastUser(username, 'balance:update', { balance: newBalance });
                await broadcast('bet:placed', newBet);
                return res.status(200).json({ success: true, balance: newBalance });
            }

            if (action === 'cashout') {
                const { username } = body;
                if (phase !== 'running') return res.status(400).json({ error: 'Round not active' });

                const elapsed = now - virtualState.startTime;
                const currentMultiplier = calculateMultiplier(elapsed);

                if (currentMultiplier >= crashPoint) return res.status(400).json({ error: 'Game already crashed' });

                const betKey = `game:bets:${virtualState.roundId}`;
                const bets = await kv.get(betKey) || [];
                const userBetIndex = bets.findIndex(b => b.username === username && b.status === 'betting');
                if (userBetIndex === -1) return res.status(400).json({ error: 'No active bet found' });

                const userBet = bets[userBetIndex];
                const winnings = Math.floor(userBet.amount * currentMultiplier * 100) / 100;

                userBet.status = 'cashed';
                userBet.multiplier = currentMultiplier;
                userBet.winAmount = winnings;

                const redisKey = `balance:${username}`;
                const currentBal = await kv.get(redisKey);
                const balance = typeof currentBal === 'number' ? currentBal : parseFloat(currentBal) || 0;
                const newBalance = Math.round((balance + winnings) * 100) / 100;

                await kv.set(redisKey, newBalance);
                await kv.set(betKey, bets);

                await broadcastUser(username, 'balance:update', { balance: newBalance });
                await broadcast('bet:cashout', { username, winnings, multiplier: currentMultiplier });

                return res.status(200).json({ success: true, balance: newBalance, winnings, cashoutMultiplier: currentMultiplier });
            }
        }

        return res.status(404).json({ error: 'Action not found' });
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Server error' });
    }
};
