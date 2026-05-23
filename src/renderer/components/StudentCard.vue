<script setup lang="ts">
import { ref } from 'vue'
import type { StudentView } from '../env'

const props = defineProps<{ student: StudentView; kind: 'entry' | 'exit'; scannedAt?: string; duplicate?: boolean }>()

const photoError = ref(false)

function onPhotoError(): void { photoError.value = true }

const AVATAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16']
function avatarColor(id: string): string {
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
</script>

<template>
  <section class="student-card card" aria-live="polite">
    <!-- Avatar -->
    <div class="avatar-wrap">
      <img
        v-if="!photoError"
        class="photo"
        :src="`student-photo://${student.id}`"
        :alt="`รูปนักเรียน ${student.first_name}`"
        @error="onPhotoError"
      />
      <div
        v-else
        class="photo avatar-fallback"
        :style="{ background: avatarColor(student.id) }"
        aria-hidden="true"
      >
        {{ student.first_name.charAt(0) }}
      </div>
    </div>

    <!-- Info -->
    <div class="info">
      <!-- Scan type badge -->
      <span v-if="duplicate" class="badge badge--dup">✋ แตะบัตรแล้ว</span>
      <span v-else class="badge" :class="kind === 'entry' ? 'badge--entry' : 'badge--exit'">
        {{ kind === 'entry' ? '🏫 เข้าโรงเรียน' : '🏠 กลับบ้าน' }}
      </span>

      <h1 class="full-name">{{ student.prefix }}{{ student.first_name }} {{ student.last_name }}</h1>

      <p class="nickname">{{ student.nickname ? `น้อง${student.nickname}` : `น้อง${student.first_name}` }}</p>

      <p class="classroom">
        <span>📚 {{ student.classroom_name || 'ไม่ระบุห้อง' }}</span>
        <span v-if="student.class_number" class="class-number">เลขที่ {{ student.class_number }}</span>
      </p>

      <p v-if="scannedAt" class="scan-time">
        🕐 {{ formatTime(scannedAt) }} น.
      </p>
    </div>
  </section>
</template>

<style scoped>
.student-card {
  display: grid;
  grid-template-columns: 240px 1fr;
  align-items: center;
  gap: 36px;
  padding: 32px;
  width: min(900px, 100%);
}

.avatar-wrap { flex-shrink: 0; }

.photo {
  width: 240px;
  height: 240px;
  border-radius: 24px;
  object-fit: cover;
  border: 4px solid #fff;
  box-shadow: 0 0 0 2px #e2e8f0;
}

.avatar-fallback {
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 100px;
  font-weight: 800;
  letter-spacing: -2px;
  user-select: none;
}

.info { display: grid; gap: 10px; }

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 20px;
  font-weight: 700;
  width: fit-content;
}
.badge--entry { background: #dcfce7; color: #15803d; }
.badge--exit  { background: #fef9c3; color: #a16207; }
.badge--dup   { background: #f1f5f9; color: #64748b; }

.full-name {
  margin: 0;
  color: #0f172a;
  font-size: clamp(36px, 4.5vw, 64px);
  line-height: 1.1;
  font-weight: 800;
}

.nickname {
  margin: 0;
  color: #f97316;
  font-size: clamp(22px, 2.5vw, 34px);
  font-weight: 700;
}

.classroom {
  margin: 0;
  font-size: 20px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 12px;
}
.class-number { color: #94a3b8; }

.scan-time {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 720px) {
  .student-card { grid-template-columns: 1fr; text-align: center; justify-items: center; }
  .badge { margin: 0 auto; }
  .classroom { justify-content: center; }
}
</style>
