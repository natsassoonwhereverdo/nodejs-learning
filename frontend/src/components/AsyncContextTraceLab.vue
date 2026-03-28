<script setup lang="ts">
const questions = [
  {
    num: '01',
    q: 'await next() 底层怎么把中间件串起来？',
    a: 'Koa 会先把所有中间件按顺序组成一个 compose 链。每个中间件在执行到 await next() 时，实际上是把控制权交给下一个中间件，并等待下游返回的 Promise 完成；等下游结束后，控制流再回到当前中间件继续往下执行，所以外层是"前置 → 下游 → 后置"的洋葱结构。'
  },
  {
    num: '02',
    q: '隐式传递 traceId 应该用什么核心 API？',
    a: 'Node.js 用 AsyncLocalStorage（底层依赖 async_hooks）最合适。它会把一份 store 绑定到当前异步调用链上，Promise、setTimeout、I/O 回调等异步切换时，运行时会自动沿着 async resource 继承同一个 store，因此 logger、DB、RPC 封装层都能直接从 als.getStore() 读取 traceId，不需要逐层传参。'
  },
  {
    num: '03',
    q: '可能遇到哪些隐患或性能问题？',
    a: '第一，早期 Node.js 版本里 async_hooks / AsyncLocalStorage 不够稳定，链路可能丢失；第二，部分第三方旧库会自己包回调、乱改异步边界，导致上下文断裂；第三，async_hooks 本身有额外开销，高 QPS 下会增加延迟和内存压力，所以 store 里不要放大对象，也不要默认把所有链路都"全量追踪"。'
  }
];

const steps = [
  { icon: '🚪', title: '入口层生成', desc: '网关最外层中间件读取请求头 traceId，没有则用 randomUUID() 生成' },
  { icon: '🧬', title: '建立上下文', desc: '把 { traceId } 放进 AsyncLocalStorage.run() 的 store 里' },
  { icon: '📤', title: '业务层隐式调用', desc: 'Controller / Service / Model / Utils 只需调用封装层，不显式传参' },
  { icon: '🔗', title: '统一回写', desc: '响应头带 traceId，DB/RPC 调用也带上，方便全链路检索' }
];

const apis = [
  { title: 'dispatch(index) 链表调度', desc: 'Koa 把所有中间件编译成一个链表式调度器，await next() 等待下游 Promise 完成后再回到上游继续执行。' },
  { title: 'AsyncLocalStorage 异步绑定', desc: 'store 绑定到当前 async resource，Promise / setTimeout / I/O 回调等异步切换时，沿着 async_hooks 链路自动继承。' },
  { title: '封装层统一读取', desc: '日志、DB、HTTP Client、RPC Client 内部统一调用 als.getStore()，traceId 真正做到"隐式透传"。' }
];

const boundaries = [
  {
    badge: 'Worker Threads',
    desc: '主线程把 traceId 跟任务一起发给 worker；worker 收到消息后先创建局部上下文，再执行真正的业务函数。',
    code: `worker.postMessage({ traceId, payload });

parentPort.on('message', ({ traceId, payload }) => {
  als.run({ traceId }, () => handle(payload));
});`
  },
  {
    badge: '子进程',
    desc: 'fork / spawn 时通过 IPC 消息、环境变量或参数传递 traceId；每次任务下发都要显式带上。',
    code: `const child = fork('child.js');
child.send({ traceId, task });

process.on('message', (msg) => {
  als.run({ traceId: msg.traceId }, () => runTask(msg.task));
});`
  },
  {
    badge: '消息队列',
    desc: '生产者把 traceId 放进消息 header，消费者反序列化后立刻恢复上下文。',
    code: `await mq.publish('orders.created', {
  headers: { 'x-trace-id': traceId },
  body: payload
});

consume('orders.created', (msg) => {
  als.run({ traceId: msg.headers['x-trace-id'] }, () => handle(msg.body));
});`
  },
  {
    badge: '远程 RPC',
    desc: 'HTTP 用 x-trace-id，gRPC 用 metadata，Dubbo / 自研 RPC 在请求头或元数据里显式传递。',
    code: `await fetch(url, { headers: { 'x-trace-id': traceId } });

// gRPC client
client.call(req, { metadata: { 'x-trace-id': traceId } });`
  }
];

