<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { searchArticles, categories, type Article } from '../../data/knowledgeData';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const router = useRouter();
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const selectedIndex = ref(0);

const results = computed(() => {
  if (!query.value.trim()) return [];
  return searchArticles(query.value.trim());
});

watch(
  () => props.open,
  (val) => {
    if (val) {
      query.value = '';
      selectedIndex.value = 0;
      nextTick(() => inputRef.value?.focus());
    }
  }
);

watch(results, () => {
  selectedIndex.value = 0;
});

function getCategoryColor(catId: string): string {
  return categories.find((c) => c.id === catId)?.color || '#6366f1';
}

function getCategoryIcon(catId: string): string {
  return categories.find((c) => c.id === catId)?.icon || '📄';
}

function selectArticle(article: Article) {
  router.push(`/article/${article.id}`);
  emit('close');
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (selectedIndex.value < results.value.length - 1) {
      selectedIndex.value++;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (selectedIndex.value > 0) {
      selectedIndex.value--;
    }
  } else if (e.key === 'Enter' && results.value.length > 0) {
    e.preventDefault();
    selectArticle(results.value[selectedIndex.value]);
  } else if (e.key === 'Escape') {
    emit('close');
  }
}

// 全局 ⌘K 快捷键
function handleGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (props.open) {
      emit('close');
    } else {
      // Parent handles opening
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKey);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKey);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="search-overlay" @click.self="$emit('close')">
        <div class="search-modal" role="dialog" aria-label="搜索知识库">
          <div class="search-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              placeholder="搜索文章、标签、技术…"
              class="search-input"
              spellcheck="false"
              autocomplete="off"
              @keydown="handleKeyDown"
            />
            <kbd class="esc-key" @click="$emit('close')">ESC</kbd>
          </div>

          <div class="search-results" v-if="query.trim()">
            <div v-if="results.length === 0" class="no-results">
              没有找到匹配「{{ query }}」的内容
            </div>
            <button
              v-for="(article, i) in results"
              :key="article.id"
              class="result-item"
              :class="{ selected: i === selectedIndex }"
              @click="selectArticle(article)"
              @mouseenter="selectedIndex = i"
            >
              <span class="result-icon">{{ getCategoryIcon(article.categoryId) }}</span>
              <div class="result-info">
                <div class="result-title">{{ article.title }}</div>
                <div class="result-desc">{{ article.description }}</div>
              </div>
              <span
                class="result-cat"
                :style="{ color: getCategoryColor(article.categoryId) }"
              >
                {{ article.subCategory }}
              </span>
            </button>
          </div>

          <div class="search-footer" v-if="!query.trim()">
            <span class="search-hint">输入关键字搜索知识库中的文章</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.search-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  background: rgba(5, 10, 21, 0.75);
  backdrop-filter: blur(4px);
  z-index: 200;
}

.search-modal {
  width: 100%;
  max-width: 560px;
  background: #0d1321;
  border: 1px solid #1e2a3a;
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.search-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid #1e2a3a;
  color: #7a8ba3;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  color: #e8ecf1;
  font-size: 0.95rem;
  outline: none;
}

.search-input::placeholder { color: #4a5568; }

.esc-key {
  font-family: inherit;
  font-size: 0.65rem;
  padding: 0.15rem 0.45rem;
  background: #151d2e;
  border: 1px solid #1e2a3a;
  border-radius: 4px;
  color: #4a5568;
  cursor: pointer;
}

.search-results {
  max-height: 360px;
  overflow-y: auto;
  padding: 0.5rem;
}

.no-results {
  padding: 2rem;
  text-align: center;
  color: #4a5568;
  font-size: 0.85rem;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.85rem;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  color: #e8ecf1;
}

.result-item:hover,
.result-item.selected {
  background: #151d2e;
}

.result-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: #e8ecf1;
}

.result-desc {
  font-size: 0.75rem;
  color: #7a8ba3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-cat {
  font-size: 0.72rem;
  font-weight: 600;
  flex-shrink: 0;
}

.search-footer {
  padding: 1.5rem;
  text-align: center;
}

.search-hint {
  font-size: 0.82rem;
  color: #4a5568;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-active .search-modal,
.modal-leave-active .search-modal {
  transition: transform 0.2s, opacity 0.2s;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .search-modal,
.modal-leave-to .search-modal {
  transform: scale(0.96) translateY(-10px);
  opacity: 0;
}
</style>
