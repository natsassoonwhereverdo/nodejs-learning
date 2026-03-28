import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import workerRouter from './routes/worker.js';
import videoRouter from './routes/video.js';
import memoryLabRouter from './routes/memory-lab.js';
import concurrencyLabRouter from './routes/concurrency-lab.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// JSON parser for normal API requests
app.use(express.json());

// Increase payload limit for large video files (10GB max) - scoped to video routes
app.use('/api/video', express.raw({ type: '*/*', limit: '10gb' }));

app.use(cors());

// API routes
app.use('/api/worker', workerRouter);
app.use('/api/video', videoRouter);
app.use('/api/memory-lab', memoryLabRouter);
app.use('/api/concurrency-lab', concurrencyLabRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files from parent/frontend/dist
const frontendDistPath = join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDistPath));

// Fallback to index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  === Worker Thread Demo ===`);
  console.log(`  POST /api/worker/fibonacci - Fibonacci calculation`);
  console.log(`  POST /api/worker/primes    - Prime sieve`);
  console.log(`  GET  /api/worker/stats     - Pool statistics`);
  console.log(`\n  === Video Processing ===`);
  console.log(`  POST /api/video/metadata   - Extract video metadata (ffprobe)`);
  console.log(`  POST /api/video/thumbnails - Generate thumbnails (ffmpeg)`);
  console.log(`  POST /api/video/hash       - Calculate video hash`);
  console.log(`  POST /api/video/transcode  - Heavy transcode simulation`);
  console.log(`  POST /api/video/process    - Full processing pipeline`);
  console.log(`  GET  /api/video/stats      - Video pool statistics`);
  console.log(`\n  === Memory Leak Lab ===`);
  console.log(`  GET  /api/memory-lab/request - Simulate traffic request`);
  console.log(`  GET  /api/memory-lab/metrics - Runtime memory metrics`);
  console.log(`  POST /api/memory-lab/mode    - Switch leak/fixed mode`);
  console.log(`  POST /api/memory-lab/reset   - Reset counters and refs`);
  console.log(`\n  === Stream Proxy Lab (Q5) ===`);
  console.log(`  GET  /api/memory-lab/stream-proxy/download  - Proxy download (pipe/pipeline)`);
  console.log(`  GET  /api/memory-lab/stream-proxy/metrics   - Stream proxy metrics`);
  console.log(`  POST /api/memory-lab/stream-proxy/mode      - Switch pipe/pipeline`);
  console.log(`  POST /api/memory-lab/stream-proxy/reset     - Reset stream proxy state`);
  console.log(`  POST /api/memory-lab/stream-proxy/simulate-client-disconnect - Auto disconnect simulation`);
  console.log(`\n  === Concurrency & Event Loop Lab ===`);
  console.log(`  POST /api/concurrency-lab/start      - Start naive/controlled run`);
  console.log(`  POST /api/concurrency-lab/stop       - Stop current run`);
  console.log(`  POST /api/concurrency-lab/reset      - Reset run metrics`);
  console.log(`  GET  /api/concurrency-lab/metrics    - Runtime batch metrics`);
  console.log(`  GET  /api/concurrency-lab/event-loop-order - nextTick/setImmediate order demo`);
  console.log(`\nFrontend: http://localhost:${PORT}`);
});
