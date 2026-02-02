/**
 * Shared Game Engine Logic
 * Handles state transitions for the crash game.
 */

const { kv } = require('@vercel/kv');
const { broadcast } = require('./pusher');
const { generateCrashPoint, calculateMultiplier } = require('./game');

async function advanceGame() {
    // 1. Get current state
    let state = await kv.get('game:state');
    const now = Date.now();

    // 2. Initialize if missing
    if (!state) {
        state = { phase: 'crashed', crashedAt: now - 3000 };
    }

    // 3. Transition: CRASHED -> WAITING (Into betting phase)
    if (state.phase === 'crashed') {
        const timeSinceCrash = now - (state.crashedAt || 0);
        if (timeSinceCrash >= 3000) { // 3s cooldown after crash
            state = {
                phase: 'waiting',
                startTime: now + 5000, // 5s betting time
                bets: []
            };
            await kv.set('game:state', state);
            await broadcast('game:waiting', { timeLeft: 5000 });
        }
    }

    // 4. Transition: WAITING -> RUNNING (Start flight)
    if (state.phase === 'waiting' && now >= state.startTime) {
        state.phase = 'running';
        state.startTime = now;

        // Check for planned crashes
        const planned = await kv.lpop('game:planned_crashes');
        if (planned) {
            state.crashPoint = parseFloat(planned);
        } else {
            state.crashPoint = generateCrashPoint();
        }

        state.roundId = `round-${now}`;
        await kv.set('game:state', state);
        await broadcast('game:start', { roundId: state.roundId, startTime: state.startTime });
    }

    // 5. Transition: RUNNING -> CRASHED
    if (state.phase === 'running') {
        const elapsed = now - state.startTime;
        const currentMultiplier = calculateMultiplier(elapsed);

        if (currentMultiplier >= state.crashPoint) {
            state.phase = 'crashed';
            state.multiplier = state.crashPoint;
            state.crashedAt = now;
            await kv.set('game:state', state);

            const history = await kv.get('game:history') || [];
            history.unshift({ roundId: state.roundId, crashPoint: state.crashPoint, timestamp: now });
            if (history.length > 50) history.splice(50);
            await kv.set('game:history', history);

            await broadcast('game:crash', { crashPoint: state.crashPoint });
        } else {
            // Update multiplier tick in KV for other clients
            state.multiplier = currentMultiplier;
            await kv.set('game:state', state);
            // Throttle ticks? For passive loop, we rely on broadcast from whoever advanced it
            await broadcast('game:tick', { multiplier: currentMultiplier });
        }
    }

    return state;
}

module.exports = { advanceGame };
