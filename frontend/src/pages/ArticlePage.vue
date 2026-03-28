<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getArticleById, getCategoryById } from '../data/knowledgeData';

const route = useRoute();
const router = useRouter();

const article = computed(() => getArticleById(route.params.id as string));
const category = computed(() =>
  article.value ? getCategoryById(article.value.categoryId) : undefined
);

// 动态加载示例组件
const ExampleComponent = computed(() => {
  if (!article.value) return null;
  const componentMap: Record<string, ReturnType<typeof defineAsyncComponent>> = {
    VideoUploader: defineAsyncComponent(
      () => import('../components/VideoUploader.vue')
    ),
    WorkerTester: defineAsyncComponent(
      () => import('../components/WorkerTester.vue')
    ),
    MemoryLeakLab: defineAsyncComponent(
      () => import('../components/MemoryLeakLab.vue')
    ),
    ConcurrencyEventLoopLab: defineAsyncComponent(
      () => import('../components/ConcurrencyEventLoopLab.vue')
    ),
    AsyncContextTraceLab: defineAsyncComponent(
      () => import('../components/AsyncContextTraceLab.vue')
    ),
    StreamProxyLab: defineAsyncComponent(
      () => import('../components/StreamProxyLab.vue')
    ),
  };
  return componentMap[article.value.component] || null;
});
</script>

<template>
  <div class="article-page" v-if="article && category">
    <!-- Article Header -->
    <header class="article-header">
      <button class="back-btn" @click="router.push(`/category/${category.id}`)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {{ category.name }}
      </button>

      <div class="header-body">
        <div class="header-meta">
          <span
            class="header-cat-badge"
            :style="{ background: category.color + '1a', color: category.color, borderColor: category.color + '33' }"
          >
            {{ category.icon }} {{ article.subCategory }}
          </span>
          <span class="header-date">{{ article.createdAt }}</span>
        </div>
        <h1 class="article-title">{{ article.title }}</h1>
        <p class="article-desc">{{ article.description }}</p>
        <div class="article-tags">
          <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </header>

    <!-- Content Grid: Demo + Docs side by side -->
    <div class="content-grid">
      <!-- Demo Area -->
      <section class="demo-section">
        <div class="section-label">
          <span class="label-icon">🚀</span> 交互演示
        </div>
        <div class="demo-container">
          <component :is="ExampleComponent" v-if="ExampleComponent" />
          <div v-else class="no-demo">
            <span class="no-demo-icon">🚧</span>
            <p>该示例暂无交互演示组件</p>
          </div>
        </div>
      </section>

      <!-- Tech Docs Panel -->
      <aside class="docs-section">
        <div class="section-label">
          <span class="label-icon">📖</span> 技术文档
        </div>

        <div v-for="(doc, i) in article.techDocs" :key="i" class="doc-block">
          <!-- Tech Stack -->
          <div class="block-label">🛠️ 技术栈</div>
          <div class="tech-list">
            <div v-for="tech in doc.techs" :key="tech.name" class="tech-item">
              <span class="tech-icon">{{ tech.icon }}</span>
              <div class="tech-info">
                <span class="tech-name">
                  {{ tech.name }}
                  <span v-if="tech.version" class="tech-ver">{{ tech.version }}</span>
                </span>
                <span class="tech-role">{{ tech.role }}</span>
              </div>
            </div>
          </div>

          <!-- Use Cases -->
          <div class="block-label">🎯 适用场景</div>
          <div class="use-case-list">
            <div v-for="uc in doc.useCases" :key="uc.title" class="use-case">
              <span class="uc-icon">{{ uc.icon }}</span>
              <div>
                <div class="uc-title">{{ uc.title }}</div>
                <div class="uc-desc">{{ uc.desc }}</div>
              </div>
            </div>
          </div>

          <!-- Pros & Cons -->
          <div class="block-label">⚖️ 优缺点分析</div>
          <div class="pros-cons">
            <div class="pc-section pc-pros">
              <div class="pc-header">✅ 优点</div>
              <ul>
                <li v-for="p in doc.prosCons.pros" :key="p">{{ p }}</li>
              </ul>
            </div>
            <div class="pc-section pc-cons">
              <div class="pc-header">⚠️ 注意</div>
              <ul>
                <li v-for="c in doc.prosCons.cons" :key="c">{{ c }}</li>
              </ul>
            </div>
          </div>

          <!-- Key Code -->
          <template v-if="doc.keyCode">
            <div class="block-label">💻 核心代码</div>
            <pre class="code-block"><code>{{ doc.keyCode }}</code></pre>
            <div v-if="doc.keyNote" class="key-note">{{ doc.keyNote }}</div>
          </template>

          <hr v-if="i < article.techDocs.length - 1" class="doc-divider" />
        </div>
      </aside>
    </div>
  </div>

  <!-- Not Found -->
  <div v-else class="not-found">
    <p>文章不存在</p>
    <router-link to="/" class="back-link">← 返回首页</router-link>
  </div>
</template>

<style scoped>
.article-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 1.5rem 2rem 4rem;
}

