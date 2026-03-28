import express, { Request, Response, Router } from 'express';
import { monitorEventLoopDelay, performance } from 'perf_hooks';

type RunMode = 'naive' | 'controlled';

interface StartBody {
  mode?: RunMode;
  totalUsers?: number;
  concurrency?: number;
  nextTickAbuse?: boolean;
}

interface MockUser {
  id: number;
  email: string;
  phone: string;
  tags: string[];
  profileBlob: string;
}

interface RuntimeState {
  runId: number;
  mode: RunMode;
  running: boolean;
  totalUsers: number;
  concurrency: number;
  processed: number;
  succeeded: number;
  failed: number;
  inFlight: number;
  peakInFlight: number;
  startedAt: number;
  endedAt: number | null;
  nextTickAbuse: boolean;
  lastError: string | null;
}

const router: Router = express.Router();
const MB = 1024 * 1024;
const MAX_WINDOW = 64;
const MAX_TOTAL_USERS = 120_000;

const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();

const latencySamplesMs: number[] = [];
const heapTrendMB: number[] = [];
const lagTrendMs: number[] = [];
const inFlightTrend: number[] = [];

let activeController: AbortController | null = null;

const state: RuntimeState = {
  runId: 0,
  mode: 'controlled',
  running: false,
  totalUsers: 20_000,
  concurrency: 120,
  processed: 0,
  succeeded: 0,
  failed: 0,
  inFlight: 0,
  peakInFlight: 0,
  startedAt: 0,
  endedAt: null,
  nextTickAbuse: false,
  lastError: null
};

function appendWindow(list: number[], value: number): void {
  list.push(value);
  if (list.length > MAX_WINDOW) {
    list.shift();
  }
}

