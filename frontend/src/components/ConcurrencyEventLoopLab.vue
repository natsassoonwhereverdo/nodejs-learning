<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  getConcurrencyMetrics,
  getEventLoopOrder,
  resetConcurrencyLab,
  startConcurrencyRun,
  stopConcurrencyRun,
  type ConcurrencyMetrics,
  type EventLoopOrderResult
} from '../api/concurrencyLab';

const metrics = ref<ConcurrencyMetrics | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);

const totalUsers = ref(20000);
const controlledConcurrency = ref(120);
const nextTickAbuse = ref(false);

const orderDemo = ref<EventLoopOrderResult | null>(null);

let timer: number | null = null;

const modeText = computed(() => {
  if (!metrics.value) return '未启动';
  if (metrics.value.mode === 'naive') return '错误实现：Promise.all 全量并发';
  return '修复实现：受控并发 + 主动让出事件循环';
});

const progressText = computed(() => {
  if (!metrics.value) return '0%';
  return `${metrics.value.counters.progress.toFixed(2)}%`;
});

const maxHeap = computed(() => {
  if (!metrics.value || metrics.value.trends.heapMB.length === 0) return 1;
  return Math.max(...metrics.value.trends.heapMB, 1);
});

const maxLag = computed(() => {
  if (!metrics.value || metrics.value.trends.lagMs.length === 0) return 1;
  return Math.max(...metrics.value.trends.lagMs, 1);
});

const maxInFlight = computed(() => {
  if (!metrics.value || metrics.value.trends.inFlight.length === 0) return 1;
  return Math.max(...metrics.value.trends.inFlight, 1);
});

async function refreshMetrics(): Promise<void> {
  try {
    metrics.value = await getConcurrencyMetrics();
  } catch (e: any) {
    error.value = e.message || '拉取指标失败';
  }
}

async function loadOrderDemo(): Promise<void> {
  try {
    orderDemo.value = await getEventLoopOrder();
  } catch (e: any) {
    error.value = e.message || '读取事件循环顺序失败';
  }
}

async function startNaiveRun(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    metrics.value = await startConcurrencyRun({
      mode: 'naive',
      totalUsers: totalUsers.value,
      concurrency: totalUsers.value,
      nextTickAbuse: nextTickAbuse.value
    });
  } catch (e: any) {
    error.value = e.message || '启动错误实现失败';
  } finally {
    loading.value = false;
  }
}

async function startControlledRun(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    metrics.value = await startConcurrencyRun({
      mode: 'controlled',
      totalUsers: totalUsers.value,
      concurrency: controlledConcurrency.value,
      nextTickAbuse: false
    });
  } catch (e: any) {
    error.value = e.message || '启动修复实现失败';
  } finally {
    loading.value = false;
  }
}

async function stopRun(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    metrics.value = await stopConcurrencyRun();
  } catch (e: any) {
    error.value = e.message || '停止任务失败';
  } finally {
    loading.value = false;
  }
}

