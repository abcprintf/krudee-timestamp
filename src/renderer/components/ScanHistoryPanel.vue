<script setup lang="ts">
import { ref } from 'vue'
import type { ScanHistoryRow } from '../env'

defineProps<{ rows: ScanHistoryRow[] }>()

const AVATAR_COLORS = ['#6366f1','#f43f5e','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6']
function hashColor(str: string): string { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff; return AVATAR_COLORS[h % AVATAR_COLORS.length] }

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fullName(row: ScanHistoryRow): string {
  if (!row.first_name) return `RFID: ${row.rfid_uid.slice(-6)}`
  return `${row.prefix ?? ''}${row.first_name} ${row.last_name ?? ''}`.trim()
}

const photoErrors = ref<Set<number>>(new Set())
function onPhotoError(id: number): void { photoErrors.value = new Set([...photoErrors.value, id]) }
</script>

<template>
  <aside class="history-panel">
    <h3 class="panel-title">ประวัติการแตะบัตรวันนี้</h3>
    <div v-if="rows.length === 0" class="empty">ยังไม่มีการแตะบัตร</div>
    <ul v-else class="list">
      <li v-for="row in rows" :key="row.id" class="item" :class="row.first_name ? '' : 'item--unknown'">
        <!-- Avatar -->
        <div class="avatar">
          <img v-if="row.photo_local_path && !photoErrors.has(row.id)"
            :src="`student-photo://${row.photo_local_path}`"
            :alt="row.first_name ?? ''"
            @error="onPhotoError(row.id)" />
          <div v-else class="avatar-fallback" :style="{ background: hashColor(row.rfid_uid) }">
            {{ row.first_name ? row.first_name[0] : '?' }}
          </div>
        </div>
        <!-- Info -->
        <div class="info">
          <div class="top-row">
            <span class="time">{{ fmtTime(row.scanned_at) }}</span>
            <span class="badge" :class="row.kind === 'entry' ? 'badge--entry' : 'badge--exit'">
              {{ row.kind === 'entry' ? 'เข้า' : 'ออก' }}
            </span>
          </div>
          <span class="name">{{ fullName(row) }}</span>
          <div class="sub-row">
            <span v-if="row.nickname" class="nick">({{ row.nickname }})</span>
            <span v-if="row.classroom_name" class="room">{{ row.classroom_name }}</span>
          </div>
        </div>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.history-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
  overflow-y: auto;
  max-height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.panel-title { margin: 0; font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .05em; }
.empty { font-size: 14px; color: #94a3b8; text-align: center; padding: 32px 0; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: white; border-radius: 10px; border: 1px solid #f1f5f9; }
.item--unknown { opacity: .55; }
/* Avatar */
.avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: white; }
/* Info */
.info { display: flex; flex-direction: column; min-width: 0; gap: 2px; flex: 1; }
.top-row { display: flex; align-items: center; gap: 6px; }
.time { font-size: 12px; font-weight: 700; color: #64748b; }
.badge { display: inline-flex; align-items: center; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px; }
.badge--entry { background: #dcfce7; color: #15803d; }
.badge--exit  { background: #fef9c3; color: #92400e; }
.name { font-size: 13px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub-row { display: flex; gap: 6px; }
.nick { font-size: 11px; color: #f97316; }
.room { font-size: 11px; color: #64748b; }
</style>
