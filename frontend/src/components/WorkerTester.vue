<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { runFibonacci, runPrimes, getPoolStats, type PoolStats, type FibonacciResponse, type PrimesResponse } from '../api/worker';

const fibNumber = ref(40);
const maxPrime = ref(1000000);
const results = ref<Array<{id: number; type: string; result: string; workerId: string; duration: number}>>([]);
const poolStats = ref<PoolStats | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let resultId = 0;
let statsInterval: number | null = null;

async function fetchStats() {
  try {
    poolStats.value = await getPoolStats();
  } catch (e) {
    console.error('获取状态失败:', e);
  }
}

async function testFibonacci() {
  loading.value = true;
  error.value = null;
  try {
    const res: FibonacciResponse = await runFibonacci(fibNumber.value);
    results.value.unshift({
      id: ++resultId,
      type: '斐波那契',
      result: `F(${fibNumber.value}) = ${res.result}`,
      workerId: res.workerId,
      duration: res.duration
    });
    if (results.value.length > 10) results.value.pop();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function testPrimes() {
  loading.value = true;
  error.value = null;
  try {
    const res: PrimesResponse = await runPrimes(maxPrime.value);
    results.value.unshift({
      id: ++resultId,
      type: '质数筛法',
      result: `不超过 ${maxPrime.value} 的质数数量 = ${res.count}`,
      workerId: res.workerId,
      duration: res.duration
    });
    if (results.value.length > 10) results.value.pop();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchStats();
  statsInterval = window.setInterval(fetchStats, 2000);
});

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval);
});
</script>

<template>
  <div class="container">
    <header>
      <h1>Worker 线程池演示</h1>
      <p class="subtitle">CPU 密集型任务多线程处理</p>
    </header>

    <div class="stats-panel">
      <div class="status-title">线程池状态</div>
      <div class="stats" v-if="poolStats">
        <div class="stat-box">
          <span class="label">就绪</span>
          <span class="value" :class="{ ready: poolStats.ready }">{{ poolStats.ready ? '是' : '否' }}</span>
        </div>
        <div class="stat-box">
          <span class="label">队列</span>
          <span class="value">{{ poolStats.queueSize }}</span>
        </div>
        <div class="stat-box">
          <span class="label">工作线程</span>
          <span class="value">{{ poolStats.totalWorkers }}</span>
        </div>
      </div>
    </div>

    <div class="tests">
      <div class="test-card">
        <h3>斐波那契计算</h3>
        <p class="description">CPU 密集型递归计算</p>
        <div class="input-group">
          <label for="fib-input">n =</label>
          <input id="fib-input" type="number" v-model.number="fibNumber" min="0" max="45" autocomplete="off" />
          <button @click="testFibonacci" :disabled="loading">
            <span v-if="loading && results.length === 0" class="spinner"></span>
            <span v-else>运行</span>
          </button>
        </div>
      </div>

      <div class="test-card">
        <h3>质数筛法</h3>
        <p class="description">埃拉托斯特尼筛法找质数</p>
        <div class="input-group">
          <label for="prime-input">max =</label>
          <input id="prime-input" type="number" v-model.number="maxPrime" min="2" max="10000000" step="10000" autocomplete="off" />
          <button @click="testPrimes" :disabled="loading">
            <span v-if="loading && results.length === 0" class="spinner"></span>
            <span v-else>运行</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="error" role="alert">{{ error }}</div>

    <div class="results">
      <h2>结果</h2>
      <div class="result-list">
        <div v-for="r in results" :key="r.id" class="result-item">
          <span class="result-type">{{ r.type }}</span>
          <span class="result-value">{{ r.result }}</span>
          <span class="result-meta">线程: {{ r.workerId }}</span>
          <span class="result-meta">{{ r.duration }}ms</span>
        </div>
        <div v-if="results.length === 0" class="no-results">暂无结果。请在上方运行测试。</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

header { text-align: center; margin-bottom: 2rem; }

h1 {
  font-size: 2rem;
  margin: 0;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle { color: #7a8ba3; margin-top: 0.5rem; }

.stats-panel {
  background: #0d1321;
  border: 1px solid #1e2a3a;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.status-title {
  font-size: 0.8rem;
  color: #7a8ba3;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.stats {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-box .label {
  font-size: 0.7rem;
  color: #4a5568;
  text-transform: uppercase;
}

.stat-box .value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #6366f1;
  font-variant-numeric: tabular-nums;
}

.stat-box .value.ready { color: #10b981; }

.tests {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.test-card {
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 12px;
  padding: 1.5rem;
}

.test-card h3 {
  margin: 0 0 0.3rem 0;
  color: #e8ecf1;
  font-size: 1.05rem;
}

.description {
  color: #4a5568;
  font-size: 0.82rem;
  margin: 0 0 1rem 0;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-group label {
  color: #7a8ba3;
  font-size: 0.88rem;
}

.input-group input {
  padding: 0.5rem 0.75rem;
  background: #151d2e;
  border: 1px solid #1e2a3a;
  border-radius: 8px;
  color: #e8ecf1;
  width: 120px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.input-group input:focus {
  border-color: #6366f1;
}

.input-group button {
  padding: 0.5rem 1.25rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  transition: transform 0.2s, opacity 0.2s;
}

.input-group button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.input-group button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error {
  background: #2d0a0a;
  border: 1px solid #4c1d1d;
  color: #f87171;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}

.results h2 {
  color: #e8ecf1;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 8px;
  flex-wrap: wrap;
}

.result-type {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 5px;
  font-size: 0.75rem;
  font-weight: 700;
}

.result-value {
  flex: 1;
  font-family: 'Fira Code', monospace;
  color: #e8ecf1;
  font-size: 0.85rem;
}

.result-meta {
  color: #4a5568;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.no-results {
  text-align: center;
  color: #4a5568;
  padding: 2rem;
  font-size: 0.88rem;
}
</style>
