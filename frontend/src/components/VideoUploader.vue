<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  getPoolStats,
  extractMetadata,
  generateThumbnails,
  calculateHash,
  processVideo,
  transcodeVideo,
  type PoolStats,
  type UploadProgress
} from '../api/video';

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error' | 'worker';
  message: string;
}

const selectedFile = ref<File | null>(null);
const videoDuration = ref(0);
const videoPreview = ref<string | null>(null);

const uploadProgress = ref<UploadProgress | null>(null);
const isProcessing = ref(false);
const currentOperation = ref('');

const poolStats = ref<PoolStats | null>(null);
const logs = ref<LogEntry[]>([]);
const results = ref<Record<string, any>>({});

let statsInterval: number | null = null;

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatTime(ms: number): string {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return (ms / 60000).toFixed(1) + 'm';
}

function addLog(type: LogEntry['type'], message: string) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false });
  logs.value.unshift({ time, type, message });
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    selectFile(input.files[0]);
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    selectFile(event.dataTransfer.files[0]);
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
}

function selectFile(file: File) {
  if (!file.type.startsWith('video/')) {
    addLog('error', '请选择视频文件');
    return;
  }

  selectedFile.value = file;
  videoDuration.value = 0;
  videoPreview.value = null;
  results.value = {};
  addLog('info', `已选择文件: ${file.name} (${formatSize(file.size)})`);

  videoPreview.value = URL.createObjectURL(file);

  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    videoDuration.value = video.duration;
    addLog('info', `视频: ${video.videoWidth}x${video.videoHeight}, ${video.duration.toFixed(1)}秒`);
  };
  video.src = videoPreview.value;
}

async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function updateProgress(progress: UploadProgress) {
  uploadProgress.value = progress;
}

async function runOperation(name: string, operation: () => Promise<any>) {
  if (isProcessing.value) {
    addLog('error', '正在处理中，请稍候...');
    return;
  }

  if (!selectedFile.value) {
    addLog('error', '未选择视频文件');
    return;
  }

  isProcessing.value = true;
  currentOperation.value = name;
  uploadProgress.value = null;
  results.value[name] = null;
  addLog('info', `开始: ${name}`);

  try {
    const startTime = Date.now();
    const buffer = await readFileBuffer(selectedFile.value);
    const result = await operation(buffer);
    const duration = Date.now() - startTime;

    results.value[name] = result;
    addLog('success', `${name} 完成，耗时 ${formatTime(duration)}`);

    if (result.workerId) {
      addLog('worker', `处理线程: ${result.workerId}`);
    }
    if (result.processingTime) {
      addLog('worker', `处理时间: ${formatTime(result.processingTime)}`);
    }
    if (result.segments) {
      addLog('info', `转码: 已处理 ${result.segments.length} 个分段`);
    }
    if (result.hash) {
      addLog('info', `哈希: ${result.hash.substring(0, 16)}...`);
    }
    if (result.thumbnails?.length) {
      addLog('info', `已生成 ${result.thumbnails.length} 个缩略图`);
    }

  } catch (error: any) {
    addLog('error', `${name} 失败: ${error.message}`);
  } finally {
    isProcessing.value = false;
    currentOperation.value = '';
    uploadProgress.value = null;
  }
}

async function getMetadata() {
  await runOperation('metadata', async (buffer) => {
    return await extractMetadata(buffer, videoDuration.value, updateProgress);
  });
}

async function getThumbnails() {
  await runOperation('thumbnails', async (buffer) => {
    return await generateThumbnails(buffer, videoDuration.value, updateProgress);
  });
}

async function getHash() {
  await runOperation('hash', async (buffer) => {
    return await calculateHash(buffer, updateProgress);
  });
}

async function getTranscode() {
  await runOperation('transcode', async (buffer) => {
    return await transcodeVideo(buffer, updateProgress);
  });
}

async function runFullPipeline() {
  await runOperation('process', async (buffer) => {
    return await processVideo(buffer, videoDuration.value, updateProgress);
  });
}

onMounted(async () => {
  try {
    poolStats.value = await getPoolStats();
    addLog('info', `线程池就绪: ${poolStats.value.video.totalWorkers} 个视频工作线程`);
  } catch (e) {
    addLog('error', '连接服务器失败');
  }

  statsInterval = window.setInterval(async () => {
    try {
      poolStats.value = await getPoolStats();
    } catch (e) {}
  }, 2000);
});

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval);
  if (videoPreview.value) URL.revokeObjectURL(videoPreview.value);
});
</script>

