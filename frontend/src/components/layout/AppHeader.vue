<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCategoryById, getArticleById } from '../../data/knowledgeData';

defineEmits<{
  (e: 'toggle-sidebar'): void;
  (e: 'open-search'): void;
}>();

const route = useRoute();
const router = useRouter();

interface Crumb {
  label: string;
  to?: string;
}

const breadcrumbs = computed<Crumb[]>(() => {
  const crumbs: Crumb[] = [{ label: '🧠 知识库', to: '/' }];

  if (route.name === 'category') {
    const cat = getCategoryById(route.params.id as string);
    if (cat) {
      crumbs.push({ label: `${cat.icon} ${cat.name}` });
    }
  }

  if (route.name === 'article') {
    const article = getArticleById(route.params.id as string);
    if (article) {
      const cat = getCategoryById(article.categoryId);
      if (cat) {
        crumbs.push({
          label: `${cat.icon} ${cat.name}`,
          to: `/category/${cat.id}`,
        });
      }
      crumbs.push({ label: article.title });
    }
  }

  return crumbs;
});

function handleCrumbClick(crumb: Crumb) {
  if (crumb.to) {
    router.push(crumb.to);
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <button
        class="sidebar-toggle"
        aria-label="切换侧边栏"
        @click="$emit('toggle-sidebar')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <router-link to="/" class="logo">
        <span class="logo-icon">🧠</span>
        <span class="logo-text">IT Knowledge Base</span>
      </router-link>
    </div>

    <nav class="breadcrumbs" aria-label="面包屑导航">
      <ol>
        <li
          v-for="(crumb, i) in breadcrumbs"
          :key="i"
          :class="{ active: i === breadcrumbs.length - 1 }"
        >
          <button
            v-if="crumb.to && i < breadcrumbs.length - 1"
            class="crumb-link"
            @click="handleCrumbClick(crumb)"
          >
            {{ crumb.label }}
          </button>
          <span v-else class="crumb-current">{{ crumb.label }}</span>
          <span v-if="i < breadcrumbs.length - 1" class="crumb-sep">/</span>
        </li>
      </ol>
    </nav>

    <button
      class="search-trigger"
      aria-label="搜索"
      @click="$emit('open-search')"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <span class="search-label">搜索…</span>
      <kbd>⌘K</kbd>
    </button>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
  height: 56px;
  background: #0d1321;
  border-bottom: 1px solid #1e2a3a;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.sidebar-toggle {
  display: none;
  background: none;
  border: none;
  color: #7a8ba3;
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
}

.sidebar-toggle:hover {
  color: #e8ecf1;
  background: #151d2e;
}

@media (max-width: 900px) {
  .sidebar-toggle { display: flex; }
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  flex-shrink: 0;
}

.logo-icon { font-size: 1.4rem; }

.logo-text {
  font-size: 1rem;
  font-weight: 700;
  color: #e8ecf1;
  letter-spacing: -0.02em;
}

.breadcrumbs {
  flex: 1;
  min-width: 0;
}

.breadcrumbs ol {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.breadcrumbs li {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.82rem;
}

.crumb-link {
  background: none;
  border: none;
  color: #7a8ba3;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.82rem;
  transition: color 0.2s, background 0.2s;
}

.crumb-link:hover {
  color: #e8ecf1;
  background: #151d2e;
}

.crumb-current {
  color: #e8ecf1;
  font-weight: 500;
}

.crumb-sep {
  color: #4a5568;
  font-size: 0.75rem;
}

.search-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: #151d2e;
  border: 1px solid #1e2a3a;
  border-radius: 8px;
  color: #7a8ba3;
  cursor: pointer;
  font-size: 0.82rem;
  transition: border-color 0.2s, background 0.2s;
  flex-shrink: 0;
}

.search-trigger:hover {
  border-color: #6366f1;
  background: #1a2435;
}

.search-trigger kbd {
  font-family: inherit;
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 4px;
  color: #4a5568;
}

@media (max-width: 640px) {
  .logo-text { display: none; }
  .search-label { display: none; }
  .breadcrumbs { display: none; }
}
</style>
