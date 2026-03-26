<script setup lang="ts">
interface TechItem {
  name: string;
  version?: string;
  role: string;
  icon: string;
}

interface ProCon {
  pros: string[];
  cons: string[];
}

interface UseCase {
  title: string;
  desc: string;
  icon: string;
}

interface DocSection {
  id: string;
  title: string;
  techs: TechItem[];
  useCases: UseCase[];
  prosCons: ProCon;
  keyCode?: string;
  keyCodeLang?: string;
  keyNote?: string;
}

const props = defineProps<{
  side: 'left' | 'right';
}>();

const leftSections: DocSection[] = [
  {
    id: 'worker-threads',
    title: 'Node.js Worker Threads',
    techs: [
      { name: 'worker_threads', role: 'Node.js 内置多线程模块', icon: '⚙️' },
      { name: 'Piscina', version: 'v4', role: '高性能 Worker 线程池库', icon: '🏊' },
      { name: 'TypeScript', version: '5.x', role: '类型安全的 JS 超集', icon: '📘' },
    ],
    useCases: [
      { title: 'CPU 密集型计算', desc: '哈希计算、加密解密、矩阵运算、图像处理', icon: '🔢' },
      { title: '视频/音频处理', desc: '转码、缩略图生成、格式转换', icon: '🎬' },
      { title: '大数据批处理', desc: '日志分析、数据聚合、CSV 解析', icon: '📊' },
      { title: '并行任务队列', desc: '同时处理多个用户上传的文件', icon: '📑' },
    ],
    prosCons: {
      pros: [
        '真正的多线程并行，突破 JS 单线程瓶颈',
        '共享内存（SharedArrayBuffer）零拷贝传输',
        'Piscina 自动管理线程生命周期和任务队列',
        '不影响主线程，保持 Event Loop 响应',
        'Worker 崩溃不影响主进程稳定性',
      ],
      cons: [
        '启动 Worker 有初始化开销（建议用线程池）',
        '线程间通信需要序列化（大数据用 transferable）',
        '调试较复杂，错误追踪困难',
        '不适合 I/O 密集型（用 async/await 即可）',
        '内存占用比单线程更高',
      ],
    },
    keyCode: `// pool.ts - Piscina 线程池配置
const videoPool = new Piscina({
  filename: 'video-task.js',
  minThreads: 4,   // 预热线程数
  maxThreads: 8,   // 最大并发数
  maxQueue: 2,     // 队列限制（防OOM）
  idleTimeout: 120000,   // 空闲回收
  activityTimeout: 300000 // 任务超时
});

// 提交任务给线程池
const result = await videoPool.runTask({
  type: 'hash',
  data: buffer  // ArrayBuffer 传输
});`,
    keyCodeLang: 'typescript',
    keyNote: '💡 Piscina 实现了任务窃取算法，空闲线程会自动接手繁忙线程的队列任务，提升整体吞吐量。',
  },
  {
    id: 'express',
    title: 'Express.js REST API',
    techs: [
      { name: 'Express', version: '4.x', role: 'Node.js Web 框架', icon: '🚀' },
      { name: 'CORS', role: '跨域资源共享中间件', icon: '🔗' },
      { name: 'ESM', role: 'ES Module 原生模块系统', icon: '📦' },
    ],
    useCases: [
      { title: 'RESTful API 服务', desc: '标准 HTTP 接口，前后端分离架构', icon: '🌐' },
      { title: '文件上传处理', desc: '大文件 multipart 或 raw buffer 接收', icon: '📤' },
      { title: '中间件链路', desc: '认证、日志、限流、缓存等横切关注点', icon: '🔧' },
    ],
    prosCons: {
      pros: [
        '生态极其丰富，npm 中间件数量庞大',
        '学习曲线平缓，代码直观简洁',
        '灵活性高，不强制项目结构',
        '支持 raw buffer，适合大文件传输',
      ],
      cons: [
        '无内置 TypeScript 支持（需额外配置）',
        '回调风格遗留问题，需注意异步错误处理',
        '无框架级别的依赖注入',
        '高并发下建议配合 cluster 或反向代理',
      ],
    },
    keyCode: `// server.ts - 大文件 raw body 配置
app.use(express.raw({
  type: '*/*',
  limit: '10gb'  // 支持超大视频文件
}));

// 路由模块化
app.use('/api/worker', workerRouter);
app.use('/api/video', videoRouter);`,
    keyCodeLang: 'typescript',
    keyNote: '💡 本项目使用 raw body 接收视频文件（直接是 Buffer），避免 multipart 解析开销，直接传给 Worker 处理。',
  },
];

