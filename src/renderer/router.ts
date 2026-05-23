import { createRouter, createWebHashHistory } from 'vue-router'
import Setup from './pages/Setup.vue'
import Kiosk from './pages/Kiosk.vue'
import Admin from './pages/Admin.vue'
import Offline from './pages/Offline.vue'

const router = createRouter({ history: createWebHashHistory(), routes: [
  { path: '/', redirect: '/kiosk' }, { path: '/setup', component: Setup }, { path: '/kiosk', component: Kiosk }, { path: '/admin', component: Admin }, { path: '/offline', component: Offline }
] })
router.beforeEach(async (to) => { const config = await window.krudee.config.get(); if (!config.configured && to.path !== '/setup') return '/setup'; if (config.configured && to.path === '/setup') return '/kiosk'; return true })
export default router