const risks = [
  { icon: '⚠️', title: '旧版 Node.js / 旧库兼容性', desc: '早期 async_hooks 和 AsyncLocalStorage 实现不稳定，某些第三方库自行管理回调、事件监听或异步边界时会丢失上下文。' },
  { icon: '📉', title: '性能开销', desc: 'async_hooks 增加额外事件追踪开销，高 QPS 场景下关注吞吐、延迟和内存占用，store 不要塞大对象。' },
  { icon: '🔀', title: '跨线程 / 跨进程边界', desc: 'AsyncLocalStorage 只对当前进程内异步链路生效，Worker Threads、子进程、消息队列和远程 RPC 都需要显式传递。' }
];

const fullCode = `import Koa from 'koa';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const als = new AsyncLocalStorage<{ traceId: string }>();

app.use(async (ctx, next) => {
  const traceId = ctx.get('x-trace-id') || randomUUID();
  ctx.set('x-trace-id', traceId);

  await als.run({ traceId }, async () => {
    await next();
  });
});

function getTraceId() {
  return als.getStore()?.traceId;
}

logger.info({ traceId: getTraceId() }, 'request finished');`;
</script>

<template>
  <div class="lab">
    <!-- Hero -->
    <header class="hero">
      <div class="hero-eyebrow">
        <span class="eyebrow-dot"></span>
        Node.js Async Context Lab · 实验四
      </div>
      <h1 class="hero-title">中间件模型与异步上下文追踪</h1>
      <p class="hero-desc">
        围绕 Koa/NestJS 的洋葱模型、Node.js AsyncLocalStorage 与 traceId 隐式透传，
        讲清实现步骤、落地方式和性能取舍。
      </p>
      <div class="hero-tags">
        <span class="tag">traceId 隐式透传</span>
        <span class="tag">Koa / NestJS 通用</span>
        <span class="tag">日志 / DB / RPC 同源</span>
      </div>
    </header>

    <!-- Section 1: Direct Answers -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">Q&amp;A</span>
        <h2 class="section-title">核心三问</h2>
      </div>
      <div class="qa-grid">
        <article v-for="item in questions" :key="item.num" class="qa-card">
          <div class="qa-num">{{ item.num }}</div>
          <h3 class="qa-q">{{ item.q }}</h3>
          <p class="qa-a">{{ item.a }}</p>
        </article>
      </div>
    </section>

    <!-- Section 2: Onion Model -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">01</span>
        <h2 class="section-title">洋葱模型如何串联</h2>
      </div>

      <!-- Visual Onion Flow -->
      <div class="onion-diagram">
        <div class="onion-layer outer">
          <span class="layer-label">Middleware A</span>
          <div class="layer-inner">
            <div class="onion-layer mid">
              <span class="layer-label">Middleware B</span>
              <div class="layer-inner">
                <div class="onion-layer inner">
                  <span class="layer-label">Controller / Service</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="onion-legend">
          <div class="legend-item">
            <span class="legend-arrow">→</span>
            <span>外层先执行 <strong>before</strong> 部分</span>
          </div>
          <div class="legend-item">
            <span class="legend-arrow">→</span>
            <span>逐层向内，直到最深层</span>
          </div>
          <div class="legend-item">
            <span class="legend-arrow">←</span>
            <span>逐层向外，执行 <strong>after</strong> 部分</span>
          </div>
        </div>
      </div>

      <!-- Step Cards -->
      <div class="step-track">
        <div v-for="(step, idx) in steps" :key="idx" class="step-item">
          <div class="step-icon">{{ step.icon }}</div>
          <div class="step-content">
            <h3 class="step-title">{{ step.title }}</h3>
            <p class="step-desc">{{ step.desc }}</p>
          </div>
          <div v-if="idx < steps.length - 1" class="step-connector">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 3: Core API -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">02</span>
        <h2 class="section-title">核心 API 原理</h2>
      </div>
      <div class="api-stack">
        <article v-for="api in apis" :key="api.title" class="api-card">
          <h3 class="api-title">{{ api.title }}</h3>
          <p class="api-desc">{{ api.desc }}</p>
        </article>
      </div>
    </section>

    <!-- Section 4: Cross Boundary -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">03</span>
        <h2 class="section-title">跨线程 / 跨进程显式注入</h2>
        <p class="section-note">AsyncLocalStorage 只对当前进程内异步链路生效，边界场景需要显式传递</p>
      </div>
      <div class="boundary-grid">
        <article v-for="b in boundaries" :key="b.badge" class="boundary-card">
          <div class="boundary-badge">{{ b.badge }}</div>
          <p class="boundary-desc">{{ b.desc }}</p>
          <pre class="boundary-code"><code>{{ b.code }}</code></pre>
        </article>
      </div>
    </section>

    <!-- Section 5: Implementation -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">04</span>
        <h2 class="section-title">推荐实现</h2>
      </div>
      <div class="code-block">
        <div class="code-toolbar">
          <div class="code-dots">
            <span></span><span></span><span></span>
          </div>
          <span class="code-filename">middleware/trace.ts</span>
        </div>
        <pre class="code-content"><code>{{ fullCode }}</code></pre>
      </div>
      <p class="impl-note">
        💡 实战里通常再补一层请求结束日志、异常日志、数据库封装和 RPC 封装，让所有出口都自动读取同一个上下文。
      </p>
    </section>

    <!-- Section 6: Risks -->
    <section class="section">
      <div class="section-header">
        <span class="section-num">!</span>
        <h2 class="section-title">隐患与性能问题</h2>
      </div>
      <div class="risk-list">
        <article v-for="risk in risks" :key="risk.title" class="risk-card">
          <div class="risk-icon">{{ risk.icon }}</div>
          <div class="risk-content">
            <h3 class="risk-title">{{ risk.title }}</h3>
            <p class="risk-desc">{{ risk.desc }}</p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lab {
  --bg-base: #06090f;
  --bg-card: rgba(10, 17, 30, 0.92);
  --border: rgba(139, 233, 255, 0.12);
  --border-bright: rgba(139, 233, 255, 0.22);
  --accent: #38d9f5;
  --accent-dim: rgba(56, 217, 245, 0.15);
  --text: #d4e5f7;
  --text-dim: #7a94b0;
  --text-bright: #e8f4ff;
  --glow: rgba(56, 217, 245, 0.08);

  width: 100%;
  padding: 1.5rem;
  color: var(--text);
  background: var(--bg-base);
  line-height: 1.6;
}

