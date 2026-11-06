import { defineRouter } from '#q-app/wrappers'
import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'

export default defineRouter(() => createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: HomePage }, { path: '/mesas/:id', component: () => import('../pages/TabletopPage.vue') }],
}))
