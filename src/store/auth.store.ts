/**
 * auth.store.ts — Store de autenticación para NexusField.
 *
 * Responsabilidades:
 * - Mantener el perfil público del usuario (NUNCA el JWT).
 * - Proveer acciones login/logout con flujo CSRF → credenciales.
 * - Restaurar sesión desde localStorage para persistir entre recargas.
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api, { fetchCsrfToken } from '@/services/api'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  nombreCompleto: string
  nombreUsuario: string
  rol: string
}

export interface LoginCredentials {
  nombreUsuario: string
  clave: string
}

const STORAGE_KEY = 'nexus_profile'

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = defineStore('auth', () => {
  // ── Estado ──────────────────────────────────────────────────────────────────
  const user = ref<User | null>(null)

  // ── Getters ─────────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!user.value)

  // ── Acciones ────────────────────────────────────────────────────────────────

  /**
   * login — Obtiene cookie CSRF primero, luego envía credenciales.
   * El JWT lo maneja el backend vía Cookie HttpOnly; aquí solo guardamos el perfil.
   */

  async function login(credentials: LoginCredentials): Promise<void> {
    // 1. Pedimos token CSRF para "Invitado" (necesario para poder hacer el POST de login)
    await fetchCsrfToken()

    // 2. Hacemos el Login. El backend nos devuelve la cookie JWT.
    const { data } = await api.post<User>('/auth/login', credentials)

    // 3. EL FIX MÁGICO: Pedimos un NUEVO token CSRF. 
    // Como Axios ya tiene la cookie JWT, .NET nos dará un token atado al usuario autenticado.
    await fetchCsrfToken()

    // 4. Guarda el perfil público
    user.value = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  /**
   * logout — Notifica al backend para invalidar la sesión server-side
   * y limpia todo estado local.
   */
  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } catch {
      // Silencia errores de red: el estado local se limpia de todas formas
    } finally {
      user.value = null
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  /**
   * restoreSession — Recupera el perfil desde localStorage.
   * Usado por el router guard para mantener sesión entre recargas.
   * Retorna true si se pudo restaurar, false en caso contrario.
   */
  function restoreSession(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false

    try {
      const parsed = JSON.parse(raw) as unknown
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'id' in parsed &&
        'nombreUsuario' in parsed &&
        'rol' in parsed
      ) {
        user.value = parsed as User

        // NUEVO: Si restauramos la sesión con éxito al recargar la página, 
        // pedimos un token CSRF nuevo en segundo plano para poder hacer POSTs.
        fetchCsrfToken()

        return true
      }
      return false
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      return false
    }
  }

  return {
    user,
    isAuthenticated,
    login,
    logout,
    restoreSession,
  }
})
