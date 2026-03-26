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
