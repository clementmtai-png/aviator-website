# Complete Step-by-Step: Pesapal STK Push (M-PESA) Deposit Integration

This guide walks you through integrating **Pesapal** so users can deposit via **M-PESA** (including STK-style flow) on your crash game platform. The app uses **Pesapal API 3.0**: you create an order, redirect the user to Pesapal, they choose **M-PESA** (or card), pay, and Pesapal notifies your server via **IPN** so you can credit the user’s balance.

---

## Overview

| Step | What you do |
|------|------------------|
| 1 | Get Pesapal credentials (sandbox then live) |
| 2 | Deploy the app to Vercel and add env vars |
| 3 | Create Vercel KV and attach it to the project |
| 4 | Register your IPN URL with Pesapal and set `PESAPAL_IPN_ID` |
| 5 | (Optional) Set callback base URL for production |
| 6 | Test deposit flow (M-PESA on Pesapal page) |
| 7 | Go live with production credentials |

---

## Step 1 — Get Pesapal API Credentials

### 1.1 Create a Pesapal account

- Go to [Pesapal](https://www.pesapal.com/) and sign up as a merchant (or use existing account).
- For development, use the **sandbox**; for real money, complete **go-live** with Pesapal.

### 1.2 Get API keys

- Open [Pesapal Developer Community](https://developer.pesapal.com/).
- Sign in and go to **API 3.0** documentation.
- Use **sandbox/demo keys** for testing:  
  [Pesapal API 3 demo keys](https://developer.pesapal.com/api3-demo-keys.txt)  
  You will get:
  - **Consumer Key** → use as `PESAPAL_CONSUMER_KEY`
  - **Consumer Secret** → use as `PESAPAL_CONSUMER_SECRET`
- For **production**, get live credentials from your Pesapal merchant dashboard / support.

### 1.3 Note on “STK Push”

- Pesapal API 3.0 uses **SubmitOrderRequest**: you get a **redirect URL**; the user pays on Pesapal’s page.
- On that page, the user can select **M-PESA** (and may receive an M-PESA prompt on their phone — the “STK” experience).
- Your app does **not** call a separate STK API; it sends **amount**, **phone**, and **email** in the order; Pesapal handles M-PESA/STK on their side.

---

## Step 2 — Deploy to Vercel and Set Environment Variables

### 2.1 Deploy the project

- Push the repo to **GitHub** (or use **Vercel CLI** / **upload**).
- In [Vercel](https://vercel.com): **Add New Project** → import the repo.
- Deploy with **no custom build command** (static site + serverless API).

### 2.2 Add Pesapal env vars

In **Vercel** → your project → **Settings** → **Environment Variables**, add:

| Name | Value | Notes |
|------|--------|--------|
| `PESAPAL_CONSUMER_KEY` | Your consumer key | From Step 1 |
| `PESAPAL_CONSUMER_SECRET` | Your consumer secret | From Step 1 |
| `PESAPAL_SANDBOX` | `true` | Use `true` for sandbox; remove or `false` for live |
| `PESAPAL_IPN_ID` | *(leave empty for now)* | You will set this after Step 4 |

Optional:

| Name | Value |
|------|--------|
| `APP_URL` | Your production URL, e.g. `https://your-domain.com` |

Redeploy after changing env vars.

---

## Step 3 — Create Vercel KV (User Balances)

Balances are stored in **Vercel KV** so they persist and stay in sync with Pesapal IPN.

1. In Vercel: **Storage** → **Create Database** → **KV**.
2. Create a new KV database and **attach it to this project**.
3. Vercel will inject:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - (and optionally read-only token)
4. **Redeploy** so the API routes can read/write balance (e.g. `balance:username`).

Without KV, `/api/user/balance`, `/api/user/credit`, and `/api/user/debit` will fail; the app can still load but balance will not persist.

---

## Step 4 — Register IPN URL and Set PESAPAL_IPN_ID

Pesapal must know where to send payment notifications (IPN). Your app exposes a **one-time** registration endpoint.

### 4.1 Ensure deployment is live

Your project must be deployed so that:

`https://<your-vercel-url>/api/pesapal/ipn`

is publicly reachable (e.g. `https://your-project.vercel.app/api/pesapal/ipn`).

### 4.2 Call the register-IPN API once

From your machine (or Postman):

```bash
curl -X POST https://YOUR_VERCEL_URL/api/pesapal/register-ipn
```

Use your **actual** Vercel URL (e.g. `https://crash-game-xyz.vercel.app`).

### 4.3 Read the response

Example:

```json
{
  "ipn_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "https://your-project.vercel.app/api/pesapal/ipn",
  "message": "Set PESAPAL_IPN_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890 in Vercel env and redeploy."
}
```

### 4.4 Set env and redeploy

1. In Vercel → **Settings** → **Environment Variables**, add:
   - **Name:** `PESAPAL_IPN_ID`
   - **Value:** the `ipn_id` from the response (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).
2. **Redeploy** the project.

You only need to register the IPN **once** per environment (sandbox vs production may use different IPN URLs/IDs if you use different domains).

---

## Step 5 — (Optional) Set Production Callback Base URL

- The app builds **callback** and **cancellation** URLs as:  
  `{baseUrl}/?pesapal=callback` and `{baseUrl}/?pesapal=cancel`.
- `baseUrl` is taken from `VERCEL_URL` (e.g. `https://your-project.vercel.app`) or from **APP_URL** if set.
- For a **custom domain**, set:
  - **APP_URL** = `https://your-domain.com`
- Redeploy so initiate uses the correct callback/cancel URLs.

---

## Step 6 — Test the Deposit Flow (M-PESA / STK)

### 6.1 User flow in the app

1. **Login** (or register) so the app has a username.
2. Click **Deposit** (wallet icon or nav).
3. Select **M-PESA** (or **Pesapal**).
4. Enter:
   - **Amount** (e.g. 500 KES; respect `MIN_DEPOSIT` in `config.js`).
   - **M-PESA phone** (e.g. 254712345678) — optional but recommended for M-PESA.
   - **Email** (for receipt).
5. Click **Pay with Pesapal** (not “Pay via STK link” unless you use an external STK link).

### 6.2 What happens in the backend

1. Frontend calls **POST** `/api/pesapal/initiate` with:
   - `amount`, `currency` (KES), `email`, `phone`, `merchant_reference` (e.g. `dep-<timestamp>-<username>`).
2. **initiate** uses Pesapal API 3.0:
   - Authenticates (RequestToken).
   - Calls **SubmitOrderRequest** with billing_address (email + phone).
   - Returns **redirect_url** to the frontend.
3. Frontend redirects the user to **redirect_url** (Pesapal payment page).
4. User selects **M-PESA** (or card) and completes payment (may get M-PESA prompt on phone).
5. Pesapal redirects user back to your **callback_url** and sends an **IPN** request to **GET/POST** `/api/pesapal/ipn`.
6. **IPN handler**:
   - Calls Pesapal **GetTransactionStatus**.
   - If status is **COMPLETED**, parses `merchant_reference` to get username and amount, then **credits** `balance:username` in KV.
7. User can **refresh** or return to the app; **GET** `/api/user/balance?username=...` will show the updated balance (auth.js fetches balance on load/after login).

### 6.3 Sandbox testing

- Use Pesapal **sandbox** credentials and `PESAPAL_SANDBOX=true`.
- Use test phone numbers / cards as per [Pesapal sandbox documentation](https://developer.pesapal.com/).
- Confirm in Vercel logs that:
  - `/api/pesapal/initiate` returns 200 and a `redirect_url`.
  - `/api/pesapal/ipn` is called and returns 200; check that balance in KV increases after a successful payment.

### 6.4 Merchant reference format

- The app uses: `dep-<timestamp>-<username>`.
- IPN parses the **last segment** as username to credit the correct user. Keep this format if you change the reference.

---

## Step 7 — Go Live (Production)

1. **Pesapal go-live**
   - Complete Pesapal’s process for live M-PESA (and card if needed).
   - Get **live** Consumer Key and Consumer Secret.

2. **Update env on Vercel**
   - Set `PESAPAL_CONSUMER_KEY` and `PESAPAL_CONSUMER_SECRET` to **live** values.
   - Set `PESAPAL_SANDBOX` to `false` or remove it.
   - Keep `PESAPAL_IPN_ID` as is (or register a new IPN for production domain and set the new `ipn_id`).
   - Set `APP_URL` to your live domain if needed.

3. **Redeploy** and run a small real-money test deposit.

4. **Security**
   - Do not expose Consumer Secret or KV tokens in the frontend; only `/api/*` routes use them.
   - Keep env vars only in Vercel (or your server env), not in repo or client.

---

## Quick Reference

| Item | Value |
|------|--------|
| Initiate payment | **POST** `/api/pesapal/initiate` with `amount`, `currency`, `email`, `phone?`, `merchant_reference?` |
| Pesapal docs | [API 3.0 – SubmitOrderRequest](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest) |
| IPN (credits balance) | **GET/POST** `/api/pesapal/ipn` (Pesapal calls this; you only register it in Step 4) |
| User balance | **GET** `/api/user/balance?username=...` |
| Env vars | `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_IPN_ID`, `PESAPAL_SANDBOX`, KV_* |

---

## Troubleshooting

| Issue | What to check |
|-------|-------------------|
| "Pesapal not configured" | All of `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_IPN_ID` set in Vercel and redeployed. |
| "Invalid amount" | Send a positive number for `amount`; frontend validates against `MIN_DEPOSIT`. |
| "Either email or phone is required" | Send at least one of `email` or `phone` in the initiate request body. |
| No redirect_url | Check Pesapal response in server logs; ensure sandbox/live base URL and credentials match. |
| Balance not updating after pay | IPN must be registered and `PESAPAL_IPN_ID` set; KV must be attached; check IPN handler logs and GetTransactionStatus response (status_code 1 = COMPLETED). |
| Callback goes to wrong URL | Set `APP_URL` to your production domain and redeploy. |

---

You now have a complete path: **Pesapal credentials → Vercel + KV → IPN registration → user deposits via M-PESA (STK) on Pesapal → balance credited in your app.**
