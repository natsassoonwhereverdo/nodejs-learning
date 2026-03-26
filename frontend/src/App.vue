<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import AppHeader from './components/layout/AppHeader.vue';
import AppSidebar from './components/layout/AppSidebar.vue';
import SearchModal from './components/layout/SearchModal.vue';

const sidebarCollapsed = ref(false);
const searchOpen = ref(false);

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function openSearch() {
  searchOpen.value = true;
}

function closeSearch() {
  searchOpen.value = false;
}

// ⌘K shortcut
function handleGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchOpen.value = !searchOpen.value;
  }
}

onMounted(() => window.addEventListener('keydown', handleGlobalKey));
onUnmounted(() => window.removeEventListener('keydown', handleGlobalKey));
</script>

<template>
  <div class="app-shell">
    <AppHeader
      @toggle-sidebar="toggleSidebar"
      @open-search="openSearch"
    />
    <div class="app-body">
      <AppSidebar :collapsed="sidebarCollapsed" />
      <main class="main-content">
        <router-view />
      </main>
    </div>
    <SearchModal :open="searchOpen" @close="closeSearch" />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap');

* { box-sizing: border-box; }

html {
  color-scheme: dark;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #050a15;
  color: #e8ecf1;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Custom scrollbars */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #1e2a3a; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #2e3a4e; }

a { color: #6366f1; }
</style>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-body {
  display: flex;
  flex: 1;
}

.main-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
</style>
