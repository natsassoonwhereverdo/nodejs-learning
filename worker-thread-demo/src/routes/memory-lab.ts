import express, { Request, Response, Router } from 'express';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as http from 'http';
import type { IncomingMessage } from 'http';
import { pipeline } from 'stream';

type LabMode = 'leak' | 'fixed';
type StreamProxyMode = 'pipe' | 'pipeline';
type StreamProxySimulateMode = StreamProxyMode | 'current';

interface ModeRequestBody {
  mode?: LabMode;
}

interface StreamProxyModeBody {
  mode?: StreamProxyMode;
}

interface StreamProxySimulateBody {
  mode?: StreamProxySimulateMode;
  totalMB?: number;
  disconnectAtMB?: number;
}

interface LeakedObject {
  id: number;
  createdAt: number;
  values: number[];
  tags: string[];
}

interface StreamProxySession {
  id: number;
  mode: StreamProxyMode;
  totalMB: number;
  startedAt: number;
  clientDisconnected: boolean;
  upstreamAborted: boolean;
  settled: boolean;
  abortUpstream?: (reason: string) => void;
}

interface UpstreamSession {
  id: number;
  totalBytes: number;
  sentBytes: number;
  startedAt: number;
  lastWriteAt: number;
}

const router: Router = express.Router();
const MB = 1024 * 1024;
const CSV_CHUNK_BYTES = 64 * 1024;
const STREAM_MIN_TOTAL_MB = 16;
const STREAM_MAX_TOTAL_MB = 5 * 1024;
const SCENARIO_REPORT_MB = 5 * 1024;
const SCENARIO_DISCONNECT_MB = 2 * 1024;
const SIM_DEFAULT_TOTAL_MB = 256;
const SIM_DEFAULT_DISCONNECT_MB = 128;
const UPSTREAM_SESSION_TIMEOUT_MS = 120_000;
const CSV_CHUNK = buildCsvChunk(CSV_CHUNK_BYTES);

let mode: LabMode = 'leak';
let requestCount = 0;
let longTailCount = 0;
let simulatedMajorGcCount = 0;
let lastPauseCostMs = 0;
let lastPauseAt = 0;

let streamProxyMode: StreamProxyMode = 'pipe';
let streamProxyRequestCount = 0;
let streamProxyCompletedCount = 0;
let streamProxyErrorCount = 0;
let streamProxyClientDisconnectCount = 0;
let streamProxyUpstreamAbortCount = 0;
let streamProxyLeakRiskCount = 0;
let streamProxySimulationCount = 0;

let upstreamCompletedCount = 0;
let upstreamAbortedCount = 0;
let upstreamTimeoutCount = 0;

const leakedObjects: LeakedObject[] = [];
const unboundedCache = new Map<number, LeakedObject>();
const danglingTimers = new Set<NodeJS.Timeout>();
const listenerHub = new EventEmitter();
listenerHub.setMaxListeners(0);

const activeProxySessions = new Map<number, StreamProxySession>();
const activeUpstreamSessions = new Map<number, UpstreamSession>();

const recentLatenciesMs: number[] = [];

function buildCsvChunk(targetBytes: number): Buffer {
  const line = 'order_id,user_id,amount,created_at\n1001,2001,128.66,2026-03-28T00:00:00.000Z\n';
  const repeat = Math.ceil(targetBytes / line.length);
  return Buffer.from(line.repeat(repeat).slice(0, targetBytes));
}

function createObject(seed: number): LeakedObject {
  const now = Date.now();
  const values = Array.from({ length: 512 }, (_, idx) => seed + idx);
  const base = `${seed}-${now}-${Math.random().toString(16).slice(2)}`;
  const tags = Array.from({ length: 48 }, (_, idx) => `${base}-tag-${idx}`);

  return {
    id: seed,
    createdAt: now,
    values,
    tags
  };
}

function generateYoungGenGarbage(): void {
  const temp = [] as Array<{ text: string; list: number[] }>;
  for (let i = 0; i < 160; i += 1) {
    temp.push({
      text: `${i}-${Math.random().toString(36).slice(2)}`.repeat(6),
      list: [i, i + 1, i + 2, i + 3]
    });
  }

  if (temp.length === 0) {
    throw new Error('unreachable');
  }
}

