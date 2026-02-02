/**
 * Shared Game Logic (Shared between Cron and Game API)
 */

function generateCrashPoint() {
    const r = Math.random();
    // 3% instant crash at 1.00
    if (r < 0.03) return 1.00;

    // Balanced crash formula: (0.99 / (1 - U))
    // We cap it at 1000 for safety and round to 2 decimals
    const cp = 0.99 / (1 - Math.random());
    return Math.max(1.01, Math.min(1000, Math.floor(cp * 100) / 100));
}

function calculateMultiplier(elapsedMs) {
    const growthRate = 0.00006; // Match Engine.js
    const mult = Math.exp(growthRate * elapsedMs);
    return Math.floor(mult * 100) / 100;
}

module.exports = { generateCrashPoint, calculateMultiplier };
