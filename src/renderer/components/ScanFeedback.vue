<script setup lang="ts">
defineProps<{ kind: 'entry' | 'exit' | 'unknown' | 'duplicate' | 'idle'; message: string }>()
</script>
<template><div class="feedback" :class="kind" role="status" aria-live="polite">{{ message }}</div></template>
<style scoped>.feedback{border-radius:999px;padding:14px 24px;font-size:24px;font-weight:700;color:#1e293b;background:#e2e8f0}.entry{color:#047857;background:#d1fae5}.exit{color:#1d4ed8;background:#dbeafe}.unknown{color:#b91c1c;background:#fee2e2}.duplicate{color:#6b7280;background:#f3f4f6}.idle{color:#475569;background:#f1f5f9}</style>
