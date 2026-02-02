/**
 * Autonomous Game Loop
 * Runs via Cron to keep the game flying.
 */

const { kv } = require('@vercel/kv');
const { broadcast } = require('../lib/pusher');
const { generateCrashPoint, calculateMultiplier } = require('../lib/game');

module.exports = async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.NODE_ENV === 'production') return res.status(401).end();
    }

    const endTime = Date.now() + 55000; // Run for 55s

    try {
        while (Date.now() < endTime) {
            let gameState = await kv.get('game:state');

            // 1. NEW ROUND INITIALIZATION (into Waiting Phase)
            if (!gameState || gameState.phase === 'crashed') {
                if (gameState?.crashedAt && (Date.now() - gameState.crashedAt) < 5000) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                gameState = {
                    phase: 'waiting',
                    startTime: Date.now() + 5000, // 5s betting time
                    bets: []
                };
                await kv.set('game:state', gameState);
                await broadcast('game:waiting', { timeLeft: 5000 });
            }

            // 2. WAITING PHASE (Waiting for betting to end)
            if (gameState.phase === 'waiting') {
                if (Date.now() >= gameState.startTime) {
                    gameState.phase = 'running';
                    gameState.startTime = Date.now();
                    gameState.crashPoint = generateCrashPoint();
                    gameState.roundId = `round-${Date.now()}`;
                    await kv.set('game:state', gameState);
                    await broadcast('game:start', { roundId: gameState.roundId, startTime: gameState.startTime });
                } else {
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }
            }

            // 3. RUNNING PHASE
            if (gameState.phase === 'running') {
                const elapsed = Date.now() - gameState.startTime;
                const currentMultiplier = calculateMultiplier(elapsed);

                if (currentMultiplier >= gameState.crashPoint) {
                    gameState.phase = 'crashed';
                    gameState.multiplier = gameState.crashPoint;
                    gameState.crashedAt = Date.now();
                    await kv.set('game:state', gameState);

                    const history = await kv.get('game:history') || [];
                    history.unshift({ roundId: gameState.roundId, crashPoint: gameState.crashPoint, timestamp: Date.now() });
                    if (history.length > 50) history.splice(50);
                    await kv.set('game:history', history);

                    await broadcast('game:crash', { crashPoint: gameState.crashPoint });
                } else {
                    gameState.multiplier = currentMultiplier;
                    await kv.set('game:state', gameState);
                    await broadcast('game:tick', { multiplier: currentMultiplier });
                }
            }

            await new Promise(r => setTimeout(r, 1000));
        }
        return res.status(200).json({ status: 'done' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
