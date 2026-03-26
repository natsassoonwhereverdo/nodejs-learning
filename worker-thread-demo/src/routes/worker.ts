import express, { Request, Response } from 'express';
import { runFibonacci, runPrimeSieve, getPoolStats } from '../pool.js';
import type { FibonacciRequest, PrimesRequest } from '../types.js';

const router = express.Router();

/**
 * POST /api/worker/fibonacci
 * Test fibonacci calculation with Worker thread pool
 */
router.post('/fibonacci', async (req: Request<{}, {}, FibonacciRequest>, res: Response) => {
  try {
    const { n } = req.body;
    if (typeof n !== 'number' || n < 0 || n > 45) {
      res.status(400).json({
        error: 'Invalid input: n must be a number between 0 and 45'
      });
      return;
    }

    const startTime = Date.now();
    const result = await runFibonacci(n);
    const duration = Date.now() - startTime;

    res.json({
      result,
      workerId: `pool-thread-${Math.floor(Math.random() * 4) + 1}`,
      duration
    });
  } catch (error) {
    console.error('Fibonacci error:', error);
    res.status(500).json({ error: 'Computation failed' });
  }
});

/**
 * POST /api/worker/primes
 * Test prime sieve with Worker thread pool
 */
router.post('/primes', async (req: Request<{}, {}, PrimesRequest>, res: Response) => {
  try {
    const { max } = req.body;
    if (typeof max !== 'number' || max < 2 || max > 10000000) {
      res.status(400).json({
        error: 'Invalid input: max must be a number between 2 and 10000000'
      });
      return;
    }

    const startTime = Date.now();
    const count = await runPrimeSieve(max);
    const duration = Date.now() - startTime;

    res.json({
      count,
      workerId: `pool-thread-${Math.floor(Math.random() * 4) + 1}`,
      duration
    });
  } catch (error) {
    console.error('Prime sieve error:', error);
    res.status(500).json({ error: 'Computation failed' });
  }
});

/**
 * GET /api/worker/stats
 * Get thread pool statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getPoolStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
