/**
 * Pesapal API 3.0 helpers for serverless routes.
 * Base URLs: sandbox https://cybqa.pesapal.com/pesapalv3 | prod https://pay.pesapal.com/v3
 */

const SANDBOX_BASE = 'https://cybqa.pesapal.com/pesapalv3';
const PROD_BASE = 'https://pay.pesapal.com/v3';

function getBaseUrl() {
  const sandbox = process.env.PESAPAL_SANDBOX === 'true' || process.env.PESAPAL_SANDBOX === '1';
  return sandbox ? SANDBOX_BASE : PROD_BASE;
}

async function getTokenForBase(base) {
  const res = await fetch(`${base}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    }),
  });
  const data = await res.json();
  if (data.token) return data.token;
  throw new Error(data.message || 'Pesapal auth failed');
}

async function getToken() {
  return getTokenForBase(getBaseUrl());
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
  return res.json();
}

async function registerIPN(token, ipnUrl) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/URLRegister/RegisterIPN`, {
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
  return res.json();
}

module.exports = { getBaseUrl, getToken, getTokenForBase, getTransactionStatus, registerIPN, SANDBOX_BASE, PROD_BASE };
