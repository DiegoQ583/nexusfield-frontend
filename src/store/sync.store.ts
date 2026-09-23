import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import localforage from 'localforage'
import { useNetwork } from '@vueuse/core'
import { TecnicoService } from '@/services/tecnico.service'
import { fetchCsrfToken } from '@/services/api'
import { toast } from 'vue-sonner'

export const dbOrdenes = localforage.createInstance({ name: 'NexusField', storeName: 'ordenes_locales' })
export const dbCatalogo = localforage.createInstance({ name: 'NexusField', storeName: 'catalogo_local' })
export const dbSyncQueue = localforage.createInstance({ name: 'NexusField', storeName: 'sync_queue' })

// Helper nativo para reconstruir los archivos antes de enviar
function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

export const useSyncStore = defineStore('sync', () => {
  const isSyncing = ref(false)
  const pendingSyncCount = ref(0)
  const { isOnline } = useNetwork()

  // ─── 1. Hidratación inicial del contador ─────────────────────────────────────
  async function actualizarContador() {
    try {
      const keys = await dbSyncQueue.keys()
      pendingSyncCount.value = keys.length
    } catch {
      pendingSyncCount.value = 0
    }
  }

  // Se ejecuta inmediatamente al cargar el store
  actualizarContador()

  // ─── 2. Descargar datos del día (Pre-fetch con Smart Merge) ─────────────────
  async function descargarDatosDelDia() {
    if (!isOnline.value) return

    isSyncing.value = true
    try {
      const [ordenes, catalogo] = await Promise.all([
        TecnicoService.obtenerMisOrdenes(),
        TecnicoService.obtenerCatalogoOffline()
      ])

      const ordenesLocales = (await dbOrdenes.getItem<any[]>('mis_ordenes')) || []

      const ordenesFusionadas = ordenes.map((nueva: any) => {
        const local = ordenesLocales.find((l: any) => l.id === nueva.id)
        if (local && (local.estado === 'EnProgreso' || local.estado === 'Pausada')) {
          return { ...nueva, estado: local.estado }
        }
        return nueva
      })

      const activasLocales = ordenesLocales.filter(
        (l: any) => (l.estado === 'EnProgreso' || l.estado === 'Pausada') && !ordenes.some((n: any) => n.id === l.id)
      )

      await dbOrdenes.setItem('mis_ordenes', [...ordenesFusionadas, ...activasLocales])
      await dbCatalogo.setItem('catalogo', catalogo)
    } catch (error) {
      console.error('Error al sincronizar datos offline:', error)
    } finally {
      isSyncing.value = false
    }
  }

  // ─── 3. Encolar acciones offline de forma segura ────────────────────────────
  async function agregarASyncQueue(data: any, tipo: 'completar' | 'pausar') {
    const id = Date.now().toString()
    await dbSyncQueue.setItem(id, {
      tipo,
      payload: data,
      ordenId: data.ordenId,
      fecha: Date.now()
    })
    await actualizarContador()
  }

  // ─── 4. Procesar la Cola de Sincronización ──────────────────────────────────
  async function procesarSyncQueue() {
    if (isSyncing.value || !isOnline.value) return

    const keys = await dbSyncQueue.keys()
    if (keys.length === 0) {
      pendingSyncCount.value = 0
      return
    }

    isSyncing.value = true
    try {
      await fetchCsrfToken()

      for (const key of keys) {
        const item = await dbSyncQueue.getItem<any>(key)
        if (!item) continue

        const { tipo, payload, ordenId } = item

        try {
          if (tipo === 'completar') {
            // Reconstruimos el FormData en caliente con archivos binarios reales
            const formData = new FormData()
            formData.append('ordenId', ordenId.toString())
            formData.append('horasTrabajadas', payload.horasTrabajadas.toString())
            formData.append('notasTecnico', payload.notasTecnico)

            if (payload.fotosBase64 && Array.isArray(payload.fotosBase64)) {
              payload.fotosBase64.forEach((b64: string, idx: number) => {
                formData.append('fotos', base64ToFile(b64, `evidencia_${ordenId}_${idx}.jpg`))
              })
            }

            if (payload.firmaBase64) {
              formData.append('firma', base64ToFile(payload.firmaBase64, `firma_${ordenId}.png`))
            }

            if (payload.repuestos && Array.isArray(payload.repuestos)) {
              payload.repuestos.forEach((rep: any, index: number) => {
                formData.append(`repuestos[${index}].repuestoId`, rep.id.toString())
                formData.append(`repuestos[${index}].cantidad`, rep.cantidad.toString())
              })
            }

            await TecnicoService.completarOrden(ordenId, formData)
            toast.success(`Orden #${ordenId} sincronizada con éxito`)
          } else if (tipo === 'pausar') {
            await TecnicoService.pausarOrden(ordenId, payload.motivoPausa)
            toast.success(`Pausa de orden #${ordenId} sincronizada`)
          }

          // Si tuvo éxito, lo borramos de la cola
          await dbSyncQueue.removeItem(key)
        } catch (error: any) {
          console.error(`Fallo al sincronizar orden #${ordenId}:`, error)
          // Si el servidor la rechaza con 400 o 404 (conflicto de estado), la descartamos para no trabar la cola
          if (error.response?.status === 400 || error.response?.status === 404) {
            await dbSyncQueue.removeItem(key)
          }
        }
      }
    } catch (err) {
      console.error('Error general en procesarSyncQueue:', err)
    } finally {
      await actualizarContador()
      isSyncing.value = false
      // Refrescamos los datos del día para que la UI se actualice
      descargarDatosDelDia()
    }
  }

  // ─── 5. Gatillo Automático al volver el Internet ────────────────────────────
  watch(
    isOnline,
    async (online) => {
      if (online) {
        await actualizarContador()
        if (pendingSyncCount.value > 0) {
          procesarSyncQueue()
        }
      }
    },
    { immediate: true }
  )

  return {
    isSyncing,
    pendingSyncCount,
    isOnline,
    descargarDatosDelDia,
    agregarASyncQueue,
    procesarSyncQueue,
    actualizarContador
  }
})