function pushLatency(valueMs: number): void {
  latencySamplesMs.push(valueMs);
  if (latencySamplesMs.length > 1200) {
    latencySamplesMs.shift();
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return Number(sorted[idx].toFixed(2));
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((acc, item) => acc + item, 0);
  return Number((total / values.length).toFixed(2));
}

function resetMeasurements(): void {
  latencySamplesMs.length = 0;
  heapTrendMB.length = 0;
  lagTrendMs.length = 0;
  inFlightTrend.length = 0;
}

function resetRuntime(keepMode = true): void {
  state.running = false;
  if (!keepMode) {
    state.mode = 'controlled';
  }
  state.totalUsers = 20_000;
  state.concurrency = 120;
  state.processed = 0;
  state.succeeded = 0;
  state.failed = 0;
  state.inFlight = 0;
  state.peakInFlight = 0;
  state.startedAt = 0;
  state.endedAt = null;
  state.nextTickAbuse = false;
  state.lastError = null;
  resetMeasurements();
}

function getDurationMs(): number {
  if (!state.startedAt) {
    return 0;
  }

  if (state.running) {
    return Date.now() - state.startedAt;
  }

  if (state.endedAt) {
    return state.endedAt - state.startedAt;
  }

  return 0;
}

function getMetrics() {
  const mem = process.memoryUsage();
  const eventLoopLagP99Ms = Number((eventLoopDelay.percentile(99) / 1e6).toFixed(2));
  const eventLoopLagMeanMs = Number((eventLoopDelay.mean / 1e6).toFixed(2));

  appendWindow(heapTrendMB, Number((mem.heapUsed / MB).toFixed(2)));
  appendWindow(lagTrendMs, eventLoopLagP99Ms);
  appendWindow(inFlightTrend, state.inFlight);
  eventLoopDelay.reset();

  const progress = state.totalUsers > 0
    ? Number(((state.processed / state.totalUsers) * 100).toFixed(2))
    : 0;

  return {
    runId: state.runId,
    mode: state.mode,
    running: state.running,
    config: {
      totalUsers: state.totalUsers,
      concurrency: state.concurrency,
      nextTickAbuse: state.nextTickAbuse
    },
    counters: {
      processed: state.processed,
      succeeded: state.succeeded,
      failed: state.failed,
      progress,
      inFlight: state.inFlight,
      peakInFlight: state.peakInFlight
    },
    timing: {
      durationMs: getDurationMs(),
      apiLatencyP99Ms: percentile(latencySamplesMs, 0.99),
      apiLatencyP95Ms: percentile(latencySamplesMs, 0.95),
      apiLatencyMeanMs: mean(latencySamplesMs),
      eventLoopLagP99Ms,
      eventLoopLagMeanMs
    },
    memoryMB: {
      rss: Number((mem.rss / MB).toFixed(2)),
      heapUsed: Number((mem.heapUsed / MB).toFixed(2)),
      heapTotal: Number((mem.heapTotal / MB).toFixed(2)),
      external: Number((mem.external / MB).toFixed(2)),
      arrayBuffers: Number((mem.arrayBuffers / MB).toFixed(2))
    },
    trends: {
      heapMB: [...heapTrendMB],
      lagMs: [...lagTrendMs],
      inFlight: [...inFlightTrend]
    },
    lastError: state.lastError,
    updatedAt: new Date().toISOString()
  };
}

function buildMockUser(id: number): MockUser {
  const base = `u-${id}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    email: `${base}@example.com`,
    phone: `13${String(10_000_000 + (id % 90_000_000)).padStart(8, '0')}`,
    tags: Array.from({ length: 6 }, (_, idx) => `${base}-t${idx}`),
    profileBlob: `${base}:`.repeat(30)
  };
}

function transformUser(user: MockUser) {
  return {
    uid: user.id,
    contact: {
      email: user.email.toLowerCase(),
      phone: user.phone
    },
    attrs: user.tags.join('|'),
    payload: {
      // 模拟真实业务中的格式转换结果体积
      body: `${user.profileBlob}${user.profileBlob}`,
      ts: Date.now()
    }
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, { once: true });
  });
}

async function fakeThirdPartyApiCall(currentInFlight: number, signal: AbortSignal): Promise<void> {
  const base = 18 + Math.random() * 28;
  const queuePenalty = Math.max(0, currentInFlight - 120) * 0.35;
  const jitter = Math.random() * 10;
  const delayMs = Math.min(900, base + queuePenalty + jitter);

  await sleep(delayMs, signal);

  const failRate = currentInFlight > 650
    ? 0.16
    : currentInFlight > 320
      ? 0.07
      : 0.015;

  if (Math.random() < failRate) {
    throw new Error('third-party 429/timeout');
  }
}

function nextTickFlood(count: number): void {
  let remaining = count;

  const run = () => {
    remaining -= 1;
    if (remaining > 0) {
      process.nextTick(run);
    }
  };

  process.nextTick(run);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function processOneUser(user: MockUser, signal: AbortSignal): Promise<void> {
  const transformed = transformUser(user);
  const started = performance.now();
  state.inFlight += 1;
  state.peakInFlight = Math.max(state.peakInFlight, state.inFlight);

  try {
    await fakeThirdPartyApiCall(state.inFlight, signal);
    if (!signal.aborted) {
      state.succeeded += 1;
    }
  } catch (error) {
    if (!signal.aborted) {
      state.failed += 1;
      state.lastError = (error as Error).message;
    }
  } finally {
    const durationMs = performance.now() - started;
    pushLatency(durationMs);

    state.inFlight = Math.max(0, state.inFlight - 1);
    if (!signal.aborted) {
      state.processed += 1;
    }

    if (transformed.uid < 0) {
      console.log('never');
    }
  }
}

async function runNaive(totalUsers: number, signal: AbortSignal, nextTickAbuse: boolean): Promise<void> {
  const users = Array.from({ length: totalUsers }, (_, idx) => buildMockUser(idx + 1));

  if (nextTickAbuse) {
    // 滥用 nextTick 会优先清空微任务队列，导致 I/O 阶段被推迟
    nextTickFlood(30_000);
  }

  const promises = users.map((user) => processOneUser(user, signal));
  await Promise.allSettled(promises);
}

async function runWithConcurrency(totalUsers: number, concurrency: number, signal: AbortSignal): Promise<void> {
  let cursor = 0;

  const worker = async () => {
    while (!signal.aborted) {
      const current = cursor;
      cursor += 1;

      if (current >= totalUsers) {
        return;
      }

      const user = buildMockUser(current + 1);
      await processOneUser(user, signal);

      if ((current + 1) % 80 === 0) {
        await yieldToEventLoop();
      }
    }
  };

  const size = Math.max(1, Math.min(concurrency, 800));
  const workers = Array.from({ length: size }, () => worker());
  await Promise.allSettled(workers);
}

function normalizeStartBody(body: StartBody) {
  const mode: RunMode = body.mode === 'naive' ? 'naive' : 'controlled';

  const total = typeof body.totalUsers === 'number' ? Math.trunc(body.totalUsers) : 20_000;
  const totalUsers = Math.min(MAX_TOTAL_USERS, Math.max(1_000, total));

  const rawConcurrency = typeof body.concurrency === 'number' ? Math.trunc(body.concurrency) : 120;
  const concurrency = Math.min(800, Math.max(1, rawConcurrency));

  const nextTickAbuse = Boolean(body.nextTickAbuse);

  return {
    mode,
    totalUsers,
    concurrency,
    nextTickAbuse
  };
}

function finalizeRun(): void {
  state.running = false;
  state.endedAt = Date.now();
  activeController = null;
}

/**
 * POST /api/concurrency-lab/start
 * 启动实验：naive(错误实现) / controlled(修复实现)
 */
router.post('/start', (req: Request<{}, {}, StartBody>, res: Response) => {
  if (state.running) {
    res.status(409).json({ error: 'A run is already in progress', metrics: getMetrics() });
    return;
  }

  const options = normalizeStartBody(req.body ?? {});

  state.runId += 1;
  state.mode = options.mode;
  state.totalUsers = options.totalUsers;
  state.concurrency = options.concurrency;
  state.nextTickAbuse = options.nextTickAbuse;
  state.processed = 0;
  state.succeeded = 0;
  state.failed = 0;
  state.inFlight = 0;
  state.peakInFlight = 0;
  state.startedAt = Date.now();
  state.endedAt = null;
  state.lastError = null;
  state.running = true;
  resetMeasurements();

  const controller = new AbortController();
  activeController = controller;

  void (async () => {
    try {
      if (options.mode === 'naive') {
        await runNaive(options.totalUsers, controller.signal, options.nextTickAbuse);
      } else {
        await runWithConcurrency(options.totalUsers, options.concurrency, controller.signal);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        state.lastError = (error as Error).message;
      }
    } finally {
      finalizeRun();
    }
  })();

  res.json({ ok: true, runId: state.runId, metrics: getMetrics() });
});

/**
 * POST /api/concurrency-lab/stop
 * 中断当前实验
 */
router.post('/stop', (_req: Request, res: Response) => {
  if (activeController) {
    activeController.abort();
  }
  finalizeRun();

  res.json({ ok: true, metrics: getMetrics() });
});

/**
 * POST /api/concurrency-lab/reset
 * 重置计数器与趋势数据
 */
router.post('/reset', (_req: Request, res: Response) => {
  if (activeController) {
    activeController.abort();
  }

  resetRuntime(true);
  res.json({ ok: true, metrics: getMetrics() });
});

/**
 * GET /api/concurrency-lab/metrics
 * 获取实验运行状态
 */
router.get('/metrics', (_req: Request, res: Response) => {
  res.json(getMetrics());
});

/**
 * GET /api/concurrency-lab/event-loop-order
 * nextTick / Promise / setImmediate / setTimeout 的顺序示意
 */
router.get('/event-loop-order', async (_req: Request, res: Response) => {
  const order: string[] = [];

  process.nextTick(() => order.push('process.nextTick'));
  Promise.resolve().then(() => order.push('Promise.then (microtask)'));
  setTimeout(() => order.push('setTimeout(0) [timers phase]'), 0);
  setImmediate(() => order.push('setImmediate [check phase]'));

  await new Promise<void>((resolve) => setTimeout(resolve, 5));

  res.json({
    order,
    note: '在不同触发上下文下 setTimeout(0) 与 setImmediate 的先后可能不同，但 nextTick 总是优先于事件循环阶段。'
  });
});

export default router;
