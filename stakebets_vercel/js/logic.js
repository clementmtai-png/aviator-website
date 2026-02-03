/**
 * Shared Deterministic Game Logic
 */
const ROUND_CYCLE = 20000;
const BETTING_TIME = 5000;

function getDeterministicCrashPoint(timestamp) {
    const roundId = Math.floor(timestamp / ROUND_CYCLE);
    const date = new Date(timestamp);
    const minute = date.getMinutes();

    // Seeded random
    const seed = (roundId * 16807) % 2147483647;
    const r = (seed / 2147483647);

    // Golden Hour Rule: First 2 minutes of every hour
    if (minute < 2) {
        return Math.floor(20 + r * 80 * 100) / 100;
    }

    if (r < 0.03) return 1.00;
    const cp = 0.99 / (1 - r);
    return Math.max(1.01, Math.min(50, Math.floor(cp * 100) / 100));
}

function calculateMultiplier(elapsedMs) {
    const growthRate = 0.00006;
    const mult = Math.exp(growthRate * elapsedMs);
    return Math.floor(mult * 100) / 100;
}

// Node.js support
if (typeof module !== 'undefined') {
    module.exports = { getDeterministicCrashPoint, calculateMultiplier, ROUND_CYCLE, BETTING_TIME };
}
