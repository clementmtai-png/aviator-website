/**
 * Game State Debugger
 * Path: /api/debug-game.js
 */

const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    try {
        const state = await kv.get('game:state');
        const history = await kv.get('game:history');
        const planned = await kv.lrange('game:planned_crashes', 0, -1);

        res.status(200).json({
            state,
            history: history ? history.slice(0, 5) : [],
            planned_queue: planned,
            server_time: Date.now()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
