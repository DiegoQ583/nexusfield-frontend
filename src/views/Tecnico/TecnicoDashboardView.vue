<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { dbOrdenes, useSyncStore } from '@/store/sync.store'
import { useAuthStore } from '@/store/auth.store'
import type { OrdenTecnicoDto } from '@/services/tecnico.service'
import { useNetwork, useGeolocation } from '@vueuse/core'

import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

// Lucide icons
import { Package, CheckCircle2, MapPin, Play } from 'lucide-vue-next'

const router = useRouter()
const syncStore = useSyncStore()
const authStore = useAuthStore()
const { isOnline } = useNetwork()
const { coords } = useGeolocation()

const nombreTecnico = computed(() => {
  const nombreCompleto = authStore.user?.nombreCompleto || ''
  return nombreCompleto.split(' ')[0] || 'Técnico'
})

const ordenesPendientes = ref<OrdenTecnicoDto[]>([])
const ordenesEnProgreso = ref<OrdenTecnicoDto[]>([])
const isLoading = ref(true)

const clima = ref({ temp: 0, descripcion: 'Cargando...', icono: '🌤️' })

function mapearClima(code: number) {
  if (code === 0) return { icono: '☀️', descripcion: 'Despejado' }
  if ([1, 2, 3].includes(code)) return { icono: '⛅', descripcion: 'Parcialmente nublado' }
  if ([45, 48].includes(code)) return { icono: '🌫️', descripcion: 'Niebla' }
  if ([51, 53, 55, 61, 63, 65].includes(code)) return { icono: '🌧️', descripcion: 'Lluvia' }
  if ([71, 73, 75].includes(code)) return { icono: '❄️', descripcion: 'Nieve' }
  if ([95, 96, 99].includes(code)) return { icono: '⛈️', descripcion: 'Tormenta' }
  return { icono: '🌤️', descripcion: 'Desconocido' }
}

