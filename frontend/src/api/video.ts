const API_BASE = '/api/video';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  fps: number;
  format: string;
}

export interface ThumbnailResult {
  timestamp: number;
  data: string;
  size?: number;
  error?: string;
}

export interface PoolStats {
  compute: {
    ready: boolean;
    queueSize: number;
    totalWorkers: number;
  };
  video: {
    ready: boolean;
    queueSize: number;
    totalWorkers: number;
    busyWorkers: number;
    completedTasks: number;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

function uploadWithProgress(
  endpoint: string,
  data: ArrayBuffer,
  videoDuration: number,
  onProgress?: (progress: UploadProgress) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percentage: Math.round((e.loaded / e.total) * 100)
        });
      }
    };

    xhr.onload = () => {
      resolve(new Response(xhr.responseText, {
        status: xhr.status,
        statusText: xhr.statusText
      }));
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Request timeout'));

    xhr.open('POST', `${API_BASE}${endpoint}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    if (videoDuration > 0) {
      xhr.setRequestHeader('X-Video-Duration', videoDuration.toString());
    }

    xhr.send(data);
  });
}

export async function extractMetadata(
  buffer: ArrayBuffer,
  videoDuration: number,
  onProgress?: (progress: UploadProgress) => void
): Promise<any> {
  const response = await uploadWithProgress('/metadata', buffer, videoDuration, onProgress);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to extract metadata');
  }
  return response.json();
}

export async function generateThumbnails(
  buffer: ArrayBuffer,
  videoDuration: number,
  onProgress?: (progress: UploadProgress) => void
): Promise<any> {
  const response = await uploadWithProgress('/thumbnails', buffer, videoDuration, onProgress);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate thumbnails');
  }
  return response.json();
}

export async function calculateHash(
  buffer: ArrayBuffer,
  onProgress?: (progress: UploadProgress) => void
): Promise<any> {
  const response = await uploadWithProgress('/hash', buffer, 0, onProgress);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to calculate hash');
  }
  return response.json();
}

export async function processVideo(
  buffer: ArrayBuffer,
  videoDuration: number,
  onProgress?: (progress: UploadProgress) => void
): Promise<any> {
  const response = await uploadWithProgress('/process', buffer, videoDuration, onProgress);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Processing failed');
  }
  return response.json();
}

export async function transcodeVideo(
  buffer: ArrayBuffer,
  onProgress?: (progress: UploadProgress) => void
): Promise<any> {
  const response = await uploadWithProgress('/transcode', buffer, 0, onProgress);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Transcode failed');
  }
  return response.json();
}

export async function getPoolStats(): Promise<PoolStats> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) {
    throw new Error('Failed to get stats');
  }
  return response.json();
}