const rightSections: DocSection[] = [
  {
    id: 'vue3',
    title: 'Vue 3 + Composition API',
    techs: [
      { name: 'Vue 3', version: '3.x', role: '渐进式前端框架', icon: '💚' },
      { name: 'Vite', version: '5.x', role: '极速构建工具', icon: '⚡' },
      { name: 'TypeScript', version: '5.x', role: '类型安全开发', icon: '📘' },
      { name: 'Composition API', role: '逻辑复用与组合', icon: '🧩' },
    ],
    useCases: [
      { title: 'SPA 单页应用', desc: '复杂交互界面，无刷新体验', icon: '📱' },
      { title: '响应式数据绑定', desc: '实时展示 Worker 线程池状态', icon: '🔄' },
      { title: '组件化开发', desc: '可复用的 UI 逻辑单元', icon: '🧱' },
      { title: '大文件拖拽上传', desc: '原生 File API + DnD 事件处理', icon: '📁' },
    ],
    prosCons: {
      pros: [
        'Composition API 逻辑组合优于 Options API',
        'ref/reactive 精细化响应式追踪',
        'Vite 开发服务器热重载极快（< 50ms）',
        'TypeScript 一等公民支持',
        '生态完善：Pinia、Vue Router、VueUse',
      ],
      cons: [
        'Composition API 对初学者有学习曲线',
        'ref 需要 .value 解包，容易遗忘',
        '大型应用需要严格的代码规范',
        '相比 React 生态略小（但 Vue 更易上手）',
      ],
    },
    keyCode: `// Vue 3 Composition API 核心模式
const poolStats = ref<PoolStats | null>(null);
const isProcessing = ref(false);

// 生命周期 + 定时轮询
onMounted(async () => {
  poolStats.value = await getPoolStats();
  // 每 2s 更新线程池状态
  statsInterval = setInterval(async () => {
    poolStats.value = await getPoolStats();
  }, 2000);
});

onUnmounted(() => {
  clearInterval(statsInterval);  // 防内存泄漏
});`,
    keyCodeLang: 'typescript',
    keyNote: '💡 onUnmounted 中清理定时器是关键！否则组件销毁后定时器仍在运行，导致内存泄漏和无效请求。',
  },
  {
    id: 'architecture',
    title: '整体架构与数据流',
    techs: [
      { name: 'ArrayBuffer', role: '二进制数据传输（零序列化）', icon: '💾' },
      { name: 'FileReader API', role: '浏览器端文件读取', icon: '📖' },
      { name: 'Fetch API', role: '现代 HTTP 客户端', icon: '🌊' },
      { name: 'Object URL', role: '本地文件预览（内存管理）', icon: '🖼️' },
    ],
    useCases: [
      { title: '前后端分离', desc: 'Vue SPA + Express API，独立部署可扩展', icon: '🏗️' },
      { title: '流式处理管道', desc: '文件→Buffer→Worker→结果，全程异步', icon: '🔀' },
      { title: '实时状态监控', desc: '轮询 /api/stats，展示线程池健康度', icon: '📡' },
    ],
    prosCons: {
      pros: [
        'ArrayBuffer 传输，无 JSON 序列化开销',
        '任务可并行分配给多个 Worker 线程',
        '前端不存储文件，处理完即释放内存',
        '状态实时反馈，用户体验好',
      ],
      cons: [
        '大文件通过 HTTP 传输有带宽限制',
        '无持久化，刷新后结果丢失',
        '轮询消耗连接（可改用 WebSocket 推送）',
        '生产环境需加认证和限流',
      ],
    },
    keyCode: `// 数据流：浏览器文件 → ArrayBuffer → API
async function readFileBuffer(file: File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);  // 读取为二进制
  });
}

// fetch 发送 raw binary
const res = await fetch('/api/video/hash', {
  method: 'POST',
  body: buffer,  // 直接发 ArrayBuffer
  headers: { 'Content-Type': 'application/octet-stream' }
});`,
    keyCodeLang: 'typescript',
    keyNote: '💡 直接传输 ArrayBuffer 而不是 Base64 字符串，可节省 ~33% 的传输体积，并省去编解码 CPU 消耗。',
  },
];

const sections = props.side === 'left' ? leftSections : rightSections;
</script>

<template>
  <aside class="tech-docs" :class="`tech-docs--${side}`">
    <div class="docs-header">
      <div class="docs-header-icon">{{ side === 'left' ? '⚙️' : '🎨' }}</div>
      <div>
        <div class="docs-header-label">技术文档</div>
        <div class="docs-header-title">{{ side === 'left' ? '后端 & 核心技术' : '前端 & 架构设计' }}</div>
      </div>
    </div>

    <div class="docs-content">
      <div v-for="section in sections" :key="section.id" class="doc-section">
        <!-- Section Header -->
        <div class="section-title">
          <span class="section-title-bar"></span>
          {{ section.title }}
        </div>

        <!-- Tech Stack -->
        <div class="block-label">🛠️ 技术栈</div>
        <div class="tech-list">
          <div v-for="tech in section.techs" :key="tech.name" class="tech-tag">
            <span class="tech-icon">{{ tech.icon }}</span>
            <div class="tech-info">
              <span class="tech-name">{{ tech.name }}<span v-if="tech.version" class="tech-version">{{ tech.version }}</span></span>
              <span class="tech-role">{{ tech.role }}</span>
            </div>
          </div>
        </div>

        <!-- Use Cases -->
        <div class="block-label">🎯 适用场景</div>
        <div class="use-cases">
          <div v-for="uc in section.useCases" :key="uc.title" class="use-case">
            <span class="use-case-icon">{{ uc.icon }}</span>
            <div>
              <div class="use-case-title">{{ uc.title }}</div>
              <div class="use-case-desc">{{ uc.desc }}</div>
            </div>
          </div>
        </div>

        <!-- Pros & Cons -->
        <div class="block-label">⚖️ 优缺点分析</div>
        <div class="pros-cons">
          <div class="pros">
            <div class="pc-header pros-header">✅ 优点</div>
            <ul>
              <li v-for="pro in section.prosCons.pros" :key="pro">{{ pro }}</li>
            </ul>
          </div>
          <div class="cons">
            <div class="pc-header cons-header">⚠️ 注意</div>
            <ul>
              <li v-for="con in section.prosCons.cons" :key="con">{{ con }}</li>
            </ul>
          </div>
        </div>

        <!-- Key Code -->
        <template v-if="section.keyCode">
          <div class="block-label">💻 核心代码</div>
          <pre class="code-block"><code>{{ section.keyCode }}</code></pre>
          <div class="key-note">{{ section.keyNote }}</div>
        </template>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.tech-docs {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  position: sticky;
  top: 1.5rem;
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}

