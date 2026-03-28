const API_BASE = '/api/concurrency-lab';

export type RunMode = 'naive' | 'controlled';

export interface ConcurrencyMetrics {
  runId: number;
  mode: RunMode;
  running: boolean;
  config: {
    totalUsers: number;
    concurrency: number;
    nextTickAbuse: boolean;
  };
  counters: {
    processed: number;
    succeeded: number;
    failed: number;
    progress: number;
    inFlight: number;
    peakInFlight: number;
  };
  timing: {
    durationMs: number;
    apiLatencyP99Ms: number;
    apiLatencyP95Ms: number;
    apiLatencyMeanMs: number;
    eventLoopLagP99Ms: number;
    eventLoopLagMeanMs: number;
  };
  memoryMB: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  trends: {
    heapMB: number[];
    lagMs: number[];
    inFlight: number[];
  };
  lastError: string | null;
  updatedAt: string;
}

export interface StartPayload {
  mode: RunMode;
  totalUsers: number;
  concurrency?: number;
  nextTickAbuse?: boolean;
}

export interface EventLoopOrderResult {
  order: string[];
  note: string;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = await response.json();
    return new Error(payload.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

async function readMetricsPayload(response: Response, fallback: string): Promise<ConcurrencyMetrics> {
  if (!response.ok) {
    throw await parseError(response, fallback);
  }

  const payload = await response.json();
  return (payload.metrics ?? payload) as ConcurrencyMetrics;
}

export async function startConcurrencyRun(payload: StartPayload): Promise<ConcurrencyMetrics> {
  const response = await fetch(`${API_BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return readMetricsPayload(response, 'Failed to start concurrency lab run');
}

export async function stopConcurrencyRun(): Promise<ConcurrencyMetrics> {
  const response = await fetch(`${API_BASE}/stop`, {
    method: 'POST'
  });

  return readMetricsPayload(response, 'Failed to stop concurrency lab run');
}

export async function resetConcurrencyLab(): Promise<ConcurrencyMetrics> {
  const response = await fetch(`${API_BASE}/reset`, {
    method: 'POST'
  });

  return readMetricsPayload(response, 'Failed to reset concurrency lab');
}

export async function getConcurrencyMetrics(): Promise<ConcurrencyMetrics> {
  const response = await fetch(`${API_BASE}/metrics`);
  return readMetricsPayload(response, 'Failed to get concurrency metrics');
}

export async function getEventLoopOrder(): Promise<EventLoopOrderResult> {
  const response = await fetch(`${API_BASE}/event-loop-order`);
  if (!response.ok) {
    throw await parseError(response, 'Failed to get event loop ordering demo');
  }
  return response.json();
}