async function fetchClima() {
  if (!isOnline.value) return
  if (!coords.value || coords.value.latitude === Infinity) return

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.value.latitude}&longitude=${coords.value.longitude}&current_weather=true`)
    const data = await res.json()
    if (data && data.current_weather) {
      clima.value.temp = Math.round(data.current_weather.temperature)
      const mapeo = mapearClima(data.current_weather.weathercode)
      clima.value.icono = mapeo.icono
      clima.value.descripcion = mapeo.descripcion
    }
  } catch (error) {
    console.error('Error fetching weather', error)
    clima.value.descripcion = 'Sin datos'
  }
}

watch(coords, (newCoords) => {
  if (
    newCoords && 
    newCoords.latitude !== Infinity && 
    newCoords.longitude !== Infinity
  ) {
    fetchClima()
  }
}, { deep: true, immediate: true })

async function cargarDatosLocales() {
  try {
    const data = await dbOrdenes.getItem<OrdenTecnicoDto[]>('mis_ordenes')
    if (data) {
      // Solo mostramos las Pendientes en la lista principal
      ordenesPendientes.value = data.filter(o => o.estado === 'Pendiente')
      // Solo mostramos las EnProgreso en la sección verde superior
      ordenesEnProgreso.value = data.filter(o => o.estado === 'EnProgreso')
      // Las órdenes 'Pausada' se ignoran aquí, ya que viven en la vista de Historial
    }
  } catch (error) {
    console.error('Error al leer IndexedDB', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  // 1. Carga inmediata desde IndexedDB (0ms)
  await cargarDatosLocales()
  
  // 2. Dispara la sincronización en background SIN bloquear la UI
  syncStore.descargarDatosDelDia().then(() => {
    // 4. Cuando termine de descargar, vuelve a leer de la BD local para actualizar la UI
    cargarDatosLocales()
  })
})

const repuestosARetirar = computed(() => {
  const map = new Map<string, number>()
  ordenesPendientes.value.forEach(orden => {
    orden.repuestosPreAsignados.forEach(rep => {
      const actual = map.get(rep.nombre) || 0
      map.set(rep.nombre, actual + rep.cantidad)
    })
  })
  
  const result: string[] = []
  map.forEach((cantidad, nombre) => {
    result.push(`${cantidad}x ${nombre}`)
  })
  return result
})

function getBadgeProps(prioridad: string) {
  if (prioridad === 'Alta') return { class: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent' }
  if (prioridad === 'Media') return { class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent' }
  return { class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent' }
}
</script>

<template>
  <div class="max-w-md mx-auto w-full p-4 space-y-6">
    <!-- Sección 1: Saludo y Clima -->
    <div class="flex items-center justify-between bg-card border border-border rounded-2xl p-5 shadow-sm mb-6">
      <h1 class="text-lg font-bold tracking-tight text-foreground">Hola, {{ nombreTecnico }}</h1>
      <div class="flex flex-col items-end">
        <span class="text-2xl font-bold text-foreground">{{ clima.temp }}°C</span>
        <span class="text-xs text-muted-foreground flex items-center gap-1">
          {{ clima.icono }} {{ clima.descripcion }}
        </span>
      </div>
    </div>

    <!-- Sección 2: Alerta de Almacén -->
    <Alert 
      v-if="repuestosARetirar.length > 0"
      class="bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400 flex flex-col gap-2 rounded-xl"
    >
      <div class="flex items-center gap-2 font-medium">
        <Package class="w-4 h-4 shrink-0" />
        Recuerda retirar del almacén:
      </div>
      <ul class="text-xs list-disc list-inside opacity-90 pl-1">
        <li v-for="item in repuestosARetirar" :key="item">{{ item }}</li>
      </ul>
    </Alert>

    <!-- Sección: En Ejecución (Fase 4 refactor) -->
    <div v-if="ordenesEnProgreso.length > 0" class="mb-6">
      <div class="flex items-center gap-2 mb-3">
        <Play class="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
        <h2 class="text-lg font-semibold text-foreground">En Ejecución</h2>
      </div>
      <div class="space-y-3">
        <Card 
          v-for="orden in ordenesEnProgreso" 
          :key="orden.id"
          class="rounded-2xl border-emerald-500/30 bg-emerald-500/5 shadow-sm active:scale-[0.98] transition-all duration-200 overflow-hidden cursor-pointer"
          @click="router.push(`/tecnico/orden/${orden.id}/ejecucion`)"
        >
          <div class="p-4 flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-emerald-700 dark:text-emerald-400 leading-tight text-sm truncate">
                #{{ orden.id }} - {{ orden.titulo }}
              </h3>
              <p class="text-xs text-muted-foreground font-medium truncate mt-1">
                {{ orden.activoNombre }}
              </p>
            </div>
            <Button 
              size="sm" 
              class="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 h-8 rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              Continuar
              <Play class="w-3 h-3 fill-current" />
            </Button>
          </div>
        </Card>
      </div>
    </div>

    <!-- Sección 3: Órdenes Asignadas -->
    <div>
      <h2 class="text-lg font-semibold mb-3 text-foreground">Tus trabajos de hoy</h2>
      
      <div v-if="isLoading" class="space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-28 w-full rounded-2xl" />
      </div>
      
      <div v-else-if="ordenesPendientes.length === 0" class="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
        <CheckCircle2 class="w-16 h-16 opacity-20 text-emerald-500" />
        <p class="text-sm font-medium">No tienes órdenes pendientes.</p>
      </div>
      
      <div v-else class="space-y-3">
        <Card 
          v-for="orden in ordenesPendientes" 
          :key="orden.id"
          class="rounded-2xl border-border/50 shadow-sm active:scale-[0.98] transition-all duration-200 overflow-hidden cursor-pointer bg-card"
          @click="router.push(`/tecnico/orden/${orden.id}/preview`)"
        >
          <div class="bg-muted/20 p-4 border-b border-border/50">
            <div class="flex justify-between items-start gap-2 mb-2">
              <h3 class="font-bold text-foreground leading-tight text-sm">
                #{{ orden.id }} - {{ orden.titulo }}
              </h3>
              <Badge 
                variant="outline" 
                :class="getBadgeProps(orden.prioridad).class"
                class="text-[10px] shrink-0"
              >
                {{ orden.prioridad }}
              </Badge>
            </div>
            <div class="text-xs text-muted-foreground font-medium line-clamp-1">
              {{ orden.activoNombre }}
            </div>
          </div>
          <div class="p-4 flex items-center gap-1.5 text-xs text-muted-foreground opacity-80">
            <MapPin class="w-3.5 h-3.5 shrink-0" />
            <span class="truncate">{{ orden.ubicacion }}</span>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
