<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNetwork, refDebounced } from '@vueuse/core'
import { TecnicoService, type OrdenTecnicoDto } from '@/services/tecnico.service'
import { dbOrdenes, dbSyncQueue } from '@/store/sync.store'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

import { Search, ClipboardList, WifiOff, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { isOnline } = useNetwork()

const tabActual = ref<'Pausadas' | 'Completadas'>('Pausadas')
const isLoading = ref(true)
const isLoadingMore = ref(false)

const ordenes = ref<OrdenTecnicoDto[]>([])
const page = ref(1)
const totalPages = ref(1)

const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 300)

async function cargarDatos() {
  if (page.value === 1) {
    isLoading.value = true
  }
  
  try {
    if (tabActual.value === 'Pausadas') {
      const locales = await dbOrdenes.getItem<OrdenTecnicoDto[]>('mis_ordenes') || []
      let filtradas = locales.filter(o => o.estado === 'Pausada')
      if (debouncedSearch.value.trim()) {
        const query = debouncedSearch.value.toLowerCase()
        filtradas = filtradas.filter(o => 
          o.titulo.toLowerCase().includes(query) || 
          o.activoNombre.toLowerCase().includes(query)
        )
      }
      ordenes.value = filtradas
      totalPages.value = 1
    } else {
      // 1. Buscamos órdenes completadas que aún estén en la cola de sincronización local
      const keys = await dbSyncQueue.keys()
      const ordenesEnCola: OrdenTecnicoDto[] = []
      
      for (const key of keys) {
        const item = await dbSyncQueue.getItem<any>(key)
        if (item && item.tipo === 'completar') {
          const misOrdenes = (await dbOrdenes.getItem<any[]>('mis_ordenes')) || []
          const ordenOriginal = misOrdenes.find((o) => o.id === item.ordenId)
          if (ordenOriginal) {
            ordenesEnCola.push({
              ...ordenOriginal,
              estado: 'Completada',
              // Usamos la fecha original de la orden como fallback seguro
              fechaCreacion: item.fecha ? new Date(item.fecha).toISOString() : ordenOriginal.fechaCreacion,
            })
          }
        }
      }

      // 2. Si no hay internet, mostramos lo que esté en la cola local
      if (!isOnline.value) {
        ordenes.value = ordenesEnCola
        totalPages.value = 1
        return
      }

      // 3. Si hay internet, consultamos el historial del servidor
      const res = await TecnicoService.obtenerHistorial(
        page.value,
        10,
        'Completada',
        debouncedSearch.value.trim() || undefined
      )
      
      if (page.value === 1) {
        // Desduplicamos por ID para que no aparezcan dos veces
        const idsEnCola = new Set(ordenesEnCola.map((o) => o.id))
        const delServidorSinDuplicar = res.data.filter((o) => !idsEnCola.has(o.id))
        ordenes.value = [...ordenesEnCola, ...delServidorSinDuplicar]
      } else {
        const idsExistentes = new Set(ordenes.value.map((o) => o.id))
        const nuevasSinDuplicar = res.data.filter((o) => !idsExistentes.has(o.id))
        ordenes.value.push(...nuevasSinDuplicar)
      }
      totalPages.value = res.totalPages
    }
  } catch (error) {
    console.error('Error al cargar historial:', error)
  } finally {
    isLoading.value = false
  }
}

watch(tabActual, () => {
  page.value = 1
  searchQuery.value = ''
  ordenes.value = []
  cargarDatos()
})

watch(debouncedSearch, () => {
  page.value = 1
  cargarDatos()
})

onMounted(() => {
  cargarDatos()
})

// Refresca la vista automáticamente cada vez que el técnico entra al historial
watch(
  () => route.path,
  (newPath) => {
    if (newPath === '/tecnico/historial') {
      cargarDatos()
    }
  }
)

function abrirOrden(orden: OrdenTecnicoDto) {
  if (orden.estado === 'Pausada') {
    router.push('/tecnico/orden/' + orden.id + '/ejecucion')
  } else if (orden.estado === 'Completada') {
    router.push('/tecnico/orden/' + orden.id + '/readonly')
  }
}

async function cargarMas() {
  if (page.value < totalPages.value) {
    isLoadingMore.value = true
    page.value++
    await cargarDatos()
    isLoadingMore.value = false
  }
}

function getBadgeProps(estado: string) {
  if (estado === 'Pausada') return { class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent' }
  return { class: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent' }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return 'Sin fecha'
  const d = new Date(dateStr)
  return d.toLocaleDateString()
}
</script>

<template>
  <div class="max-w-md mx-auto w-full p-4 space-y-5 pb-24 min-h-screen bg-background">
    <h1 class="text-2xl font-bold text-foreground">Mi Historial</h1>
    
    <Tabs v-model="tabActual" class="w-full">
      <TabsList class="w-full grid grid-cols-2">
        <TabsTrigger value="Pausadas">Pausadas</TabsTrigger>
        <TabsTrigger value="Completadas" class="flex items-center justify-center gap-2">
          Completadas
          <WifiOff v-if="!isOnline" class="w-3 h-3 opacity-50 text-amber-500" />
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="relative flex items-center">
      <Search class="absolute left-3 w-4 h-4 text-muted-foreground" />
      <Input 
        v-model="searchQuery" 
        placeholder="Buscar por título o activo..." 
        class="pl-9 h-10 bg-card" 
      />
    </div>

    <div v-if="isLoading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-28 w-full rounded-2xl" />
    </div>

    <div v-else-if="ordenes.length === 0" class="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
      <ClipboardList class="w-16 h-16 opacity-20" />
      <p class="text-sm font-medium">No se encontraron órdenes.</p>
    </div>

    <div v-else class="space-y-3">
      <Card 
        v-for="orden in ordenes" 
        :key="orden.id"
        class="rounded-2xl border-border/50 shadow-sm active:scale-[0.98] transition-transform cursor-pointer bg-card p-4 flex flex-col gap-2"
        @click="abrirOrden(orden)"
      >
        <div class="flex justify-between items-start gap-2">
          <h3 class="font-bold text-foreground leading-tight text-sm">
            #{{ orden.id }} - {{ orden.titulo }}
          </h3>
          <Badge 
            variant="outline" 
            :class="getBadgeProps(orden.estado).class"
            class="text-[10px] shrink-0"
          >
            {{ orden.estado }}
          </Badge>
        </div>
        <div class="text-xs text-muted-foreground font-medium line-clamp-1">
          {{ orden.activoNombre }}
        </div>
        <div class="text-[10px] text-muted-foreground opacity-70 text-right mt-1">
          {{ formatDate(orden.fechaCreacion) }}
        </div>
      </Card>

      <Button 
        v-if="tabActual === 'Completadas' && page < totalPages"
        variant="outline"
        class="w-full h-12 mt-4 active:scale-95"
        @click="cargarMas"
        :disabled="isLoadingMore"
      >
        <Loader2 v-if="isLoadingMore" class="w-4 h-4 mr-2 animate-spin" />
        Cargar más órdenes
      </Button>
    </div>
  </div>
</template>
