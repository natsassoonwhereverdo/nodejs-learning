const API_BASE = '/api/worker';

export interface FibonacciRequest {
  n: number;
}

export interface FibonacciResponse {
  result: number;
  workerId: string;
  duration: number;
}

export interface PrimesRequest {
  max: number;
}

export interface PrimesResponse {
  count: number;
  workerId: string;
  duration: number;
}

export interface PoolStats {
  ready: boolean;
  queueSize: number;
  totalWorkers: number;
}

export async function runFibonacci(n: number): Promise<FibonacciResponse> {
  const response = await fetch(`${API_BASE}/fibonacci`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ n })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

export async function runPrimes(max: number): Promise<PrimesResponse> {
  const response = await fetch(`${API_BASE}/primes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ max })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
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
