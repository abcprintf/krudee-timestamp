<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { AppConfigView, ClockSkew, DailySummary, HistoryRow, RfidCard, StudentView, UnknownUidRow } from '../env'

const router = useRouter()
const isDev = import.meta.env.DEV
const unlocked = ref(false)
const pin = ref('')
const error = ref('')
const tab = ref<'summary' | 'students' | 'cards' | 'settings' | 'history' | 'changelog'>('summary')

const changelog: { version: string; date: string; added?: string[]; fixed?: string[] }[] = [
  {
    version: '1.0.9',
    date: '17 กรกฎาคม 2569',
    added: [
      'แท็บ "สรุปวันนี้" — นักเรียนทั้งหมด/มาแล้ว/มาสาย/กลับแล้ว/ยังไม่มา แยกรายห้อง พร้อมเกณฑ์มาสายตั้งค่าได้ (ค่าเริ่มต้น 08:30)',
      'ตั้งค่าใหม่: ข้อความทักทายเข้า/กลับ ({name}), เปลี่ยน PIN ผู้ดูแล, ล็อกโหมดคีออสก์',
      'Sync ขึ้นเซิร์ฟเวอร์อัตโนมัติไม่กี่วินาทีหลังแตะบัตร — ไม่ต้องรอรอบ 5 นาที',
      'เตือนเมื่อนาฬิกาเครื่องคลาดจากเซิร์ฟเวอร์เกิน 2 นาที + ป้ายออนไลน์/ออฟไลน์บนหน้า Kiosk',
      'Log ไฟล์ production ที่ userData/logs (เก็บ 14 วัน)',
    ],
    fixed: [
      'PIN ผู้ดูแลเก็บเป็น hash + ล็อก 30 วินาทีเมื่อใส่ผิด 5 ครั้งติด',
      'Sync mark เฉพาะรายการที่เซิร์ฟเวอร์ยืนยัน, ลบนักเรียนที่หายจากเซิร์ฟเวอร์ออกจากเครื่อง',
      'ไฟล์ Linux ไม่มีเลข version ในชื่อ — startup application ชี้ path เดิมได้ทุกเวอร์ชัน',
    ],
  },
  {
    version: '1.0.8',
    date: '17 กรกฎาคม 2569',
    added: [
      'ตั้งค่า "กันแตะซ้ำ (นาที)" ได้จากหน้า Admin',
      'ตั้งค่า "นับเป็น ออก ตั้งแต่กี่โมง" — แตะบัตรหลังเวลานี้นับเป็น "ออกโรงเรียน" อัตโนมัติ',
      'แตะซ้ำชนิดเดิมใน cooldown ถูกบล็อก แต่เปลี่ยนชนิด (เข้า→ออก) บันทึกได้ทันที',
    ],
    fixed: [
      'หน้า "ผู้ดูแลเครื่อง" scroll ไม่ได้ กดปุ่มบันทึกไม่ถึง',
      'แตะบัตรครั้งที่ 2 ยังขึ้น "เข้าโรงเรียน" — ใช้ logic เข้า/ออกแบบอิงเวลา',
    ],
  },
  {
    version: '1.0.7',
    date: '17 กรกฎาคม 2569',
    added: ['ทดสอบระบบ auto-update ครบวงจร — ยืนยันการอัปเดตอัตโนมัติทุกแพลตฟอร์ม รวม macOS'],
  },
  {
    version: '1.0.6',
    date: '16 กรกฎาคม 2569',
    added: [
      'รองรับ auto-update บน macOS (zip target + notarize)',
      'เอกสาร RELEASE.md — ขั้นตอนออกเวอร์ชันใหม่',
    ],
    fixed: ['ปิด auto-updater ใน dev mode — ไม่มี error log ตอนพัฒนา'],
  },
  {
    version: '1.0.5',
    date: '28 มิถุนายน 2568',
    added: [
      'QueueBadge แสดง countdown นับถอยหลังถึงรอบ sync อัตโนมัติถัดไป (ทุก 5 นาที)',
      'Dev logs ใน attendance sync — แสดง endpoint URL, รายการที่ส่ง, response และ error เฉพาะ mode development',
    ],
    fixed: [
      'Attendance sync ไม่ส่ง request เมื่อคิวเป็น 0',
      'แก้ bug คิวค้างหลัง sync — mark synced ทุก event ทันทีที่ server ตอบกลับสำเร็จ',
    ],
  },
  {
    version: '1.0.4',
    date: '24 พ.ค. 2568',
    added: [
      'README: หัวข้อ "เกี่ยวกับระบบครูดี" + ลิงก์ krudee.workitdee.com',
      'README: แนะนำ hardware RFID reader และบัตรที่ใช้งานได้',
      'README: เพิ่มภาษาอังกฤษควบคู่ภาษาไทยในส่วนหลัก',
    ],
  },
  {
    version: '1.0.3',
    date: '',
    added: [
      'กรอกรหัสนักเรียนบนหน้า Kiosk เป็น fallback เมื่อลืมบัตร RFID',
      'tab Changelog ในหน้า Admin — ดูประวัติ version ในแอปได้เลย',
      'build macOS ใน GitHub Actions release workflow',
      'เปิดรับนักพัฒนาร่วมพัฒนา — Contributing section ใน README',
    ],
    fixed: ['แสดงเวอร์ชันในหน้าจอจาก package.json ถูกต้องแล้ว'],
  },
  {
    version: '1.0.1',
    date: '23 พ.ค. 2568',
    added: ['เพิ่ม Linux build (AppImage + deb) ใน CI'],
    fixed: ['แก้สิทธิ์ CI อัปโหลด release assets', 'แก้ build usb บน Linux runner'],
  },
  {
    version: '1.0.0',
    date: '23 พ.ค. 2568',
    added: [
      'สแกน RFID keyboard-wedge พร้อม cooldown 30 นาที',
      'ตรวจจับประเภทเข้า/ออก รองรับ entry, exit, both',
      'เสียงทักทายภาษาไทยผ่าน TTS',
      'ฐานข้อมูล SQLite ในเครื่อง',
      'ดึงรายชื่อนักเรียนทุก 30 นาที',
      'ซิงก์ข้อมูลแตะบัตรทุก 5 นาที',
      'หน้า Admin — ค้นหา ผูก/ยกเลิกบัตร จัดการ UID',
      'อัปเดตอัตโนมัติผ่าน electron-updater',
      'เปิดโปรแกรมพร้อมเครื่อง (configurable)',
    ],
  },
]
const query = ref('')
const students = ref<StudentView[]>([])
const unknownUids = ref<UnknownUidRow[]>([])
const history = ref<HistoryRow[]>([])
const config = ref<AppConfigView | null>(null)
const summary = ref<DailySummary | null>(null)
const clockSkew = ref<ClockSkew | null>(null)
const newPin = ref('')
const loading = ref(false)
const resetArmed = ref(false)