/* Hero */
.hero {
  margin: 0 auto 2rem;
  text-align: center;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent);
}

.eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.hero-title {
  margin: 0 0 1rem;
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--text-bright) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-desc {
  max-width: 68ch;
  margin: 0 auto 1.5rem;
  font-size: 1rem;
  color: var(--text-dim);
  line-height: 1.75;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}

.tag {
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--border-bright);
  background: var(--glow);
  color: var(--accent);
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}

/* Sections */
.section {
  margin: 0 auto 2.5rem;
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--border);
}

.section-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent-dim), transparent);
  border: 1px solid var(--border-bright);
  color: var(--accent);
  font-size: 0.7rem;
  font-weight: 700;
}

.section-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.section-note {
  margin: 0 0 0 0.5rem;
  font-size: 0.82rem;
  color: var(--text-dim);
}

/* Q&A Grid */
.qa-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.qa-card {
  padding: 1.4rem;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.qa-card:hover {
  border-color: var(--border-bright);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--accent-dim);
}

.qa-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  margin-bottom: 0.9rem;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent-dim), transparent);
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.qa-q {
  margin: 0 0 0.7rem;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.45;
}

.qa-a {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-dim);
  line-height: 1.7;
}

/* Onion Diagram */
.onion-diagram {
  display: flex;
  align-items: center;
  gap: 3rem;
  margin-bottom: 2rem;
  padding: 2rem;
  border-radius: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
}

.onion-layer {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.3s;
}

.onion-layer.outer {
  width: clamp(120px, 20vw, 200px);
  height: clamp(120px, 20vw, 200px);
  background: linear-gradient(135deg, rgba(251, 146, 60, 0.3), rgba(251, 146, 60, 0.1));
  border: 2px solid rgba(251, 146, 60, 0.4);
}

