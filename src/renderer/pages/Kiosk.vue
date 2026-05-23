<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StudentCard from '../components/StudentCard.vue'
import ScanFeedback from '../components/ScanFeedback.vue'
import QueueBadge from '../components/QueueBadge.vue'
import type { ScanResult } from '../env'
const router = useRouter(); const buffer = ref(''); const lastScan = ref<ScanResult | null>(null); const queueCount = ref(0); const syncing = ref(false); const feedback = ref({ kind: 'idle' as 'entry' | 'exit' | 'unknown' | 'idle', message: 'พร้อมสแกนบัตร' }); let clearTimer: number | undefined
const rfidConnected = ref(false)
let unsubRfid: (() => void) | null = null
function resetLater(): void { window.clearTimeout(clearTimer); clearTimer = window.setTimeout(() => { feedback.value = { kind: 'idle', message: 'พร้อมสแกนบัตร' } }, 6500) }
async function submitScan(uid: string): Promise<void> { if (!uid) return; const result = await window.krudee.scan.record({ uid, scanned_at: new Date().toISOString() }); lastScan.value = result; queueCount.value = result.queue_count; feedback.value = result.student ? { kind: result.event.kind, message: result.event.kind === 'entry' ? 'บันทึกเข้าโรงเรียนแล้ว' : 'บันทึกกลับบ้านแล้ว' } : { kind: 'unknown', message: 'บัตรนี้ยังไม่ลงทะเบียน → ใช้โหมดผู้ดูแล' }; resetLater() }
function onKeydown(event: KeyboardEvent): void { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') { void router.push('/admin'); return } if (event.key === 'Enter') { const uid = buffer.value.trim(); buffer.value = ''; void submitScan(uid); return } if (/^[a-zA-Z0-9]$/.test(event.key)) buffer.value += event.key }
async function syncNow(): Promise<void> { syncing.value = true; try { await window.krudee.sync.now(); queueCount.value = await window.krudee.scan.queueCount() } finally { syncing.value = false } }
onMounted(async () => {
  queueCount.value = await window.krudee.scan.queueCount()
  window.addEventListener('keydown', onKeydown)
  const status = await window.krudee.device.rfidStatus()
  rfidConnected.value = status.connected
  unsubRfid = window.krudee.device.onRfidStatusChange((s) => { rfidConnected.value = s.connected })
})
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); window.clearTimeout(clearTimer); unsubRfid?.() })
</script>
<template><main class="page kiosk-page"><div class="topbar"><div><strong>ครูดี - Timestamp</strong><p class="muted">แตะบัตร RFID แล้วกด Enter จากเครื่องอ่านอัตโนมัติ</p></div><div class="topbar-right"><span class="rfid-status" :class="rfidConnected ? 'rfid-status--on' : 'rfid-status--off'"><span class="rfid-dot" />{{ rfidConnected ? 'เครื่องแตะบัตรพร้อม' : 'ไม่พบเครื่องแตะบัตร' }}</span><QueueBadge :count="queueCount" :syncing="syncing" @sync="syncNow" /></div></div><div class="stage"><StudentCard v-if="lastScan?.student" :student="lastScan.student" :kind="lastScan.event.kind" /><div v-else class="idle-card card"><h1>พร้อมสแกนบัตร</h1><p>เมื่อพบข้อมูลนักเรียน ระบบจะแสดงรูปและกล่าวทักทายภาษาไทย</p></div><ScanFeedback :kind="feedback.kind" :message="feedback.message" /></div><div v-if="feedback.kind === 'unknown'" class="unknown-overlay" role="alert">บัตรนี้ยังไม่ลงทะเบียน → ใช้โหมดผู้ดูแล</div></main></template>
<style scoped>.kiosk-page{display:grid;grid-template-rows:auto 1fr;gap:24px}.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.topbar strong{font-size:28px;color:#0f172a}.topbar p{margin:4px 0 0}.topbar-right{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}.rfid-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid;font-weight:500}.rfid-status--on{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}.rfid-status--off{background:#fef2f2;border-color:#fecaca;color:#b91c1c}.rfid-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;animation:none}.rfid-status--on .rfid-dot{background:#22c55e;animation:pulse 2s infinite}.rfid-status--off .rfid-dot{background:#ef4444}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}.stage{display:grid;place-items:center;align-content:center;gap:28px}.idle-card{padding:56px;text-align:center}.idle-card h1{margin:0 0 12px;font-size:64px;color:#2563eb}.unknown-overlay{position:fixed;inset:0;display:grid;place-items:center;padding:32px;color:white;background:rgba(185,28,28,.9);font-size:clamp(38px,7vw,88px);font-weight:800;text-align:center;pointer-events:none}</style>
