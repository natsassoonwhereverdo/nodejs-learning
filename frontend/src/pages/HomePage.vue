<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { categories, articles, getArticleCountByCategory } from '../data/knowledgeData';

const router = useRouter();

const recentArticles = computed(() => {
  return [...articles]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
});
</script>

<template>
  <div class="home-page">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-glow"></div>
      <h1 class="hero-title">
        <span class="hero-emoji">🧠</span>
        个人 IT 知识库
      </h1>
      <p class="hero-desc">
        系统化记录前端、后端、运维等 IT 领域的知识与实践案例
      </p>
      <div class="hero-stats">
        <div class="stat-pill">
          <span class="stat-num">{{ categories.length }}</span>
          <span class="stat-label">个分类</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">{{ articles.length }}</span>
          <span class="stat-label">篇文章</span>
        </div>
      </div>
    </section>

    <!-- Categories Grid -->
    <section class="categories-section">
      <h2 class="section-title">📂 知识分类</h2>
      <div class="categories-grid">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="category-card"
          @click="router.push(`/category/${cat.id}`)"
        >
          <div class="card-accent" :style="{ background: cat.gradient }"></div>
          <div class="card-body">
            <div class="card-icon-row">
              <span class="card-icon">{{ cat.icon }}</span>
              <span class="card-count" :style="{ color: cat.color }">
                {{ getArticleCountByCategory(cat.id) }} 篇
              </span>
            </div>
            <h3 class="card-title">{{ cat.name }}</h3>
            <p class="card-name-en">{{ cat.nameEn }}</p>
            <p class="card-desc">{{ cat.description }}</p>
          </div>
          <div class="card-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </button>
      </div>
    </section>

    <!-- Recent Articles -->
    <section class="recent-section">
      <h2 class="section-title">📝 最近文章</h2>
      <div class="articles-list">
        <router-link
          v-for="article in recentArticles"
          :key="article.id"
          :to="`/article/${article.id}`"
          class="article-card"
        >
          <div class="article-meta">
            <span
              class="article-cat-dot"
              :style="{ background: categories.find(c => c.id === article.categoryId)?.color }"
            ></span>
            <span class="article-sub">{{ article.subCategory }}</span>
            <span class="article-date">{{ article.createdAt }}</span>
          </div>
          <h3 class="article-title">{{ article.title }}</h3>
          <p class="article-desc">{{ article.description }}</p>
          <div class="article-tags">
            <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 2rem 4rem;
}

/* ---- Hero ---- */
.hero {
  position: relative;
  text-align: center;
  padding: 3rem 1rem 2.5rem;
  margin-bottom: 2.5rem;
  overflow: hidden;
}

.hero-glow {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  width: 320px;
  height: 200px;
  background: radial-gradient(ellipse, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.hero-title {
  font-size: 2.2rem;
  font-weight: 800;
  color: #e8ecf1;
  margin: 0 0 0.75rem;
  letter-spacing: -0.03em;
  position: relative;
}

.hero-emoji {
  font-size: 2.4rem;
  vertical-align: middle;
  margin-right: 0.3rem;
}

.hero-desc {
  font-size: 1rem;
  color: #7a8ba3;
  margin: 0 0 1.5rem;
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 1rem;
  background: #151d2e;
  border: 1px solid #1e2a3a;
  border-radius: 20px;
}

.stat-num {
  font-size: 1.1rem;
  font-weight: 700;
  color: #6366f1;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.8rem;
  color: #7a8ba3;
}

/* ---- Section Title ---- */
.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #e8ecf1;
  margin: 0 0 1.25rem;
}

/* ---- Categories Grid ---- */
.categories-section {
  margin-bottom: 3rem;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.category-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  text-align: left;
  color: inherit;
}

.category-card:hover {
  transform: translateY(-2px);
  border-color: #2e3a4e;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.card-accent {
  height: 3px;
  width: 100%;
}

.card-body {
  padding: 1.25rem 1.5rem 1rem;
  flex: 1;
}

.card-icon-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.card-icon {
  font-size: 1.8rem;
}

.card-count {
  font-size: 0.78rem;
  font-weight: 600;
}

.card-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e8ecf1;
  margin: 0 0 0.15rem;
}

.card-name-en {
  font-size: 0.78rem;
  color: #4a5568;
  margin: 0 0 0.6rem;
  font-weight: 500;
}

.card-desc {
  font-size: 0.82rem;
  color: #7a8ba3;
  margin: 0;
  line-height: 1.5;
}

.card-arrow {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 1.5rem 1rem;
  color: #4a5568;
  transition: color 0.2s, transform 0.2s;
}

.category-card:hover .card-arrow {
  color: #6366f1;
  transform: translateX(4px);
}

/* ---- Recent Articles ---- */
.recent-section {
  margin-bottom: 2rem;
}

.articles-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.article-card {
  display: block;
  padding: 1.25rem 1.5rem;
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, border-color 0.2s;
}

.article-card:hover {
  transform: translateX(4px);
  border-color: #2e3a4e;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.article-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.article-sub {
  font-size: 0.75rem;
  font-weight: 600;
  color: #7a8ba3;
}

.article-date {
  font-size: 0.72rem;
  color: #4a5568;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.article-card .article-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #e8ecf1;
  margin: 0 0 0.35rem;
}

.article-desc {
  font-size: 0.82rem;
  color: #7a8ba3;
  margin: 0 0 0.65rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag {
  font-size: 0.68rem;
  padding: 0.15rem 0.55rem;
  background: #151d2e;
  border: 1px solid #1e2a3a;
  border-radius: 4px;
  color: #7a8ba3;
}

@media (max-width: 640px) {
  .home-page { padding: 1.25rem; }
  .hero-title { font-size: 1.6rem; }
  .categories-grid { grid-template-columns: 1fr; }
}
</style>
