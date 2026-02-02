/**
 * GET /api/game/history
 * Returns the last 100 game rounds with crash points and timestamps
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
        // Retrieve game history from KV storage
        const history = await kv.get('game:history') || [];

        // Return the history (already limited to last 100 rounds)
        return res.status(200).json({
            success: true,
            history: history,
            count: history.length
        });
    } catch (e) {
        console.error('Error fetching game history:', e);
        return res.status(500).json({
            error: e.message,
            history: []
        });
    }
};
