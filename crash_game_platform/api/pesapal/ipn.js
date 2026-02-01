/**
 * GET/POST /api/pesapal/ipn
 * Pesapal IPN webhook. Query/body: OrderTrackingId, OrderMerchantReference, OrderNotificationType.
 * Responds with JSON as required by Pesapal; optionally fetches transaction status and logs/credits.
 */

const { getToken, getTransactionStatus } = require('./utils');

function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getIpnParams(req) {
  if (req.method === 'GET') {
    return {
      OrderTrackingId: req.query.OrderTrackingId,
      OrderMerchantReference: req.query.OrderMerchantReference,
      OrderNotificationType: req.query.OrderNotificationType,
    };
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  return {
    OrderTrackingId: body.OrderTrackingId || body.order_tracking_id,
    OrderMerchantReference: body.OrderMerchantReference || body.order_merchant_reference,
    OrderNotificationType: body.OrderNotificationType || body.order_notification_type,
  };
}

module.exports = async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = getIpnParams(req);
  if (!OrderTrackingId || !OrderMerchantReference) {
    return res.status(400).json({
      orderNotificationType: OrderNotificationType || 'IPNCHANGE',
      orderTrackingId: OrderTrackingId || '',
      orderMerchantReference: OrderMerchantReference || '',
      status: 500,
    });
  }

  try {
    const token = await getToken();
    const statusData = await getTransactionStatus(OrderTrackingId, token);
    // status_code: 0 INVALID, 1 COMPLETED, 2 FAILED, 3 REVERSED
    const completed = statusData.status_code === 1;
    if (completed) {
      // Here you would credit the user (merchant_reference maps to your order/user).
      // This app has no DB; persist via your own store or external service.
      // console.log('Payment completed', { OrderMerchantReference, amount: statusData.amount });
    }
    return res.status(200).json({
      orderNotificationType: OrderNotificationType || 'IPNCHANGE',
      orderTrackingId: OrderTrackingId,
      orderMerchantReference: OrderMerchantReference,
      status: 200,
    });
  } catch (e) {
    return res.status(200).json({
      orderNotificationType: OrderNotificationType || 'IPNCHANGE',
      orderTrackingId: OrderTrackingId,
      orderMerchantReference: OrderMerchantReference,
      status: 500,
    });
  }
};
