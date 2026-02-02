/**
 * Pesapal API 3.0 helpers for serverless routes.
 */

const SANDBOX_BASE = 'https://cybqa.pesapal.com/pesapalv3';
const PROD_BASE = 'https://pay.pesapal.com/v3';

function getBaseUrl() {
  const sandbox = process.env.PESAPAL_SANDBOX === 'true' || process.env.PESAPAL_SANDBOX === '1';
  return sandbox ? SANDBOX_BASE : PROD_BASE;
}

async function getToken() {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`PesaPal Auth Invalid JSON (${res.status}): ${text.slice(0, 100)}`);
  }

  if (!res.ok || data.error || data.status >= 400) {
    const errorMsg = data.error?.message || data.message || text.slice(0, 100);
    throw new Error(`PesaPal Auth Failed: ${errorMsg}`);
  }

  if (data.token) return data.token;
  throw new Error('PesaPal Auth Failed: No token in response');
}

async function getTransactionStatus(orderTrackingId, token) {
  const base = getBaseUrl();
  const url = `${base}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PesaPal Status Failed (${res.status}): ${text.slice(0, 100)}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`PesaPal Status Invalid JSON: ${text.slice(0, 100)}`);
  }
}

async function registerIPN(token, ipnUrl) {
  if (!ipnUrl || ipnUrl.includes('undefined') || ipnUrl.includes('your-project-name') || ipnUrl.includes('localhost')) {
    throw new Error("Invalid IPN URL. Please set your actual APP_URL in Vercel environment variables.");
  }
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: ipnUrl,
      ipn_notification_type: 'GET',
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PesaPal IPN Failed (${res.status}): ${text.slice(0, 100)}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`PesaPal IPN Invalid JSON: ${text.slice(0, 100)}`);
  }
}

module.exports = { getBaseUrl, getToken, getTransactionStatus, registerIPN, SANDBOX_BASE, PROD_BASE };
