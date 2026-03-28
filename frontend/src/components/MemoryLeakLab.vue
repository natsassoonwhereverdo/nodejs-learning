<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  getMemoryMetrics,
  hitMemoryRequest,
  resetMemoryLab,
  setMemoryMode,
  type MemoryLabMetrics,
  type MemoryLabMode
} from '../api/memoryLab';

const metrics = ref<MemoryLabMetrics | null>(null);
const error = ref<string | null>(null);
const isPressureRunning = ref(false);
const isSwitchingMode = ref(false);

const burstSize = ref(8);
const pressureIntervalMs = ref(320);

const heapTrend = ref<number[]>([]);
const p99Trend = ref<number[]>([]);
const latencyTrend = ref<number[]>([]);

let pressureTimer: number | null = null;
let metricsTimer: number | null = null;
let burstLock = false;

function appendWindow(arr: number[], value: number, max = 42): void {
  arr.push(value);
  if (arr.length > max) {
    arr.shift();
  }
}

function calcP99(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.99) - 1);
  return Number(sorted[idx].toFixed(2));
}

const modeText = computed(() => {
  if (!metrics.value) return '加载中';
  return metrics.value.mode === 'leak' ? 'Leak 模式（故障复现）' : 'Fixed 模式（修复已生效）';
});

const localP99 = computed(() => calcP99(latencyTrend.value));
const maxHeap = computed(() => Math.max(...heapTrend.value, 1));
const maxP99 = computed(() => Math.max(...p99Trend.value, 1));

async function refreshMetrics(): Promise<void> {
  try {
    const next = await getMemoryMetrics();
    metrics.value = next;
    appendWindow(heapTrend.value, next.memoryMB.heapUsed);
    appendWindow(p99Trend.value, next.stats.recentP99Ms);
  } catch (e: any) {
    error.value = e.message || '拉取指标失败';
  }
}

async function runBurst(): Promise<void> {
  if (burstLock) {
    return;
  }
  burstLock = true;

  try {
    const tasks = Array.from({ length: burstSize.value }, () => hitMemoryRequest());
    const settled = await Promise.allSettled(tasks);

    for (const item of settled) {
      if (item.status === 'fulfilled') {
        appendWindow(latencyTrend.value, item.value.durationMs, 140);
      } else {
        const reason = item.reason as Error;
        error.value = reason.message || '压测请求失败';
      }
    }

    await refreshMetrics();
  } finally {
    burstLock = false;
  }
}

function stopPressure(): void {
  if (pressureTimer) {
    clearInterval(pressureTimer);
    pressureTimer = null;
  }
  isPressureRunning.value = false;
}

function startPressure(): void {
  if (isPressureRunning.value) {
    return;
  }

  isPressureRunning.value = true;
  void runBurst();

  pressureTimer = window.setInterval(() => {
    void runBurst();
  }, pressureIntervalMs.value);
}

async function switchMode(nextMode: MemoryLabMode): Promise<void> {
  isSwitchingMode.value = true;
  error.value = null;

  try {
    stopPressure();
    metrics.value = await setMemoryMode(nextMode);
    appendWindow(heapTrend.value, metrics.value.memoryMB.heapUsed);
    appendWindow(p99Trend.value, metrics.value.stats.recentP99Ms);
  } catch (e: any) {
    error.value = e.message || '切换模式失败';
  } finally {
    isSwitchingMode.value = false;
  }
}

async function resetLab(): Promise<void> {
  stopPressure();
  error.value = null;

  try {
    metrics.value = await resetMemoryLab();
    heapTrend.value = [];
    p99Trend.value = [];
    latencyTrend.value = [];
    appendWindow(heapTrend.value, metrics.value.memoryMB.heapUsed);
    appendWindow(p99Trend.value, metrics.value.stats.recentP99Ms);
  } catch (e: any) {
    error.value = e.message || '重置失败';
  }
}

watch(pressureIntervalMs, () => {
  if (isPressureRunning.value) {
    stopPressure();
    startPressure();
  }
});

onMounted(() => {
  void refreshMetrics();
  metricsTimer = window.setInterval(() => {
    void refreshMetrics();
  }, 1200);
});

onUnmounted(() => {
  stopPressure();
  if (metricsTimer) {
    clearInterval(metricsTimer);
  }
});
</script>