.tech-docs::-webkit-scrollbar { width: 4px; }
.tech-docs::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
.tech-docs::-webkit-scrollbar-track { background: transparent; }

.docs-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 14px 14px 0 0;
  border: 1px solid #334155;
  border-bottom: none;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tech-docs--right .docs-header {
  background: linear-gradient(135deg, #1e293b 0%, #12172a 100%);
}

.docs-header-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #334155;
  border-radius: 10px;
}

.docs-header-label {
  font-size: 0.65rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.docs-header-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #e2e8f0;
}

.docs-content {
  background: #111827;
  border: 1px solid #334155;
  border-top: none;
  border-radius: 0 0 14px 14px;
  padding: 0;
  overflow: hidden;
}

.doc-section {
  padding: 1.25rem;
  border-bottom: 1px solid #1e293b;
}

.doc-section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: linear-gradient(180deg, #667eea, #764ba2);
  flex-shrink: 0;
}

.block-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.6rem;
  margin-top: 1rem;
}

.block-label:first-of-type {
  margin-top: 0;
}

/* Tech Tags */
.tech-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.tech-tag {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.65rem;
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #2d3f55;
  transition: border-color 0.2s;
}

.tech-tag:hover {
  border-color: #667eea44;
}

.tech-icon {
  font-size: 1rem;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.tech-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.tech-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #c4b5fd;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.tech-version {
  font-size: 0.65rem;
  background: #334155;
  color: #94a3b8;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-weight: 400;
}

.tech-role {
  font-size: 0.72rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Use Cases */
.use-cases {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.use-case {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  background: #0f172a;
  border-radius: 8px;
  border-left: 2px solid #334155;
  transition: border-color 0.2s;
}

.use-case:hover {
  border-left-color: #667eea;
}

.use-case-icon {
  font-size: 0.9rem;
  margin-top: 0.05rem;
  flex-shrink: 0;
}

.use-case-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1;
  margin-bottom: 0.1rem;
}

.use-case-desc {
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.4;
}

/* Pros & Cons */
.pros-cons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pros, .cons {
  border-radius: 8px;
  overflow: hidden;
}

.pc-header {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.35rem 0.65rem;
  letter-spacing: 0.05em;
}

.pros-header {
  background: #052e16;
  color: #34d399;
}

.cons-header {
  background: #422006;
  color: #fb923c;
}

.pros ul, .cons ul {
  margin: 0;
  padding: 0.5rem 0.65rem 0.5rem 1.4rem;
  background: #0f172a;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pros li {
  font-size: 0.72rem;
  color: #6ee7b7;
  line-height: 1.4;
}

.cons li {
  font-size: 0.72rem;
  color: #fdba74;
  line-height: 1.4;
}

/* Code Block */
.code-block {
  background: #0a0f1a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.68rem;
  line-height: 1.6;
  color: #a5f3fc;
  overflow-x: auto;
  margin: 0;
  white-space: pre;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}

.code-block::-webkit-scrollbar { height: 3px; }
.code-block::-webkit-scrollbar-thumb { background: #334155; }

/* 语法高亮-简单颜色 */
.code-block code {
  color: #a5f3fc;
}

.key-note {
  margin-top: 0.5rem;
  font-size: 0.72rem;
  color: #94a3b8;
  background: #1e293b;
  border-left: 2px solid #f59e0b;
  padding: 0.4rem 0.65rem;
  border-radius: 0 6px 6px 0;
  line-height: 1.5;
}

/* Responsive - 允许更窄屏幕显示，而不是直接隐藏 */
@media (max-width: 1400px) {
  .tech-docs {
    width: 260px;
  }
}

@media (max-width: 1200px) {
  .tech-docs {
    width: 220px;
  }
  .tech-name { font-size: 0.75rem; }
  .use-case-title { font-size: 0.75rem; }
  .section-title { font-size: 0.85rem; }
}

@media (max-width: 900px) {
  .tech-docs {
    display: none; /* 只有实在太窄的手持设备分辨率才隐藏 */
  }
}
</style>
