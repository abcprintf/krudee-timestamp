<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const form = reactive({
  base_url: 'https://krudee.workitdee.com',
  school_code: '',
  setup_token: '',
  device_name: 'อาคาร 1',
  role: 'both',
  admin_pin: '',
})

async function submit(): Promise<void> {
  error.value = ''
  if (!form.school_code || !form.setup_token || form.admin_pin.length < 4) {
    error.value = 'กรุณากรอกข้อมูลให้ครบ และตั้ง PIN อย่างน้อย 4 หลัก'
    return
  }
  loading.value = true
  try {
    await window.krudee.setup.register({ ...form })
    await router.push('/kiosk')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'ลงทะเบียนเครื่องไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="setup-page">
    <div class="setup-layout">
      <!-- Left: branding -->
      <div class="setup-brand">
        <img src="../assets/logo.png" alt="KruDee" class="brand-logo" />
        <h2 class="brand-name">ครูดี</h2>
        <p class="brand-sub">ระบบบันทึกเวลาเข้า-ออกโรงเรียน</p>
      </div>

      <!-- Right: form -->
      <form class="card setup-card grid" @submit.prevent="submit">
        <div>
          <p class="muted">ตั้งค่าครั้งแรก</p>
          <h1>เชื่อมต่อเครื่องบันทึกเวลา</h1>
          <p class="setup-desc">กรอกข้อมูลจากระบบ KruDee เพื่อเริ่มใช้งานคีออสก์ RFID</p>
        </div>

        <label>
          URL เซิร์ฟเวอร์ KruDee
          <input v-model="form.base_url" class="input" required />
        </label>

        <div class="row-fields">
          <label>
            รหัสโรงเรียน
            <input v-model="form.school_code" class="input" required autocomplete="off" />
          </label>
          <label>
            Setup Token
            <input v-model="form.setup_token" class="input" required autocomplete="off" style="text-transform:uppercase" />
          </label>
        </div>

        <div class="row-fields">
          <label>
            ชื่อเครื่อง
            <input v-model="form.device_name" class="input" />
          </label>
          <label>
            โหมดเครื่อง
            <select v-model="form.role" class="input">
              <option value="both">เข้าและออก</option>
              <option value="entry">เข้าอย่างเดียว</option>
              <option value="exit">ออกอย่างเดียว</option>
            </select>
          </label>
        </div>

        <label>
          ตั้ง PIN ผู้ดูแล
          <input v-model="form.admin_pin" class="input pin-input" type="password" inputmode="numeric" required placeholder="อย่างน้อย 4 หลัก" />
        </label>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <button class="btn-primary submit-btn" :disabled="loading">
          {{ loading ? 'กำลังลงทะเบียน...' : 'ลงทะเบียนและดาวน์โหลดรายชื่อนักเรียน' }}
        </button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.setup-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: clamp(16px, 4vw, 48px);
  background: radial-gradient(circle at top left, #dbeafe 0, transparent 28%), #f8fafc;
}

.setup-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: clamp(20px, 3vw, 40px);
  width: 100%;
  max-width: min(620px, 100%);
  align-items: center;
}

/* landscape / wide screen: branding on left, form on right */
@media (min-width: 900px) {
  .setup-layout {
    grid-template-columns: 200px 1fr;
    max-width: min(860px, 100%);
  }
}

.setup-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.brand-logo {
  width: clamp(64px, 10vw, 120px);
  height: clamp(64px, 10vw, 120px);
  object-fit: contain;
  border-radius: 24px;
}

.brand-name {
  margin: 0;
  font-size: clamp(22px, 4vw, 32px);
  font-weight: 700;
  color: #1e40af;
}

.brand-sub {
  margin: 0;
  font-size: clamp(12px, 1.5vw, 14px);
  color: #64748b;
  line-height: 1.4;
}

/* hide branding on very small portrait screens */
@media (max-width: 899px) and (max-height: 600px) {
  .setup-brand { display: none; }
}

.setup-card {
  padding: clamp(20px, 4vw, 36px);
}

h1 {
  margin: 4px 0 0;
  font-size: clamp(20px, 3.5vw, 30px);
  color: #0f172a;
  line-height: 1.2;
}

.setup-desc {
  margin: 6px 0 0;
  font-size: clamp(13px, 1.5vw, 15px);
  color: #64748b;
}

label {
  display: grid;
  gap: 6px;
  font-weight: 700;
  color: #334155;
  font-size: clamp(13px, 1.5vw, 15px);
}

.row-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 500px) {
  .row-fields { grid-template-columns: 1fr; }
}

.pin-input { letter-spacing: 4px; }

.submit-btn {
  width: 100%;
  font-size: clamp(14px, 1.8vw, 16px);
}
</style>