.onion-layer.mid {
  width: clamp(80px, 14vw, 140px);
  height: clamp(80px, 14vw, 140px);
  background: linear-gradient(135deg, rgba(56, 217, 245, 0.3), rgba(56, 217, 245, 0.1));
  border: 2px solid rgba(56, 217, 245, 0.4);
}

.onion-layer.inner {
  width: clamp(50px, 8vw, 80px);
  height: clamp(50px, 8vw, 80px);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.15));
  border: 2px solid rgba(34, 197, 94, 0.5);
}

.layer-label {
  position: absolute;
  white-space: nowrap;
}

.layer-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.onion-legend {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.875rem;
  color: var(--text-dim);
}

.legend-arrow {
  color: var(--accent);
  font-weight: 700;
}

/* Step Track */
.step-track {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.step-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.2rem;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-card);
}

.step-icon {
  font-size: 1.8rem;
  margin-bottom: 0.8rem;
}

.step-title {
  margin: 0 0 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.step-desc {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-dim);
  line-height: 1.55;
}

.step-connector {
  position: absolute;
  right: -1.2rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--accent);
  z-index: 1;
}

/* API Stack */
.api-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.api-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.2rem;
  align-items: start;
  padding: 1.2rem 1.4rem;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-card);
}

.api-title {
  grid-column: 1 / -1;
  margin: 0 0 0.3rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--accent);
}

.api-desc {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-dim);
  line-height: 1.65;
}

/* Boundary Grid */
.boundary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.boundary-card {
  padding: 1.3rem;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--bg-card);
}

.boundary-badge {
  display: inline-block;
  padding: 0.25rem 0.7rem;
  margin-bottom: 0.8rem;
  border-radius: 6px;
  background: var(--glow);
  border: 1px solid var(--border-bright);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
}

.boundary-desc {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: var(--text-dim);
  line-height: 1.6;
}

.boundary-code {
  margin: 0;
  padding: 1rem;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border);
  overflow-x: auto;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #7dd3fc;
}

/* Code Block */
.code-block {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: rgba(4, 8, 15, 0.95);
}

.code-toolbar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid var(--border);
}

.code-dots {
  display: flex;
  gap: 0.4rem;
}

.code-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
}

.code-dots span:first-child { background: #ff5f57; }
.code-dots span:nth-child(2) { background: #febc2e; }
.code-dots span:nth-child(3) { background: #28c840; }

.code-filename {
  font-size: 0.75rem;
  color: var(--text-dim);
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.code-content {
  margin: 0;
  padding: 1.2rem 1.5rem;
  font-size: 0.8rem;
  line-height: 1.7;
  color: #7dd3fc;
  overflow-x: auto;
}

.impl-note {
  margin: 1rem 0 0;
  padding: 1rem;
  border-radius: 10px;
  background: var(--accent-dim);
  border: 1px solid var(--border-bright);
  font-size: 0.875rem;
  color: var(--text-dim);
}

/* Risk List */
.risk-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.risk-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.2rem;
  align-items: start;
  padding: 1.2rem 1.4rem;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-card);
}

.risk-icon {
  font-size: 1.4rem;
}

.risk-title {
  margin: 0 0 0.3rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.risk-desc {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-dim);
  line-height: 1.65;
}

/* Responsive */
@media (max-width: 1024px) {
  .qa-grid {
    grid-template-columns: 1fr;
  }

  .step-track {
    grid-template-columns: repeat(2, 1fr);
  }

  .step-connector {
    display: none;
  }

  .boundary-grid {
    grid-template-columns: 1fr;
  }

  .onion-diagram {
    flex-direction: column;
  }

  .hero-tags {
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .lab {
    padding: 1rem;
  }

  .hero-title {
    font-size: 1.4rem;
  }

  .hero-desc {
    font-size: 0.9rem;
  }

  .step-track {
    grid-template-columns: 1fr;
  }

  .onion-diagram {
    padding: 1rem;
  }

  .onion-legend {
    display: none;
  }
}
</style>
