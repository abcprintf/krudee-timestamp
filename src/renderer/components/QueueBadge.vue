<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
defineProps<{ count: number; syncing: boolean }>()
const emit = defineEmits<{ sync: [] }>()

const countdown = ref('')
let timer: ReturnType<typeof setInterval> | null = null

function updateCountdown(): void {
  const now = new Date()
  const next = new Date(now)
  next.setMinutes(Math.ceil((now.getMinutes() + 1) / 5) * 5, 0, 0)
  const diff = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000))
  const m = Math.floor(diff / 60)
  const s = diff % 60
  countdown.value = `${m}:${String(s).padStart(2, '0')}`
}

onMounted(() => { updateCountdown(); timer = setInterval(updateCountdown, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
<template><button class="queue" :disabled="syncing" aria-label="ซิงก์ข้อมูลค้างส่ง" @click="emit('sync')"><span>คิวค้างส่ง</span><strong>{{ count }}</strong><small>{{ syncing ? 'กำลังซิงก์...' : `ซิงก์ใน ${countdown}` }}</small></button></template>
<style scoped>.queue{display:grid;gap:2px;min-width:150px;min-height:64px;padding:10px 16px;border:1px solid #bfdbfe;border-radius:18px;color:#1e3a8a;background:#eff6ff;text-align:left}strong{font-size:28px;line-height:1}small{color:#2563eb}</style>
