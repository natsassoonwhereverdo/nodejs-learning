// ============================================================
// 知识库数据层 - 所有分类和文章静态数据定义
// 新增文章只需往 articles 数组添加一条记录即可
// ============================================================

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  gradient: string;
  description: string;
}

export interface TechItem {
  name: string;
  version?: string;
  role: string;
  icon: string;
}

export interface UseCase {
  title: string;
  desc: string;
  icon: string;
}

export interface ProCon {
  pros: string[];
  cons: string[];
}

export interface TechDocData {
  techs: TechItem[];
  useCases: UseCase[];
  prosCons: ProCon;
  keyCode?: string;
  keyCodeLang?: string;
  keyNote?: string;
}

export interface Article {
  id: string;
  categoryId: string;
  subCategory: string;
  title: string;
  description: string;
  tags: string[];
  component: string; // Vue 组件名
  createdAt: string;
  techDocs: TechDocData[];
}

// ---- 分类定义 ----
export const categories: Category[] = [
  {
    id: 'frontend',
    name: '前端',
    nameEn: 'Frontend',
    icon: '🎨',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    description: 'Vue、React、CSS、构建工具等前端技术栈',
  },
  {
    id: 'backend',
    name: '后端',
    nameEn: 'Backend',
    icon: '⚙️',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    description: 'Node.js、Express、数据库等服务端技术',
  },
  {
    id: 'devops',
    name: '运维',
    nameEn: 'DevOps',
    icon: '🔧',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    description: 'Docker、CI/CD、Nginx 等部署与运维',
  },
];

