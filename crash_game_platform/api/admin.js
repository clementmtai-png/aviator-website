/**
 * Admin API
 * POST /api/admin
 * Action: set_planned_crashes { multipliers: [number, number, ...] }
 */

const { kv } = require('@vercel/kv');

function allowCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
        const { action, multipliers, username, password } = body;

        // Simple auth check for now (should be improved with sessions)
        const user = await kv.get(`user:${username}`);
        if (!user || user.password !== password || !username.includes('admin')) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (action === 'set_planned_crashes') {
            if (!Array.isArray(multipliers) || multipliers.length === 0) {
                return res.status(400).json({ error: 'Multipliers must be a non-empty array' });
            }

            // Clear existing and push new
            await kv.del('game:planned_crashes');
            for (const m of multipliers) {
                const val = parseFloat(m);
                if (!isNaN(val) && val >= 1) {
                    await kv.rpush('game:planned_crashes', val);
                }
            }

            return res.status(200).json({ success: true, message: `Stored ${multipliers.length} planned crashes.` });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (e) {
        console.error('Admin API Error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