// นาฬิกาเครื่องต่างจากเซิร์ฟเวอร์เกิน 2 นาที = เวลาแตะบัตรเชื่อไม่ได้แล้ว ต้องเตือน
const clockSkewMinutes = computed(() => clockSkew.value ? Math.round(Math.abs(clockSkew.value.skew_ms) / 60000) : 0)
const clockWarning = computed(() => clockSkewMinutes.value >= 2)

// --- card binding step state ---
type BindStep = 'uid' | 'student' | 'confirm'
const bindStep = ref<BindStep>('uid')
const selectedUid = ref('')
const selectedStudentId = ref('')
const bindSuccess = ref(false)
const bindError = ref('')
const selectedStudent = computed(() => students.value.find(s => s.id === selectedStudentId.value))

function selectUid(uid: string): void {
  selectedUid.value = uid
  selectedStudentId.value = ''
  query.value = ''
  bindStep.value = 'student'
}

function selectStudent(id: string): void {
  selectedStudentId.value = id
  bindStep.value = 'confirm'
}

function cancelBind(): void {
  selectedUid.value = ''
  selectedStudentId.value = ''
  query.value = ''
  bindStep.value = 'uid'
  bindSuccess.value = false
  bindError.value = ''
}

async function confirmBind(): Promise<void> {
  if (!selectedUid.value || !selectedStudentId.value) return
  if ((selectedStudent.value?.rfid_uids_list.length ?? 0) > 0) return
  bindError.value = ''
  loading.value = true
  try {
    await window.krudee.admin.bindCard({ student_id: selectedStudentId.value, rfid_uid: selectedUid.value })
    bindSuccess.value = true
    await loadAll()
    setTimeout(() => { cancelBind() }, 2000)
  } catch (err) {
    bindError.value = err instanceof Error ? err.message : 'ผูกบัตรไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

async function unlock(): Promise<void> {
  error.value = ''
  const result = await window.krudee.admin.verifyPin(pin.value)
  if (result.locked) { error.value = `ใส่ PIN ผิดหลายครั้งเกินไป — ลองใหม่ในอีก ${result.retry_in_s} วินาที`; return }
  if (!result.ok) { error.value = 'PIN ไม่ถูกต้อง'; return }
  unlocked.value = true
  await loadAll()
}

async function loadAll(): Promise<void> {
  config.value = await window.krudee.config.get()
  students.value = await window.krudee.admin.students(query.value)
  unknownUids.value = await window.krudee.admin.unknownUids()
  history.value = await window.krudee.admin.history()
  summary.value = await window.krudee.admin.dailySummary()
  clockSkew.value = await window.krudee.device.clockSkew()
}

async function refreshSummary(): Promise<void> { summary.value = await window.krudee.admin.dailySummary() }

async function searchStudents(): Promise<void> { students.value = await window.krudee.admin.students(query.value) }

async function saveSettings(): Promise<void> {
  if (!config.value) return
  loading.value = true
  try {
    const payload: Record<string, string> = {
      base_url: config.value.base_url, device_name: config.value.device_name ?? '', role: config.value.role,
      tts_enabled: config.value.tts_enabled, auto_start: config.value.auto_start,
      // String() จำเป็น — input type=number ทำให้ v-model cast เป็น number แต่ IPC รับเฉพาะ string
      exit_after_hour: String(config.value.exit_after_hour ?? ''), late_after: config.value.late_after ?? '08:30',
      scan_cooldown_minutes: String(config.value.scan_cooldown_minutes ?? '30'),
      greeting_entry: config.value.greeting_entry ?? '', greeting_exit: config.value.greeting_exit ?? '',
      kiosk_lock: config.value.kiosk_lock ?? 'false',
    }
    if (newPin.value.length >= 4) payload.new_pin = newPin.value
    config.value = await window.krudee.admin.updateSettings(payload)
    newPin.value = ''
  }
  finally { loading.value = false }
}

async function manualSync(): Promise<void> {
  loading.value = true
  try { await window.krudee.sync.now(); await window.krudee.sync.roster(); await loadAll() }
  finally { loading.value = false }
}

async function resetDevice(): Promise<void> {
  if (!resetArmed.value) { resetArmed.value = true; return }
  await window.krudee.admin.resetDevice()
  await router.push('/setup')
}

async function devClearScans(): Promise<void> {
  await window.krudee.admin.devClearScans()
  alert('[DEV] ล้างข้อมูลแตะบัตรแล้ว')
}

async function clearUnknownUids(): Promise<void> {
  loading.value = true
  try { await window.krudee.admin.clearUnknownUids(); await refreshCards() }
  finally { loading.value = false }
}

async function deleteUnknownUid(uid: string): Promise<void> {
  // optimistic: ลบออกทันทีก่อน IPC
  unknownUids.value = unknownUids.value.filter(u => u.rfid_uid !== uid)
  try {
    await window.krudee.admin.deleteUnknownUid(uid)
  } catch (err) {
    manageError.value = err instanceof Error ? err.message : 'ลบไม่สำเร็จ'
    // rollback
    await refreshCards()
  }
}

async function refreshCards(): Promise<void> { unknownUids.value = await window.krudee.admin.unknownUids() }

// --- student card management ---
const managingStudent = ref<StudentView | null>(null)
const unbindLoading = ref('')
const manageError = ref('')

function openManage(student: StudentView): void {
  managingStudent.value = student
  manageError.value = ''
  void refreshCards()
}
function closeManage(): void { managingStudent.value = null; manageError.value = '' }

async function bindNewCardToStudent(student: StudentView, uid: string): Promise<void> {
  if (student.rfid_uids_list.length > 0) { manageError.value = 'นักเรียนคนนี้มีบัตรแล้ว ต้องยกเลิกบัตรเก่าก่อน'; return }
  manageError.value = ''
  loading.value = true
  try {
    await window.krudee.admin.bindCard({ student_id: student.id, rfid_uid: uid })
    await loadAll()
    await refreshCards()
    managingStudent.value = students.value.find(s => s.id === student.id) ?? null
  } catch (err) {
    manageError.value = err instanceof Error ? err.message : 'ผูกบัตรไม่สำเร็จ'
  } finally { loading.value = false }
}

async function unbindCard(card: RfidCard): Promise<void> {
  manageError.value = ''
  unbindLoading.value = card.id
  try {
    await window.krudee.admin.unbindCard({ card_id: card.id })
    await loadAll()
    managingStudent.value = students.value.find(s => s.id === managingStudent.value?.id) ?? null
  } catch (err) {
    manageError.value = err instanceof Error ? err.message : 'ยกเลิกบัตรไม่สำเร็จ'
  } finally { unbindLoading.value = '' }
}

const lastScannedUid = ref('')
let wedgeBuffer = ''
let wedgeTimer: ReturnType<typeof setTimeout> | null = null
function onAdminKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    const uid = wedgeBuffer.trim()
    wedgeBuffer = ''
    if (uid.length >= 4) {
      // ป้องกัน Enter trigger ปุ่มที่ focused ใน modal
      event.preventDefault()
      event.stopPropagation()
      lastScannedUid.value = uid
      // ไม่บันทึกเวลาเข้า-ออก — เพิ่ม UID เข้า unknownUids โดยตรงเพื่อแสดงในหน้า Admin
      if (!unknownUids.value.some(u => u.rfid_uid === uid)) {
        unknownUids.value = [{ rfid_uid: uid, count: 1, last_scanned_at: new Date().toISOString() }, ...unknownUids.value]
      }
      if (managingStudent.value) {
        const id = managingStudent.value.id
        void searchStudents().then(() => {
          managingStudent.value = students.value.find(s => s.id === id) ?? managingStudent.value
        })
      }
    }
    return
  }
  if (/^[a-zA-Z0-9\-]$/.test(event.key)) {
    wedgeBuffer += event.key
    if (wedgeTimer) clearTimeout(wedgeTimer)
    wedgeTimer = setTimeout(() => { wedgeBuffer = '' }, 1000)
  }
}

