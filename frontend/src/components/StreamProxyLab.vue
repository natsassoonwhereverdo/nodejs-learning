<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  getStreamProxyMetrics,
  resetStreamProxyLab,
  setStreamProxyMode,
  simulateStreamProxyDisconnect,
  type StreamProxyMetrics,
  type StreamProxyMode,
  type StreamProxySimulateMode,
  type StreamProxySimulationResult
} from '../api/streamProxyLab';

const metrics = ref<StreamProxyMetrics | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const simulating = ref(false);
const lastSimulation = ref<StreamProxySimulationResult | null>(null);

const totalMB = ref(256);
const disconnectAtMB = ref(128);

let metricsTimer: number | null = null;

function toErrorMessage(errorLike: unknown, fallback: string): string {
  if (errorLike instanceof Error) {
    return errorLike.message;
  }

  return fallback;
}

function normalizeInputs(): void {
  const nextTotal = Number.isFinite(totalMB.value) ? Math.trunc(totalMB.value) : 256;
  totalMB.value = Math.min(1024, Math.max(16, nextTotal));

  const defaultDisconnect = Math.max(1, Math.floor(totalMB.value / 2));
  const nextDisconnect = Number.isFinite(disconnectAtMB.value)
    ? Math.trunc(disconnectAtMB.value)
    : defaultDisconnect;

  disconnectAtMB.value = Math.min(totalMB.value - 1, Math.max(1, nextDisconnect));
}

const modeText = computed(() => {
  if (!metrics.value) {
    return '加载中';
  }

  return metrics.value.mode === 'pipeline'
    ? 'pipeline（修复版）'
    : 'pipe（风险版）';
});

const leakRiskDelta = computed(() => {
  if (!lastSimulation.value) {
    return 0;
  }

  return (
    lastSimulation.value.after.proxy.leakRiskCount -
    lastSimulation.value.before.proxy.leakRiskCount
  );
});

const upstreamAbortDelta = computed(() => {
  if (!lastSimulation.value) {
    return 0;
  }

  return (
    lastSimulation.value.after.proxy.upstreamAbortCount -
    lastSimulation.value.before.proxy.upstreamAbortCount
  );
});

const activeUpstreamDelta = computed(() => {
  if (!lastSimulation.value) {
    return 0;
  }

  return (
    lastSimulation.value.after.upstream.activeSessions -
    lastSimulation.value.before.upstream.activeSessions
  );
});

async function refreshMetrics(): Promise<void> {
  try {
    metrics.value = await getStreamProxyMetrics();
  } catch (errorLike: unknown) {
    error.value = toErrorMessage(errorLike, '拉取 stream proxy 指标失败');
  }
}

async function switchMode(nextMode: StreamProxyMode): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    metrics.value = await setStreamProxyMode(nextMode);
  } catch (errorLike: unknown) {
    error.value = toErrorMessage(errorLike, '切换模式失败');
  } finally {
    loading.value = false;
  }
}

async function resetLab(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    metrics.value = await resetStreamProxyLab();
    lastSimulation.value = null;
  } catch (errorLike: unknown) {
    error.value = toErrorMessage(errorLike, '重置实验失败');
  } finally {
    loading.value = false;
  }
}

async function runSimulation(mode: StreamProxySimulateMode): Promise<void> {
  simulating.value = true;
  error.value = null;
  normalizeInputs();

  try {
    const result = await simulateStreamProxyDisconnect({
      mode,
      totalMB: totalMB.value,
      disconnectAtMB: disconnectAtMB.value
    });

    lastSimulation.value = result;
    metrics.value = result.after;
  } catch (errorLike: unknown) {
    error.value = toErrorMessage(errorLike, '模拟客户端断连失败');
  } finally {
    simulating.value = false;
  }
}

watch(totalMB, () => {
  normalizeInputs();
});

onMounted(() => {
  normalizeInputs();
  void refreshMetrics();
  metricsTimer = window.setInterval(() => {
    void refreshMetrics();
  }, 1200);
});

onUnmounted(() => {
  if (metricsTimer) {
    clearInterval(metricsTimer);
  }
});
</script>

