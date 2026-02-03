# StakeBets | Premium Crash Platform

A modern, high-performance web-based Crash gambling game built with Vanilla JavaScript, HTML5 Canvas, and CSS3.

## 🚀 Overview
StakeBets is a real-time crash game featuring:
- **Real-time Canvas Animation**: High-performance flight path simulation at 60FPS.
- **Organic Simulation**: Simulated live chat and betting list to create a vibrant environment.
- **Advanced Admin Controls**: Hidden system control panel to manage next-round multipliers and pre-set future crash sequences.
- **Persistent Authentication**: Server-side user accounts and balance management via Vercel KV.
- **Real-Time Multiplayer Sync**: Global game state synchronized across all clients using Pusher.
- **Wallet System**: Integrated deposit and withdrawal logic with Pesapal 3.0.
- **Responsive Design**: Fully responsive layout for Desktop and Mobile.

---

## 📁 File Structure & Architecture

### Core Files
- `index.html`: Main entry point containing the UI structure and all modals (Login, Register, Wallet, Admin).
- `styles.css`: Central stylesheet using modern CSS variables, glassmorphism, and animations.

### JavaScript Layer (`/js`)
- `app.js`: UI Controller. Handles global event listeners, modal transitions, and toast notifications.
- `engine.js`: The "Brain". Manages the game loop, canvas rendering, multiplier calculation, and crash logic.
- `auth.js`: User authentication and state management. Handles backend verification and balance persistence.
- `admin.js`: System Control Panel logic. Handles user monitoring and planned crash sequences.
- `bets.js`: Simulated live bets list with real-time updates based on game ticks.
- `chat.js`: Simulated organic chat messaging system.
- `wallet.js`: Transaction logic for simulated deposits and withdrawals.
- `config.js`: Centralized constants, default values, and simulated user data.
- `utils.js`: Shared utility functions (DOM access, formatting, storage).

---

## 🛠 Admin Features

### Accessing the Control Panel
An **Admin** user can access the **SYSTEM CONTROL PANEL** by:
1. Logging in with credentials:
   - **Username**: `admin`
   - **Password**: `root`
2. Clicking the **[Admin]** button that appears in the top-right navigation bar.

### "Force Run" Mechanics
- **Direct Input**: Enter a multiplier in the input box and click **FORCE** to set the *very next* round.
- **Planned Sequences**: In the "Future Multipliers" section, enter at least 5 multipliers separated by commas to control multiple upcoming rounds.
- **Real-Time Status**: Dashboard shows live stats of the active round and current user balances.

---

## 💻 Developer Notes for AI Agents
- **Scaling**: Multiplier calculation follows an exponential curve: `Math.pow(Math.E, 0.06 * elapsed)`.
- **Throttling**: Game engine runs at 60FPS, but UI events (`game-tick`) are throttled to 10Hz to preserve main-thread performance.
- **Communication**: Inter-module communication is handled via global objects (`Engine`, `UI`, `Auth`) and custom browser events (`game-tick`, `round-start`).
- **Persistence**: User state is maintained in `Vercel KV` and verified via `/api/auth`.
- **Game Engine**: Crash points are generated server-side in `/api/cron.js` or consumed from a planned queue.

---

### Local
1. Clone the repository or copy the directory.
2. Run `npm run dev` to start the local Vercel development server with backend support. Visit `http://localhost:3000`.
3. The project now uses Vercel serverless functions and KV storage for persistent authentication.

### Deploy to Vercel (live website)

The project is laid out so Vercel can run it with **no build step** and no root-directory config:

- **Root** has `index.html`, `styles.css`, and `js/` → served as the static site.
- **`/api/pesapal/`** → Vercel serverless functions (payments).
- **`/api/user/`** → Balance, debit, credit (real money stored in Vercel KV).

**Ways to deploy:**

