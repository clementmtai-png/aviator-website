/**
 * Combined PesaPal API
 * Path: /api/pesapal/index.js
 */

const { kv } = require('@vercel/kv');
const { getToken, registerIPN, getBaseUrl } = require('../lib/pesapal');

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
        // Ping action for testing
        if (action === 'ping') return res.status(200).json({ status: 'ok', time: Date.now() });

        const token = await getToken();

        if (action === 'initiate') {
            const { amount, username } = req.body;
            if (!username) return res.status(400).json({ error: 'Username required' });
            if (process.env.APP_URL.includes('your-project-name')) {
                return res.status(400).json({ error: 'APP_URL placeholder detected. Set your actual URL in Vercel settings.' });
            }

            // Reference format: dep-<timestamp>-<username>
            const orderId = `dep-${Date.now()}-${username}`;

            const payload = {
                id: orderId,
                currency: "KES",
                amount: parseFloat(amount),
                description: `Deposit for ${username}`,
                callback_url: `${process.env.APP_URL}/api/pesapal/ipn`,
                notification_id: process.env.PESAPAL_IPN_ID,
                billing_address: {
                    email_address: "customer@aviator.com",
                    first_name: username,
                    last_name: "Customer"
                }
            };

            const response = await fetch(`${getBaseUrl()}/api/Transactions/SubmitOrderRequest`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const text = await response.text();
            if (!response.ok) throw new Error(`PesaPal Initiation Failed (${response.status}): ${text.slice(0, 100)}`);
            const data = JSON.parse(text);

            await kv.set(`order:${orderId}`, { username, amount, status: 'pending' });
            return res.status(200).json(data);
        }

        if (action === 'check-status') {
            const trackingId = req.query.orderTrackingId || req.query.trackingId;
            if (!trackingId) return res.status(400).json({ error: 'trackingId required' });

            const response = await fetch(`${getBaseUrl()}/api/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const text = await response.text();
            if (!response.ok) throw new Error(`PesaPal Status Failed (${response.status}): ${text.slice(0, 100)}`);
            const data = JSON.parse(text);
            return res.status(200).json(data);
        }

        if (action === 'register-ipn') {
            const ipnUrl = `${process.env.APP_URL}/api/pesapal/ipn`;
            const result = await registerIPN(token, ipnUrl);
            return res.status(200).json(result);
        }

        return res.status(404).json({ error: 'Action not found' });
    } catch (e) {
        return res.status(500).json({ error: e.message || 'PesaPal API error' });
    }
};
