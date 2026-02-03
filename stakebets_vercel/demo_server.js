const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3002;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// --- MOCK API LOGIC ---
let mockState = {
    phase: 'running',
    multiplier: 1.0,
    startTime: Date.now(),
    crashPoint: 10.0,
    roundId: 'mock-123'
};

function updateMockGame() {
    const now = Date.now();
    if (mockState.phase === 'running') {
        const elapsed = (now - mockState.startTime);
        mockState.multiplier = Math.exp(0.00006 * elapsed);
        if (mockState.multiplier >= mockState.crashPoint) {
            mockState.phase = 'crashed';
            mockState.crashedAt = now;
        }
    } else if (mockState.phase === 'crashed') {
        if (now - mockState.crashedAt > 3000) {
            mockState = {
                phase: 'running',
                startTime: now,
                multiplier: 1.0,
                crashPoint: 5 + Math.random() * 10,
                roundId: 'mock-' + now
            };
        }
    }
}
setInterval(updateMockGame, 100);

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // API Handling
    if (req.url.includes('/api/auth')) {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const data = JSON.parse(body || '{}');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                user: {
                    username: data.username || 'DemoUser',
                    phone: data.phone || '0000000000',
                    balance: 0,
                    isAdmin: false
                }
            }));
        });
        return;
    }

    if (req.url.includes('/api/pesapal')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            success: true,
            redirect_url: 'https://www.pesapal.com/mock-payment?order=123',
            message: 'Mock payment initiated'
        }));
    }

    if (req.url.includes('/api/game/state') || req.url.includes('action=state')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ...mockState, success: true, serverTime: Date.now() }));
    }

    if (req.url.includes('/api/game/history') || req.url.includes('action=history')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, history: [], count: 0 }));
    }

    if (req.url.includes('/api/user')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            success: true,
            balance: 0.00,
            username: 'DemoUser'
        }));
    }

    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end(`Internal Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
