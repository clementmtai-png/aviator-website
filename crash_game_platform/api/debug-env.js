/**
 * Diagnostic Tool
 * Path: /api/debug-env.js
 * Use this to check if Vercel sees your environment variables.
 * DO NOT use this in a public production environment as it reveals variable keys.
 */

module.exports = async function handler(req, res) {
    const requiredVars = [
        'KV_REST_API_URL',
        'KV_REST_API_TOKEN',
        'PESAPAL_CONSUMER_KEY',
        'PESAPAL_CONSUMER_SECRET',
        'PESAPAL_IPN_ID',
        'PUSHER_APP_ID'
    ];

    const status = {};
    requiredVars.forEach(v => {
        status[v] = process.env[v] ? 'LOADED' : 'MISSING';
    });

    res.status(200).json({
        message: "Diagnostic Report",
        environment: process.env.NODE_ENV || 'unknown',
        variables: status,
        vercel_url: process.env.VERCEL_URL || 'unknown'
    });
};
