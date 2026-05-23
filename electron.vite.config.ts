import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin({ exclude: ['ofetch'] })], build: { rollupOptions: { external: ['better-sqlite3', 'node-cron', 'auto-launch'] } } },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: { root: resolve('src/renderer'), plugins: [vue()], resolve: { alias: { '@renderer': resolve('src/renderer') } } }
})
