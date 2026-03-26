<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getCategoryById,
  getArticlesByCategory,
  getAllSubCategories,
} from '../data/knowledgeData';

const route = useRoute();
const router = useRouter();

const category = computed(() => getCategoryById(route.params.id as string));

const subCategories = computed(() => {
  if (!category.value) return [];
  let subs = getAllSubCategories(category.value.id);
  
  if (route.query.sub) {
    subs = subs.filter(sub => sub === route.query.sub);
  }
  
  return subs.map((sub) => ({
    name: sub,
    articles: getArticlesByCategory(category.value!.id).filter(
      (a) => a.subCategory === sub
    ),
  }));
});

const totalArticles = computed(() =>
  getArticlesByCategory(route.params.id as string).length
);
</script>

<template>
  <div class="category-page" v-if="category">
    <!-- Category Header -->
    <header class="cat-header">
      <div class="cat-accent" :style="{ background: category.gradient }"></div>
      <div class="cat-header-body">
        <div class="cat-header-top">
          <span class="cat-icon-large">{{ category.icon }}</span>
          <div>
            <h1 class="cat-title">{{ category.name }}</h1>
            <p class="cat-name-en">{{ category.nameEn }}</p>
          </div>
        </div>
        <p class="cat-description">{{ category.description }}</p>
        <div class="cat-meta">
          <span class="meta-pill" :style="{ borderColor: category.color + '44', color: category.color }">
            {{ totalArticles }} 篇文章
          </span>
          <span class="meta-pill">
            {{ subCategories.length }} 个子分类
          </span>
        </div>
      </div>
    </header>

    <!-- Sub-categories & Articles -->
    <div v-for="sub in subCategories" :key="sub.name" class="subcategory-section">
      <h2 class="sub-title">
        <span class="sub-bar" :style="{ background: category.color }"></span>
        {{ sub.name }}
        <span class="sub-count">{{ sub.articles.length }}</span>
      </h2>
      <div class="articles-grid">
        <router-link
          v-for="article in sub.articles"
          :key="article.id"
          :to="`/article/${article.id}`"
          class="article-card"
        >
          <div class="card-top-accent" :style="{ background: category.gradient }"></div>
          <div class="card-content">
            <h3 class="card-title">{{ article.title }}</h3>
            <p class="card-desc">{{ article.description }}</p>
            <div class="card-bottom">
              <div class="card-tags">
                <span v-for="tag in article.tags.slice(0, 3)" :key="tag" class="tag">
                  {{ tag }}
                </span>
                <span v-if="article.tags.length > 3" class="tag tag-more">
                  +{{ article.tags.length - 3 }}
                </span>
              </div>
              <span class="card-date">{{ article.createdAt }}</span>
            </div>
          </div>
          <div class="card-hover-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </router-link>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="totalArticles === 0" class="empty-state">
      <span class="empty-icon">📭</span>
      <p>该分类下暂无文章</p>
      <button class="back-btn" @click="router.push('/')">返回首页</button>
    </div>
  </div>

  <!-- Not Found -->
  <div v-else class="not-found">
    <p>分类不存在</p>
    <router-link to="/" class="back-link">← 返回首页</router-link>
  </div>
</template>

<style scoped>
.category-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 2rem 4rem;
}

/* ---- Category Header ---- */
.cat-header {
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 2.5rem;
}

.cat-accent {
  height: 4px;
}

.cat-header-body {
  padding: 1.75rem 2rem;
}

.cat-header-top {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.cat-icon-large {
  font-size: 2.5rem;
}

.cat-title {
  font-size: 1.7rem;
  font-weight: 800;
  color: #e8ecf1;
  margin: 0;
  letter-spacing: -0.02em;
}

.cat-name-en {
  font-size: 0.82rem;
  color: #4a5568;
  margin: 0;
  font-weight: 500;
}

.cat-description {
  font-size: 0.9rem;
  color: #7a8ba3;
  margin: 0 0 1rem;
  line-height: 1.6;
}

.cat-meta {
  display: flex;
  gap: 0.5rem;
}

.meta-pill {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  border: 1px solid #1e2a3a;
  border-radius: 16px;
  color: #7a8ba3;
}

/* ---- Sub-category ---- */
.subcategory-section {
  margin-bottom: 2rem;
}

.sub-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: #e8ecf1;
  margin: 0 0 1rem;
}

.sub-bar {
  width: 3px;
  height: 18px;
  border-radius: 2px;
  flex-shrink: 0;
}

.sub-count {
  font-size: 0.7rem;
  background: #151d2e;
  color: #4a5568;
  padding: 0.1rem 0.45rem;
  border-radius: 8px;
  font-weight: 500;
}

/* ---- Articles Grid ---- */
.articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.article-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}

.article-card:hover {
  transform: translateY(-2px);
  border-color: #2e3a4e;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
}

.card-top-accent {
  height: 2px;
}

.card-content {
  padding: 1.25rem 1.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #e8ecf1;
  margin: 0 0 0.5rem;
}

.card-desc {
  font-size: 0.82rem;
  color: #7a8ba3;
  margin: 0 0 1rem;
  line-height: 1.55;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.tag {
  font-size: 0.66rem;
  padding: 0.12rem 0.5rem;
  background: #151d2e;
  border: 1px solid #1e2a3a;
  border-radius: 4px;
  color: #7a8ba3;
}

.tag-more {
  color: #4a5568;
}

.card-date {
  font-size: 0.68rem;
  color: #4a5568;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.card-hover-arrow {
  position: absolute;
  top: 1.15rem;
  right: 1.25rem;
  color: #4a5568;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.2s, transform 0.2s;
}

.article-card:hover .card-hover-arrow {
  opacity: 1;
  transform: translateX(0);
  color: #6366f1;
}

/* ---- Empty / Not Found ---- */
.empty-state, .not-found {
  text-align: center;
  padding: 4rem 2rem;
  color: #7a8ba3;
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.back-btn {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
}

.back-link {
  color: #6366f1;
  text-decoration: none;
}

@media (max-width: 640px) {
  .category-page { padding: 1.25rem; }
  .articles-grid { grid-template-columns: 1fr; }
  .cat-title { font-size: 1.3rem; }
}
</style>
