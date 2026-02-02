/**
 * GET /api/game/state
 * Returns current game state (for new clients joining mid-round)
 */

const { kv } = require('@vercel/kv');

function allowCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const gameState = await kv.get('game:state') || {
            phase: 'waiting',
            multiplier: 1.00,
            crashPoint: null,
            roundId: null,
            startTime: null,
            bets: []
        };

        return res.status(200).json(gameState);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