<template>
  <div class="stream-proxy-lab">
    <header class="hero">
      <p class="eyebrow">Node.js Stream Proxy Lab</p>
      <h2>第五题：大文件流式代理与网络异常阻断</h2>
      <p class="desc">
        BFF 代理大文件下载时，模拟客户端中途断连，对比 <code>pipe</code> 与 <code>pipeline</code>
        在「断连后上游是否继续浪费资源」上的差异。重点观察：leakRisk（泄漏风险）、active upstream（活跃上游会话）、upstreamAbort（上游被阻断次数）。
      </p>
      <div class="mode-chip" :class="metrics?.mode === 'pipeline' ? 'safe' : 'danger'">
        当前模式：{{ modeText }}
      </div>
    </header>

    <section class="controls">
      <button class="btn danger" :disabled="loading" @click="switchMode('pipe')">切到 pipe（风险版）</button>
      <button class="btn safe" :disabled="loading" @click="switchMode('pipeline')">切到 pipeline（修复版）</button>
      <button class="btn ghost" :disabled="loading || simulating" @click="resetLab">重置指标</button>
    </section>

    <section class="scenario-config">
      <label>
        模拟文件大小 (MB)
        <input v-model.number="totalMB" type="number" min="16" max="1024" />
      </label>
      <label>
        断连位置 (MB)
        <input v-model.number="disconnectAtMB" type="number" min="1" :max="Math.max(1, totalMB - 1)" />
      </label>
      <div class="hint">建议先用 128MB / 64MB 快速对比，再放大到更高体量观察趋势。</div>
    </section>

    <section class="simulate-actions">
      <button class="btn ghost" :disabled="simulating" @click="runSimulation('current')">按当前模式模拟断连</button>
      <button class="btn ghost" :disabled="simulating" @click="runSimulation('pipe')">强制用 pipe 模拟</button>
      <button class="btn ghost" :disabled="simulating" @click="runSimulation('pipeline')">强制用 pipeline 模拟</button>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="metrics" class="cards">
      <article class="card">
        <h3>Proxy 会话</h3>
        <p class="value">{{ metrics.proxy.requestCount }}</p>
        <p class="meta">active {{ metrics.proxy.activeSessions }} / completed {{ metrics.proxy.completedCount }}</p>
      </article>

      <article class="card">
        <h3>断连与阻断</h3>
        <p class="value">disconnect {{ metrics.proxy.clientDisconnectCount }}</p>
        <p class="meta">abort {{ metrics.proxy.upstreamAbortCount }} / leakRisk {{ metrics.proxy.leakRiskCount }}</p>
      </article>

      <article class="card">
        <h3>上游状态</h3>
        <p class="value">active {{ metrics.upstream.activeSessions }}</p>
        <p class="meta">completed {{ metrics.upstream.completedCount }} / aborted {{ metrics.upstream.abortedCount }}</p>
      </article>

      <article class="card">
        <h3>进程资源</h3>
        <p class="value">handles {{ metrics.process.activeHandles }}</p>
        <p class="meta">heap {{ metrics.process.heapUsedMB.toFixed(2) }} MB / rss {{ metrics.process.rssMB.toFixed(2) }} MB</p>
      </article>
    </section>

    <section v-if="lastSimulation" class="result-panel">
      <h3>最近一次模拟结果</h3>
      <p>
        模式 {{ lastSimulation.simulation.mode }}，文件 {{ lastSimulation.simulation.totalMB }} MB，
        在 {{ lastSimulation.simulation.disconnectAtMB }} MB 断连，实际接收 {{ lastSimulation.simulation.receivedMB }} MB。
      </p>
      <div class="result-grid">
        <div class="result-item" :class="leakRiskDelta > 0 ? 'warn' : 'ok'">
          leakRisk 增量：{{ leakRiskDelta }}
        </div>
        <div class="result-item" :class="upstreamAbortDelta > 0 ? 'ok' : 'warn'">
          upstreamAbort 增量：{{ upstreamAbortDelta }}
        </div>
        <div class="result-item" :class="activeUpstreamDelta > 0 ? 'warn' : 'ok'">
          activeUpstream 增量：{{ activeUpstreamDelta }}
        </div>
      </div>
    </section>

    <section v-if="metrics" class="upstream-list">
      <h3>活跃上游会话（Top）</h3>
      <ul v-if="metrics.upstream.activeTop.length > 0">
        <li v-for="item in metrics.upstream.activeTop" :key="item.id">
          #{{ item.id }} · {{ item.sentMB.toFixed(2) }} / {{ item.totalMB.toFixed(2) }} MB · 已运行 {{ item.ageSec.toFixed(1) }} s
        </li>
      </ul>
      <p v-else class="empty">当前无活跃上游会话。</p>
    </section>
  </div>
