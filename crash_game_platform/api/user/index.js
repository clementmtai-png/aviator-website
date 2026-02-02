/**
 * Combined User API
 * GET  /api/user/index?action=balance&username=xxx
 * POST /api/user/index { action: 'credit'|'debit', username, amount }
 */

const { kv } = require('@vercel/kv');

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
        if (req.method === 'GET') {
            // HANDLE GET ACTIONS
            if (action === 'balance') {
                const username = (req.query.username || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
                if (!username) return res.status(400).json({ error: 'Username required' });
                const redisKey = `balance:${username}`;
                const balance = await kv.get(redisKey);
                const num = typeof balance === 'number' ? balance : parseFloat(balance) || 0;
                return res.status(200).json({ balance: Math.max(0, num) });
            }
        }

        if (req.method === 'POST') {
            // HANDLE POST ACTIONS
            const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
            const act = body.action;
            const username = (body.username || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
            const amount = parseFloat(body.amount);

            if (!username) return res.status(400).json({ error: 'Username required' });
            if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

            const redisKey = `balance:${username}`;
            const current = await kv.get(redisKey);
            const balance = typeof current === 'number' ? current : parseFloat(current) || 0;

            if (act === 'debit') {
                if (balance < amount) return res.status(400).json({ error: 'Insufficient balance', balance });
                const newBalance = Math.round((balance - amount) * 100) / 100;
                await kv.set(redisKey, newBalance);
                return res.status(200).json({ balance: newBalance });
            }

            if (act === 'credit') {
                const newBalance = Math.round((balance + amount) * 100) / 100;
                await kv.set(redisKey, newBalance);
                return res.status(200).json({ balance: newBalance });
            }
        }

        return res.status(404).json({ error: 'Action not found' });
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Server error' });
    }
};
