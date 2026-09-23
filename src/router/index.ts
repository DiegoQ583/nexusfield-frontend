/**
 * router/index.ts — Configuración de Vue Router con guards de autenticación.
 *
 * Flujo del guard beforeEach (Vue Router 4 return-value API, sin next()):
 * 1. Si la ruta NO requiere auth → dejar pasar (return true).
 * 2. Si la ruta requiere auth → verificar Pinia; si no hay user, intentar
 *    restaurar desde localStorage; si falla, redirigir a /login.
 * 3. Si el usuario está autenticado y navega a /login → redirigir según rol.
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/store/auth.store'

// ─── Definición de rutas ───────────────────────────────────────────────────────

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { requiresAuth: false },
  },

  // ── Módulo Despachador (con layout persistente) ──────────────────────────────────
  {
    path: '/despachador',
    component: () => import('@/components/layout/DespachadorLayout.vue'),
    meta: { requiresAuth: true, roles: ['Despachador', 'Admin'] },
    children: [
      {
        path: 'dashboard',
        name: 'AdminDashboard',
        component: () => import('@/views/Despachador/DespachadorDashboardView.vue'),
      },
      {
        path: 'ordenes',
        name: 'DespachadorOrdenes',
        component: () => import('@/views/Despachador/OrdenesList.vue'),
      },
      {
        path: 'inventario',
        name: 'AdminInventario',
        component: () => import('@/views/Despachador/InventarioList.vue'),
      },
      {
        path: 'usuarios',
        name: 'DespachadorUsuarios',
        component: () => import('@/views/Despachador/UsuariosView.vue'),
      },
      {
        path: 'activos',
        name: 'AdminActivos',
        component: () => import('@/views/Despachador/ActivosList.vue'),
      },
    ],
  },

  // ── Módulo Técnico (PWA Mobile-First) ──────────────────────────────────────────
  {
    path: '/tecnico',
    component: () => import('@/components/layout/TecnicoLayout.vue'),
    meta: { requiresAuth: true, roles: ['Tecnico'] },
    children: [
      {
        path: 'dashboard',
        name: 'TecnicoDashboard',
        component: () => import('@/views/Tecnico/TecnicoDashboardView.vue'),
      },
      {
        path: 'sync',
        name: 'TecnicoSync',
        component: () => import('@/views/Tecnico/SyncQueueView.vue'),
      },
      {
        path: 'historial',
        name: 'TecnicoHistorial',
        component: () => import('@/views/Tecnico/HistorialView.vue'),
      },
      {
        path: 'orden/:id/readonly',
        name: 'OrdenReadOnly',
        component: () => import('@/views/Tecnico/OrdenDetalleReadOnly.vue'),
      },
      {
        path: 'orden/:id/preview',
        name: 'OrdenPreview',
        component: () => import('@/views/Tecnico/OrdenPreview.vue'),
      },
      {
        path: 'orden/:id/ejecucion',
        name: 'OrdenEjecucion',
        component: () => import('@/views/Tecnico/OrdenEjecucion.vue'),
      }
    ]
  },
  {
    // Catch-all: redirige a login si la ruta no existe
    path: '/:pathMatch(.*)*',
    redirect: '/login',
  },
]

// ─── Instancia del router ──────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// ─── Guard de navegación global (Vue Router 4 return-value API) ────────────────

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth as boolean | undefined

  // Ruta pública (login, etc.)
  if (!requiresAuth) {
    // Si ya está autenticado e intenta ir al login → redirigir al dashboard correcto
    if (to.name === 'Login' && authStore.isAuthenticated) {
      return resolveRoleRedirect(authStore.user?.rol)
    }
    return true
  }

  // Ruta protegida: verificar autenticación (Pinia o restaurar desde localStorage)
  const isAuth = authStore.isAuthenticated || authStore.restoreSession()

  if (!isAuth) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }

  // Usuario autenticado: verificar que tiene el rol correcto para esta ruta
  const allowedRoles = to.meta.roles as string[] | undefined
  if (allowedRoles && authStore.user && !allowedRoles.includes(authStore.user.rol)) {
    // Tiene sesión pero no el rol correcto → redirigir a su propio dashboard
    return resolveRoleRedirect(authStore.user.rol)
  }

  return true
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function resolveRoleRedirect(rol: string | undefined): string {
  switch (rol) {
    case 'Despachador':
    case 'Admin':
      return '/despachador/dashboard'
    case 'Tecnico':
      return '/tecnico/dashboard'
    default:
      return '/login'
  }
}

export default router