function pushLatency(durationMs: number): void {
  recentLatenciesMs.push(durationMs);
  if (recentLatenciesMs.length > 500) {
    recentLatenciesMs.shift();
  }
}

function getRecentP99Ms(): number {
  if (recentLatenciesMs.length === 0) {
    return 0;
  }

  const sorted = [...recentLatenciesMs].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.99) - 1);
  return Number(sorted[idx].toFixed(2));
}

function applyLeakPatterns(currentRequestId: number): void {
  const payload = createObject(currentRequestId);

  // Anti-pattern 1: 不受控缓存持续增长
  leakedObjects.push(payload);
  unboundedCache.set(currentRequestId, payload);

  // Anti-pattern 2: 监听器不断累积且不移除
  if (currentRequestId % 6 === 0) {
    const retained = createObject(currentRequestId + 1000000);
    listenerHub.on('tick', () => retained.values[0]);
  }

  // Anti-pattern 3: 定时器闭包持有大对象且未 clear
  if (currentRequestId % 8 === 0) {
    const retained = createObject(currentRequestId + 2000000);
    const timer = setInterval(() => {
      if (retained.id < 0) {
        console.log('impossible');
      }
    }, 60_000);
    danglingTimers.add(timer);
  }
}

function applyFixedPatterns(currentRequestId: number): void {
  const payload = createObject(currentRequestId);

  // 修复思路：把缓存变成有界容器
  unboundedCache.set(currentRequestId, payload);
  if (unboundedCache.size > 120) {
    const firstKey = unboundedCache.keys().next().value as number | undefined;
    if (typeof firstKey === 'number') {
      unboundedCache.delete(firstKey);
    }
  }

  // 固定模式不再继续新增泄漏引用
  listenerHub.emit('tick');
}

function simulateMajorGcPauseIfNeeded(): void {
  if (mode !== 'leak') {
    return;
  }

  const now = Date.now();
  const heapUsedMB = process.memoryUsage().heapUsed / MB;
  if (heapUsedMB < 90 || now - lastPauseAt < 3500) {
    return;
  }

  // 为了稳定复现“周期性长尾”，实验里使用同步扫描模拟 Full GC 的 STW 暂停
  const expectedPauseMs = Math.min(1000, 140 + leakedObjects.length * 0.25);
  const pauseStart = performance.now();
  let checksum = 0;

  for (let i = 0; i < leakedObjects.length; i += 4) {
    checksum ^= leakedObjects[i].values[0] ?? 0;
  }

  while (performance.now() - pauseStart < expectedPauseMs) {
    checksum ^= 1;
  }

  if (checksum === Number.MIN_SAFE_INTEGER) {
    console.log('never');
  }

  lastPauseCostMs = Number((performance.now() - pauseStart).toFixed(2));
  lastPauseAt = now;
  simulatedMajorGcCount += 1;
}

function clearLeakReferences(): void {
  leakedObjects.length = 0;
  unboundedCache.clear();
  listenerHub.removeAllListeners('tick');

  for (const timer of danglingTimers) {
    clearInterval(timer);
  }
  danglingTimers.clear();
}

function getMetrics() {
  const mem = process.memoryUsage();

  return {
    mode,
    memoryMB: {
      rss: Number((mem.rss / MB).toFixed(2)),
      heapUsed: Number((mem.heapUsed / MB).toFixed(2)),
      heapTotal: Number((mem.heapTotal / MB).toFixed(2)),
      external: Number((mem.external / MB).toFixed(2)),
      arrayBuffers: Number((mem.arrayBuffers / MB).toFixed(2))
    },
    refs: {
      leakedObjects: leakedObjects.length,
      cacheEntries: unboundedCache.size,
      listeners: listenerHub.listenerCount('tick'),
      danglingTimers: danglingTimers.size
    },
    stats: {
      requestCount,
      longTailCount,
      longTailRatio: requestCount === 0 ? 0 : Number((longTailCount / requestCount).toFixed(4)),
      simulatedMajorGcCount,
      lastPauseCostMs,
      recentP99Ms: getRecentP99Ms(),
      uptimeSec: Math.floor(process.uptime())
    }
  };
}

