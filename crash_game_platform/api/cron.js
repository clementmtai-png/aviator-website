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

    try {
        // Import the game master logic
        const { kv } = require('@vercel/kv');
        const { broadcast } = require('./game/pusher');

        let gameState = await kv.get('game:state');

        // Check if we need to start a new round (crashed or waiting)
        if (!gameState || gameState.phase === 'crashed' || gameState.phase === 'waiting') {
            // Check if enough time has passed since last crash (5 second cooldown)
            if (gameState?.crashedAt && (Date.now() - gameState.crashedAt) < 5000) {
                return res.status(200).json({
                    status: 'waiting',
                    message: 'Cooldown period',
                    remainingMs: 5000 - (Date.now() - gameState.crashedAt)
                });
            }

            // Start new round
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

            return res.status(200).json({
                status: 'started',
                roundId,
                crashPoint: '[HIDDEN]',
                action: 'new_round'
            });
        }

        // Game is running - update tick
        if (gameState.phase === 'running') {
            const elapsed = Date.now() - gameState.startTime;
            const currentMultiplier = calculateMultiplier(elapsed);

            // Check if crashed
            if (currentMultiplier >= gameState.crashPoint) {
                gameState.phase = 'crashed';
                gameState.multiplier = gameState.crashPoint;
                gameState.crashedAt = Date.now();
                await kv.set('game:state', gameState);

                // Store round in history
                const history = await kv.get('game:history') || [];
                history.unshift({
                    roundId: gameState.roundId,
                    crashPoint: gameState.crashPoint,
                    timestamp: gameState.crashedAt
                });

                if (history.length > 100) {
                    history.splice(100);
                }

                await kv.set('game:history', history);

                await broadcast('game:crash', {
                    roundId: gameState.roundId,
                    crashPoint: gameState.crashPoint,
                    multiplier: gameState.crashPoint
                });

                return res.status(200).json({
                    status: 'crashed',
                    crashPoint: gameState.crashPoint,
                    action: 'round_ended'
                });
            }

            // Send tick
            gameState.multiplier = currentMultiplier;
            await kv.set('game:state', gameState);

            await broadcast('game:tick', {
                roundId: gameState.roundId,
                multiplier: currentMultiplier
            });

            return res.status(200).json({
                status: 'tick',
                multiplier: currentMultiplier,
                roundId: gameState.roundId
            });
        }

        return res.status(200).json({ status: gameState.phase });
    } catch (e) {
        console.error('Cron error:', e);
        return res.status(500).json({ error: e.message });
    }
};