// ---- 文章/知识点定义 ----
export const articles: Article[] = [
  {
    id: 'worker-threads',
    categoryId: 'backend',
    subCategory: 'Node.js',
    title: 'Worker Threads 线程池',
    description:
      '演示如何使用 Piscina 线程池并行处理 CPU 密集型任务，包括视频哈希计算、元数据提取、缩略图生成和转码模拟。',
    tags: ['Piscina', 'TypeScript', 'ArrayBuffer', 'Worker'],
    component: 'VideoUploader',
    createdAt: '2025-12-01',
    techDocs: [
      {
        techs: [
          { name: 'worker_threads', role: 'Node.js 内置多线程机制 (同一进程内)', icon: '⚙️' },
          { name: 'Piscina', version: 'v4', role: '基于 worker_threads 的高性能线程池', icon: '🏊' },
          { name: 'child_process', role: '衍生子进程（调用 ffmpeg 外部程序时使用）', icon: '🖧' },
        ],
        useCases: [
          { title: '纯 CPU 密集计算', desc: '如哈希计算、加解密计算，完全在 JS 多线程内完成，不阻塞主线程。', icon: '🔢' },
          { title: '混合外部命令调用', desc: '结合 child_process 异步调用 ffmpeg 等外部 C/C++ 程序处理音视频。', icon: '🎬' },
        ],
        prosCons: {
          pros: [
            'worker_threads 是真正的多线程并行，但仍然属于同一个 Node 进程，内存占用比开启多个进程小。',
            '支持 SharedArrayBuffer，实现在线程之间零拷贝传递大块数据。',
            '通过 filename (如 video-task.js) 将繁重的逻辑隔离在独立的 V8 上下文中。',
          ],
          cons: [
            'Node.js 的多线程不同于 Java/C++，它无法在多线程间直接共享复杂的 JS 对象。',
            '内部调用 ffmpeg (spawn) 其实是开启了新的子进程，属于多进程范畴，需要注意控制并发数量防止撑爆内存。',
          ],
        },
        keyCode: `// pool.ts - Piscina 线程池配置
const videoPool = new Piscina({
  // worker-task.js 是各个线程独立加载执行的具体业务代码文件
  filename: 'video-task.js', 
  minThreads: 4,
  maxThreads: 8
});

// 在 video-task.js 中：
export default async function(task) {
  // 根据 task.type 执行具体的重度计算或调用 spawn 子进程
  if (task.type === 'metadata') {
    return extractMetadata(task.data); // 将调用 child_process
  }
}`,
        keyCodeLang: 'typescript',
        keyNote:
          '💡 重点：Worker 线程和多进程（cluster/child_process）不同。当前的综合示例是混合型：Node 内部调度用开了 8 个 Worker 线程，而当 Worker 需要提取视频元数据时，又用 spawn 呼出了 ffmpeg 外部子进程。`video-task.js` 就是每个 Worker 拿到要执行的“任务清单和运行代码”。',      },
      {
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
  limit: '10gb'
}));

app.use('/api/worker', workerRouter);
app.use('/api/video', videoRouter);`,
        keyCodeLang: 'typescript',
        keyNote:
          '💡 本项目使用 raw body 接收视频文件（直接是 Buffer），避免 multipart 解析开销。',
      },
    ],
  },
  {
    id: 'worker-basic',
    categoryId: 'backend',
    subCategory: 'Node.js',
    title: 'Worker 基础计算',
    description:
      '斐波那契数列和质数筛法的多线程演示，展示 Worker 线程如何处理递归计算和大规模数据筛选。',
    tags: ['worker_threads', '斐波那契', '埃拉托斯特尼筛法'],
    component: 'WorkerTester',
    createdAt: '2025-11-15',
    techDocs: [
      {
        techs: [
          { name: 'worker_threads', role: 'Node.js 原生 Worker 线程', icon: '⚙️' },
          { name: 'Piscina', version: 'v4', role: '线程池管理', icon: '🏊' },
        ],
        useCases: [
          { title: '递归计算', desc: '斐波那契数列等 CPU 密集递归运算', icon: '🔢' },
          { title: '数学筛法', desc: '埃拉托斯特尼筛法找质数', icon: '🧮' },
          { title: '并发比较', desc: '单线程 vs 多线程性能对比', icon: '⚡' },
        ],
        prosCons: {
          pros: [
            '直观体验多线程加速效果',
            '理解 Worker 线程通信机制',
            '入门级示例，便于学习',
          ],
          cons: [
            '简单示例不能完全体现实际复杂场景',
            '递归深度受限于栈大小',
          ],
        },
        keyCode: `// 斐波那契递归计算
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// 质数筛法
function sieveOfEratosthenes(max: number): number[] {
  const sieve = new Uint8Array(max + 1);
  for (let i = 2; i * i <= max; i++) {
    if (!sieve[i]) {
      for (let j = i * i; j <= max; j += i) {
        sieve[j] = 1;
      }
    }
  }
  return [...Array(max + 1).keys()].filter(i => i >= 2 && !sieve[i]);
}`,
        keyCodeLang: 'typescript',
        keyNote: '💡 递归斐波那契时间复杂度 O(2^n)，n=40 时主线程会阻塞数秒，Worker 可避免阻塞。',
      },
    ],
  },
  {
    id: 'memory-leak-gc-lab',
    categoryId: 'backend',
    subCategory: 'Node.js',
    title: '内存泄漏排查与 V8 GC 抖动复现',
    description:
      '复现流量高峰下的“内存阶梯上涨 + P99 周期抖动 + OOM 重启”场景，并提供一键切换修复模式，讲解生产排查链路。',
    tags: ['V8 GC', 'Memory Leak', 'Heap Snapshot', 'P99', 'Node.js'],
    component: 'MemoryLeakLab',
    createdAt: '2026-03-27',
    techDocs: [
      {
        techs: [
          { name: 'V8 GC', role: '新生代/老生代分代回收与 STW 停顿机制', icon: '🧠' },
          { name: 'Heap Snapshot', role: '对比 retained size，定位泄漏引用链', icon: '📸' },
          { name: 'Prometheus/Grafana', role: '监控 heap、rss、GC pause 与 P99 指标', icon: '📈' },
        ],
        useCases: [
          { title: '线上长尾抖动分析', desc: '通过 GC 日志与延迟曲线时间对齐确认 Full GC 影响。', icon: '⏱️' },
          { title: '内存泄漏根因定位', desc: '在高峰前后抓 heap dump diff，定位持续增长对象。', icon: '🔍' },
          { title: '修复灰度验证', desc: '发布后验证内存曲线是否回落、P99 是否恢复稳定。', icon: '🧪' },
        ],
        prosCons: {
          pros: [
            '可交互复现“故障到修复”的完整链路，便于面试和团队培训。',
            '把抽象的 V8 GC 原理映射到可观测指标和可操作按钮。',
            '覆盖缓存、监听器、定时器三类常见泄漏反模式。',
          ],
          cons: [
            '实验中的暂停模拟用于稳定复现，线上还应结合真实 GC 日志验证。',
            '示例偏教学导向，生产系统需要结合业务数据结构做更细粒度治理。',
          ],
        },
        keyCode: `// Memory Leak Lab: 泄漏模式核心逻辑
if (mode === 'leak') {
  leakedObjects.push(payload);      // 不受控缓存
  emitter.on('tick', listener);     // 监听器不释放
  setInterval(() => use(payload), 60000); // 定时器闭包泄漏
}

// 修复模式
if (mode === 'fixed') {
  leakedObjects.length = 0;
  emitter.removeAllListeners('tick');
  clearInterval(timer);
}`,
        keyCodeLang: 'typescript',
        keyNote:
          '💡 建议在生产中配合 --trace-gc、heap snapshot diff 和 pprof flamegraph 一起定位，单一指标容易误判。',
      },
    ],
  },
  {
    id: 'concurrency-event-loop-lab',
    categoryId: 'backend',
    subCategory: 'Node.js',
    title: '高并发任务调度与 Event Loop 实验',
    description:
      '复现 Promise.all 全量并发带来的内存与长尾问题，并通过有界并发控制器、背压思路和 Event Loop 调度策略完成修复。',
    tags: ['Promise.all', '并发控制', 'Event Loop', 'process.nextTick', 'setImmediate'],
    component: 'ConcurrencyEventLoopLab',
    createdAt: '2026-03-27',
    techDocs: [
      {
        techs: [
          { name: 'Promise', role: '异步任务封装；错误聚合策略直接影响批处理稳定性', icon: '🤝' },
          { name: 'Event Loop', role: 'Node.js 阶段调度模型，决定 I/O 与回调执行时机', icon: '🔄' },
          { name: 'Backpressure', role: '有界并发与限流，避免下游与自身资源被打爆', icon: '🧯' },
        ],
        useCases: [
          { title: '日常跑批任务', desc: '百万级数据清洗、通知发送、第三方同步等离线任务。', icon: '🌙' },
          { title: '高并发 API 分发', desc: '对接外部 API 时控制 in-flight，降低 429/timeout 风险。', icon: '🌐' },
          { title: '事件循环健康治理', desc: '通过 lag 监控防止 nextTick 滥用导致饥饿。', icon: '📊' },
        ],
        prosCons: {
          pros: [
            '可视化对比“错误实现 vs 修复实现”，快速理解并发失控的代价。',
            '同时观察内存、P99、Event Loop lag 与 in-flight 峰值，便于建立系统视角。',
            '示例包含手写并发控制器核心骨架，可直接迁移到业务代码。',
          ],
          cons: [
            '实验中的第三方 API 延迟为模拟值，线上还需结合真实 SLA 调参。',
            '单进程示例未覆盖分布式调度与多 Pod 全局限流场景。',
          ],
        },
        keyCode: `// 错误写法：一次性创建全部 Promise，瞬时并发失控
const users = await loadAllUsers();
const jobs = users.map((u) => sendToThirdParty(transform(u)));
await Promise.all(jobs);

// 修复写法：有界并发 + worker 循环
let cursor = 0;
async function worker() {
  while (cursor < total) {
    const i = cursor++;
    await sendToThirdParty(transform(buildUser(i)));
    if (i % 80 === 0) await new Promise((r) => setImmediate(r));
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));`,
        keyCodeLang: 'typescript',
        keyNote:
          '💡 关键不是“并发越大越快”，而是让并发稳定在下游可承受的窗口内，并持续观测成功率与 P99。',
      },
    ],
  },
  {
    id: 'async-context-tracing-lab',
    categoryId: 'backend',
    subCategory: 'Node.js',
    title: '中间件模型与异步上下文追踪实验',
    description:
      '围绕 Koa/NestJS 的洋葱模型、Node.js AsyncLocalStorage 与 traceId 隐式透传，讲清实现步骤、落地方式和性能取舍。',
    tags: ['Koa', 'NestJS', 'AsyncLocalStorage', 'traceId', 'async_hooks'],
    component: 'AsyncContextTraceLab',
    createdAt: '2026-03-28',
    techDocs: [
      {
        techs: [
          { name: 'Koa Middleware', role: '洋葱模型编排中间件的前后置逻辑', icon: '🧅' },
          { name: 'AsyncLocalStorage', role: '按异步调用链隐式保存 traceId 上下文', icon: '🧬' },
          { name: 'Structured Logging', role: '日志、DB、RPC 统一注入 traceId', icon: '🪪' },
        ],
        useCases: [
          { title: '网关请求追踪', desc: '入口生成 traceId，并贯穿所有后续日志、下游调用与错误上报。', icon: '🚪' },
          { title: '调用链排障', desc: '按 traceId 关联 Controller、Service、Model、RPC 的整条请求路径。', icon: '🧭' },
          { title: '多框架统一观测', desc: 'Koa、NestJS、Express 封装层可共享同一种上下文读取方式。', icon: '🛰️' },
        ],
        prosCons: {
          pros: [
            '无需一层层传参，业务代码侵入性低，适合深层调用链。',
            '日志、数据库、RPC 可统一从上下文读取 traceId，减少重复样板代码。',
            '和结构化日志、链路追踪、OpenTelemetry 容易融合。',
          ],
          cons: [
            '依赖 async_hooks 运行时能力，旧 Node.js 版本和部分第三方库兼容性较差。',
            '高频场景下存在额外上下文追踪开销，store 也不能放入过大的对象。',
          ],
        },
        keyCode: `import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const als = new AsyncLocalStorage<{ traceId: string }>();

app.use(async (ctx, next) => {
  const traceId = ctx.get('x-trace-id') || randomUUID();
  ctx.set('x-trace-id', traceId);

  await als.run({ traceId }, async () => {
    await next();
  });
});

export function getTraceId() {
  return als.getStore()?.traceId;
}`,
        keyCodeLang: 'typescript',
        keyNote:
          '💡 入口层负责创建上下文，封装层负责读取上下文；不要把 traceId 作为参数散落到每个业务函数里。',
      },
    ],
  },
  {
    id: 'stream-proxy-network-boundary-lab',
    categoryId: 'backend',
    subCategory: 'Node.js',
    title: '大文件流式代理与网络异常阻断',
    description:
      'BFF 层代理大文件下载时，模拟客户端中途断连（网络波动、标签页关闭），对比 pipe 与 pipeline 两种写法在「上游是否继续浪费资源」上的差异。',
    tags: ['Stream', 'pipeline', 'Client Disconnect', 'BFF', 'Node.js'],
    component: 'StreamProxyLab',
    createdAt: '2026-03-28',
    techDocs: [
      {
        techs: [
          { name: 'stream.pipeline', role: '自动绑定三个流的错误处理，任意一个出错时统一销毁整条管道', icon: '🧵' },
          { name: 'req.on(“aborted”)', role: '监听客户端连接断开事件', icon: '🔌' },
          { name: 'upstreamReq.destroy()', role: '主动切断上游请求，避免继续消耗带宽和 CPU', icon: '🛑' },
        ],
        useCases: [
          { title: 'BFF 下载代理', desc: 'Node.js 作为网关，把 OSS/S3 的大文件流式转发给前端，不把整个文件加载到内存。', icon: '📦' },
          { title: '弱网异常处理', desc: '手机网络切换、用户强制刷新、标签页关闭时，快速清理上游连接，不留悬挂进程。', icon: '📡' },
          { title: '资源泄漏排查', desc: '通过 leakRisk / activeUpstream / upstreamAbort 三个指标，直观看到断连后资源是否被正确回收。', icon: '🧪' },
        ],
        prosCons: {
          pros: [
            'pipeline 把错误传播、销毁和收尾逻辑收敛到一处，减少漏处理分支。',
            '客户端断连时及时 destroy 上游，可避免无意义的带宽与 CPU 消耗。',
            '通过实验指标可直观看到 leakRisk、activeUpstream、upstreamAbort 的变化。',
          ],
          cons: [
            '只替换为 pipeline 仍不够，必须同时监听 req aborted / res close 等边界事件。',
            '若上游协议或 SDK 屏蔽底层流对象，仍需额外封装中断能力。',
          ],
        },
        keyCode: `// 【错误写法】只用 pipe，不处理断连后的上游清理
upstreamRes.pipe(res);
// 客户端断连 → pipe 不会自动停止上游 → leakRisk ↑↑↑

// 【正确写法】pipeline + 监听断连事件并主动 destroy 上游
req.on('aborted', () => {
  // 客户端连接已断开，立即停止上游
  upstreamReq.destroy(new Error('client disconnected'));
});

res.on('close', () => {
  // 响应流意外关闭（如客户端提前断开）
  if (!res.writableEnded) upstreamReq.destroy();
});

pipeline(upstreamRes, res, (err) => {
  // 管道结束的统一回调
  // err 非空表示有错误发生（客户端断连、上游错误等）
});`,
        keyCodeLang: 'typescript',
        keyNote:
          '⚠️ 本实验关注的是「断连后上游是否及时停止」，而非断点重传。真正的断点重传需要额外实现：服务端记录已发送字节数 + 客户端支持 Range 请求 + 续传时传递 Range Header。',
      },
    ],
  },
];

// ---- 辅助函数 ----

export function getCategoryById(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getArticleById(id: string): Article | undefined {
  return articles.find((a) => a.id === id);
}

export function getArticlesByCategory(categoryId: string): Article[] {
  return articles.filter((a) => a.categoryId === categoryId);
}

export function getArticleCountByCategory(categoryId: string): number {
  return articles.filter((a) => a.categoryId === categoryId).length;
}

export function getAllSubCategories(categoryId: string): string[] {
  const subs = articles
    .filter((a) => a.categoryId === categoryId)
    .map((a) => a.subCategory);
  return [...new Set(subs)];
}

export function searchArticles(query: string): Article[] {
  const q = query.toLowerCase();
  return articles.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q)) ||
      a.subCategory.toLowerCase().includes(q)
  );
}
