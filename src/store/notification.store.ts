/**
 * notification.store.ts — Store de notificaciones en tiempo real (SignalR).
 *
 * Responsabilidades:
 * - Mantener el historial de notificaciones y el conteo de no leídas.
 * - Gestionar la conexión con el Hub de SignalR.
 * - Exponer un trigger reactivo para que el dashboard se refresque
 *   automáticamente cuando el backend emite el evento "ActualizarDashboard".
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr'
import { toast } from 'vue-sonner'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  mensaje: string
  leida: boolean
  fecha: Date
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNotificationStore = defineStore('notifications', () => {
  // ─── Estado ─────────────────────────────────────────────────────────────────
  const unreadCount = ref(0)
  const isConnected = ref(false)
  const dashboardRefreshTrigger = ref(0)
  const notificaciones = ref<AppNotification[]>([])

  // Instancia de la conexión (privada al store)
  let connection: HubConnection | null = null

  // ─── Acción principal ────────────────────────────────────────────────────────

  /**
   * initSignalR — Establece la conexión con el Hub de notificaciones.
   *
   * Seguridad: `withCredentials: true` asegura que el navegador adjunte
   * la Cookie HttpOnly del JWT en el handshake de WebSockets.
   *
   * Evita duplicar conexiones si ya está activa o en proceso de conexión.
   */
  async function initSignalR(): Promise<void> {
    if (
      connection &&
      (connection.state === HubConnectionState.Connected ||
        connection.state === HubConnectionState.Connecting ||
        connection.state === HubConnectionState.Reconnecting)
    ) {
      return
    }

    const hubUrl =
      (import.meta.env.VITE_API_URL as string).replace('/api/v1', '') + '/hubs/notificaciones'

    connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { withCredentials: true })
      .withAutomaticReconnect()
      .build()

    // ── Eventos del servidor ────────────────────────────────────────────────

    connection.on('NuevaNotificacion', (mensaje: string) => {
      // Incrementar contador
      unreadCount.value++

      // Registrar en el historial (más reciente arriba)
      const nuevaNotificacion: AppNotification = {
        id: crypto.randomUUID(),
        mensaje,
        leida: false,
        fecha: new Date(),
      }
      notificaciones.value.unshift(nuevaNotificacion)

      // Toast visual
      toast.info(mensaje)
    })

    connection.on('ActualizarDashboard', () => {
      dashboardRefreshTrigger.value++
    })

    // ── Eventos de ciclo de vida de la conexión ─────────────────────────────

    connection.onreconnecting(() => {
      isConnected.value = false
    })

    connection.onreconnected(() => {
      isConnected.value = true
    })

    connection.onclose(() => {
      isConnected.value = false
    })

    // ── Inicio ──────────────────────────────────────────────────────────────

    try {
      await connection.start()
      isConnected.value = true
    } catch (err) {
      isConnected.value = false
      console.error('[SignalR] Error al conectar al hub de notificaciones:', err)
    }
  }

  /**
   * markAllRead — Marca todas las notificaciones como leídas y reinicia el contador.
   * Llamar cuando el usuario abre el panel de notificaciones.
   */
  function markAllRead(): void {
    notificaciones.value.forEach((n) => {
      n.leida = true
    })
    unreadCount.value = 0
  }

  return {
    unreadCount,
    isConnected,
    dashboardRefreshTrigger,
    notificaciones,
    initSignalR,
    markAllRead,
  }
})
