<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StudentCard from '../components/StudentCard.vue'
import ScanFeedback from '../components/ScanFeedback.vue'
import QueueBadge from '../components/QueueBadge.vue'
import ScanHistoryPanel from '../components/ScanHistoryPanel.vue'
import type { ScanResult, ScanHistoryRow } from '../env'
const router = useRouter()
const isDev = import.meta.env.DEV
const inputRef = ref<HTMLInputElement | null>(null)
const inputValue = ref('')
const lastScan = ref<ScanResult | null>(null)
const queueCount = ref(0)
const syncing = ref(false)
const feedback = ref({ kind: 'idle' as 'entry' | 'exit' | 'unknown' | 'duplicate' | 'idle', message: 'พร้อมสแกนบัตร' })
const schoolName = ref('')
const rfidConnected = ref(false)
const scanHistory = ref<ScanHistoryRow[]>([])
let clearTimer: number | undefined
let unsubRfid: (() => void) | null = null

function refocusInput(): void { void nextTick(() => inputRef.value?.focus()) }

function resetLater(): void {
  window.clearTimeout(clearTimer)
  clearTimer = window.setTimeout(() => { feedback.value = { kind: 'idle', message: 'พร้อมสแกนบัตร' }; refocusInput() }, 6500)
}

function pushHistory(result: ScanResult): void {
  if (result.duplicate) return
  const row: ScanHistoryRow = {
    id: Date.now(),
    rfid_uid: result.event.rfid_uid,
    scanned_at: result.event.scanned_at,
    kind: result.event.kind,
    prefix: result.student?.prefix ?? null,
    first_name: result.student?.first_name ?? null,
    last_name: result.student?.last_name ?? null,
    nickname: result.student?.nickname ?? null,
    classroom_name: result.student?.classroom_name ?? null,
    class_number: result.student?.class_number ?? null,
    photo_url: result.student?.photo_url ?? null,
    photo_local_path: result.student?.photo_local_path ?? null,
  }
  scanHistory.value = [row, ...scanHistory.value].slice(0, 10)
}

async function submitScan(uid: string): Promise<void> {
  if (!uid) return
  inputValue.value = ''
  const result = await window.krudee.scan.record({ uid, scanned_at: new Date().toISOString() })
  lastScan.value = result
  queueCount.value = result.queue_count
  feedback.value = result.student
    ? result.duplicate
      ? { kind: 'duplicate', message: 'บันทึกแล้ว ไม่ต้องแตะซ้ำ 😊' }
      : { kind: result.event.kind, message: result.event.kind === 'entry' ? 'บันทึกเข้าโรงเรียนแล้ว' : 'บันทึกกลับบ้านแล้ว' }
    : { kind: 'unknown', message: 'ไม่พบรหัสนักเรียนนี้ → ใช้โหมดผู้ดูแล' }
  pushHistory(result)
  refocusInput()
  resetLater()
}

function onInputKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') { void router.push('/admin'); return }
  if (event.key === 'Enter') { event.preventDefault(); void submitScan(inputValue.value.trim()) }
}

async function devClearScans(): Promise<void> {
  await window.krudee.admin.devClearScans()
  scanHistory.value = []
  lastScan.value = null
  feedback.value = { kind: 'idle', message: 'พร้อมสแกนบัตร' }
  refocusInput()
}

async function syncNow(): Promise<void> {
  syncing.value = true
  try { await window.krudee.sync.now(); queueCount.value = await window.krudee.scan.queueCount() }
  finally { syncing.value = false }
}

onMounted(async () => {
  queueCount.value = await window.krudee.scan.queueCount()
  scanHistory.value = await window.krudee.scan.history()
  refocusInput()
  const status = await window.krudee.device.rfidStatus()
  rfidConnected.value = status.connected
  unsubRfid = window.krudee.device.onRfidStatusChange((s) => { rfidConnected.value = s.connected })
  const config = await window.krudee.config.get()
  schoolName.value = (config as { school_name?: string }).school_name ?? ''
})

onBeforeUnmount(() => { window.clearTimeout(clearTimer); unsubRfid?.() })
</script>

