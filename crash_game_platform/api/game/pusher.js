/**
 * Pusher server-side utilities for real-time game sync
 */

const Pusher = require('pusher');

let pusherInstance = null;

function getPusher() {
    if (!pusherInstance) {
        pusherInstance = new Pusher({
            appId: process.env.PUSHER_APP_ID,
            key: process.env.PUSHER_KEY,
            secret: process.env.PUSHER_SECRET,
            cluster: process.env.PUSHER_CLUSTER,
            useTLS: true
        });
    }
    return pusherInstance;
}

// Broadcast game event to all connected clients
async function broadcast(event, data) {
    const pusher = getPusher();
    await pusher.trigger('crash-game', event, data);
}

// Broadcast private user event (like balance update)
async function broadcastUser(username, event, data) {
    const pusher = getPusher();
    // Subscribe client to 'user-username' channel for private events
    await pusher.trigger(`user-${username}`, event, data);
}

module.exports = { getPusher, broadcast, broadcastUser };
