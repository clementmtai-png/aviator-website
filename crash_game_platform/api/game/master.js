/**
 * POST /api/game/master
 * Game master endpoint - starts rounds and controls the game loop
 * This can be called by a cron job or admin to run the game
 */

const { kv } = require('@vercel/kv');
const { broadcast } = require('./pusher');

function allowCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Generate crash point with house edge
function generateCrashPoint() {
    const houseEdge = 0.05;
    const random = Math.random();
    if (random < houseEdge) return 1.00;
    const crashPoint = 1 / (1 - random * (1 - houseEdge));
    return Math.min(Math.floor(crashPoint * 100) / 100, 1000);
}

// Calculate multiplier based on elapsed time
function calculateMultiplier(elapsedMs) {
    const growthRate = 0.00006;
    return Math.floor((Math.exp(growthRate * elapsedMs)) * 100) / 100;
}

module.exports = async function handler(req, res) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();

    try {
        let gameState = await kv.get('game:state');

        // No game or game is crashed/waiting - start new round
        if (!gameState || gameState.phase === 'crashed' || gameState.phase === 'waiting') {
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
                action: 'started',
                roundId,
                phase: 'running'
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

                // Keep only last 100 rounds
                if (history.length > 100) {
                    history.splice(100);
                }

                await kv.set('game:history', history);

                await broadcast('game:crash', {
                    roundId: gameState.roundId,
                    crashPoint: gameState.crashPoint,
                    multiplier: gameState.crashPoint
                });

                // Schedule automatic restart after 5 seconds
                // Note: In serverless, we rely on the cron to call us again
                // which will trigger the new round start logic at the top

                return res.status(200).json({
                    action: 'crashed',
                    crashPoint: gameState.crashPoint,
                    phase: 'crashed'
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
                action: 'tick',
                multiplier: currentMultiplier,
                phase: 'running'
            });
        }

        return res.status(200).json({ phase: gameState.phase });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