onMounted(async () => { config.value = await window.krudee.config.get(); window.addEventListener('keydown', onAdminKeydown) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onAdminKeydown) })
</script>
<template><main class="page admin-page"><section v-if="!unlocked" class="card pin-card grid"><h1>โหมดผู้ดูแล</h1><label>กรอก PIN <input v-model="pin" class="input" type="password" inputmode="numeric" @keyup.enter="unlock" /></label><p v-if="error" class="error">{{ error }}</p><div class="row"><button class="btn-secondary" @click="router.push('/kiosk')">กลับหน้าสแกน</button><button class="btn-primary" @click="unlock">เข้าสู่ระบบ</button></div></section><section v-else class="admin-shell"><header class="admin-header"><div><h1>ผู้ดูแลเครื่อง</h1><p class="muted">จัดการนักเรียน บัตร และการซิงก์</p></div><button class="btn-secondary" @click="router.push('/kiosk')">กลับหน้าสแกน</button></header><div v-if="clockWarning" class="clock-warning" role="alert">⚠️ นาฬิกาเครื่องนี้คลาดจากเซิร์ฟเวอร์ประมาณ {{ clockSkewMinutes }} นาที — เวลาแตะบัตรอาจไม่ตรงจริง กรุณาตั้งเวลาเครื่องใหม่</div><nav class="tabs" aria-label="เมนูผู้ดูแล"><button :class="{active:tab==='summary'}" @click="tab='summary'; refreshSummary()">สรุปวันนี้</button><button :class="{active:tab==='students'}" @click="tab='students'">นักเรียน</button><button :class="{active:tab==='cards'}" @click="tab='cards'; refreshCards()">บัตรยังไม่ผูก</button><button :class="{active:tab==='settings'}" @click="tab='settings'">ตั้งค่า</button><button :class="{active:tab==='history'}" @click="tab='history'">ประวัติ</button><button :class="{active:tab==='changelog'}" @click="tab='changelog'">Changelog</button></nav><section v-if="tab==='summary'" class="card panel grid">
        <div class="row" style="justify-content:space-between;align-items:center">
          <p class="muted" style="margin:0">เกณฑ์มาสาย: entry แรกหลัง {{ summary?.late_after || '-' }} น.</p>
          <button class="btn-secondary" @click="refreshSummary">🔄 รีเฟรช</button>
        </div>
        <div v-if="summary" class="stat-tiles">
          <div class="stat-tile"><span class="stat-num">{{ summary.totals.students }}</span><span class="stat-label">นักเรียนทั้งหมด</span></div>
          <div class="stat-tile stat-tile--ok"><span class="stat-num">{{ summary.totals.present }}</span><span class="stat-label">มาแล้ว</span></div>
          <div class="stat-tile stat-tile--warn"><span class="stat-num">{{ summary.totals.late }}</span><span class="stat-label">มาสาย</span></div>
          <div class="stat-tile"><span class="stat-num">{{ summary.totals.exited }}</span><span class="stat-label">กลับแล้ว</span></div>
          <div class="stat-tile stat-tile--bad"><span class="stat-num">{{ summary.totals.absent }}</span><span class="stat-label">ยังไม่มา</span></div>
        </div>
        <div v-if="summary" class="summary-table-wrap">
          <table class="summary-table">
            <thead><tr><th>ห้อง</th><th>ทั้งหมด</th><th>มาแล้ว</th><th>มาสาย</th><th>กลับแล้ว</th><th>ยังไม่มา</th></tr></thead>
            <tbody>
              <tr v-for="cls in summary.classes" :key="cls.classroom_name">
                <td>{{ cls.classroom_name }}</td><td>{{ cls.total }}</td><td>{{ cls.present }}</td>
                <td :class="{ 'cell-warn': cls.late > 0 }">{{ cls.late }}</td><td>{{ cls.exited }}</td>
                <td :class="{ 'cell-bad': cls.total - cls.present > 0 }">{{ Math.max(0, cls.total - cls.present) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section><section v-if="tab==='students'" class="card panel grid">
        <div class="row"><input v-model="query" class="input" placeholder="ค้นหาชื่อ ห้อง หรือรหัสนักเรียน" @keyup.enter="searchStudents" /><button class="btn-primary" @click="searchStudents">ค้นหา</button></div>
        <div class="list">
          <article v-for="student in students" :key="student.id" class="list-item list-item--clickable" @click="openManage(student)">
            <div class="student-row">
              <div>
                <strong>{{ student.first_name }} {{ student.last_name }}</strong>
                <span class="muted" style="font-size:13px"> · {{ student.classroom_name || '-' }} เลขที่ {{ student.class_number || '-' }}</span>
              </div>
              <div class="card-badges">
                <span v-if="student.rfid_uids_list.length === 0" class="badge badge--none">ไม่มีบัตร</span>
                <span v-for="uid in student.rfid_uids_list" :key="uid" class="badge badge--has">🪪 {{ uid }}</span>
              </div>
            </div>
          </article>
        </div>

        <!-- Modal จัดการบัตรของนักเรียน -->
        <div v-if="managingStudent" class="modal-overlay" @click.self="closeManage">
          <div class="modal-box grid">
            <div class="row" style="justify-content:space-between">
              <div>
                <h2 style="margin:0">{{ managingStudent.first_name }} {{ managingStudent.last_name }}</h2>
                <p class="muted" style="margin:4px 0 0">{{ managingStudent.classroom_name || '-' }}</p>
              </div>
              <button class="btn-secondary" style="align-self:start" @click="closeManage">✕</button>
            </div>

            <div>
              <p style="font-weight:700;margin:0 0 8px">บัตร RFID ที่ผูกแล้ว</p>
              <p v-if="managingStudent.rfid_cards_list.length === 0" class="muted">ยังไม่มีบัตร</p>
              <div class="grid" style="gap:8px">
                <div v-for="card in managingStudent.rfid_cards_list" :key="card.id" class="card-item">
                  <span class="mono">{{ card.rfid_uid }}</span>
                  <span v-if="card.label" class="muted" style="font-size:12px">{{ card.label }}</span>
                  <button class="btn-danger" style="padding:6px 12px;min-height:36px;font-size:13px" :disabled="unbindLoading === card.id" @click="unbindCard(card)">
                    {{ unbindLoading === card.id ? '...' : 'ยกเลิก' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- scan indicator -->
            <div class="scan-hint">
              <span v-if="lastScannedUid">🪪 ตรวจพบบัตร: <strong class="mono">{{ lastScannedUid }}</strong></span>
              <span v-else class="muted">แตะบัตร RFID ที่เครื่องเพื่อผูกบัตร</span>
            </div>

            <div v-if="unknownUids.length > 0">
              <p style="font-weight:700;margin:0 0 8px">ผูกบัตรใหม่ (บัตรที่ยังไม่ผูก)</p>
              <div class="grid" style="gap:8px">
                <div v-for="uid in unknownUids" :key="uid.rfid_uid" class="card-item card-item--new">
                  <span class="mono">{{ uid.rfid_uid }}</span>
                  <span class="muted" style="font-size:12px">แตะ {{ uid.count }} ครั้ง</span>
                  <button class="btn-primary" style="padding:6px 12px;min-height:36px;font-size:13px" :disabled="loading" @click="bindNewCardToStudent(managingStudent!, uid.rfid_uid)">
                    {{ loading ? '...' : 'ผูกบัตรนี้' }}
                  </button>
                  <button class="btn-secondary" style="padding:6px 10px;min-height:36px;font-size:13px" title="ลบออกจากรายการ" @click="deleteUnknownUid(uid.rfid_uid)">✕</button>
                </div>
              </div>
            </div>
            <p v-if="manageError" class="error" role="alert">{{ manageError }}</p>
            <p v-else-if="unknownUids.length === 0" class="muted" style="font-size:13px">ให้นักเรียนแตะบัตรที่เครื่องก่อน เพื่อผูกบัตรใหม่</p>
          </div>
        </div>
      </section><section v-if="tab==='cards'" class="card panel grid">
        <!-- Step indicator -->
        <div class="bind-steps">
          <span :class="['step', bindStep==='uid' ? 'active' : (selectedUid ? 'done' : '')]">1 เลือกบัตร</span>
          <span class="step-sep">›</span>
          <span :class="['step', bindStep==='student' ? 'active' : (selectedStudentId ? 'done' : '')]">2 เลือกนักเรียน</span>
          <span class="step-sep">›</span>
          <span :class="['step', bindStep==='confirm' ? 'active' : '']">3 ยืนยัน</span>
        </div>

        <!-- Step 1: เลือก UID -->
        <div v-if="bindStep==='uid'">
          <div class="row" style="margin-bottom:8px">
            <p v-if="unknownUids.length === 0" class="muted" style="flex:1">ไม่มีบัตรที่รอผูก — ให้นักเรียนแตะบัตรที่เครื่องก่อน</p>
            <span v-else class="muted" style="flex:1">{{ unknownUids.length }} บัตรรอผูก</span>
            <button class="btn-secondary" style="min-width:80px" @click="refreshCards">🔄 รีเฟรช</button>
          </div>
          <div class="list">
            <div v-for="uid in unknownUids" :key="uid.rfid_uid" class="uid-row-wrap">
              <button class="uid-row" @click="selectUid(uid.rfid_uid)">
                <strong>{{ uid.rfid_uid }}</strong>
                <span>แตะ {{ uid.count }} ครั้ง · ล่าสุด {{ new Date(uid.last_scanned_at).toLocaleString('th-TH') }}</span>
              </button>
              <button class="btn-secondary" style="padding:6px 10px;min-height:36px;font-size:13px;flex-shrink:0" title="ลบออกจากรายการ" @click="deleteUnknownUid(uid.rfid_uid)">✕</button>
            </div>
          </div>
        </div>

        <!-- Step 2: เลือกนักเรียน -->
        <div v-else-if="bindStep==='student'" class="grid">
          <div class="bind-uid-badge">บัตร: <strong>{{ selectedUid }}</strong></div>
          <div class="row">
            <input v-model="query" class="input" placeholder="ค้นหาชื่อ ห้อง หรือรหัสนักเรียน" @input="searchStudents" autofocus />
            <button class="btn-secondary" @click="cancelBind">ยกเลิก</button>
          </div>
          <div class="list">
            <button
              v-for="student in students" :key="student.id"
              class="uid-row"
              :class="{ 'uid-row--disabled': student.rfid_uids_list.length > 0 }"
              :disabled="student.rfid_uids_list.length > 0"
              @click="student.rfid_uids_list.length === 0 && selectStudent(student.id)"
            >
              <div class="row" style="justify-content:space-between;align-items:center">
                <strong>{{ student.first_name }} {{ student.last_name }}</strong>
                <span v-if="student.rfid_uids_list.length > 0" class="badge badge--has" style="font-size:11px">มีบัตรแล้ว</span>
              </div>
              <span>{{ student.classroom_name || '-' }} · เลขที่ {{ student.class_number || '-' }}</span>
              <small v-if="student.rfid_uids_list.length > 0" style="color:#94a3b8">{{ student.rfid_uids_list.join(', ') }}</small>
            </button>
          </div>
        </div>

        <!-- Step 3: ยืนยัน -->
        <div v-else-if="bindStep==='confirm'" class="grid">
          <div v-if="bindSuccess" class="success" style="font-size:18px;text-align:center;padding:24px">✅ ผูกบัตรสำเร็จ!</div>
          <template v-else>
            <div class="confirm-box">
              <p class="muted">ยืนยันการผูกบัตร</p>
              <div class="confirm-row"><span>บัตร RFID</span><strong class="mono">{{ selectedUid }}</strong></div>
              <div class="confirm-row"><span>นักเรียน</span><strong>{{ selectedStudent?.first_name }} {{ selectedStudent?.last_name }}</strong></div>
              <div class="confirm-row"><span>ห้อง</span><strong>{{ selectedStudent?.classroom_name || '-' }}</strong></div>
            </div>
            <p v-if="bindError" class="error" role="alert">{{ bindError }}</p>
            <div class="row">
              <button class="btn-secondary" :disabled="loading" @click="cancelBind">ยกเลิก</button>
              <button class="btn-primary" :disabled="loading" @click="confirmBind">{{ loading ? 'กำลังผูก...' : 'ยืนยันผูกบัตร' }}</button>
            </div>
          </template>
        </div>
      </section><section v-if="tab==='settings' && config" class="card panel grid"><div class="info-box"><p class="info-row"><span class="info-label">Server URL</span><span class="info-value">{{ config.base_url }}</span></p><p class="info-row"><span class="info-label">Device ID</span><span class="info-value mono">{{ config.device_id || '-' }}</span></p><p class="info-row"><span class="info-label">รหัสโรงเรียน</span><span class="info-value mono">{{ config.school_code || '-' }}</span></p></div><label>URL เซิร์ฟเวอร์ <input v-model="config.base_url" class="input" /></label><label>ชื่อเครื่อง <input v-model="config.device_name" class="input" /></label><label>โหมด <select v-model="config.role"><option value="both">เข้าและออก</option><option value="entry">เข้าอย่างเดียว</option><option value="exit">ออกอย่างเดียว</option></select></label><div class="row-2col"><label>แตะครั้งแรกหลังกี่โมงถือว่า "กลับบ้าน" (โหมดเข้าและออก, ว่าง = ปิด) <input v-model="config.exit_after_hour" class="input" type="number" min="0" max="23" placeholder="10" /></label><label>มาสายเมื่อเข้าหลังเวลา <input v-model="config.late_after" class="input" type="time" /></label></div><div class="row-2col"><label>กันแตะซ้ำภายใน (นาที) <input v-model="config.scan_cooldown_minutes" class="input" type="number" min="0" /></label><label>เปลี่ยน PIN ผู้ดูแล (อย่างน้อย 4 หลัก, เว้นว่าง = ไม่เปลี่ยน) <input v-model="newPin" class="input" type="password" inputmode="numeric" autocomplete="new-password" /></label></div><label>ข้อความทักทายตอนเข้า (ใช้ {name} แทนชื่อ) <input v-model="config.greeting_entry" class="input" /></label><label>ข้อความทักทายตอนกลับ (ใช้ {name} แทนชื่อ) <input v-model="config.greeting_exit" class="input" /></label><label class="check"><input v-model="config.tts_enabled" true-value="true" false-value="false" type="checkbox" /> เปิดเสียงทักทาย</label><label class="check"><input v-model="config.auto_start" true-value="true" false-value="false" type="checkbox" /> เปิดโปรแกรมพร้อมเครื่อง</label><label class="check"><input v-model="config.kiosk_lock" true-value="true" false-value="false" type="checkbox" /> ล็อกโหมดคีออสก์ (กันย่อ/ปิดหน้าต่าง)</label><div class="row"><button class="btn-primary" :disabled="loading" @click="saveSettings">บันทึก</button><button class="btn-secondary" :disabled="loading" @click="manualSync">ซิงก์ตอนนี้</button><button class="btn-secondary" :disabled="loading" @click="clearUnknownUids">ล้างบัตรยังไม่ผูก</button><button class="btn-danger" @click="resetDevice">{{ resetArmed ? 'กดอีกครั้งเพื่อยืนยันรีเซ็ต' : 'รีเซ็ตเครื่อง' }}</button><button v-if="isDev" class="btn-secondary" style="border-color:#f59e0b;color:#b45309" @click="devClearScans">[DEV] ล้างข้อมูลแตะบัตร</button></div></section><section v-if="tab==='history'" class="card panel grid"><article v-for="item in history" :key="item.id" class="list-item"><strong>{{ item.nickname || item.first_name || 'ไม่ทราบชื่อ' }} — {{ item.kind === 'entry' ? 'เข้า' : 'ออก' }}</strong><span>{{ item.rfid_uid }} · {{ new Date(item.scanned_at).toLocaleString('th-TH') }}</span><small>{{ item.synced ? 'ซิงก์แล้ว' : 'รอซิงก์' }} {{ item.sync_error ? `· ${item.sync_error}` : '' }}</small></article></section><section v-if="tab==='changelog'" class="card panel grid">
        <div v-for="entry in changelog" :key="entry.version" class="changelog-entry">
          <div class="changelog-header">
            <span class="changelog-version">v{{ entry.version }}</span>
            <span v-if="entry.date" class="muted" style="font-size:13px">{{ entry.date }}</span>
            <span v-else class="badge badge--new">ล่าสุด</span>
          </div>
          <div v-if="entry.added?.length" class="changelog-group">
            <p class="changelog-group-label added">เพิ่มใหม่</p>
            <ul class="changelog-list">
              <li v-for="(item, i) in entry.added" :key="i">{{ item }}</li>
            </ul>
          </div>
          <div v-if="entry.fixed?.length" class="changelog-group">
            <p class="changelog-group-label fixed">แก้ไข</p>
            <ul class="changelog-list">
              <li v-for="(item, i) in entry.fixed" :key="i">{{ item }}</li>
            </ul>
          </div>
        </div>
      </section></section></main></template>
<style scoped>.admin-page{height:100vh;overflow-y:auto}.pin-card{width:min(440px,100%);margin:10vh auto 0;padding:28px}.admin-shell{max-width:1180px;margin:0 auto;display:grid;gap:18px}.admin-header{display:flex;justify-content:space-between;align-items:center;gap:16px}h1{margin:0;color:#0f172a;font-size:38px}.tabs{display:flex;gap:8px;flex-wrap:wrap}.tabs button{min-height:48px;border:0;border-radius:14px;padding:8px 16px;background:#e2e8f0;color:#334155;font-weight:700}.tabs button.active{background:#2563eb;color:#fff}.panel{padding:24px}.list{display:grid;gap:10px;max-height:58vh;overflow:auto}.list-item{display:grid;gap:2px;padding:14px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0}.split{display:grid;grid-template-columns:1fr 1.4fr;gap:20px}.uid-row{width:100%;display:grid;gap:2px;margin-bottom:8px;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;text-align:left}.uid-row-wrap{display:flex;align-items:center;gap:8px}.uid-row-wrap .uid-row{margin-bottom:0;flex:1}.uid-row.active{border-color:#2563eb;background:#eff6ff}.uid-row--disabled{opacity:.5;cursor:not-allowed;background:#f8fafc}.check{display:flex;align-items:center;gap:10px;font-weight:700}.check input{width:22px;height:22px}.info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;display:grid;gap:8px}.info-row{display:flex;justify-content:space-between;align-items:center;margin:0;gap:8px}.info-label{font-size:13px;font-weight:700;color:#64748b;white-space:nowrap}.info-value{font-size:13px;color:#0f172a;text-align:right;word-break:break-all}.mono{font-family:monospace;font-size:12px}.bind-steps{display:flex;align-items:center;gap:8px;padding:4px 0}.step{font-size:13px;font-weight:700;color:#94a3b8;padding:4px 10px;border-radius:20px}.step.active{color:#2563eb;background:#eff6ff}.step.done{color:#059669;background:#ecfdf5}.step-sep{color:#cbd5e1;font-size:16px}.bind-uid-badge{background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px 16px;font-size:14px;color:#1e40af}.confirm-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px;display:grid;gap:12px}.confirm-row{display:flex;justify-content:space-between;align-items:center;font-size:15px}.student-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.card-badges{display:flex;gap:6px;flex-wrap:wrap}.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700}.badge--has{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}.badge--none{background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0}.list-item--clickable{cursor:pointer;transition:background 150ms}.list-item--clickable:hover{background:#eff6ff;border-color:#bfdbfe}.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:24px}.modal-box{background:#fff;border-radius:20px;padding:28px;width:min(560px,100%);max-height:80vh;overflow:auto;gap:20px}.card-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.card-item--new{border-color:#bfdbfe;background:#eff6ff}.card-item span:first-child{flex:1}.scan-hint{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 16px;font-size:14px;text-align:center}.changelog-entry{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px 20px;display:grid;gap:10px}.changelog-header{display:flex;align-items:center;gap:10px}.changelog-version{font-size:18px;font-weight:800;color:#0f172a;font-family:monospace}.changelog-group{display:grid;gap:4px}.changelog-group-label{margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.changelog-group-label.added{color:#059669}.changelog-group-label.fixed{color:#d97706}.changelog-list{margin:0;padding-left:18px;display:grid;gap:3px}.changelog-list li{font-size:14px;color:#334155}.badge--new{background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe}.clock-warning{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:14px;padding:12px 18px;font-weight:700}.stat-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.stat-tile{display:grid;gap:2px;place-items:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px}.stat-num{font-size:34px;font-weight:800;color:#0f172a}.stat-label{font-size:13px;color:#64748b;font-weight:700}.stat-tile--ok .stat-num{color:#059669}.stat-tile--warn .stat-num{color:#d97706}.stat-tile--bad .stat-num{color:#dc2626}.summary-table-wrap{overflow-x:auto}.summary-table{width:100%;border-collapse:collapse;font-size:14px}.summary-table th,.summary-table td{padding:10px 12px;text-align:left;border-bottom:1px solid #e2e8f0}.summary-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}.cell-warn{color:#d97706;font-weight:700}.cell-bad{color:#dc2626;font-weight:700}.row-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px}</style>
