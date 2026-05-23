<template>
  <RouterView />
  <footer class="app-footer">
    <span>ระบบจัดการโรงเรียน</span>
    <a href="https://krudee.workitdee.com/" target="_blank" rel="noopener">krudee.workitdee.com</a>
  </footer>
</template>

<style scoped>
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
  background: rgba(248, 250, 252, 0.85);
  backdrop-filter: blur(4px);
  border-top: 1px solid #e2e8f0;
  z-index: 9999;
  pointer-events: none;
}
.app-footer a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
  pointer-events: auto;
}
.app-footer a:hover {
  text-decoration: underline;
}
</style>

