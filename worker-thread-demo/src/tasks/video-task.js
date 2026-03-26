import { spawn } from 'child_process';
import { createHash } from 'crypto';

function normalizeBuffer(data) {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }

  throw new TypeError('Expected Buffer or Uint8Array video data');
}

/**
 * Extract video metadata using ffprobe
 */
async function extractMetadata(buffer) {
  return new Promise((resolve, reject) => {
    const inputBuffer = normalizeBuffer(buffer);
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      'pipe:0'
    ]);

    const chunks = [];
    ffprobe.stdout.on('data', chunk => chunks.push(chunk));
    ffprobe.stderr.on('data', chunk => console.error('ffprobe stderr:', chunk.toString()));
    ffprobe.stdin.end(inputBuffer);

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }
      try {
        const output = JSON.parse(Buffer.concat(chunks).toString());
        const videoStream = output.streams?.find(s => s.codec_type === 'video');
        const format = output.format;

        resolve({
          duration: parseFloat(format?.duration || 0),
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          codec: videoStream?.codec_name || 'unknown',
          bitrate: parseInt(format?.bit_rate || '0'),
          fps: eval(videoStream?.r_frame_rate || '0/1') || 0,
          format: format?.format_name || 'unknown'
        });
      } catch (e) {
        reject(e);
      }
    });

    ffprobe.on('error', reject);
  });
}

/**
 * Generate thumbnail at specific timestamp
 */
async function generateThumbnail(buffer, timestamp) {
  return new Promise((resolve, reject) => {
    const inputBuffer = normalizeBuffer(buffer);
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-ss', timestamp.toString(),
      '-i', 'pipe:0',
      '-vframes', '1',
      '-q:v', '5',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      'pipe:1'
    ]);

    const chunks = [];
    ffmpeg.stdout.on('data', chunk => chunks.push(chunk));
    ffmpeg.stderr.on('data', chunk => console.error('ffmpeg stderr:', chunk.toString()));
    ffmpeg.stdin.end(inputBuffer);

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      const imageBuffer = Buffer.concat(chunks);
      resolve({
        timestamp,
        data: imageBuffer.toString('base64'),
        size: imageBuffer.length
      });
    });

    ffmpeg.on('error', reject);
  });
}

/**
 * Calculate video hash
 */
function calculateHash(buffer) {
  return createHash('sha256').update(normalizeBuffer(buffer)).digest('hex');
}

/**
 * Process video segment
 */
function processSegment(buffer, startTime, duration) {
  const inputBuffer = normalizeBuffer(buffer);
  const iterations = 1000;
  let hash = calculateHash(inputBuffer);

  for (let i = 0; i < iterations; i++) {
    hash = createHash('sha256').update(hash + i.toString()).digest('hex');
  }

  return {
    startTime,
    duration,
    hash,
    processedSize: inputBuffer.length,
    workerThread: process.env.WORKER_THREAD_ID || 'unknown'
  };
}

/**
 * Transcode video simulation
 */
function transcodeVideo(buffer) {
  const inputBuffer = normalizeBuffer(buffer);
  const segmentCount = 8;
  const segmentSize = Math.floor(inputBuffer.length / segmentCount);
  const results = [];

  for (let i = 0; i < segmentCount; i++) {
    const segment = inputBuffer.slice(i * segmentSize, (i + 1) * segmentSize);
    results.push(processSegment(segment, i * segmentSize, segmentSize));
  }

  return {
    segments: results,
    totalProcessed: inputBuffer.length,
    workerThread: process.env.WORKER_THREAD_ID || 'unknown'
  };
}

/**
 * Default handler for piscina
 */
export default async function(task) {
  const { type, data, timestamp, maxDuration } = task;

  switch (type) {
    case 'metadata':
      return await extractMetadata(data);

    case 'thumbnail':
      return await generateThumbnail(data, timestamp);

    case 'thumbnails': {
      const timestamps = [0, maxDuration * 0.25, maxDuration * 0.5, maxDuration * 0.75, maxDuration - 1];
      const promises = timestamps.map(t => generateThumbnail(data, t).catch(e => ({ timestamp: t, error: e.message })));
      return await Promise.all(promises);
    }

    case 'hash':
      return {
        hash: calculateHash(data),
        size: data.length
      };

    case 'segment':
      return processSegment(data, task.startTime, task.duration);

    case 'transcode':
      return transcodeVideo(data);

    default:
      throw new Error(`Unknown task type: ${type}`);
  }
}
