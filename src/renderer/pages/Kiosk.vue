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
const online = ref(navigator.onLine)
const scanHistory = ref<ScanHistoryRow[]>([])
const showQuitPin = ref(false)
const quitPin = ref('')
const quitError = ref('')
let clearTimer: number | undefined
let unsubRfid: (() => void) | null = null

function refocusInput(): void { void nextTick(() => inputRef.value?.focus()) }

function goAdmin(): void { void router.push('/admin') }

function openQuitPin(): void { quitPin.value = ''; quitError.value = ''; showQuitPin.value = true }
function closeQuitPin(): void { showQuitPin.value = false; quitPin.value = ''; quitError.value = ''; refocusInput() }

async function confirmQuit(): Promise<void> {
  quitError.value = ''
  const result = await window.krudee.admin.verifyPin(quitPin.value)
  if (result.ok) { await window.krudee.app.quit(); return }
  quitError.value = result.locked ? `ใส่ผิดหลายครั้ง ลองใหม่ใน ${result.retry_in_s} วินาที` : 'PIN ไม่ถูกต้อง'
  quitPin.value = ''
}

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
  if (event.key === 'Enter') { event.preventDefault(); void submitScan(inputValue.value.trim()) }
}

// ดักที่ window — เข้า Admin ได้แม้ focus หลุดจากช่อง input
function onWindowKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') { event.preventDefault(); void router.push('/admin') }
}
function onOnline(): void { online.value = true; void syncNow() }
function onOffline(): void { online.value = false }

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
  window.addEventListener('keydown', onWindowKeydown)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  queueCount.value = await window.krudee.scan.queueCount()
  scanHistory.value = await window.krudee.scan.history()
  refocusInput()
  const status = await window.krudee.device.rfidStatus()
  rfidConnected.value = status.connected
  unsubRfid = window.krudee.device.onRfidStatusChange((s) => { rfidConnected.value = s.connected })
  const config = await window.krudee.config.get()
  schoolName.value = (config as { school_name?: string }).school_name ?? ''
})

onBeforeUnmount(() => {
  window.clearTimeout(clearTimer); unsubRfid?.()
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})
</script>

<template>
  <main class="page kiosk-page" @click="refocusInput">
    <div class="topbar">
      <div>
        <strong>{{ schoolName || 'ครูดี - Timestamp' }}</strong>
        <p class="muted">แตะบัตร RFID หรือพิมพ์รหัสนักเรียน แล้วกด Enter</p>
      </div>
      <div class="topbar-right">
        <span class="rfid-status" :class="online ? 'rfid-status--on' : 'rfid-status--off'">
          <span class="rfid-dot" />{{ online ? 'ออนไลน์' : 'ออฟไลน์ — บันทึกในเครื่อง' }}
        </span>
        <span class="rfid-status" :class="rfidConnected ? 'rfid-status--on' : 'rfid-status--off'">
          <span class="rfid-dot" />{{ rfidConnected ? 'เครื่องแตะบัตรพร้อม' : 'ไม่พบเครื่องแตะบัตร' }}
        </span>
        <QueueBadge :count="queueCount" :syncing="syncing" @sync="syncNow" />
        <button class="topbar-btn" @click.stop="goAdmin">โหมดผู้ดูแล</button>
        <button class="topbar-btn topbar-btn--danger" @click.stop="openQuitPin">ปิดโปรแกรม</button>
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

    <div v-if="showQuitPin" class="quit-overlay" @click.stop="closeQuitPin">
      <div class="quit-card card" @click.stop>
        <h2>ปิดโปรแกรม</h2>
        <p class="muted">ใส่ PIN ผู้ดูแลเพื่อยืนยันการปิดโปรแกรม</p>
        <input
          v-model="quitPin"
          class="quit-input"
          type="password"
          inputmode="numeric"
          placeholder="PIN ผู้ดูแล"
          autocomplete="off"
          @keydown.enter.prevent="confirmQuit"
        />
        <p v-if="quitError" class="quit-error">{{ quitError }}</p>
        <div class="quit-actions">
          <button class="quit-btn quit-btn--ghost" @click.stop="closeQuitPin">ยกเลิก</button>
          <button class="quit-btn quit-btn--danger" @click.stop="confirmQuit">ปิดโปรแกรม</button>
        </div>
      </div>
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
.topbar-btn { font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid #cbd5e1; color: #334155; background: #f8fafc; cursor: pointer; font-weight: 600; }
.topbar-btn:hover { background: #eef2f7; }
.topbar-btn--danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }
.topbar-btn--danger:hover { background: #fee2e2; }
.quit-overlay { position: fixed; inset: 0; display: grid; place-items: center; padding: 32px; background: rgba(15, 23, 42, .55); z-index: 50; }
.quit-card { width: 100%; max-width: 360px; padding: 28px; text-align: center; display: grid; gap: 14px; }
.quit-card h2 { margin: 0; font-size: 24px; color: #0f172a; }
.quit-input { width: 100%; box-sizing: border-box; font-size: 20px; text-align: center; padding: 12px 16px; border: 2px solid #cbd5e1; border-radius: 10px; outline: none; letter-spacing: 4px; }
.quit-input:focus { border-color: #2563eb; }
.quit-error { color: #b91c1c; font-size: 14px; margin: 0; font-weight: 600; }
.quit-actions { display: flex; gap: 12px; justify-content: center; }
.quit-btn { font-size: 15px; padding: 10px 18px; border-radius: 10px; border: 1px solid transparent; cursor: pointer; font-weight: 600; }
.quit-btn--ghost { border-color: #cbd5e1; color: #334155; background: white; }
.quit-btn--danger { color: white; background: #dc2626; }
.quit-btn--danger:hover { background: #b91c1c; }
.scan-input-wrap { width: 100%; max-width: 460px; }
.scan-input { width: 100%; box-sizing: border-box; font-size: 20px; text-align: center; padding: 12px 16px; border: 2px solid #cbd5e1; border-radius: 10px; outline: none; font-weight: 500; background: #f8fafc; color: #0f172a; }
.scan-input:focus { border-color: #2563eb; background: white; }
.scan-input::placeholder { color: #94a3b8; font-size: 15px; font-weight: 400; }
</style>
