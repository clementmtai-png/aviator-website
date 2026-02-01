# StakeBets | Premium Crash Platform

A modern, high-performance web-based Crash gambling game built with Vanilla JavaScript, HTML5 Canvas, and CSS3.

## 🚀 Overview
StakeBets is a real-time crash game featuring:
- **Real-time Canvas Animation**: High-performance flight path simulation at 60FPS.
- **Organic Simulation**: Simulated live chat and betting list to create a vibrant environment.
- **Advanced Admin Controls**: Hidden system control panel to manage next-round multipliers.
- **Wallet System**: Simulated deposit and withdrawal logic.
- **Responsive Design**: Fully responsive layout for Desktop and Mobile.

---

## 📁 File Structure & Architecture

### Core Files
- `index.html`: Main entry point containing the UI structure and all modals (Login, Register, Wallet, Admin).
- `styles.css`: Central stylesheet using modern CSS variables, glassmorphism, and animations.

### JavaScript Layer (`/js`)
- `app.js`: UI Controller. Handles global event listeners, modal transitions, and toast notifications.
- `engine.js`: The "Brain". Manages the game loop, canvas rendering, multiplier calculation, and crash logic.
- `auth.js`: User authentication and state management. Handles local persistence and admin privilege checks.
- `admin.js`: System Control Panel logic. Handles user monitoring and forced crash mechanics.
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
- **Direct Input**: Enter a multiplier in the input box and click **FORCE**.
- **Popup Interface**: Click **FORCE RUN POPUP** to trigger a browser prompt for the next multiplier.
- Setting a forced value ensures the *very next* round crashes at exactly that multiplier.

---

## 💻 Developer Notes for AI Agents
- **Scaling**: Multiplier calculation follows an exponential curve: `Math.pow(Math.E, 0.06 * elapsed)`.
- **Throttling**: Game engine runs at 60FPS, but UI events (`game-tick`) are throttled to 10Hz to preserve main-thread performance.
- **Communication**: Inter-module communication is handled via global objects (`Engine`, `UI`, `Auth`) and custom browser events (`game-tick`, `round-start`).
- **Persistence**: User state is maintained in `localStorage` under the key `aviator_user`.

---

## 🔧 Installation & Running

### Local
1. Clone the repository or copy the directory.
2. Open `index.html` in any modern web browser, or run `npm run dev` and visit http://localhost:3000.
3. No build step or backend required (pure frontend simulation).

### Deploy to Vercel (live website)

The project is laid out so Vercel can run it with **no build step** and no root-directory config:

- **Root** has `index.html`, `styles.css`, and `js/` → served as the static site.
- **`/api/pesapal/`** → Vercel serverless functions (payments).

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

### API routes

| Route | Method | Purpose |
|-------|--------|--------|
| `/api/pesapal/initiate` | POST | Start a payment; returns `redirect_url` to send the user to Pesapal. |
| `/api/pesapal/ipn` | GET / POST | Pesapal IPN webhook; respond with status and optionally credit the user. |
| `/api/pesapal/register-ipn` | POST | One-time setup: register your IPN URL and get `ipn_id` for env. |

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

### Frontend flow

1. User opens **Deposit** → selects **M-PESA**.
2. Enters amount and (optionally) email, then clicks **Pay with Pesapal**.
3. Frontend calls **POST /api/pesapal/initiate** with `amount`, `currency`, `email`, `merchant_reference`.
4. Backend returns `redirect_url`; user is redirected to Pesapal to complete payment.
5. After payment, Pesapal redirects to your site (`?pesapal=callback`) and sends an IPN to `/api/pesapal/ipn`. The IPN handler should credit the user (e.g. by `merchant_reference`); this app has no DB, so add your own persistence if needed.

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

### 5. (Optional) Direct STK / payment link

- If you use a separate payment page (e.g. Paybill, Till, or another gateway), set `STK_PAYMENT_LINK` in `js/config.js` to that URL. The “Pay via STK link” button in the wallet will open it and append `?amount=XXX`.

### 6. Receiving the money

- **Pesapal:** Money goes to the bank/M-PESA account linked to your Pesapal merchant account. Check your Pesapal dashboard for payouts.
- **Crediting users:** The app has no database. To credit in-game balance when a payment completes, you’d extend `/api/pesapal/ipn` to look up the user by `merchant_reference` and update a database, or call your own backend that does that.
