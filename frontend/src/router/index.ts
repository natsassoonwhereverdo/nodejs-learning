import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import CategoryPage from '../pages/CategoryPage.vue';
import ArticlePage from '../pages/ArticlePage.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
    meta: { title: '首页' },
  },
  {
    path: '/category/:id',
    name: 'category',
    component: CategoryPage,
    meta: { title: '分类' },
  },
  {
    path: '/article/:id',
    name: 'article',
    component: ArticlePage,
    meta: { title: '文章' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

// 动态页面标题
router.afterEach((to) => {
  const base = 'IT 知识库';
  document.title = to.meta.title ? `${to.meta.title} - ${base}` : base;
});

export default router;
