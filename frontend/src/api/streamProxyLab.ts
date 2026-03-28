const API_BASE = '/api/memory-lab/stream-proxy';

export type StreamProxyMode = 'pipe' | 'pipeline';
export type StreamProxySimulateMode = StreamProxyMode | 'current';

export interface StreamProxyMetrics {
  mode: StreamProxyMode;
  scenario: {
    expectedReportSizeMB: number;
    expectedDisconnectAtMB: number;
  };
  proxy: {
    requestCount: number;
    activeSessions: number;
    completedCount: number;
    errorCount: number;
    clientDisconnectCount: number;
    upstreamAbortCount: number;
    leakRiskCount: number;
    simulationCount: number;
  };
  upstream: {
    activeSessions: number;
    completedCount: number;
    abortedCount: number;
    timeoutCount: number;
    activeTop: Array<{
      id: number;
      sentMB: number;
      totalMB: number;
      ageSec: number;
    }>;
  };
  process: {
    activeHandles: number;
    rssMB: number;
    heapUsedMB: number;
  };
}

export interface StreamProxySimulationPayload {
  mode?: StreamProxySimulateMode;
  totalMB?: number;
  disconnectAtMB?: number;
}

export interface StreamProxySimulationResult {
  ok: boolean;
  simulation: {
    mode: StreamProxyMode;
    totalMB: number;
    disconnectAtMB: number;
    receivedMB: number;
    disconnected: boolean;
    note: string;
  };
  before: StreamProxyMetrics;
  after: StreamProxyMetrics;
}

interface MetricsResponse {
  metrics: StreamProxyMetrics;
}

interface ErrorResponse {
  error?: string;
  detail?: string;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as ErrorResponse;
    return new Error(payload.error || payload.detail || fallback);
  } catch {
    return new Error(fallback);
  }
}

async function readMetricsPayload(response: Response, fallback: string): Promise<StreamProxyMetrics> {
  if (!response.ok) {
    throw await parseError(response, fallback);
  }

  const payload = (await response.json()) as Partial<MetricsResponse> & StreamProxyMetrics;
  return (payload.metrics ?? payload) as StreamProxyMetrics;
}

export async function getStreamProxyMetrics(): Promise<StreamProxyMetrics> {
  const response = await fetch(`${API_BASE}/metrics`);
  return readMetricsPayload(response, 'Failed to get stream proxy metrics');
}

export async function setStreamProxyMode(mode: StreamProxyMode): Promise<StreamProxyMetrics> {
  const response = await fetch(`${API_BASE}/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });

  return readMetricsPayload(response, 'Failed to switch stream proxy mode');
}

export async function resetStreamProxyLab(): Promise<StreamProxyMetrics> {
  const response = await fetch(`${API_BASE}/reset`, {
    method: 'POST'
  });

  return readMetricsPayload(response, 'Failed to reset stream proxy lab');
}

export async function simulateStreamProxyDisconnect(
  payload: StreamProxySimulationPayload
): Promise<StreamProxySimulationResult> {
  const response = await fetch(`${API_BASE}/simulate-client-disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await parseError(response, 'Failed to simulate client disconnect');
  }

  return response.json();
}
