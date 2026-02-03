/**
 * POST /api/user/credit
 * Body: { username, amount }
 * Adds amount to user balance (deposits from IPN or game cashout). Returns new balance.
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const username = (body.username || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const amount = parseFloat(body.amount);

  if (!username) return res.status(400).json({ error: 'Username required' });
  if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  try {
    const redisKey = `balance:${username}`;
    const current = await kv.get(redisKey);
    const balance = typeof current === 'number' ? current : parseFloat(current) || 0;
    const newBalance = Math.round((balance + amount) * 100) / 100;
    await kv.set(redisKey, newBalance);
    return res.status(200).json({ balance: newBalance });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to credit' });
  }
};