async function resetRun(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    metrics.value = await resetConcurrencyLab();
  } catch (e: any) {
    error.value = e.message || '重置失败';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refreshMetrics();
  void loadOrderDemo();

  timer = window.setInterval(() => {
    void refreshMetrics();
  }, 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<template>
  <div class="concurrency-lab">
    <header class="hero">
      <p class="eyebrow">Node.js Concurrency Lab</p>
      <h2>第三题：高并发任务调度与 Event Loop</h2>
      <p class="desc">
        这个实验复现错误写法 `Promise.all(users.map(send))` 的风险，再切换到“受控并发”的修复方案。
        你可以看到 in-flight、内存、Event Loop lag 与 P99 的变化。
      </p>
      <div class="mode-chip" :class="metrics?.mode === 'naive' ? 'danger' : 'safe'">
        当前模式：{{ modeText }}
      </div>
    </header>

    <section class="controls">
      <label>
        总用户数
        <input v-model.number="totalUsers" type="number" min="1000" max="120000" step="1000" />
      </label>
      <label>
        修复版并发度
        <input v-model.number="controlledConcurrency" type="number" min="1" max="800" />
      </label>
      <label class="switch">
        <input v-model="nextTickAbuse" type="checkbox" />
        <span>错误版叠加 nextTick 滥用</span>
      </label>
    </section>

    <section class="actions">
      <button class="btn danger" :disabled="loading" @click="startNaiveRun">启动错误版（Promise.all）</button>
      <button class="btn safe" :disabled="loading" @click="startControlledRun">启动修复版（并发控制）</button>
      <button class="btn ghost" :disabled="loading" @click="stopRun">停止运行</button>
      <button class="btn ghost" :disabled="loading" @click="resetRun">重置指标</button>
      <button class="btn ghost" :disabled="loading" @click="loadOrderDemo">刷新 Event Loop 顺序</button>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="metrics" class="cards">
      <article class="card">
        <h3>进度</h3>
        <p class="value">{{ progressText }}</p>
        <p class="meta">{{ metrics.counters.processed }} / {{ metrics.config.totalUsers }}</p>
      </article>
      <article class="card">
        <h3>并发请求数</h3>
        <p class="value">{{ metrics.counters.inFlight }}</p>
        <p class="meta">峰值: {{ metrics.counters.peakInFlight }}</p>
      </article>
      <article class="card">
        <h3>延迟</h3>
        <p class="value">P99 {{ metrics.timing.apiLatencyP99Ms.toFixed(2) }} ms</p>
        <p class="meta">P95 {{ metrics.timing.apiLatencyP95Ms.toFixed(2) }} ms / 均值 {{ metrics.timing.apiLatencyMeanMs.toFixed(2) }} ms</p>
      </article>
      <article class="card">
        <h3>Event Loop Lag</h3>
        <p class="value">{{ metrics.timing.eventLoopLagP99Ms.toFixed(2) }} ms</p>
        <p class="meta">均值 {{ metrics.timing.eventLoopLagMeanMs.toFixed(2) }} ms</p>
      </article>
      <article class="card">
        <h3>内存</h3>
        <p class="value">Heap {{ metrics.memoryMB.heapUsed.toFixed(2) }} MB</p>
        <p class="meta">RSS {{ metrics.memoryMB.rss.toFixed(2) }} MB</p>
      </article>
      <article class="card">
        <h3>结果</h3>
        <p class="value">成功 {{ metrics.counters.succeeded }}</p>
        <p class="meta">失败 {{ metrics.counters.failed }} / 运行 {{ Math.floor(metrics.timing.durationMs / 1000) }} s</p>
      </article>
    </section>

    <section v-if="metrics" class="trends">
      <div class="trend-card">
        <h3>Heap 趋势</h3>
        <div class="sparkline">
          <div
            v-for="(n, idx) in metrics.trends.heapMB"
            :key="`heap-${idx}`"
            class="bar heap"
            :style="{ height: `${Math.max(4, (n / maxHeap) * 100)}%` }"
            :title="`${n.toFixed(2)} MB`"
          ></div>
        </div>
      </div>
      <div class="trend-card">
        <h3>Event Loop Lag 趋势</h3>
        <div class="sparkline">
          <div
            v-for="(n, idx) in metrics.trends.lagMs"
            :key="`lag-${idx}`"
            class="bar lag"
            :style="{ height: `${Math.max(4, (n / maxLag) * 100)}%` }"
            :title="`${n.toFixed(2)} ms`"
          ></div>
        </div>
      </div>
      <div class="trend-card">
        <h3>In-flight 趋势</h3>
        <div class="sparkline">
          <div
            v-for="(n, idx) in metrics.trends.inFlight"
            :key="`if-${idx}`"
            class="bar inflight"
            :style="{ height: `${Math.max(4, (n / maxInFlight) * 100)}%` }"
            :title="`${n}`"
          ></div>
        </div>
      </div>
    </section>

    <section class="qa">
      <h3>逐一问答</h3>

      <article class="qa-item">
        <h4>Q1：这段 Promise.all 写法会引发哪些严重问题？</h4>
        <p>
          第一，V8 内存会被瞬间拉高：`users.map(...)` 立即创建百万个 Promise 与闭包，内存占用陡增，GC 压力显著上升。
          第二，网络 I/O 会被打爆：瞬间并发把 socket、连接池与第三方 QPS 限额全部冲穿，导致 429、超时、重试风暴。
          第三，Event Loop 体验变差：大量回调与微任务排队，I/O 回调处理与计时器执行被拖慢，P99 长尾抖动明显。
          第四，失败放大：`Promise.all` 任一 reject 会导致整批失败，容错与恢复都很差。
        </p>
      </article>

      <article class="qa-item">
        <h4>Q2：高级工程师如何重构并发控制？核心逻辑是什么？</h4>
        <p>
          设计要点：分批读取（避免一次性装载全部数据）、有界并发（控制 in-flight 上限）、背压与限流（按第三方能力动态调参）、
          幂等与重试（失败可恢复）、可观测性（并发数/成功率/P99/lag 监控）。
        </p>
        <p>
          本实验修复版实现了最小并发控制器：维护一个共享游标，启动 N 个 worker 循环拉取任务；每处理一段任务后使用
          `setImmediate` 主动让出事件循环，避免长期占用；所有 worker 汇总后完成整批任务。这就是“高效且安全”的核心骨架。
        </p>
      </article>

      <article class="qa-item">
        <h4>Q3：process.nextTick 与 setImmediate 的执行时机差异？滥用后果？</h4>
        <p>
          `process.nextTick` 属于 Node 特有的 nextTick 队列，会在当前操作结束后、进入下一轮 Event Loop 之前立即清空；
          `setImmediate` 在 check 阶段执行，属于真正让出本轮循环后再继续。
        </p>
        <p>
          如果滥用 `process.nextTick`（例如递归塞任务），会持续“插队”导致 I/O 与定时器得不到调度，产生事件循环饥饿，
          表现为吞吐下降、响应超时和整体系统抖动。
        </p>
        <div v-if="orderDemo" class="order-box">
          <p class="order-title">当前服务上的一次顺序示意：</p>
          <ol>
            <li v-for="item in orderDemo.order" :key="item">{{ item }}</li>
          </ol>
          <p class="order-note">{{ orderDemo.note }}</p>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.concurrency-lab {
  padding: 1.2rem 1.2rem 1.8rem;
  color: #e8ecf1;
  background:
    radial-gradient(circle at 88% -10%, rgba(15, 164, 120, 0.16), transparent 45%),
    radial-gradient(circle at 0% 130%, rgba(223, 122, 22, 0.15), transparent 50%),
    #0c111d;
}

.hero {
  margin-bottom: 1rem;
}

.eyebrow {
  margin: 0 0 0.3rem;
  color: #8de7c7;
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
  max-width: 72ch;
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.8rem;
}

.controls label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: #9db0c8;
}

.controls input[type='number'] {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #24314a;
  background: #11192a;
  color: #e8ecf1;
  padding: 0.45rem 0.55rem;
  font-size: 0.88rem;
}

.switch {
  align-self: end;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 1px solid #24314a;
  background: #11192a;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 0.95rem;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 0.5rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn.danger {
  color: #fff;
  background: linear-gradient(135deg, #ef4444, #b91c1c);
}

.btn.safe {
  color: #062015;
  background: linear-gradient(135deg, #34d399, #10b981);
}

.btn.ghost {
  color: #c7d5e7;
  background: #11192a;
  border: 1px solid #24314a;
}

.error {
  margin: 0 0 0.9rem;
  color: #fda4af;
  background: rgba(127, 29, 29, 0.4);
  border: 1px solid rgba(239, 68, 68, 0.45);
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.82rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.7rem;
  margin-bottom: 1rem;
}

.card {
  background: #10182a;
  border: 1px solid #24314a;
  border-radius: 10px;
  padding: 0.75rem;
}

.card h3 {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  color: #8fa6c2;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.value {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 700;
  color: #f2f6ff;
  font-variant-numeric: tabular-nums;
}

.meta {
  margin: 0.35rem 0 0;
  font-size: 0.76rem;
  color: #8fa6c2;
}

.trends {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.1rem;
}

.trend-card {
  background: #10182a;
  border: 1px solid #24314a;
  border-radius: 10px;
  padding: 0.7rem;
}

.trend-card h3 {
  margin: 0 0 0.55rem;
  font-size: 0.82rem;
  color: #c7d5e7;
}

.sparkline {
  height: 112px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(4px, 1fr);
  align-items: end;
  gap: 2px;
}

.bar {
  width: 100%;
  border-radius: 2px 2px 0 0;
}

.bar.heap {
  background: linear-gradient(180deg, #f59e0b, #d97706);
}

.bar.lag {
  background: linear-gradient(180deg, #ef4444, #b91c1c);
}

.bar.inflight {
  background: linear-gradient(180deg, #38bdf8, #0ea5e9);
}

.qa h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.qa-item {
  background: #0f1728;
  border: 1px solid #24314a;
  border-radius: 10px;
  padding: 0.8rem;
  margin-bottom: 0.6rem;
}

.qa-item h4 {
  margin: 0 0 0.45rem;
  font-size: 0.92rem;
  color: #f2f6ff;
}

.qa-item p,
.qa-item li {
  margin: 0;
  color: #a9bfd7;
  font-size: 0.84rem;
  line-height: 1.6;
}

.qa-item p + p {
  margin-top: 0.45rem;
}

.qa-item ul,
.qa-item ol {
  margin: 0;
  padding-left: 1.2rem;
}

.order-box {
  margin-top: 0.55rem;
  padding: 0.55rem;
  border-radius: 8px;
  border: 1px dashed #31507e;
  background: rgba(49, 80, 126, 0.15);
}

.order-title {
  margin-bottom: 0.35rem !important;
  color: #d8e8ff !important;
}

.order-note {
  margin-top: 0.35rem !important;
  font-size: 0.76rem !important;
  color: #9bb8d8 !important;
}

@media (max-width: 768px) {
  .concurrency-lab {
    padding: 0.95rem;
  }

  .hero h2 {
    font-size: 1.13rem;
  }
}
</style>
