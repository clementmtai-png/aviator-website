/**
 * GET /api/user/balance?username=xxx
 * Returns the user's balance from KV (real money). Returns 0 if no key.
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

  const username = (req.query.username || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!username) return res.status(400).json({ error: 'Username required' });

  try {
    const redisKey = `balance:${username}`;
    const balance = await kv.get(redisKey);
    const num = typeof balance === 'number' ? balance : parseFloat(balance) || 0;
    return res.status(200).json({ balance: Math.max(0, num) });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to get balance' });
  }
};
