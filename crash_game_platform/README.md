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
1. Install the [Vercel CLI](https://vercel.com/cli): `npm i -g vercel`
2. From the project root, run:
   - **First time**: `vercel` (log in if prompted, then deploy)
   - **Production**: `npm run deploy` or `vercel --prod`
3. Or connect the repo at [vercel.com](https://vercel.com) → **Add New Project** → import this repo; Vercel will use `vercel.json` and deploy automatically on push.