/* ---- Header ---- */
.article-header {
  margin-bottom: 2rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  color: #7a8ba3;
  cursor: pointer;
  font-size: 0.82rem;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  transition: color 0.2s, background 0.2s;
}

.back-btn:hover {
  color: #e8ecf1;
  background: #151d2e;
}

.header-body {
  padding-left: 0.25rem;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.header-cat-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  border: 1px solid;
}

.header-date {
  font-size: 0.75rem;
  color: #4a5568;
  font-variant-numeric: tabular-nums;
}

.article-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: #e8ecf1;
  margin: 0 0 0.6rem;
  letter-spacing: -0.02em;
}

.article-desc {
  font-size: 0.95rem;
  color: #7a8ba3;
  margin: 0 0 1rem;
  line-height: 1.6;
  max-width: 700px;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag {
  font-size: 0.72rem;
  padding: 0.2rem 0.6rem;
  background: #151d2e;
  border: 1px solid #1e2a3a;
  border-radius: 5px;
  color: #7a8ba3;
}

/* ---- Content Grid ---- */
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1.5rem;
  align-items: start;
}

/* ---- Section Label ---- */
.section-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #7a8ba3;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.75rem;
}

.label-icon { font-size: 0.9rem; }

/* ---- Demo Section ---- */
.demo-section {
  min-width: 0;
  width: 100%;
}

.demo-container {
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 14px;
  overflow: visible;
  width: 100%;
}

.no-demo {
  padding: 3rem;
  text-align: center;
  color: #4a5568;
}

.no-demo-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.75rem;
}

/* ---- Docs Section ---- */
.docs-section {
  position: sticky;
  top: calc(56px + 1.5rem);
  max-height: calc(100vh - 56px - 3rem);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #1e2a3a transparent;
}

.docs-section::-webkit-scrollbar { width: 4px; }
.docs-section::-webkit-scrollbar-thumb { background: #1e2a3a; border-radius: 2px; }

.doc-block {
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 0.75rem;
}

.doc-divider {
  border: none;
  border-top: 1px solid #1e2a3a;
  margin: 1.25rem 0;
}

.block-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #4a5568;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 1rem 0 0.5rem;
}

.block-label:first-child { margin-top: 0; }

/* Tech Stack */
.tech-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tech-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.6rem;
  background: #151d2e;
  border-radius: 8px;
  border: 1px solid #1e2a3a;
  transition: border-color 0.2s;
}

.tech-item:hover { border-color: #2e3a4e; }

.tech-icon {
  font-size: 1rem;
  flex-shrink: 0;
  width: 22px;
  text-align: center;
}

.tech-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
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

.tech-ver {
  font-size: 0.62rem;
  background: #1e2a3a;
  color: #7a8ba3;
  padding: 0.08rem 0.3rem;
  border-radius: 4px;
  font-weight: 400;
}

.tech-role {
  font-size: 0.72rem;
  color: #4a5568;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Use Cases */
.use-case-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.use-case {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  background: #0b1120;
  border-radius: 8px;
  border-left: 2px solid #1e2a3a;
  transition: border-color 0.2s;
}

.use-case:hover { border-left-color: #6366f1; }

.uc-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
  margin-top: 0.05rem;
}

.uc-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #e8ecf1;
}

.uc-desc {
  font-size: 0.7rem;
  color: #4a5568;
  line-height: 1.4;
}

/* Pros & Cons */
.pros-cons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pc-section { border-radius: 8px; overflow: hidden; }

.pc-header {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.35rem 0.65rem;
  letter-spacing: 0.05em;
}

.pc-pros .pc-header { background: #052e16; color: #34d399; }
.pc-cons .pc-header { background: #422006; color: #fb923c; }

.pc-section ul {
  margin: 0;
  padding: 0.5rem 0.65rem 0.5rem 1.4rem;
  background: #0b1120;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.pc-pros li { font-size: 0.72rem; color: #6ee7b7; line-height: 1.4; }
.pc-cons li { font-size: 0.72rem; color: #fdba74; line-height: 1.4; }

/* Code */
.code-block {
  background: #0b1120;
  border: 1px solid #1e2a3a;
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'Geist Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.68rem;
  line-height: 1.6;
  color: #a5f3fc;
  overflow-x: auto;
  margin: 0;
  white-space: pre;
  scrollbar-width: thin;
  scrollbar-color: #1e2a3a transparent;
}

.code-block::-webkit-scrollbar { height: 3px; }
.code-block::-webkit-scrollbar-thumb { background: #1e2a3a; }

.key-note {
  margin-top: 0.5rem;
  font-size: 0.72rem;
  color: #7a8ba3;
  background: #151d2e;
  border-left: 2px solid #f59e0b;
  padding: 0.4rem 0.65rem;
  border-radius: 0 6px 6px 0;
  line-height: 1.5;
}

/* ---- Not Found ---- */
.not-found {
  text-align: center;
  padding: 4rem 2rem;
  color: #7a8ba3;
}

.back-link {
  color: #6366f1;
  text-decoration: none;
}

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  .docs-section {
    position: static;
    max-height: none;
  }
}

@media (max-width: 640px) {
  .article-page { padding: 1rem; }
  .article-title { font-size: 1.3rem; }
}
</style>
