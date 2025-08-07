/**
 * index.ts
 * Entry point. Starts the Alchemy subscription and keeps the process alive.
 * The listener module will send Telegram messages for each detected log/event.
 *
 * Render Web Service note:
 * - Render expects a Web Service to bind to process.env.PORT.
 * - We add a tiny HTTP server that responds on:
 *   - GET /health -> 200 "ok"
 *   - GET /       -> 200 "service running"
 * - This satisfies Render's port scan while the bot/monitor runs.
 */

import http from 'http'; // Built-in HTTP server for Render port binding
import { startLogSubscription } from './alchemy.js';
import { CONTRACT_ADDRESS, ALCHEMY_WEBSOCKET_URL } from './config.js';

function startHealthServer(): void {
  // Read port from environment (Render provides PORT). Default to 3000 locally.
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  const server = http.createServer((req, res) => {
    // Very small, dependency-free router
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('service running');
      return;
    }

    // Fallback: keep it simple to avoid noisy 404 logs
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('service running');
  });

  server.listen(port, () => {
    console.log(`[HTTP] Health server listening on port ${port}`);
  });

  // Be explicit about error handling to avoid silent failures
  server.on('error', (err) => {
    console.error('[HTTP] Server error:', err);
  });
}

function main(): void {
  console.log('[Startup] Using Alchemy WS:', ALCHEMY_WEBSOCKET_URL);
  console.log('[Startup] Watching contract:', CONTRACT_ADDRESS);

  // 1) Start the minimal HTTP server to satisfy Render's port probe
  startHealthServer();

  // 2) Start the actual subscription/bot logic
  startLogSubscription();

  // Keep alive: handle termination signals gracefully
  process.on('SIGINT', () => {
    console.log('Received SIGINT. Exiting...');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Exiting...');
    process.exit(0);
  });
}

main();