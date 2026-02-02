/**
 * Combined PesaPal API
 * Path: /api/pesapal/index.js
 */

const { kv } = require('@vercel/kv');
const { getAuthToken, registerIPN, getPesaPalBaseUrl } = require('../../lib/pesapal');

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
        const token = await getAuthToken();

        if (action === 'initiate') {
            const { amount, phone, username, isStk } = req.body;
            const orderId = `DEP-${Date.now()}`;

            const payload = {
                id: orderId,
                currency: "KES",
                amount: parseFloat(amount),
                description: `Deposit for ${username}`,
                callback_url: `${process.env.APP_URL}/api/pesapal/ipn`,
                notification_id: process.env.PESAPAL_IPN_ID,
                billing_address: {
                    phone_number: phone || "",
                    email_address: "customer@example.com",
                    first_name: username,
                    last_name: "Customer"
                }
            };

            const endpoint = isStk ? "/api/Transactions/SubmitOrderRequest" : "/api/Transactions/SubmitOrderRequest";
            // Actually PesaPal 3.0 uses the same endpoint for both, but returns a redirect URL
            // For STK Push, it depends on the payment method selected in the redirect page OR the API flavor
            // Here we assume standard redirect flow as optimized previously.

            const response = await fetch(`${getPesaPalBaseUrl()}${endpoint}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // Store reference to credit user on IPN
            await kv.set(`order:${orderId}`, { username, amount, status: 'pending' });

            return res.status(200).json(data);
        }

        if (action === 'check-status') {
            const { trackingId } = req.query;
            const response = await fetch(`${getPesaPalBaseUrl()}/api/Transactions/GetTransactionStatus?trackingId=${trackingId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await response.json();
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
