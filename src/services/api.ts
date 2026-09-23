/**
 * api.ts — Instancia global de Axios para NexusField.
 *
 * Responsabilidades:
 * - Configurar baseURL, withCredentials y headers CSRF de forma global.
 * - Interceptar respuestas HTTP y manejar 401/429/500 de forma centralizada.
 * - Dejar pasar los errores 400 para que el componente los gestione localmente.
 */

import axios, { type AxiosError } from 'axios'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/store/auth.store'

// ─── Instancia base ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ─── Manejo de CSRF en Memoria ─────────────────────────────────────────────────
let csrfTokenInMemory: string | null = null

// Exportamos esta función para llamarla desde el Login
export async function fetchCsrfToken(): Promise<void> {
  try {
    const response = await api.get('/auth/csrf')
    csrfTokenInMemory = response.data.token
  } catch (error) {
    console.error('Error obteniendo el token CSRF', error)
  }
}

// ─── Interceptor de Peticiones ─────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  // Solo inyectamos el token en peticiones que modifican datos
  const requiresCsrf = ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() ?? '')

  if (requiresCsrf && csrfTokenInMemory && config.headers) {
    config.headers['X-XSRF-TOKEN'] = csrfTokenInMemory
  }

  return config
}, (error) => {
  return Promise.reject(error)
})

// ─── Interceptor de respuestas ─────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const originalRequest = error.config
    const responseData = error.response?.data as any // Cast para evitar errores de TS

    // ── Auto-Refresh del Token CSRF (Silent Retry Blindado) ──
    // Convertimos toda la respuesta a string en minúsculas para atrapar cualquier variante del error
    const errorString = JSON.stringify(responseData || {}).toLowerCase() + (error.message || '').toLowerCase()
    const isAntiforgeryError = errorString.includes('anti-forgery') || errorString.includes('antiforgery')

    if (isAntiforgeryError && originalRequest && !(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true
      try {
        console.log('[Seguridad] Refrescando token CSRF en segundo plano...')
        await fetchCsrfToken()
        if (originalRequest.headers && csrfTokenInMemory) {
          originalRequest.headers['X-XSRF-TOKEN'] = csrfTokenInMemory
        }
        return api(originalRequest)
      } catch (retryError) {
        return Promise.reject(retryError)
      }
    }

    // Extrae la URL original para discriminar errores del flujo de login
    const url = originalRequest?.url ?? ''
    const isLoginRequest = url.includes('/auth/login')

    if (status === 401) {
      if (isLoginRequest) {
        // El componente LoginView.vue se encarga de mostrar el mensaje
        return Promise.reject(error)
      }

      // Sesión expirada fuera del login → limpiar estado y redirigir
      const authStore = useAuthStore()
      authStore.logout()

      toast.warning('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', {
        style: { background: '#f97316', color: '#fff' },
      })

      // Importación dinámica para romper la dependencia circular
      const router = (await import('@/router')).default
      await router.push('/login')
      return Promise.reject(error)
    }

    if (status === 429) {
      if (isLoginRequest) {
        // El componente LoginView.vue mostrará el mensaje inline en la Card
        return Promise.reject(error)
      }
      toast.warning('Demasiados intentos. Espera 1 minuto antes de volver a intentarlo.')
      return Promise.reject(error)
    }

    if (status === 500 && !isAntiforgeryError) {
      toast.error('Error interno del servidor. Por favor, inténtalo más tarde.')
      return Promise.reject(error)
    }

    // Los errores 400 (ValidationProblemDetails) se propagan al componente
    return Promise.reject(error)
  }
)

export default api