<template>
  <div class="memory-lab">
    <header class="hero">
      <p class="eyebrow">Node.js Memory Leak Lab</p>
      <h2>第二题：内存泄漏排查与 V8 垃圾回收机制</h2>
      <p class="desc">
        这个实验页会先复现“内存阶梯式上涨 + P99 周期性剧烈抖动”，再通过按钮切换到修复方案。
        建议先点“复现泄漏”，再点“开始压测”。
      </p>
      <div class="mode-chip" :class="metrics?.mode === 'leak' ? 'danger' : 'safe'">
        当前模式：{{ modeText }}
      </div>
    </header>

    <section class="controls">
      <button class="btn danger" :disabled="isSwitchingMode" @click="switchMode('leak')">复现泄漏</button>
      <button class="btn safe" :disabled="isSwitchingMode" @click="switchMode('fixed')">一键修复</button>
      <button class="btn ghost" :disabled="isPressureRunning" @click="startPressure">开始压测</button>
      <button class="btn ghost" :disabled="!isPressureRunning" @click="stopPressure">停止压测</button>
      <button class="btn ghost" @click="runBurst">手动打一轮请求</button>
      <button class="btn ghost" @click="resetLab">重置统计</button>
    </section>

    <section class="pressure-config">
      <label>
        每轮并发请求数
        <input v-model.number="burstSize" type="number" min="1" max="20" />
      </label>
      <label>
        压测间隔 (ms)
        <input v-model.number="pressureIntervalMs" type="number" min="120" max="2000" step="20" />
      </label>
      <div class="hint">本地观察建议：并发 6-12、间隔 250-500ms。</div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="metrics" class="cards">
      <article class="card">
        <h3>Heap Used</h3>
        <p class="value">{{ metrics.memoryMB.heapUsed.toFixed(2) }} MB</p>
        <p class="meta">RSS: {{ metrics.memoryMB.rss.toFixed(2) }} MB</p>
      </article>
      <article class="card">
        <h3>请求统计</h3>
        <p class="value">{{ metrics.stats.requestCount }}</p>
        <p class="meta">长尾: {{ metrics.stats.longTailCount }} ({{ (metrics.stats.longTailRatio * 100).toFixed(2) }}%)</p>
      </article>
      <article class="card">
        <h3>P99</h3>
        <p class="value">{{ metrics.stats.recentP99Ms.toFixed(2) }} ms</p>
        <p class="meta">前端窗口 P99: {{ localP99.toFixed(2) }} ms</p>
      </article>
      <article class="card">
        <h3>泄漏引用</h3>
        <p class="value">{{ metrics.refs.cacheEntries }}</p>
        <p class="meta">监听器: {{ metrics.refs.listeners }} / 定时器: {{ metrics.refs.danglingTimers }}</p>
      </article>
    </section>

    <section class="trends">
      <div class="trend-card">
        <h3>Heap 趋势（阶梯上涨）</h3>
        <div class="sparkline">
          <div
            v-for="(n, idx) in heapTrend"
            :key="`heap-${idx}`"
            class="bar heap"
            :style="{ height: `${Math.max(6, (n / maxHeap) * 100)}%` }"
            :title="`${n.toFixed(2)} MB`"
          ></div>
        </div>
      </div>
      <div class="trend-card">
        <h3>P99 趋势（周期抖动）</h3>
        <div class="sparkline">
          <div
            v-for="(n, idx) in p99Trend"
            :key="`p99-${idx}`"
            class="bar p99"
            :style="{ height: `${Math.max(4, (n / maxP99) * 100)}%` }"
            :title="`${n.toFixed(2)} ms`"
          ></div>
        </div>
      </div>
    </section>

    <section class="qa">
      <h3>逐一问答</h3>

      <article class="qa-item">
        <h4>Q1：为什么会出现“周期性的剧烈抖动”？</h4>
        <p>
          V8 的内存分代回收机制里，新生代对象会被频繁 Minor GC（Scavenge）回收，停顿通常较短。
          但泄漏导致对象被长期引用并晋升到老生代，老生代不断膨胀后会触发 Major GC（Mark-Sweep / Mark-Compact）。
          Major GC 在关键阶段需要 Stop-The-World，Node.js 主线程会暂停处理请求，所以你会看到每隔几分钟出现一次长尾尖刺。
        </p>
        <p>
          本实验在泄漏模式下，持续制造“缓存不清 + 监听器不释放 + 定时器不销毁”的老生代引用，并在高堆占用时模拟 Full GC 暂停，
          所以会出现和线上告警一致的“周期抖动”。
        </p>
      </article>

      <article class="qa-item">
        <h4>Q2：生产环境如何定位并修复？</h4>
        <p>
          推荐链路：先用监控定位，再用采样与快照定点，最后做灰度验证。
          典型工具组合包括：Prometheus/Grafana（heap、rss、GC pause、P99）、Node `--trace-gc`、`clinic doctor/flame`、
          `heapdump` 或 DevTools Heap Snapshot、`pprof` / `0x`。
        </p>
        <p>
          实战步骤：1) 对齐“内存上涨时间窗”和“P99 抖动时间窗”；2) 抓 GC 日志确认是否频繁 Major GC；
          3) 在高峰前后各抓一份 heap snapshot 做 diff，找 retained size 最大且持续增长的引用链；
          4) 回到代码修复引用生命周期（有界缓存、removeListener、clearInterval 等）；
          5) 灰度发布并观察 heap 曲线是否回落、P99 是否恢复。
        </p>
      </article>

      <article class="qa-item">
        <h4>Q3：Node.js 常见内存泄漏反模式（3 种）</h4>
        <ul>
          <li>不受控缓存：`Map/Object` 只增不删，没有 TTL/LRU。</li>
          <li>事件监听器泄漏：重复 `on` 但不 `off/removeListener`。</li>
          <li>定时器泄漏：`setInterval` 持有闭包大对象且不 `clearInterval`。</li>
        </ul>
        <p>
          这个示例后端把三种反模式都内置到了 leak 模式，点击“一键修复”会切换到 fixed 模式并清空引用。
        </p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.memory-lab {
  padding: 1.2rem 1.2rem 1.8rem;
  color: #e8ecf1;
  background:
    radial-gradient(circle at 90% -10%, rgba(232, 84, 32, 0.16), transparent 45%),
    radial-gradient(circle at 0% 130%, rgba(45, 104, 255, 0.15), transparent 50%),
    #0b101c;
}

