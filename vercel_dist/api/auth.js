/**
 * User Authentication API
 * POST /api/auth
 * Registration: { action: 'register', username, phone, password }
 * Login: { action: 'login', username, password }
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
        const { action, username, phone, password } = body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const cleanUsername = username.trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '');
        const userKey = `user:${cleanUsername}`;

        if (action === 'register') {
            if (!phone) return res.status(400).json({ error: 'Phone number is required' });

            // Check if user already exists
            const existing = await kv.get(userKey);
            if (existing) {
                return res.status(400).json({ error: 'Username already taken' });
            }

            // Create user profile
            const userProfile = {
                username: cleanUsername,
                phone: phone,
                password: password, // In production, hash this!
                createdAt: Date.now()
            };

            await kv.set(userKey, userProfile);

            // Initialize balance if not exists
            const balanceKey = `balance:${cleanUsername}`;
            const existingBalance = await kv.get(balanceKey);
            if (existingBalance === null) {
                await kv.set(balanceKey, 0);
            }

            return res.status(200).json({
                success: true,
                message: 'Registration successful',
                user: { username: cleanUsername, phone: phone, balance: existingBalance || 0 }
            });
        }

        if (action === 'login') {
            const user = await kv.get(userKey);

            if (!user) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            if (user.password !== password) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            // Get balance
            const balanceKey = `balance:${cleanUsername}`;
            const balance = await kv.get(balanceKey) || 0;

            return res.status(200).json({
                success: true,
                user: {
                    username: user.username,
                    phone: user.phone,
                    balance: balance,
                    isAdmin: user.username.includes('admin')
                }
            });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (e) {
        console.error('Auth Error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