</template>

<style scoped>
.stream-proxy-lab {
  padding: 1.25rem;
  color: #d7deea;
}

.hero {
  margin-bottom: 1rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8ea3c2;
}

h2 {
  margin: 0.25rem 0 0.5rem;
  font-size: 1.45rem;
  color: #f5f7fb;
}

.desc {
  margin: 0;
  line-height: 1.6;
  color: #9db0cc;
}

.mode-chip {
  margin-top: 0.75rem;
  display: inline-flex;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  font-size: 0.78rem;
  border: 1px solid;
}

.mode-chip.safe {
  color: #6ee7b7;
  border-color: #065f46;
  background: rgba(6, 95, 70, 0.25);
}

.mode-chip.danger {
  color: #fca5a5;
  border-color: #7f1d1d;
  background: rgba(127, 29, 29, 0.24);
}

.controls,
.simulate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
}

.btn {
  border: 1px solid #263346;
  background: #131c2b;
  color: #d7deea;
  border-radius: 8px;
  padding: 0.46rem 0.78rem;
  cursor: pointer;
  font-size: 0.84rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.danger {
  border-color: #7f1d1d;
  color: #fecaca;
}

.btn.safe {
  border-color: #14532d;
  color: #bbf7d0;
}

.btn.ghost {
  border-color: #334155;
}

.scenario-config {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.8rem;
}

.scenario-config label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: #9db0cc;
}

.scenario-config input {
  border: 1px solid #2a3a52;
  background: #0f1725;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 0.4rem 0.55rem;
}

.hint {
  grid-column: 1 / -1;
  font-size: 0.75rem;
  color: #7d92af;
}

.error {
  margin: 0.6rem 0;
  color: #fda4af;
  font-size: 0.84rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.8rem;
}

.card {
  border: 1px solid #243247;
  background: #0f1725;
  border-radius: 10px;
  padding: 0.75rem;
}

.card h3 {
  margin: 0;
  font-size: 0.84rem;
  color: #93a7c3;
}

.value {
  margin: 0.45rem 0 0.2rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #f8fafc;
}

.meta {
  margin: 0;
  color: #7f93ad;
  font-size: 0.75rem;
  line-height: 1.5;
}

.result-panel,
.upstream-list {
  border: 1px solid #243247;
  background: #0f1725;
  border-radius: 10px;
  padding: 0.75rem;
  margin-bottom: 0.7rem;
}

.result-panel h3,
.upstream-list h3 {
  margin: 0 0 0.4rem;
  font-size: 0.9rem;
  color: #e7eef8;
}

.result-panel p {
  margin: 0;
  font-size: 0.8rem;
  color: #9db0cc;
  line-height: 1.6;
}

.result-grid {
  margin-top: 0.6rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.45rem;
}

.result-item {
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  font-size: 0.78rem;
  border: 1px solid;
}

.result-item.ok {
  color: #86efac;
  background: rgba(21, 128, 61, 0.2);
  border-color: #166534;
}

.result-item.warn {
  color: #fdba74;
  background: rgba(146, 64, 14, 0.2);
  border-color: #9a3412;
}

.upstream-list ul {
  margin: 0;
  padding-left: 1.1rem;
}

.upstream-list li {
  color: #c0cde0;
  font-size: 0.78rem;
  line-height: 1.6;
}

.empty {
  margin: 0;
  font-size: 0.8rem;
  color: #7d92af;
}

@media (max-width: 640px) {
  .stream-proxy-lab {
    padding: 0.9rem;
  }

  h2 {
    font-size: 1.2rem;
  }
}
</style>
