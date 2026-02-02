/**
 * Vercel Cron Job Endpoint
 * Called every second to keep the game running autonomously
 * GET /api/cron (triggered by Vercel Cron)
 */

const { kv } = require('@vercel/kv');

// Calculate multiplier based on elapsed time
function calculateMultiplier(elapsedMs) {
    const growthRate = 0.00006;
    return Math.floor((Math.exp(growthRate * elapsedMs)) * 100) / 100;
}

// Generate crash point with house edge
function generateCrashPoint() {
    const houseEdge = 0.05;
    const random = Math.random();
    if (random < houseEdge) return 1.00;
    const crashPoint = 1 / (1 - random * (1 - houseEdge));
    return Math.min(Math.floor(crashPoint * 100) / 100, 1000);
}

module.exports = async function handler(req, res) {
    // Verify this is a cron request (Vercel sets this header)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // For local testing, allow requests without auth
        if (process.env.NODE_ENV === 'production' && !req.headers['user-agent']?.includes('vercel-cron')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    // Run for ~55 seconds to cover the minute until next cron
    const endTime = Date.now() + 55000;

    // Import dependencies once
    const { kv } = require('@vercel/kv');
    const { broadcast } = require('./game/pusher');

    try {
        while (Date.now() < endTime) {
            let gameState = await kv.get('game:state');

            // --- GAME LOOP LOGIC ---

            // 1. START NEW ROUND if waiting/crashed
            if (!gameState || gameState.phase === 'crashed' || gameState.phase === 'waiting') {
                // Check cooldown (5 seconds)
                if (gameState?.crashedAt && (Date.now() - gameState.crashedAt) < 5000) {
                    // Wait 1s and retry
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                const roundId = `round-${Date.now()}`;
                const crashPoint = generateCrashPoint();
                const startTime = Date.now();

                gameState = {
                    phase: 'running',
                    multiplier: 1.00,
                    crashPoint: crashPoint,
                    roundId: roundId,
                    startTime: startTime,
                    bets: []
                };

                await kv.set('game:state', gameState);
                await broadcast('game:start', { roundId, startTime });
                console.log(`Round ${roundId} started. Crash at ${crashPoint}`);
            }

            // 2. RUNNING STATE
            if (gameState.phase === 'running') {
                const elapsed = Date.now() - gameState.startTime;
                const currentMultiplier = calculateMultiplier(elapsed);

                // CRASH CHECK
                if (currentMultiplier >= gameState.crashPoint) {
                    gameState.phase = 'crashed';
                    gameState.multiplier = gameState.crashPoint;
                    gameState.crashedAt = Date.now();
                    await kv.set('game:state', gameState);

                    // History
                    const history = await kv.get('game:history') || [];
                    history.unshift({
                        roundId: gameState.roundId,
                        crashPoint: gameState.crashPoint,
                        timestamp: gameState.crashedAt
                    });
                    if (history.length > 100) history.splice(100);
                    await kv.set('game:history', history);

                    await broadcast('game:crash', {
                        roundId: gameState.roundId,
                        crashPoint: gameState.crashPoint,
                        multiplier: gameState.crashPoint
                    });
                    console.log(`Crashed at ${gameState.crashPoint}`);
                } else {
                    // TICK
                    // Only broadcast tick every 1000ms to save quota/bandwidth, client interpolates
                    // BUT for server-state accuracy we update KV
                    gameState.multiplier = currentMultiplier;
                    // Optimization: Only write to KV if significant change or every few ticks? 
                    // accurate KV is needed for late-joiners.
                    await kv.set('game:state', gameState);

                    // Broadcast tick
                    await broadcast('game:tick', {
                        roundId: gameState.roundId,
                        multiplier: currentMultiplier
                    });
                }
            }

            // Sleep 1 second before next tick
            await new Promise(r => setTimeout(r, 1000));
        }

        return res.status(200).json({ status: 'ok', message: 'Cron loop finished' });

    } catch (e) {
        console.error('Cron error:', e);
        return res.status(500).json({ error: e.message });
    }
};