.hero {
  margin-bottom: 1rem;
}

.eyebrow {
  margin: 0 0 0.3rem;
  color: #f9ad84;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero h2 {
  margin: 0;
  font-size: 1.3rem;
  letter-spacing: -0.02em;
}

.desc {
  margin: 0.6rem 0 0;
  color: #9db0c8;
  line-height: 1.65;
  max-width: 70ch;
}

.mode-chip {
  display: inline-flex;
  margin-top: 0.8rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.mode-chip.danger {
  background: rgba(239, 68, 68, 0.14);
  color: #fecaca;
  border-color: rgba(239, 68, 68, 0.45);
}

.mode-chip.safe {
  background: rgba(16, 185, 129, 0.14);
  color: #bbf7d0;
  border-color: rgba(16, 185, 129, 0.45);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 0.85rem;
}

.btn {
  border: 1px solid #2d3950;
  background: #141d2f;
  color: #f7f9fb;
  border-radius: 9px;
  padding: 0.5rem 0.82rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn.danger {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  border-color: transparent;
}

.btn.safe {
  background: linear-gradient(135deg, #0891b2, #22c55e);
  border-color: transparent;
}

.btn.ghost {
  background: #121928;
}

.pressure-config {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.7rem;
  margin-bottom: 0.95rem;
  align-items: end;
}

.pressure-config label {
  font-size: 0.76rem;
  color: #9db0c8;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.pressure-config input {
  background: #11192a;
  border: 1px solid #2b3850;
  border-radius: 8px;
  color: #e8ecf1;
  padding: 0.45rem 0.6rem;
}

.hint {
  color: #8195ae;
  font-size: 0.75rem;
}

.error {
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  color: #fecaca;
  background: rgba(127, 29, 29, 0.55);
  border: 1px solid rgba(239, 68, 68, 0.35);
  margin-bottom: 0.9rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.7rem;
  margin-bottom: 1rem;
}

.card {
  background: rgba(15, 22, 36, 0.9);
  border: 1px solid #243147;
  border-radius: 12px;
  padding: 0.85rem 0.9rem;
}

.card h3 {
  margin: 0;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8ea5c1;
}

.value {
  margin: 0.45rem 0 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f3f6fb;
  font-variant-numeric: tabular-nums;
}

.meta {
  margin: 0.3rem 0 0;
  color: #8ea5c1;
  font-size: 0.78rem;
}

.trends {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.15rem;
}

.trend-card {
  border: 1px solid #243147;
  background: rgba(9, 14, 25, 0.92);
  border-radius: 12px;
  padding: 0.8rem 0.85rem;
}

.trend-card h3 {
  margin: 0 0 0.7rem;
  font-size: 0.82rem;
  color: #ced9e9;
}

.sparkline {
  height: 86px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(4px, 1fr);
  align-items: end;
  gap: 2px;
}

.bar {
  border-radius: 2px 2px 0 0;
  min-height: 3px;
}

.bar.heap {
  background: linear-gradient(180deg, #f97316, #ef4444);
}

.bar.p99 {
  background: linear-gradient(180deg, #38bdf8, #0ea5e9);
}

.qa {
  border: 1px solid #243147;
  background: rgba(8, 12, 22, 0.95);
  border-radius: 12px;
  padding: 0.95rem;
}

.qa h3 {
  margin: 0 0 0.6rem;
  font-size: 1rem;
}

.qa-item + .qa-item {
  margin-top: 0.9rem;
  padding-top: 0.9rem;
  border-top: 1px dashed #2a3952;
}

.qa-item h4 {
  margin: 0;
  font-size: 0.92rem;
  color: #f3f6fb;
}

.qa-item p {
  margin: 0.5rem 0 0;
  line-height: 1.7;
  color: #a9bdd7;
  font-size: 0.84rem;
}

.qa-item ul {
  margin: 0.5rem 0 0;
  padding-left: 1rem;
  color: #a9bdd7;
}

.qa-item li + li {
  margin-top: 0.3rem;
}

@media (max-width: 780px) {
  .memory-lab {
    padding: 1rem 0.9rem 1.2rem;
  }

  .controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .btn {
    width: 100%;
  }
}
</style>
