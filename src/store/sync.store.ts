import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import localforage from 'localforage'
import { useNetwork } from '@vueuse/core'
import { TecnicoService } from '@/services/tecnico.service'
import { fetchCsrfToken } from '@/services/api'

export const dbOrdenes = localforage.createInstance({ name: 'NexusField', storeName: 'ordenes_locales' })
export const dbCatalogo = localforage.createInstance({ name: 'NexusField', storeName: 'catalogo_local' })
export const dbSyncQueue = localforage.createInstance({ name: 'NexusField', storeName: 'sync_queue' })

export const useSyncStore = defineStore('sync', () => {
  const isSyncing = ref(false)
  const pendingSyncCount = ref(0)

  const { isOnline } = useNetwork()

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
        if (local && local.estado === 'EnProgreso') {
          return { ...nueva, estado: 'EnProgreso' }
        }
        return nueva
      })

      const enProgresoLocales = ordenesLocales.filter(
        (l: any) => l.estado === 'EnProgreso' && !ordenes.some((n: any) => n.id === l.id)
      )
      const resultadoFinal = [...ordenesFusionadas, ...enProgresoLocales]

      await dbOrdenes.setItem('mis_ordenes', resultadoFinal)
      await dbCatalogo.setItem('catalogo', catalogo)
    } catch (error) {
      console.error('Error al sincronizar datos offline:', error)
    } finally {
      isSyncing.value = false
    }
  }

  async function agregarASyncQueue(payload: FormData | any, tipo: 'completar' | 'pausar') {
    let objetoPlano: Record<string, any> = {}
    let ordenId: number = 0

    if (payload instanceof FormData) {
      for (const [key, value] of payload.entries()) {
        objetoPlano[key] = value
      }
      ordenId = parseInt(objetoPlano['ordenId'] as string, 10)
    } else {
      objetoPlano = payload
      ordenId = payload.ordenId
    }

    const id = Date.now().toString()
    await dbSyncQueue.setItem(id, { tipo, payload: objetoPlano, ordenId, fecha: Date.now() })
    pendingSyncCount.value++
  }

  async function procesarSyncQueue() {
    if (isSyncing.value || !isOnline.value) return

    isSyncing.value = true

    await fetchCsrfToken()

    isSyncing.value = true
    try {
      const keys = await dbSyncQueue.keys()
      for (const key of keys) {
        const item = await dbSyncQueue.getItem<any>(key)
        if (!item) continue

        const { tipo, payload, ordenId } = item

        try {
          if (tipo === 'completar') {
            const formData = new FormData()
            for (const k in payload) {
              formData.append(k, payload[k])
            }
            await TecnicoService.completarOrden(ordenId, formData)
          } else if (tipo === 'pausar') {
            await TecnicoService.pausarOrden(ordenId, payload.motivoPausa)
          }
          await dbSyncQueue.removeItem(key)
        } catch (error: any) {
          if (error.response?.status === 400) {
            await dbSyncQueue.removeItem(key)
            console.warn(`[SyncQueue] Descartada orden #${ordenId} de la cola por error 400 del servidor.`)
          } else {
            console.error(`Error sincronizando la orden #${ordenId}`, error)
          }
        }
      }
    } catch (error) {
      console.error('Error procesando sync queue:', error)
    } finally {
      const remainingKeys = await dbSyncQueue.keys()
      pendingSyncCount.value = remainingKeys.length
      isSyncing.value = false
    }
  }

  watch(isOnline, (online) => {
    if (online && pendingSyncCount.value > 0) {
      procesarSyncQueue()
    }
  })

  return {
    isSyncing,
    pendingSyncCount,
    isOnline,
    descargarDatosDelDia,
    agregarASyncQueue,
    procesarSyncQueue
  }
})