function getActiveHandleCount(): number {
  const proc = process as NodeJS.Process & { _getActiveHandles?: () => unknown[] };
  return typeof proc._getActiveHandles === 'function' ? proc._getActiveHandles().length : -1;
}

function getQueryScalar(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function normalizeInt(value: unknown, fallback: number, min: number, max: number): number {
  const raw = getQueryScalar(value);
  const parsed = typeof raw === 'number'
    ? Math.trunc(raw)
    : typeof raw === 'string'
      ? Math.trunc(Number(raw))
      : fallback;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function createInternalUrl(req: Request, pathname: string): URL {
  const protocol = req.protocol === 'https' ? 'https' : 'http';
  const host = req.get('host') ?? '127.0.0.1:3000';
  return new URL(pathname, `${protocol}://${host}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStreamProxyMetrics() {
  const mem = process.memoryUsage();
  const activeUpstreamTop = [...activeUpstreamSessions.values()]
    .slice(0, 6)
    .map((session) => ({
      id: session.id,
      sentMB: Number((session.sentBytes / MB).toFixed(2)),
      totalMB: Number((session.totalBytes / MB).toFixed(2)),
      ageSec: Number(((Date.now() - session.startedAt) / 1000).toFixed(1))
    }));

  return {
    mode: streamProxyMode,
    scenario: {
      expectedReportSizeMB: SCENARIO_REPORT_MB,
      expectedDisconnectAtMB: SCENARIO_DISCONNECT_MB
    },
    proxy: {
      requestCount: streamProxyRequestCount,
      activeSessions: activeProxySessions.size,
      completedCount: streamProxyCompletedCount,
      errorCount: streamProxyErrorCount,
      clientDisconnectCount: streamProxyClientDisconnectCount,
      upstreamAbortCount: streamProxyUpstreamAbortCount,
      leakRiskCount: streamProxyLeakRiskCount,
      simulationCount: streamProxySimulationCount
    },
    upstream: {
      activeSessions: activeUpstreamSessions.size,
      completedCount: upstreamCompletedCount,
      abortedCount: upstreamAbortedCount,
      timeoutCount: upstreamTimeoutCount,
      activeTop: activeUpstreamTop
    },
    process: {
      activeHandles: getActiveHandleCount(),
      rssMB: Number((mem.rss / MB).toFixed(2)),
      heapUsedMB: Number((mem.heapUsed / MB).toFixed(2))
    }
  };
}

async function runDisconnectSimulation(
  req: Request,
  modeForRun: StreamProxyMode,
  totalMB: number,
  disconnectAtMB: number
): Promise<{ receivedMB: number; disconnected: boolean; note: string }> {
  const downloadUrl = createInternalUrl(req, '/api/memory-lab/stream-proxy/download');
  downloadUrl.searchParams.set('mode', modeForRun);
  downloadUrl.searchParams.set('totalMB', String(totalMB));

  const disconnectAtBytes = disconnectAtMB * MB;

  return new Promise((resolve, reject) => {
    let receivedBytes = 0;
    let disconnected = false;
    let settled = false;

    const timeout = setTimeout(() => {
      complete('simulation-timeout');
      clientReq.destroy(new Error('simulation timeout'));
    }, 15_000);

    const complete = (note: string) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        receivedMB: Number((receivedBytes / MB).toFixed(2)),
        disconnected,
        note
      });
    };

    const clientReq = http.request(downloadUrl, { method: 'GET' }, (clientRes) => {
      clientRes.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length;

        if (!disconnected && receivedBytes >= disconnectAtBytes) {
          disconnected = true;
          clientRes.destroy(new Error('simulated client disconnect'));
          clientReq.destroy(new Error('simulated client disconnect'));
        }
      });

      clientRes.on('end', () => {
        complete('response-ended');
      });

      clientRes.on('close', () => {
        complete(disconnected ? 'client-disconnected' : 'response-closed');
      });

      clientRes.on('error', (error: Error) => {
        if (disconnected) {
          complete('client-disconnected');
          return;
        }

        reject(error);
      });
    });

    clientReq.on('error', (error: Error) => {
      if (disconnected) {
        complete('client-disconnected');
        return;
      }

      reject(error);
    });

    clientReq.end();
  });
}

/**
 * GET /api/memory-lab/request
 * 模拟业务请求：在 leak 模式下制造内存泄漏与周期性长尾抖动
 */
router.get('/request', (_req: Request, res: Response) => {
  const started = performance.now();
  requestCount += 1;

  generateYoungGenGarbage();

  if (mode === 'leak') {
    applyLeakPatterns(requestCount);
  } else {
    applyFixedPatterns(requestCount);
  }

  simulateMajorGcPauseIfNeeded();

  const durationMs = Number((performance.now() - started).toFixed(2));
  const longTail = durationMs >= 500;
  if (longTail) {
    longTailCount += 1;
  }

  pushLatency(durationMs);

  res.json({
    ok: true,
    mode,
    durationMs,
    longTail,
    requestId: requestCount
  });
});

/**
 * GET /api/memory-lab/metrics
 * 获取实验指标
 */
router.get('/metrics', (_req: Request, res: Response) => {
  res.json(getMetrics());
});

/**
 * POST /api/memory-lab/mode
 * 切换模式: leak | fixed
 */
router.post('/mode', (req: Request<{}, {}, ModeRequestBody>, res: Response) => {
  const targetMode = req.body?.mode;
  if (targetMode !== 'leak' && targetMode !== 'fixed') {
    res.status(400).json({ error: 'mode must be leak or fixed' });
    return;
  }

  mode = targetMode;

  if (mode === 'fixed') {
    clearLeakReferences();
    (globalThis as { gc?: () => void }).gc?.();
  }

  res.json({ ok: true, mode, metrics: getMetrics() });
});

/**
 * POST /api/memory-lab/reset
 * 重置统计并清空引用
 */
router.post('/reset', (_req: Request, res: Response) => {
  requestCount = 0;
  longTailCount = 0;
  simulatedMajorGcCount = 0;
  lastPauseCostMs = 0;
  lastPauseAt = 0;
  recentLatenciesMs.length = 0;
  clearLeakReferences();

  res.json({ ok: true, mode, metrics: getMetrics() });
});

/**
 * GET /api/memory-lab/stream-proxy/upstream-source
 * 内部上游源：模拟核心服务/OSS 输出超大 CSV
 */
router.get('/stream-proxy/upstream-source', (req: Request, res: Response) => {
  const sessionId = normalizeInt(req.query.sessionId, Date.now(), 1, Number.MAX_SAFE_INTEGER);
  const totalMB = normalizeInt(req.query.totalMB, SCENARIO_REPORT_MB, STREAM_MIN_TOTAL_MB, STREAM_MAX_TOTAL_MB);
  const totalBytes = totalMB * MB;

  const upstreamSession: UpstreamSession = {
    id: sessionId,
    totalBytes,
    sentBytes: 0,
    startedAt: Date.now(),
    lastWriteAt: Date.now()
  };
  activeUpstreamSessions.set(sessionId, upstreamSession);

  res.status(200);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="report-${sessionId}.csv"`);
  res.setHeader('X-Upstream-Session-Id', String(sessionId));

  let settled = false;
  const timeout = setTimeout(() => {
    upstreamTimeoutCount += 1;
    res.destroy(new Error('upstream stream timeout'));
  }, UPSTREAM_SESSION_TIMEOUT_MS);

  const finalize = (status: 'completed' | 'aborted') => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeout);
    activeUpstreamSessions.delete(sessionId);

    if (status === 'completed') {
      upstreamCompletedCount += 1;
    } else {
      upstreamAbortedCount += 1;
    }
  };

  const pump = () => {
    if (settled) {
      return;
    }

    let produced = 0;

    while (upstreamSession.sentBytes < totalBytes && produced < 48) {
      const remaining = totalBytes - upstreamSession.sentBytes;
      const chunk = remaining >= CSV_CHUNK.length ? CSV_CHUNK : CSV_CHUNK.subarray(0, remaining);

      const canContinue = res.write(chunk);
      upstreamSession.sentBytes += chunk.length;
      upstreamSession.lastWriteAt = Date.now();
      produced += 1;

      if (!canContinue) {
        res.once('drain', pump);
        return;
      }
    }

    if (upstreamSession.sentBytes >= totalBytes) {
      res.end();
      return;
    }

    setImmediate(pump);
  };

  req.on('aborted', () => {
    finalize('aborted');
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      finalize('aborted');
    }
  });

  res.on('finish', () => {
    finalize('completed');
  });

  setImmediate(pump);
});