<template>
  <main class="page kiosk-page" @click="refocusInput">
    <div class="topbar">
      <div>
        <strong>{{ schoolName || 'ครูดี - Timestamp' }}</strong>
        <p class="muted">แตะบัตร RFID หรือพิมพ์รหัสนักเรียน แล้วกด Enter</p>
      </div>
      <div class="topbar-right">
        <span class="rfid-status" :class="rfidConnected ? 'rfid-status--on' : 'rfid-status--off'">
          <span class="rfid-dot" />{{ rfidConnected ? 'เครื่องแตะบัตรพร้อม' : 'ไม่พบเครื่องแตะบัตร' }}
        </span>
        <QueueBadge :count="queueCount" :syncing="syncing" @sync="syncNow" />
        <button v-if="isDev" class="dev-clear-btn" @click.stop="devClearScans">[DEV] ล้างแตะบัตร</button>
      </div>
    </div>

    <div class="body">
      <div class="stage">
        <StudentCard v-if="lastScan?.student" :student="lastScan.student" :kind="lastScan.event.kind" :scanned-at="lastScan.event.scanned_at" :duplicate="lastScan.duplicate" />
        <div v-else class="idle-card card">
          <h1>พร้อมสแกนบัตร</h1>
          <p v-if="schoolName" class="school-name">{{ schoolName }}</p>
          <p v-else>เมื่อพบข้อมูลนักเรียน ระบบจะแสดงรูปและกล่าวทักทายภาษาไทย</p>
        </div>
        <ScanFeedback :kind="feedback.kind" :message="feedback.message" />
        <div class="scan-input-wrap">
          <input
            ref="inputRef"
            v-model="inputValue"
            class="scan-input"
            type="text"
            placeholder="แตะบัตร หรือพิมพ์รหัสนักเรียน แล้วกด Enter"
            autocomplete="off"
            @keydown="onInputKeydown"
            @click.stop
          />
        </div>
      </div>
      <ScanHistoryPanel :rows="scanHistory" />
    </div>

    <div v-if="feedback.kind === 'unknown'" class="unknown-overlay" role="alert">
      ไม่พบรหัสนักเรียนนี้ → ใช้โหมดผู้ดูแล
    </div>
  </main>
</template>

<style scoped>
.kiosk-page { display: grid; grid-template-rows: auto 1fr; gap: 24px; height: 100vh; overflow: hidden; }
.topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.topbar strong { font-size: 28px; color: #0f172a; }
.topbar p { margin: 4px 0 0; }
.topbar-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.rfid-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid; font-weight: 500; }
.rfid-status--on { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
.rfid-status--off { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
.rfid-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; animation: none; }
.rfid-status--on .rfid-dot { background: #22c55e; animation: pulse 2s infinite; }
.rfid-status--off .rfid-dot { background: #ef4444; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
.body { display: grid; grid-template-columns: 1fr 300px; gap: 20px; min-height: 0; overflow: hidden; }
.stage { display: grid; place-items: center; align-content: center; gap: 28px; overflow: auto; }
.idle-card { padding: 56px; text-align: center; }
.idle-card h1 { margin: 0 0 12px; font-size: 64px; color: #2563eb; }
.school-name { font-size: 20px; font-weight: 600; color: #1e40af; margin: 0; }
.unknown-overlay { position: fixed; inset: 0; display: grid; place-items: center; padding: 32px; color: white; background: rgba(185, 28, 28, .9); font-size: clamp(38px, 7vw, 88px); font-weight: 800; text-align: center; pointer-events: none; }
.dev-clear-btn { font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #f59e0b; color: #92400e; background: #fffbeb; cursor: pointer; font-weight: 600; }
.dev-clear-btn:hover { background: #fef3c7; }
.scan-input-wrap { width: 100%; max-width: 460px; }
.scan-input { width: 100%; box-sizing: border-box; font-size: 20px; text-align: center; padding: 12px 16px; border: 2px solid #cbd5e1; border-radius: 10px; outline: none; font-weight: 500; background: #f8fafc; color: #0f172a; }
.scan-input:focus { border-color: #2563eb; background: white; }
.scan-input::placeholder { color: #94a3b8; font-size: 15px; font-weight: 400; }
</style>
