/**
 * POST /api/game/start
 * Starts a new game round - should be called by game master/admin
 */

const { kv } = require('@vercel/kv');
const { broadcast } = require('./pusher');

function allowCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Generate crash point with house edge
function generateCrashPoint() {
    const houseEdge = 0.05; // 5% house edge
    const random = Math.random();
    if (random < houseEdge) {
        return 1.00; // Instant crash
    }
    // Exponential distribution for crash points
    const crashPoint = 1 / (1 - random * (1 - houseEdge));
    return Math.min(Math.floor(crashPoint * 100) / 100, 1000); // Max 1000x
}

module.exports = async function handler(req, res) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const roundId = `round-${Date.now()}`;
        const crashPoint = generateCrashPoint();
        const startTime = Date.now();

        const gameState = {
            phase: 'running',
            multiplier: 1.00,
            crashPoint: crashPoint, // Hidden from clients
            roundId: roundId,
            startTime: startTime,
            bets: []
        };

        await kv.set('game:state', gameState);

        // Broadcast game start (without crash point!)
        await broadcast('game:start', {
            roundId: roundId,
            startTime: startTime
        });

        return res.status(200).json({
            success: true,
            roundId: roundId,
            startTime: startTime
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
