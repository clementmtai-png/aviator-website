/**
 * POST /api/pesapal/register-ipn
 * One-time setup: register your IPN URL with Pesapal and get ipn_id for PESAPAL_IPN_ID.
 * Body: none (uses VERCEL_URL + /api/pesapal/ipn). Requires PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET.
 */

const { getBaseUrl, getToken } = require('./utils');

function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const allowed = ['POST', 'GET'];
  if (!allowed.includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.PESAPAL_CONSUMER_KEY || !process.env.PESAPAL_CONSUMER_SECRET) {
    return res.status(500).json({ error: 'Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET' });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.APP_URL || 'http://localhost:3000';
  const ipnUrl = `${baseUrl}/api/pesapal/ipn`;

  try {
    const token = await getToken();
    const base = getBaseUrl();
    const regRes = await fetch(`${base}/api/URLSetup/RegisterIPN`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: ipnUrl,
        ipn_notification_type: 'POST',
      }),
    });
    const data = await regRes.json();
    if (data.ipn_id) {
      return res.status(200).json({
        ipn_id: data.ipn_id,
        url: data.url,
        message: 'Set PESAPAL_IPN_ID=' + data.ipn_id + ' in Vercel env and redeploy.',
      });
    }
    return res.status(400).json({ error: data.message || 'Register IPN failed', details: data });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
};