/**
 * GET /api/memory-lab/stream-proxy/download
 * 代理下载：pipe(故障版) / pipeline(修复版)
 */
router.get('/stream-proxy/download', (req: Request, res: Response) => {
  const modeParam = getQueryScalar(req.query.mode);
  const modeForRequest: StreamProxyMode = modeParam === 'pipeline'
    ? 'pipeline'
    : modeParam === 'pipe'
      ? 'pipe'
      : streamProxyMode;

  const totalMB = normalizeInt(req.query.totalMB, SCENARIO_REPORT_MB, STREAM_MIN_TOTAL_MB, STREAM_MAX_TOTAL_MB);

  streamProxyRequestCount += 1;
  const sessionId = streamProxyRequestCount;

  const session: StreamProxySession = {
    id: sessionId,
    mode: modeForRequest,
    totalMB,
    startedAt: Date.now(),
    clientDisconnected: false,
    upstreamAborted: false,
    settled: false
  };
  activeProxySessions.set(sessionId, session);

  let upstreamRes: IncomingMessage | null = null;

  const finalize = (status: 'completed' | 'errored' | 'client-disconnect') => {
    if (session.settled) {
      return;
    }

    session.settled = true;
    activeProxySessions.delete(sessionId);

    if (status === 'completed') {
      streamProxyCompletedCount += 1;
    }

    if (status === 'errored') {
      streamProxyErrorCount += 1;
    }
  };

  const upstreamUrl = createInternalUrl(req, '/api/memory-lab/stream-proxy/upstream-source');
  upstreamUrl.searchParams.set('sessionId', String(sessionId));
  upstreamUrl.searchParams.set('totalMB', String(totalMB));

  const upstreamReq = http.request(upstreamUrl, { method: 'GET' });

  const abortUpstream = (reason: string) => {
    if (session.upstreamAborted) {
      return;
    }

    session.upstreamAborted = true;
    streamProxyUpstreamAbortCount += 1;
    upstreamReq.destroy(new Error(reason));
    upstreamRes?.destroy(new Error(reason));
  };
  session.abortUpstream = abortUpstream;

  const markClientDisconnect = () => {
    if (session.clientDisconnected) {
      return;
    }

    session.clientDisconnected = true;
    streamProxyClientDisconnectCount += 1;

    if (modeForRequest === 'pipeline') {
      abortUpstream('client disconnected');
    } else {
      streamProxyLeakRiskCount += 1;
    }
  };

  req.on('aborted', () => {
    markClientDisconnect();
    finalize('client-disconnect');
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      markClientDisconnect();
      finalize('client-disconnect');
    }
  });

  res.on('finish', () => {
    finalize('completed');
  });

  upstreamReq.on('response', (response: IncomingMessage) => {
    upstreamRes = response;

    res.status(response.statusCode ?? 200);
    res.setHeader('Content-Type', response.headers['content-type'] ?? 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', response.headers['content-disposition'] ?? `attachment; filename="report-${sessionId}.csv"`);
    res.setHeader('X-Proxy-Mode', modeForRequest);
    res.setHeader('X-Proxy-Session-Id', String(sessionId));

    if (typeof response.headers['content-length'] === 'string') {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    if (modeForRequest === 'pipeline') {
      pipeline(response, res, (error) => {
        if (error) {
          finalize(session.clientDisconnected ? 'client-disconnect' : 'errored');
          return;
        }

        finalize('completed');
      });
      return;
    }

    // 演示错误写法: client 断连时不主动销毁 upstream request。
    response.pipe(res);

    response.on('error', (error: Error) => {
      if (!session.clientDisconnected) {
        finalize('errored');
      }

      if (!res.headersSent && !res.writableEnded) {
        res.status(502).json({ error: 'upstream response error', detail: error.message });
        return;
      }

      if (!res.writableEnded) {
        res.destroy(error);
      }
    });

    response.on('end', () => {
      if (!session.clientDisconnected) {
        finalize('completed');
      }
    });
  });

  upstreamReq.on('error', (error: Error) => {
    if (session.clientDisconnected || session.upstreamAborted) {
      finalize('client-disconnect');
      return;
    }

    finalize('errored');

    if (!res.headersSent) {
      res.status(502).json({ error: 'upstream request failed', detail: error.message });
      return;
    }

    if (!res.writableEnded) {
      res.destroy(error);
    }
  });

  upstreamReq.end();
});

/**
 * GET /api/memory-lab/stream-proxy/metrics
 * 获取 stream proxy 实验指标
 */
router.get('/stream-proxy/metrics', (_req: Request, res: Response) => {
  res.json(getStreamProxyMetrics());
});

/**
 * POST /api/memory-lab/stream-proxy/mode
 * 切换 stream proxy 模式: pipe | pipeline
 */
router.post('/stream-proxy/mode', (req: Request<{}, {}, StreamProxyModeBody>, res: Response) => {
  const targetMode = req.body?.mode;
  if (targetMode !== 'pipe' && targetMode !== 'pipeline') {
    res.status(400).json({ error: 'mode must be pipe or pipeline' });
    return;
  }

  streamProxyMode = targetMode;
  res.json({ ok: true, mode: streamProxyMode, metrics: getStreamProxyMetrics() });
});

/**
 * POST /api/memory-lab/stream-proxy/reset
 * 重置 stream proxy 实验指标并终止活动会话
 */
router.post('/stream-proxy/reset', (_req: Request, res: Response) => {
  for (const session of activeProxySessions.values()) {
    session.abortUpstream?.('manual reset');
  }

  activeProxySessions.clear();
  activeUpstreamSessions.clear();

  streamProxyRequestCount = 0;
  streamProxyCompletedCount = 0;
  streamProxyErrorCount = 0;
  streamProxyClientDisconnectCount = 0;
  streamProxyUpstreamAbortCount = 0;
  streamProxyLeakRiskCount = 0;
  streamProxySimulationCount = 0;

  upstreamCompletedCount = 0;
  upstreamAbortedCount = 0;
  upstreamTimeoutCount = 0;

  res.json({ ok: true, mode: streamProxyMode, metrics: getStreamProxyMetrics() });
});

/**
 * POST /api/memory-lab/stream-proxy/simulate-client-disconnect
 * 自动模拟客户端在传输途中断开，便于对比 pipe/pipeline 的行为差异
 */
router.post('/stream-proxy/simulate-client-disconnect', async (req: Request<{}, {}, StreamProxySimulateBody>, res: Response) => {
  const modeInput = req.body?.mode;
  const modeForRun: StreamProxyMode = modeInput === 'pipe' || modeInput === 'pipeline'
    ? modeInput
    : streamProxyMode;

  const totalMB = normalizeInt(req.body?.totalMB, SIM_DEFAULT_TOTAL_MB, STREAM_MIN_TOTAL_MB, STREAM_MAX_TOTAL_MB);
  const disconnectUpperBound = Math.max(1, totalMB - 1);
  const disconnectAtMB = normalizeInt(req.body?.disconnectAtMB, SIM_DEFAULT_DISCONNECT_MB, 1, disconnectUpperBound);

  const before = getStreamProxyMetrics();

  try {
    streamProxySimulationCount += 1;
    const result = await runDisconnectSimulation(req, modeForRun, totalMB, disconnectAtMB);
    await delay(250);
    const after = getStreamProxyMetrics();

    res.json({
      ok: true,
      simulation: {
        mode: modeForRun,
        totalMB,
        disconnectAtMB,
        receivedMB: result.receivedMB,
        disconnected: result.disconnected,
        note: result.note
      },
      before,
      after
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'simulate client disconnect failed',
      detail: (error as Error).message,
      metrics: getStreamProxyMetrics()
    });
  }
});

export default router;