1. **Direct upload**  
   Zip the project (include `index.html`, `styles.css`, `js/`, `api/`, `vercel.json`, `package.json` at the **root** of the zip). In [Vercel](https://vercel.com) → **Add New Project** → **Upload** and select the zip. Do **not** set a root directory; leave build settings empty.

2. **Git**  
   Push to GitHub/GitLab, then [vercel.com](https://vercel.com) → **Add New Project** → import the repo. Vercel will detect the structure and deploy.

3. **CLI**  
   From the project root: `npx vercel` (first time), then `npm run deploy` or `vercel --prod` for production.

---

## Pesapal (M-PESA / card) backend

The app includes **Pesapal API 3.0** routes so users can pay via M-PESA or card. Backend lives under `/api/pesapal/` as Vercel serverless functions.

### Pesapal API reference (no setup required)

- **Postman collection:** [https://documenter.getpostman.com/view/6715320/UyxepTv1](https://documenter.getpostman.com/view/6715320/UyxepTv1)
- **Base URLs:**  
  - Sandbox: `https://cybqa.pesapal.com/pesapalv3`  
  - Live: `https://pay.pesapal.com/v3`  

See also **[docs/PESAPAL_REFERENCE.md](docs/PESAPAL_REFERENCE.md)**.

### API routes

| Route | Method | Purpose |
|-------|--------|--------|
| `/api/pesapal/initiate` | POST | Start a payment; returns `redirect_url` to send the user to Pesapal. |
| `/api/pesapal/ipn` | GET / POST | Pesapal IPN webhook; respond with status and optionally credit the user. |
| `/api/pesapal/register-ipn` | POST | One-time setup: register your IPN URL and get `ipn_id` for env. |

---

## Real money (balance in Vercel KV)

Balance is stored server-side so it stays in sync with real payments and bets.

- **Deposits:** When a user pays via Pesapal, the IPN webhook can credit their balance in KV — or you can **add balances manually** (see below).
- **Bets:** Placing a bet calls `POST /api/user/debit`; cashing out calls `POST /api/user/credit`.
- **Withdrawals:** Withdraw requests call `POST /api/user/debit` and update balance.

### Adding balances manually (no IPN required)

If you prefer not to use the IPN webhook, you can credit users yourself after verifying payment (e.g. from Pesapal dashboard or GetTransactionStatus):

- **POST** `/api/user/credit` with body `{ "username": "<username>", "amount": <number> }`  
  This adds the given amount to the user’s balance in KV. You can call it from your backend, a small admin script, or Postman. No IPN setup needed.

### Setup

1. In Vercel: **Storage** → **Create Database** → **KV** (or connect an existing KV store).
2. Attach the KV store to your project. The env vars (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.) are injected automatically.
3. Redeploy. Balance will then be read/written from KV.

### API routes (user balance)

| Route | Method | Purpose |
|-------|--------|--------|
| `/api/user/balance?username=` | GET | Return user balance. |
| `/api/user/debit` | POST | Body `{ username, amount }`. Deduct amount (bet or withdrawal). |
| `/api/user/credit` | POST | Body `{ username, amount }`. Add amount (IPN deposit or game cashout). |

Without a KV store, these routes return 500; the app still runs but balance will not persist across refreshes or devices.

---

### Environment variables (Vercel)

In the Vercel project → **Settings → Environment Variables**, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `PESAPAL_CONSUMER_KEY` | Yes | Pesapal API consumer key (from [Pesapal](https://developer.pesapal.com)). |
| `PESAPAL_CONSUMER_SECRET` | Yes | Pesapal API consumer secret. |
| `PESAPAL_IPN_ID` | Yes | IPN ID (GUID) from registering your IPN URL (see below). |
| `PESAPAL_SANDBOX` | No | Set to `true` to use Pesapal sandbox. |
| `APP_URL` | No | Override callback base URL (default: `https://<VERCEL_URL>`). |

### One-time: register IPN URL

1. Deploy the project so `https://your-app.vercel.app/api/pesapal/ipn` is live.
2. Call **POST** `https://your-app.vercel.app/api/pesapal/register-ipn` (with env vars set).  
   Or register manually: [Sandbox IPN form](https://cybqa.pesapal.com/PesapalIframe/PesapalIframe3/IpnRegistration) / [Live IPN form](https://pay.pesapal.com/iframe/PesapalIframe3/IpnRegistration).  
   Use URL: `https://your-app.vercel.app/api/pesapal/ipn` and type **POST**.
3. Copy the returned **ipn_id** (GUID) and set it as `PESAPAL_IPN_ID` in Vercel env, then redeploy.

### Frontend Flow

1. **Deposit**:
   - The **Deposit** button in the navbar/modal redirects to your PesaPal merchant link (Static) or initiates an API payment (Automated).
   - If `CONFIG.PESAPAL_PAYMENT_LINK` is set in `js/config.js`, the app uses it directly.
2. **Authenticated Access**:
   - **Deposit** and **Withdraw** buttons are hidden for guests.
   - They appear automatically next to the balance display area only after a user logs in.
3. **Automated Balance (Prod)**:
   - After payment, Pesapal sends an IPN to `/api/pesapal/ipn`.
   - The IPN handler credits the user's balance in **Vercel KV**.

---

## Quick setup: upload repo and get payments

**Yes.** Once you have your Pesapal details, you only need to upload this repo and add your credentials. No code changes required.

1. **Get Pesapal details** (see below): consumer key, consumer secret; optionally sandbox keys for testing.
2. **Upload the repo**: Push to GitHub/GitLab, then in [Vercel](https://vercel.com) → **Add New Project** → import this repo.
3. **Add env vars**: In the Vercel project → **Settings** → **Environment Variables**, add the variables from `.env.example` (paste your key/secret; leave `PESAPAL_IPN_ID` empty for now).
4. **Deploy**: Trigger a deploy (or push a commit). Your site will be live at `https://your-app.vercel.app`.
5. **Register IPN (one-time):**  
   - Send **POST** to `https://your-app.vercel.app/api/pesapal/register-ipn`  
   - Or use [Sandbox IPN form](https://cybqa.pesapal.com/PesapalIframe/PesapalIframe3/IpnRegistration) / [Live IPN form](https://pay.pesapal.com/iframe/PesapalIframe3/IpnRegistration) with URL `https://your-app.vercel.app/api/pesapal/ipn` and type **POST**.  
   - Copy the returned **ipn_id** (GUID).
6. **Add IPN ID**: In Vercel → **Environment Variables**, set `PESAPAL_IPN_ID` to that GUID, then **Redeploy**.
7. **Done.** Users can click **Deposit** → **M-PESA** → **Pay with Pesapal** and complete payment. Money goes to your Pesapal-linked account.

---

## What you need to get payments from the website

### 1. Pesapal merchant account

- Sign up at [Pesapal](https://www.pesapal.com) (or [developer portal](https://developer.pesapal.com)) and open a **business/merchant** account.
- Get your **consumer key** and **consumer secret** (sandbox keys for testing: [demo keys](https://developer.pesapal.com/api3-demo-keys.txt)).

### 2. Deploy the site to Vercel

- Push the repo to GitHub/GitLab and connect it in [Vercel](https://vercel.com) → **Add New Project**, or run `vercel` from the project folder.
- After deploy you’ll have a URL like `https://your-app.vercel.app`.

### 3. Set environment variables on Vercel

In the Vercel project → **Settings** → **Environment Variables**, add:

| Variable | Value |
|----------|--------|
| `PESAPAL_CONSUMER_KEY` | Your Pesapal consumer key |
| `PESAPAL_CONSUMER_SECRET` | Your Pesapal consumer secret |
| `PESAPAL_SANDBOX` | `true` for testing, remove or `false` for live |
| `PESAPAL_IPN_ID` | (You get this in step 4) |

Redeploy after adding or changing env vars.

### 4. Register your IPN URL (one-time)

- Your IPN URL must be: `https://your-app.vercel.app/api/pesapal/ipn`
- **Option A:** After deploy, send **POST** to `https://your-app.vercel.app/api/pesapal/register-ipn` (with the env vars above set). The response will include `ipn_id`.
- **Option B:** Register manually: [Sandbox](https://cybqa.pesapal.com/PesapalIframe/PesapalIframe3/IpnRegistration) or [Live](https://pay.pesapal.com/iframe/PesapalIframe3/IpnRegistration). Use the IPN URL above and choose **POST**.
- Copy the **ipn_id** (GUID) and add it in Vercel as `PESAPAL_IPN_ID`, then redeploy.

### 5. Static PesaPal Link

- If you prefer a simple static link, set `PESAPAL_PAYMENT_LINK` and `DEPOSIT_LINK` in `js/config.js` to your PesaPal Store URL (e.g., `https://store.pesapal.com/yoursite`).

### 6. Receiving the money

- **Pesapal:** Money goes to the bank/M-PESA account linked to your Pesapal merchant account. Check your Pesapal dashboard for payouts.
- **Crediting users:** The app has no database. To credit in-game balance when a payment completes, you’d extend `/api/pesapal/ipn` to look up the user by `merchant_reference` and update a database, or call your own backend that does that.
