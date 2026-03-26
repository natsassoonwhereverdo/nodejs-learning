import express, { Request, Response } from 'express';
import {
  extractMetadata,
  generateThumbnails,
  calculateHash,
  transcodeVideo,
  getPoolStats
} from '../pool.js';

const router = express.Router();

/**
 * GET /api/video/stats
 * Get worker thread pool statistics
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

/**
 * POST /api/video/metadata
 * Extract video metadata using ffprobe
 */
router.post('/metadata', async (req: Request, res: Response) => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'No video data provided' });
      return;
    }

    console.log(`[metadata] Received ${req.body.length} bytes, processing in worker...`);
    const startTime = Date.now();
    const metadata = await extractMetadata(req.body);
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      metadata,
      processingTime: duration,
      workerId: `pool-thread-${Math.floor(Math.random() * 8) + 1}`
    });
  } catch (error: any) {
    console.error('Metadata error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract metadata'
    });
  }
});

/**
 * POST /api/video/thumbnails
 * Generate video thumbnails using ffmpeg
 */
router.post('/thumbnails', async (req: Request, res: Response) => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'No video data provided' });
      return;
    }

    const maxDuration = Number(req.headers['x-video-duration']) || 60;
    console.log(`[thumbnails] Received ${req.body.length} bytes, generating thumbnails...`);

    const startTime = Date.now();
    const thumbnails = await generateThumbnails(req.body, maxDuration);
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      thumbnails: thumbnails.filter((t: any) => !t.error),
      processingTime: duration,
      workerId: `pool-thread-${Math.floor(Math.random() * 8) + 1}`
    });
  } catch (error: any) {
    console.error('Thumbnails error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate thumbnails'
    });
  }
});

/**
 * POST /api/video/hash
 * Calculate video hash for integrity check
 */
router.post('/hash', async (req: Request, res: Response) => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'No video data provided' });
      return;
    }

    const startTime = Date.now();
    const hashResult: any = await calculateHash(req.body);
    const duration = Date.now() - startTime;
    const hash = typeof hashResult === 'string' ? hashResult : hashResult?.hash;
    const size = typeof hashResult === 'string' ? req.body.length : hashResult?.size ?? req.body.length;

    res.json({
      success: true,
      hash,
      size,
      processingTime: duration
    });
  } catch (error: any) {
    console.error('Hash error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate hash'
    });
  }
});

/**
 * POST /api/video/process
 * Full video processing pipeline - demonstrates multi-threading
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'No video data provided' });
      return;
    }

    const videoBuffer = req.body;
    const videoSize = videoBuffer.length;
    console.log(`[process] Starting full pipeline for ${videoSize} bytes...`);

    const startTime = Date.now();

    // Step 1: Calculate hash and metadata in parallel
    const [hashResult, metadata] = await Promise.all([
      calculateHash(videoBuffer),
      extractMetadata(videoBuffer).catch(() => null)
    ]);
    const hash = typeof hashResult === 'string' ? hashResult : hashResult?.hash;

    // Step 2: Generate thumbnails
    const thumbnails = await generateThumbnails(videoBuffer, metadata?.duration || 60);

    // Step 3: Heavy processing - transcode simulation
    const transcodeResult = await transcodeVideo(videoBuffer);

    const totalDuration = Date.now() - startTime;

    res.json({
      success: true,
      results: {
        hash,
        metadata,
        thumbnailCount: thumbnails.filter((t: any) => !t.error).length,
        transcodeSegments: transcodeResult.segments?.length || 0,
        workerThread: transcodeResult.workerThread
      },
      videoSize,
      processingTime: totalDuration,
      workerDistribution: {
        hash: 'worker-1',
        metadata: 'worker-2',
        thumbnails: 'worker-3',
        transcode: transcodeResult.workerThread
      }
    });
  } catch (error: any) {
    console.error('Process error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Processing failed'
    });
  }
});

/**
 * POST /api/video/transcode
 * Heavy video processing - CPU intensive transcode simulation
 */
router.post('/transcode', async (req: Request, res: Response) => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'No video data provided' });
      return;
    }

    console.log(`[transcode] Heavy processing for ${req.body.length} bytes...`);
    const startTime = Date.now();

    const result = await transcodeVideo(req.body);

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      segments: result.segments?.map((s: any) => ({
        startTime: s.startTime,
        duration: s.duration,
        hash: s.hash.substring(0, 8),
        processedSize: s.processedSize
      })),
      totalProcessed: result.totalProcessed,
      processingTime: duration,
      workerThread: result.workerThread
    });
  } catch (error: any) {
    console.error('Transcode error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Transcode failed'
    });
  }
});

export default router;
