export interface FibonacciTask {
  type: 'fibonacci';
  n: number;
}

export interface PrimeSieveTask {
  type: 'primeSieve';
  max: number;
}

export type WorkerTask = FibonacciTask | PrimeSieveTask;

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
