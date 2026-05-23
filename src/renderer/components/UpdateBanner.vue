<template>
  <Transition name="slide-down">
    <div v-if="state !== 'idle'" class="update-banner">
      <template v-if="state === 'available'">
        <span class="update-text">🔄 มีเวอร์ชันใหม่ v{{ newVersion }} กำลังดาวน์โหลด...</span>
        <div class="progress-bar"><div class="progress-fill" :style="{ width: `${downloadPercent}%` }" /></div>
        <span class="progress-label">{{ downloadPercent }}%</span>
      </template>
      <template v-else-if="state === 'ready'">
        <span class="update-text">✅ v{{ newVersion }} พร้อมติดตั้งแล้ว</span>
        <button class="install-btn" :disabled="installing" @click="install">
          {{ installing ? 'กำลังรีสตาร์ท...' : 'ติดตั้งและรีสตาร์ท' }}
        </button>
      </template>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

type BannerState = 'idle' | 'available' | 'ready'

const state = ref<BannerState>('idle')
const newVersion = ref('')
const downloadPercent = ref(0)
const installing = ref(false)

let offAvailable: (() => void) | null = null
let offProgress: (() => void) | null = null
let offDownloaded: (() => void) | null = null

onMounted(() => {
  offAvailable = window.krudee.updater.onUpdateAvailable((info) => {
    newVersion.value = info.version
    downloadPercent.value = 0
    state.value = 'available'
  })
  offProgress = window.krudee.updater.onDownloadProgress((progress) => {
    downloadPercent.value = progress.percent
  })
  offDownloaded = window.krudee.updater.onUpdateDownloaded((info) => {
    newVersion.value = info.version
    state.value = 'ready'
  })
})

onUnmounted(() => {
  offAvailable?.()
  offProgress?.()
  offDownloaded?.()
})

async function install(): Promise<void> {
  installing.value = true
  await window.krudee.updater.install()
}
</script>

<style scoped>
.update-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #1e40af;
  color: #fff;
  font-size: 13px;
}
.update-text { flex: 1; font-weight: 500; }
.progress-bar { width: 120px; height: 6px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: #fff; border-radius: 3px; transition: width 0.3s ease; }
.progress-label { min-width: 36px; text-align: right; font-size: 12px; opacity: 0.85; }
.install-btn {
  padding: 4px 14px;
  background: #fff;
  color: #1e40af;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.install-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.install-btn:not(:disabled):hover { background: #eff6ff; }
.slide-down-enter-active, .slide-down-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-100%); opacity: 0; }
</style>
