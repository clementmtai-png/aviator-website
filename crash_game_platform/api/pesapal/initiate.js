/**
 * POST /api/pesapal/initiate
 * Body: { amount, currency?, email?, phone?, merchant_reference? }
 * Returns: { redirect_url, order_tracking_id, merchant_reference } or error.
 */

const { getBaseUrl, getToken, getTokenForBase, SANDBOX_BASE, PROD_BASE } = require('./utils');

function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
  const notificationId = process.env.PESAPAL_IPN_ID;
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.APP_URL || 'http://localhost:3000';

  if (!consumerKey || !consumerSecret || !notificationId) {
    return res.status(500).json({
      error: 'Pesapal not configured',
      hint: 'Set PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, PESAPAL_IPN_ID (and optionally PESAPAL_SANDBOX) in Vercel env.',
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const amount = parseFloat(body.amount);
  const currency = (body.currency || 'KES').toUpperCase().slice(0, 3);
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();
  const merchantReference = (body.merchant_reference || `order-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)
    .replace(/[^a-zA-Z0-9\-_.:]/g, '')
    .slice(0, 50);

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  if (!email && !phone) {
    return res.status(400).json({ error: 'Either email or phone is required' });
  }

  // Optional: body.sandbox true = sandbox, false = live; omit = use PESAPAL_SANDBOX env
  const useSandbox = body.sandbox === true || body.sandbox === 'true' || body.sandbox === '1';
  const useLive = body.sandbox === false || body.sandbox === 'false' || body.sandbox === '0';
  const base = useLive ? PROD_BASE : (useSandbox ? SANDBOX_BASE : getBaseUrl());

  try {
    const token = await getTokenForBase(base);
    const callbackUrl = `${baseUrl}/?pesapal=callback`;
    const cancellationUrl = `${baseUrl}/?pesapal=cancel`;

    const orderBody = {
      id: merchantReference,
      currency,
      amount,
      description: `Deposit ${amount} ${currency}`,
      callback_url: callbackUrl,
      cancellation_url: cancellationUrl,
      notification_id: notificationId,
      redirect_mode: 'TOP_WINDOW',
      billing_address: {
        email_address: email || 'noreply@example.com',
        phone_number: phone || '',
        country_code: (body.country_code || 'KE').slice(0, 2),
        first_name: (body.first_name || 'Customer').slice(0, 50),
        last_name: (body.last_name || '').slice(0, 50),
      },
    };

    const orderRes = await fetch(`${base}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderBody),
    });

    const orderData = await orderRes.json();
    if (orderData.redirect_url) {
      return res.status(200).json({
        redirect_url: orderData.redirect_url,
        order_tracking_id: orderData.order_tracking_id,
        merchant_reference: orderData.merchant_reference,
      });
    }
    return res.status(400).json({
      error: orderData.message || 'Submit order failed',
      details: orderData,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
