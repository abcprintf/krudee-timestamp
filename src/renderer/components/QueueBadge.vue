<script setup lang="ts">
defineProps<{ count: number; syncing: boolean }>()
const emit = defineEmits<{ sync: [] }>()
</script>
<template><button class="queue" :disabled="syncing" aria-label="ซิงก์ข้อมูลค้างส่ง" @click="emit('sync')"><span>คิวค้างส่ง</span><strong>{{ count }}</strong><small>{{ syncing ? 'กำลังซิงก์...' : 'ซิงก์ตอนนี้' }}</small></button></template>
<style scoped>.queue{display:grid;gap:2px;min-width:150px;min-height:64px;padding:10px 16px;border:1px solid #bfdbfe;border-radius:18px;color:#1e3a8a;background:#eff6ff;text-align:left}strong{font-size:28px;line-height:1}small{color:#2563eb}</style>
