const API_BASE = '/api/memory-lab';

export type MemoryLabMode = 'leak' | 'fixed';

export interface MemoryLabMetrics {
  mode: MemoryLabMode;
  memoryMB: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  refs: {
    leakedObjects: number;
    cacheEntries: number;
    listeners: number;
    danglingTimers: number;
  };
  stats: {
    requestCount: number;
    longTailCount: number;
    longTailRatio: number;
    simulatedMajorGcCount: number;
    lastPauseCostMs: number;
    recentP99Ms: number;
    uptimeSec: number;
  };
}

export interface RequestResult {
  ok: boolean;
  mode: MemoryLabMode;
  durationMs: number;
  longTail: boolean;
  requestId: number;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = await response.json();
    return new Error(payload.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function hitMemoryRequest(): Promise<RequestResult> {
  const response = await fetch(`${API_BASE}/request`);
  if (!response.ok) {
    throw await parseError(response, 'Failed to run memory request');
  }
  return response.json();
}

export async function getMemoryMetrics(): Promise<MemoryLabMetrics> {
  const response = await fetch(`${API_BASE}/metrics`);
  if (!response.ok) {
    throw await parseError(response, 'Failed to get memory metrics');
  }
  return response.json();
}

export async function setMemoryMode(mode: MemoryLabMode): Promise<MemoryLabMetrics> {
  const response = await fetch(`${API_BASE}/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });

  if (!response.ok) {
    throw await parseError(response, 'Failed to switch memory mode');
  }

  const payload = await response.json();
  return payload.metrics as MemoryLabMetrics;
}

export async function resetMemoryLab(): Promise<MemoryLabMetrics> {
  const response = await fetch(`${API_BASE}/reset`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw await parseError(response, 'Failed to reset memory lab');
  }

  const payload = await response.json();
  return payload.metrics as MemoryLabMetrics;
}
