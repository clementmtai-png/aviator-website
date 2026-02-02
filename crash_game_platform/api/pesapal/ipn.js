/**
 * GET/POST /api/pesapal/ipn
 * Webhook that credits user balance and notifies frontend via Pusher.
 */

const { getToken, getTransactionStatus } = require('../../lib/pesapal');
const { kv } = require('@vercel/kv');
const { broadcastUser } = require('../../lib/pusher');

function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const OrderTrackingId = req.query.OrderTrackingId || req.body.OrderTrackingId || req.body.order_tracking_id;
  const OrderMerchantReference = req.query.OrderMerchantReference || req.body.OrderMerchantReference || req.body.order_merchant_reference;

  if (!OrderTrackingId || !OrderMerchantReference) {
    return res.status(200).json({ status: 200, message: 'Keepalive/Invalid params' });
  }

  try {
    const token = await getToken();
    const statusData = await getTransactionStatus(OrderTrackingId, token);

    // Pesapal status_code: 1 = COMPLETED
    if (statusData.status_code === 1) {
      // Reference: dep-123456789-username
      const parts = OrderMerchantReference.split('-');
      const username = parts.length >= 3 ? parts[parts.length - 1] : '';
      const amount = parseFloat(statusData.amount);

      if (username && !isNaN(amount) && amount > 0) {
        const redisKey = `balance:${username}`;
        const current = await kv.get(redisKey);
        const balance = typeof current === 'number' ? current : parseFloat(current) || 0;
        const newBalance = Math.round((balance + amount) * 100) / 100;

        await kv.set(redisKey, newBalance);
        await broadcastUser(username, 'balance:update', { balance: newBalance });
        console.log(`Credited ${username} with KES ${amount}`);
      }
    }

    return res.status(200).json({ status: 200, orderTrackingId: OrderTrackingId });
  } catch (e) {
    console.error('IPN Error:', e.message);
    return res.status(200).json({ status: 500, error: e.message });
  }
};
