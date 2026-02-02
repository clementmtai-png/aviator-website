/**
 * POST /api/game/tick
 * Called periodically to update multiplier and check for crash
 * This should be called by a cron job or the frontend game master
 */

const { kv } = require('@vercel/kv');
const { broadcast } = require('./pusher');

function allowCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Calculate multiplier based on elapsed time
function calculateMultiplier(elapsedMs) {
    // Multiplier grows exponentially: starts at 1.00, grows ~6% per second
    const growthRate = 0.00006; // Per millisecond
    return Math.floor((Math.exp(growthRate * elapsedMs)) * 100) / 100;
}

module.exports = async function handler(req, res) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const gameState = await kv.get('game:state');

        if (!gameState || gameState.phase !== 'running') {
            return res.status(200).json({ phase: 'waiting', message: 'No active round' });
        }

        const elapsed = Date.now() - gameState.startTime;
        const currentMultiplier = calculateMultiplier(elapsed);

        // Check if crashed
        if (currentMultiplier >= gameState.crashPoint) {
            // CRASH!
            gameState.phase = 'crashed';
            gameState.multiplier = gameState.crashPoint;
            await kv.set('game:state', gameState);

            // Store round in history
            const history = await kv.get('game:history') || [];
            history.unshift({
                roundId: gameState.roundId,
                crashPoint: gameState.crashPoint,
                timestamp: Date.now()
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

            return res.status(200).json({
                phase: 'crashed',
                multiplier: gameState.crashPoint
            });
        }

        // Update multiplier
        gameState.multiplier = currentMultiplier;
        await kv.set('game:state', gameState);

        await broadcast('game:tick', {
            roundId: gameState.roundId,
            multiplier: currentMultiplier
        });

        return res.status(200).json({
            phase: 'running',
            multiplier: currentMultiplier
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