<template>
  <div class="container">
    <header>
      <h1>视频处理工具</h1>
      <p class="subtitle">Worker 线程池演示</p>
    </header>

    <!-- Pool Status -->
    <div class="pool-status">
      <div class="status-title">视频 Worker 线程池</div>
      <div class="stats">
        <div class="stat-box">
          <span class="label">工作线程</span>
          <span class="value">{{ poolStats?.video.totalWorkers || 0 }}</span>
        </div>
        <div class="stat-box">
          <span class="label">忙碌中</span>
          <span class="value busy">{{ poolStats?.video.busyWorkers || 0 }}</span>
        </div>
        <div class="stat-box">
          <span class="label">队列</span>
          <span class="value" :class="{ warning: (poolStats?.video.queueSize || 0) > 0 }">
            {{ poolStats?.video.queueSize || 0 }}
          </span>
        </div>
        <div class="stat-box">
          <span class="label">已完成</span>
          <span class="value">{{ poolStats?.video.completedTasks || 0 }}</span>
        </div>
        <div class="status-indicator" :class="{ ready: poolStats?.video.ready }">
          {{ poolStats?.video.ready ? '就绪' : '初始化中...' }}
        </div>
      </div>
    </div>

    <!-- Upload Area -->
    <div
      class="upload-area"
      :class="{ 'has-file': selectedFile }"
      @drop="handleDrop"
      @dragover="handleDragOver"
    >
      <input type="file" accept="video/*" @change="handleFileSelect" class="file-input" id="fileInput" />

      <template v-if="!selectedFile">
        <label for="fileInput" class="upload-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>拖拽视频到此处或点击浏览</span>
          <span class="hint">支持 MP4、MKV、AVI、MOV 等格式（文件不会保存到磁盘）</span>
        </label>
      </template>

      <template v-else>
        <div class="file-info">
          <video v-if="videoPreview" :src="videoPreview" class="video-preview" controls />
          <div class="file-details">
            <h3>{{ selectedFile.name }}</h3>
            <p>{{ formatSize(selectedFile.size) }} | {{ videoDuration.toFixed(1) }}s</p>
          </div>
          <label for="fileInput" class="change-btn">更换视频</label>
        </div>

        <div v-if="uploadProgress" class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: uploadProgress.percentage + '%' }"></div>
          </div>
          <span class="progress-text">{{ uploadProgress.percentage }}% ({{ formatSize(uploadProgress.loaded) }} / {{ formatSize(uploadProgress.total) }})</span>
        </div>
      </template>
    </div>

    <!-- Action Buttons -->
    <div class="actions">
      <button @click="getMetadata" :disabled="isProcessing || !selectedFile" class="btn btn-primary">
        <span v-if="currentOperation === 'metadata'" class="spinner"></span>
        <span v-else>📊 元数据</span>
      </button>

      <button @click="getThumbnails" :disabled="isProcessing || !selectedFile" class="btn btn-primary">
        <span v-if="currentOperation === 'thumbnails'" class="spinner"></span>
        <span v-else>🖼️ 缩略图</span>
      </button>

      <button @click="getHash" :disabled="isProcessing || !selectedFile" class="btn btn-primary">
        <span v-if="currentOperation === 'hash'" class="spinner"></span>
        <span v-else>🔐 哈希值</span>
      </button>

      <button @click="getTranscode" :disabled="isProcessing || !selectedFile" class="btn btn-warning">
        <span v-if="currentOperation === 'transcode'" class="spinner"></span>
        <span v-else>⚙️ 转码</span>
      </button>

      <button @click="runFullPipeline" :disabled="isProcessing || !selectedFile" class="btn btn-success">
        <span v-if="currentOperation === 'process'" class="spinner"></span>
        <span v-else>🚀 处理流程</span>
      </button>
    </div>

    <!-- Results -->
    <div v-if="Object.keys(results).length > 0" class="results-section">
      <h2>结果</h2>

      <!-- Metadata Result -->
      <div v-if="results.metadata?.metadata" class="result-card">
        <h3>元数据</h3>
        <div class="metadata-grid">
          <div class="meta-item"><span class="meta-label">时长</span><span class="meta-value">{{ results.metadata.metadata.duration?.toFixed(2) }}秒</span></div>
          <div class="meta-item"><span class="meta-label">分辨率</span><span class="meta-value">{{ results.metadata.metadata.width }}x{{ results.metadata.metadata.height }}</span></div>
          <div class="meta-item"><span class="meta-label">编解码器</span><span class="meta-value">{{ results.metadata.metadata.codec }}</span></div>
          <div class="meta-item"><span class="meta-label">码率</span><span class="meta-value">{{ formatSize(results.metadata.metadata.bitrate) }}/秒</span></div>
        </div>
      </div>

      <!-- Thumbnails Result -->
      <div v-if="results.thumbnails?.thumbnails?.length" class="result-card">
        <h3>缩略图</h3>
        <div class="thumbnails-grid">
          <div v-for="thumb in results.thumbnails.thumbnails" :key="thumb.timestamp" class="thumbnail">
            <img :src="'data:image/jpeg;base64,' + thumb.data" alt="Thumbnail" />
            <span class="timestamp">{{ thumb.timestamp.toFixed(1) }}s</span>
          </div>
        </div>
      </div>

      <!-- Hash Result -->
      <div v-if="results.hash?.hash" class="result-card">
        <h3>视频哈希</h3>
        <code class="hash-value">{{ results.hash.hash }}</code>
      </div>

      <!-- Transcode Result -->
      <div v-if="results.transcode?.segments" class="result-card">
        <h3>转码分段</h3>
        <div class="segments-list">
          <div v-for="(seg, i) in results.transcode.segments" :key="i" class="segment">
            <span class="seg-index">#{{ i + 1 }}</span>
            <span class="seg-hash">{{ seg.hash }}</span>
            <span class="seg-size">{{ formatSize(seg.processedSize) }}</span>
          </div>
        </div>
        <p class="worker-info">工作线程: {{ results.transcode.workerThread }}</p>
      </div>

      <!-- Pipeline Result -->
      <div v-if="results.process?.results" class="result-card">
        <h3>处理流程结果</h3>
        <div class="pipeline-summary">
          <div class="pipeline-item"><span class="pipeline-label">哈希值</span><code>{{ results.process.results.hash?.substring(0, 16) }}...</code></div>
          <div class="pipeline-item"><span class="pipeline-label">元数据</span><span>{{ results.process.results.metadata ? `${results.process.results.metadata.width}x${results.process.results.metadata.height}` : '无' }}</span></div>
          <div class="pipeline-item"><span class="pipeline-label">缩略图</span><span>{{ results.process.results.thumbnailCount }} 个已生成</span></div>
          <div class="pipeline-item"><span class="pipeline-label">分段数</span><span>{{ results.process.results.transcodeSegments }}</span></div>
          <div class="pipeline-item"><span class="pipeline-label">视频大小</span><span>{{ formatSize(results.process.videoSize) }}</span></div>
          <div class="pipeline-item"><span class="pipeline-label">总耗时</span><span>{{ formatTime(results.process.processingTime) }}</span></div>
        </div>
        <div v-if="results.process.workerDistribution" class="worker-distribution">
          <h4>工作线程分配</h4>
          <div class="worker-list">
            <div v-for="(worker, task) in results.process.workerDistribution" :key="task" class="worker-item">
              <span class="task-name">{{ task }}</span>
              <span class="worker-id">{{ worker }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Logs -->
    <div class="logs-section">
      <h2>日志 <span class="log-count">{{ logs.length }}</span></h2>
      <div class="logs-container">
        <div v-for="(log, i) in logs" :key="i" class="log-entry" :class="'log-' + log.type">
          {{ log.message }}
        </div>
        <div v-if="logs.length === 0" class="no-logs">暂无日志。请选择视频并执行操作。</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
header { text-align: center; margin-bottom: 2rem; }
h1 { font-size: 2.5rem; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { color: #64748b; margin-top: 0.5rem; }

.pool-status { background: #1e293b; padding: 1rem 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; }
.status-title { font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
.stats { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; }
.stat-box { display: flex; flex-direction: column; align-items: center; min-width: 50px; }
.stat-box .label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
.stat-box .value { font-size: 1.25rem; font-weight: bold; color: #22c55e; }
.stat-box .value.busy { color: #f59e0b; }
.stat-box .value.warning { color: #ef4444; }
.status-indicator { margin-left: auto; padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; background: #374151; color: #9ca3af; }
.status-indicator.ready { background: #064e3b; color: #34d399; }

.upload-area { border: 2px dashed #334155; border-radius: 16px; padding: 2rem; text-align: center; transition: all 0.3s; margin-bottom: 1.5rem; background: #1e293b; }
.upload-area:hover, .upload-area.has-file { border-color: #667eea; }
.file-input { display: none; }
.upload-label { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; cursor: pointer; color: #94a3b8; }
.upload-label svg { width: 48px; height: 48px; color: #667eea; }
.upload-label .hint { font-size: 0.8rem; color: #64748b; }
.file-info { display: flex; flex-direction: column; gap: 1rem; }
.video-preview { max-width: 100%; max-height: 250px; border-radius: 8px; }
.file-details h3 { margin: 0; color: #e2e8f0; word-break: break-all; font-size: 1rem; }
.file-details p { margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.9rem; }
.change-btn { padding: 0.5rem 1rem; background: #334155; color: #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
.change-btn:hover { background: #475569; }
.progress-container { margin-top: 1rem; }
.progress-bar { height: 6px; background: #334155; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); transition: width 0.3s; }
.progress-text { display: block; margin-top: 0.4rem; font-size: 0.8rem; color: #94a3b8; }

.actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.btn { flex: 1; min-width: 100px; padding: 0.75rem 1rem; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.4rem; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
.btn-success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; }
.btn-success:hover:not(:disabled) { transform: translateY(-1px); }
.btn-warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; }
.btn-warning:hover:not(:disabled) { transform: translateY(-1px); }
.spinner { width: 16px; height: 16px; border: 2px solid transparent; border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.results-section { margin-bottom: 1.5rem; }
.results-section h2 { margin-bottom: 1rem; color: #e2e8f0; }
.result-card { background: #1e293b; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
.result-card h3 { margin: 0 0 1rem 0; color: #667eea; font-size: 1rem; }
.metadata-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; }
.meta-item { background: #0f172a; padding: 0.6rem; border-radius: 6px; }
.meta-label { display: block; font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
.meta-value { font-size: 1rem; font-weight: 600; color: #e2e8f0; }
.thumbnails-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; }
.thumbnail { position: relative; border-radius: 6px; overflow: hidden; }
.thumbnail img { width: 100%; height: auto; display: block; }
.thumbnail .timestamp { position: absolute; bottom: 0.3rem; right: 0.3rem; background: rgba(0,0,0,0.7); padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.7rem; }
.hash-value { display: block; background: #0f172a; padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.85rem; color: #38ef7d; word-break: break-all; }
.segments-list { display: flex; flex-direction: column; gap: 0.4rem; }
.segment { display: flex; align-items: center; gap: 0.75rem; background: #0f172a; padding: 0.5rem 0.75rem; border-radius: 6px; }
.seg-index { font-weight: bold; color: #667eea; min-width: 25px; }
.seg-hash { font-family: monospace; color: #38ef7d; flex: 1; font-size: 0.85rem; }
.seg-size { color: #64748b; font-size: 0.8rem; }
.worker-info { margin-top: 0.75rem; font-size: 0.85rem; color: #667eea; }
.pipeline-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; }
.pipeline-item { background: #0f172a; padding: 0.6rem; border-radius: 6px; }
.pipeline-label { display: block; font-size: 0.7rem; color: #64748b; text-transform: uppercase; margin-bottom: 0.2rem; }
.pipeline-item code { color: #38ef7d; font-family: monospace; font-size: 0.85rem; }
.worker-distribution { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #334155; }
.worker-distribution h4 { margin: 0 0 0.75rem 0; color: #94a3b8; font-size: 0.9rem; }
.worker-list { display: flex; flex-direction: column; gap: 0.4rem; }
.worker-item { display: flex; justify-content: space-between; background: #0f172a; padding: 0.4rem 0.6rem; border-radius: 4px; }
.task-name { color: #94a3b8; text-transform: capitalize; font-size: 0.85rem; }
.worker-id { color: #667eea; font-weight: 600; font-size: 0.85rem; }

.logs-section h2 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; color: #e2e8f0; }
.log-count { background: #334155; padding: 0.2rem 0.6rem; border-radius: 10px; font-size: 0.8rem; font-weight: normal; }
.logs-container { background: #0f172a; border-radius: 10px; padding: 0.75rem; max-height: 200px; overflow-y: auto; font-family: 'Monaco', 'Menlo', monospace; font-size: 0.8rem; }
.log-entry { padding: 0.2rem 0; border-bottom: 1px solid #1e293b; }
.log-info { color: #94a3b8; }
.log-success { color: #38ef7d; }
.log-error { color: #f87171; }
.log-worker { color: #667eea; }
.no-logs { text-align: center; color: #64748b; padding: 1.5rem; }
</style>
