import Piscina from 'piscina';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Main compute pool for CPU tasks
export const pool = new Piscina({
  filename: join(__dirname, 'tasks', 'compute.js'),
  minThreads: 2,
  maxThreads: 4,
  maxQueue: 50
});

// Video processing pool - uses separate workers
const videoPool = new Piscina({
  filename: join(__dirname, 'tasks', 'video-task.js'),
  minThreads: 4,
  maxThreads: 8,
  maxQueue: 2, // Limit for large video files
  idleTimeout: 120000,
  activityTimeout: 300000
});

// Compute tasks (fibonacci, primes)
export async function runFibonacci(n: number): Promise<number> {
  return await pool.runTask({ type: 'fibonacci', n }) as number;
}

export async function runPrimeSieve(max: number): Promise<number> {
  return await pool.runTask({ type: 'primeSieve', max }) as number;
}

// Video processing tasks
export async function extractMetadata(buffer: Buffer) {
  return await videoPool.runTask({ type: 'metadata', data: buffer });
}

export async function generateThumbnail(buffer: Buffer, timestamp: number) {
  return await videoPool.runTask({ type: 'thumbnail', data: buffer, timestamp });
}

export async function generateThumbnails(buffer: Buffer, maxDuration: number) {
  return await videoPool.runTask({ type: 'thumbnails', data: buffer, maxDuration });
}

export async function calculateHash(buffer: Buffer) {
  return await videoPool.runTask({ type: 'hash', data: buffer });
}

export async function processSegment(buffer: Buffer, startTime: number, duration: number) {
  return await videoPool.runTask({ type: 'segment', data: buffer, startTime, duration });
}

export async function transcodeVideo(buffer: Buffer) {
  return await videoPool.runTask({ type: 'transcode', data: buffer });
}

// Stats
export function getPoolStats() {
  return {
    compute: {
      ready: pool.ready,
      queueSize: pool.queueSize,
      totalWorkers: pool.threads.length
    },
    video: {
      ready: (videoPool as any).ready ?? true,
      queueSize: videoPool.queueSize,
      totalWorkers: videoPool.threads.length,
      busyWorkers: (videoPool as any).busyThreads ?? 0,
      completedTasks: (videoPool as any).completedTasks ?? 0
    }
  };
}
