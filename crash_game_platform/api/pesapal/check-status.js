/**
 * GET /api/pesapal/check-status?orderTrackingId=xxx
 * Returns the status of a Pesapal transaction.
 */

const { getTransactionStatus, getToken } = require('./utils');

function allowCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { orderTrackingId } = req.query;
    if (!orderTrackingId) return res.status(400).json({ error: 'orderTrackingId required' });

    try {
        const token = await getToken();
        const data = await getTransactionStatus(orderTrackingId, token);

        // Pesapal status_code: 1 = Completed, 2 = Failed, 3 = Reversed, 0 = Invalid
        return res.status(200).json({
            payment_status: data.payment_status_description || data.paymentStatusDescription,
            status: data.status_code !== undefined ? data.status_code : data.statusCode,
            amount: data.amount,
            merchant_reference: data.merchant_reference || data.merchantReference,
            raw: data
        });
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Failed to check status' });
    }
};
