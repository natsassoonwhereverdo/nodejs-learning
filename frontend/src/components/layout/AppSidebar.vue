<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  categories,
  articles,
  getAllSubCategories,
  getArticleCountByCategory,
  type Category,
} from '../../data/knowledgeData';

const props = defineProps<{
  collapsed: boolean;
}>();

const route = useRoute();
const router = useRouter();

const searchQuery = ref('');
const expandedCategories = ref<Set<string>>(new Set());

// 自动展开当前路由对应的分类
watch(
  () => route.params.id,
  () => {
    if (route.name === 'category') {
      expandedCategories.value.add(route.params.id as string);
    }
    if (route.name === 'article') {
      const article = articles.find((a) => a.id === route.params.id);
      if (article) {
        expandedCategories.value.add(article.categoryId);
      }
    }
  },
  { immediate: true }
);

function toggleCategory(id: string) {
  if (expandedCategories.value.has(id)) {
    expandedCategories.value.delete(id);
  } else {
    expandedCategories.value.add(id);
  }
}

function isActiveCategory(catId: string): boolean {
  if (route.name === 'category' && route.params.id === catId) return true;
  if (route.name === 'article') {
    const article = articles.find((a) => a.id === route.params.id);
    return article?.categoryId === catId;
  }
  return false;
}

function isActiveSubCategory(catId: string, subName: string): boolean {
  if (route.name === 'category' && route.params.id === catId && route.query.sub === subName) return true;
  if (route.name === 'article') {
    const article = articles.find((a) => a.id === route.params.id);
    return article?.categoryId === catId && article?.subCategory === subName;
  }
  return false;
}

interface SidebarItem {
  category: Category;
  subCategories: {
    name: string;
    articleCount: number;
  }[];
}

const sidebarTree = computed<SidebarItem[]>(() => {
  const q = searchQuery.value.toLowerCase();

  return categories
    .map((cat) => {
      const subs = getAllSubCategories(cat.id);
      const subCategories = subs
        .map((sub) => {
          const catArticles = articles.filter(
            (a) =>
              a.categoryId === cat.id &&
              a.subCategory === sub &&
              (!q ||
                a.title.toLowerCase().includes(q) ||
                a.tags.some((t) => t.toLowerCase().includes(q)) ||
                sub.toLowerCase().includes(q))
          );
          return { name: sub, articleCount: catArticles.length };
        })
        .filter((s) => s.articleCount > 0);

      return { category: cat, subCategories };
    })
    .filter((item) => !q || item.subCategories.length > 0);
});
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-search" v-if="!collapsed">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="筛选知识…"
        class="search-input"
        spellcheck="false"
        autocomplete="off"
      />
    </div>

    <nav class="sidebar-nav" aria-label="知识分类导航">
      <div v-for="item in sidebarTree" :key="item.category.id" class="nav-category">
        <button
          class="category-btn"
          :class="{ active: isActiveCategory(item.category.id) }"
          :title="collapsed ? item.category.name : undefined"
          @click="collapsed ? router.push(`/category/${item.category.id}`) : toggleCategory(item.category.id)"
        >
          <span class="cat-icon">{{ item.category.icon }}</span>
          <template v-if="!collapsed">
            <span class="cat-name">{{ item.category.name }}</span>
            <span class="cat-count">{{ getArticleCountByCategory(item.category.id) }}</span>
            <svg
              class="cat-arrow"
              :class="{ expanded: expandedCategories.has(item.category.id) }"
              width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </template>
        </button>

        <div
          v-if="!collapsed && expandedCategories.has(item.category.id)"
          class="category-children"
        >
          <router-link
            v-for="sub in item.subCategories"
            :key="sub.name"
            :to="`/category/${item.category.id}?sub=${encodeURIComponent(sub.name)}`"
            class="article-link"
            :class="{ active: isActiveSubCategory(item.category.id, sub.name) }"
          >
            <span class="article-dot" :style="{ background: item.category.color }"></span>
            <span class="article-title">{{ sub.name }}</span>
            <span class="sub-count">{{ sub.articleCount }}</span>
          </router-link>
        </div>
      </div>
    </nav>

    <div class="sidebar-footer" v-if="!collapsed">
      <div class="footer-stats">
        <span>{{ categories.length }} 个大类</span>
        <span>·</span>
        <span>{{ articles.length }} 篇文章</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #0d1321;
  border-right: 1px solid #1e2a3a;
  height: calc(100vh - 56px);
  position: sticky;
  top: 56px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #1e2a3a transparent;
  transition: width 0.25s;
}

.sidebar::-webkit-scrollbar { width: 4px; }
.sidebar::-webkit-scrollbar-thumb { background: #1e2a3a; border-radius: 2px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }

.sidebar.collapsed {
  width: 56px;
}

.sidebar-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #1e2a3a;
  color: #4a5568;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  color: #e8ecf1;
  font-size: 0.82rem;
  outline: none;
  min-width: 0;
}

.search-input::placeholder {
  color: #4a5568;
}

.sidebar-nav {
  flex: 1;
  padding: 0.5rem 0;
  overflow-y: auto;
}

.nav-category {
  margin-bottom: 0.15rem;
}

.category-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.55rem 1rem;
  background: none;
  border: none;
  color: #7a8ba3;
  cursor: pointer;
  font-size: 0.85rem;
  text-align: left;
  transition: color 0.2s, background 0.2s;
  border-radius: 0;
}

.category-btn:hover {
  color: #e8ecf1;
  background: #151d2e;
}

.category-btn.active {
  color: #e8ecf1;
  background: #151d2e;
}

.collapsed .category-btn {
  justify-content: center;
  padding: 0.65rem;
}

.cat-icon {
  font-size: 1rem;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.cat-name {
  flex: 1;
  font-weight: 600;
}

.cat-count {
  font-size: 0.7rem;
  background: #151d2e;
  color: #4a5568;
  padding: 0.1rem 0.4rem;
  border-radius: 8px;
  min-width: 18px;
  text-align: center;
}

.cat-arrow {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.cat-arrow.expanded {
  transform: rotate(90deg);
}

.category-children {
  margin-left: 1rem;
  padding-left: 0.75rem;
  border-left: 1px solid #1e2a3a;
  padding-top: 0.2rem;
  padding-bottom: 0.5rem;
}

.article-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  color: #7a8ba3;
  text-decoration: none;
  font-size: 0.82rem;
  border-radius: 6px;
  margin: 0.1rem 0.25rem;
  transition: color 0.2s, background 0.2s;
}

.article-link:hover {
  color: #e8ecf1;
  background: #151d2e;
}

.article-link.active {
  color: #e8ecf1;
  background: #6366f11a;
}

.article-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.article-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-count {
  font-size: 0.65rem;
  color: #4a5568;
  background: #151d2e;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  line-height: 1;
}

.article-link.active .sub-count {
  background: #6366f133;
  color: #8b5cf6;
}

.sidebar-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid #1e2a3a;
}

.footer-stats {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  color: #4a5568;
}

@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 56px;
    z-index: 90;
    transform: translateX(-100%);
    transition: transform 0.25s;
  }
  .sidebar:not(.collapsed) {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
  }
}
</style>
