<script setup lang="ts">

import { ref, watch, onMounted, computed } from 'vue'
import {
  VisXYContainer,
  VisStackedBar,
  VisAxis,
} from '@unovis/vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { useNotificationStore } from '@/store/notification.store'
import OrdenDetailSheet from './components/OrdenDetailSheet.vue'

// shadcn-vue
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Lucide icons
import {
  ClipboardList,
  CheckCircle2,
  HardHat,
  DollarSign,
  TrendingUp,
  ArrowRight,
} from 'lucide-vue-next'

// ─── Interfaces TypeScript ─────────────────────────────────────────────────────

interface GraficoPunto {
  etiqueta: string
  cantidad: number
}

interface MetricasResponse {
  ordenesPendientes: number
  ordenesCompletadas: number
  tecnicosActivos: number
  costoTotal: number
  grafico: GraficoPunto[]
  prioridades: {
    alta: number
    media: number
    baja: number
  }
}

interface OrdenReciente {
  id: number
  titulo: string
  activoNombre: string
  tecnicoNombre: string
  estado: string
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Composables ──────────────────────────────────────────────────────────────

const notificationStore = useNotificationStore()

// ─── Estado ───────────────────────────────────────────────────────────────────

const metricas = ref<MetricasResponse | null>(null)
const ordenes = ref<OrdenReciente[]>([])
const isLoading = ref(true)
const filtroTiempo = ref('semana')

const router = useRouter()
const isDetailSheetOpen = ref(false)
const selectedOrdenId = ref<number | null>(null)

function abrirDetalle(id: number): void {
  selectedOrdenId.value = id
  isDetailSheetOpen.value = true
}

// ─── Config del gráfico (unovis) ──────────────────────────────────────────────

const barX = (_d: GraficoPunto, i: number) => i
const barY = (d: GraficoPunto) => d.cantidad
const barColor = () => '#6366f1'

const axisTicks = (i: number) =>
  metricas.value?.grafico?.[i]?.etiqueta ?? ''

// Fuerza al Eje Y a mostrar solo números enteros
const yAxisFormat = (tick: number) => (Number.isInteger(tick) ? tick.toString() : '')

// Cálculos para las barras de progreso de prioridades
const totalPrioridades = computed(() => {
  if (!metricas.value?.prioridades) return 0
  const { alta, media, baja } = metricas.value.prioridades
  return alta + media + baja
})

const getPorcentaje = (valor: number) => {
  if (totalPrioridades.value === 0) return 0
  return Math.round((valor / totalPrioridades.value) * 100)
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(value)

interface BadgeStyle {
  class: string
  label: string
}

function getEstadoBadge(estado: string): BadgeStyle {
  switch (estado) {
    case 'Completada':
      return {
        class: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
        label: 'Completada',
      }
    case 'EnProgreso':
      return {
        class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent',
        label: 'En Progreso',
      }
    case 'Pendiente':
      return {
        class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
        label: 'Pendiente',
      }
    default:
      return {
        class: 'bg-muted text-muted-foreground border-transparent',
        label: estado,
      }
  }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchData(silent = false): Promise<void> {
  if (!silent) isLoading.value = true

  try {
    const [metricasRes, ordenesRes] = await Promise.all([
      api.get<MetricasResponse>(`/dashboard/metricas?filtro=${filtroTiempo.value}`),
      api.get<PaginatedResponse<OrdenReciente>>('/ordenes?page=1&pageSize=5'),
    ])

    metricas.value = metricasRes.data
    ordenes.value = ordenesRes.data.data ?? []

  } catch {
    // El interceptor global de Axios muestra el Toast de error correspondiente
  } finally {
    if (!silent) isLoading.value = false
  }
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

// Cambia el filtro → recarga completa con estado de carga
watch(filtroTiempo, () => {
  fetchData(false)
})

// Evento SignalR "ActualizarDashboard" → refresco silencioso (sin parpadeo)
watch(
  () => notificationStore.dashboardRefreshTrigger,
  () => {
    fetchData(true)
  }
)

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  fetchData()
})
</script>

<template>
  <section id="admin-dashboard" class="space-y-6">

    <!-- ── Cabecera ───────────────────────────────────────────────────────── -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          Centro de Comando
        </h1>
        <p class="mt-0.5 text-sm text-muted-foreground">
          Resumen operativo y métricas en tiempo real.
        </p>
      </div>

      <!-- Selector de periodo -->
      <Select v-model="filtroTiempo">
        <SelectTrigger id="filtro-tiempo" class="w-36">
          <SelectValue placeholder="Periodo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hoy">Hoy</SelectItem>
          <SelectItem value="semana">Esta semana</SelectItem>
          <SelectItem value="mes">Este mes</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- ── Fila 1: KPI Cards ──────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

      <!-- KPI: Órdenes Pendientes -->
      <Card class="border border-border shadow-sm cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-200" @click="router.push({ path: '/despachador/ordenes', query: { tab: 'activas', estado: 'Pendiente', filtroTiempo: filtroTiempo } })">
        <CardHeader class="flex flex-row items-center justify-between pb-2 pt-5 px-5">
          <CardTitle class="text-sm font-medium text-muted-foreground">
            Órdenes Pendientes
          </CardTitle>
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
            <ClipboardList class="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
        </CardHeader>
        <CardContent class="px-5 pb-5">
          <Skeleton v-if="isLoading" class="h-9 w-20" />
          <p v-else class="text-3xl font-bold text-foreground">
            {{ metricas?.ordenesPendientes ?? 0 }}
          </p>
        </CardContent>
      </Card>

      <!-- KPI: Órdenes Completadas -->
      <Card class="border border-border shadow-sm cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-200" @click="router.push({ path: '/despachador/ordenes', query: { tab: 'historial', estado: 'Completada', filtroTiempo: filtroTiempo } })">
        <CardHeader class="flex flex-row items-center justify-between pb-2 pt-5 px-5">
          <CardTitle class="text-sm font-medium text-muted-foreground">
            Órdenes Completadas
          </CardTitle>
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
            <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        </CardHeader>
        <CardContent class="px-5 pb-5">
          <Skeleton v-if="isLoading" class="h-9 w-20" />
          <p v-else class="text-3xl font-bold text-foreground">
            {{ metricas?.ordenesCompletadas ?? 0 }}
          </p>
        </CardContent>
      </Card>

      <!-- KPI: Técnicos Activos -->
      <Card class="border border-border shadow-sm cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-200" @click="router.push({ path: '/despachador/usuarios', query: { rol: 'Tecnico' } })">
        <CardHeader class="flex flex-row items-center justify-between pb-2 pt-5 px-5">
          <CardTitle class="text-sm font-medium text-muted-foreground">
            Técnicos Activos
          </CardTitle>
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
            <HardHat class="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent class="px-5 pb-5">
          <Skeleton v-if="isLoading" class="h-9 w-16" />
          <p v-else class="text-3xl font-bold text-foreground">
            {{ metricas?.tecnicosActivos ?? 0 }}
          </p>
        </CardContent>
      </Card>

      <!-- KPI: Costo Total -->
      <Card class="border border-border shadow-sm transition-all duration-200">
        <CardHeader class="flex flex-row items-center justify-between pb-2 pt-5 px-5">
          <CardTitle class="text-sm font-medium text-muted-foreground">
            Costo Total
          </CardTitle>
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
            <DollarSign class="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
        </CardHeader>
        <CardContent class="px-5 pb-5">
          <Skeleton v-if="isLoading" class="h-9 w-28" />
          <p v-else class="text-3xl font-bold text-foreground">
            {{ formatCurrency(metricas?.costoTotal ?? 0) }}
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- ── Fila 2: Gráfico + Tabla ────────────────────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

      <!-- Gráfico de barras (col-span-5) -->
      <Card class="lg:col-span-5 border border-border shadow-sm">
        <CardHeader class="px-5 pt-5 pb-0">
          <div class="flex items-center gap-2">
            <TrendingUp class="w-4 h-4 text-muted-foreground" />
            <CardTitle class="text-sm font-semibold text-foreground">
              Rendimiento de Órdenes
            </CardTitle>
          </div>
          <CardDescription class="text-xs text-muted-foreground mt-0.5">
            Órdenes completadas por día en el periodo seleccionado.
          </CardDescription>
        </CardHeader>
        <CardContent class="px-5 py-4">
          <!-- Skeleton del gráfico -->
          <div v-if="isLoading" class="flex items-end gap-2 h-44 pt-4">
            <Skeleton v-for="i in 7" :key="i" class="flex-1 rounded-md" :style="{ height: `${30 + Math.random() * 70}%` }" />
          </div>

          <!-- Gráfico con unovis -->
          <template v-else-if="metricas?.grafico && metricas.grafico.length > 0">
            <VisXYContainer
              :data="metricas.grafico"
              :height="180"
              class="w-full"
            >
              <VisStackedBar
                :x="barX"
                :y="barY"
                :color="barColor"
                :bar-padding="0.2"
                :rounded-corners="4"
              />
              <VisAxis
                type="x"
                :tick-format="axisTicks"
                :tick-values="metricas?.grafico?.map((_, i) => i)"
                :grid-line="false"
                :tick-line="false"
              />
              <VisAxis
                type="y"
                :tick-format="yAxisFormat"
                :grid-line="true"
                :tick-line="false"
                :num-ticks="4"
              />
            </VisXYContainer>
          </template>

          <!-- Estado vacío -->
          <div v-else class="flex flex-col items-center justify-center h-44 text-center gap-2">
            <TrendingUp class="w-8 h-8 text-muted-foreground/30" />
            <p class="text-sm text-muted-foreground">Sin datos para el periodo seleccionado.</p>
          </div>
        </CardContent>
      </Card>

      <!-- Carga de Trabajo Pendiente (col-span-3) -->
      <Card class="lg:col-span-3 border border-border shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between px-5 pt-5 pb-4">
          <div>
            <CardTitle class="text-sm font-semibold text-foreground">
              Carga Pendiente
            </CardTitle>
            <CardDescription class="text-xs text-muted-foreground mt-0.5">
              Distribución por prioridad.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" class="h-8 text-xs text-muted-foreground hover:text-foreground" @click="router.push({ path: '/despachador/ordenes', query: { tab: 'activas', filtroTiempo: filtroTiempo } })">
            Ver todas
            <ArrowRight class="w-3.5 h-3.5" />
          </Button>
        </CardHeader>
        <CardContent class="px-5 pb-5 space-y-5">

          <!-- Prioridad Alta -->
          <div class="space-y-1.5 cursor-pointer hover:bg-muted/50 rounded-md transition-colors" @click="router.push({ path: '/despachador/ordenes', query: { tab: 'activas', prioridad: 'Alta', filtroTiempo: filtroTiempo } })">
            <div class="flex justify-between text-xs p-1">
              <span class="font-medium text-foreground">Alta</span>
              <span class="text-muted-foreground font-medium">{{ metricas?.prioridades?.alta ?? 0 }}</span>
            </div>
            <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div class="bg-red-500 h-full rounded-full transition-all duration-500" :style="{ width: `${getPorcentaje(metricas?.prioridades?.alta ?? 0)}%` }" />
            </div>
          </div>

          <!-- Prioridad Media -->
          <div class="space-y-1.5 cursor-pointer hover:bg-muted/50 rounded-md transition-colors" @click="router.push({ path: '/despachador/ordenes', query: { tab: 'activas', prioridad: 'Media', filtroTiempo: filtroTiempo } })">
            <div class="flex justify-between text-xs p-1">
              <span class="font-medium text-foreground">Media</span>
              <span class="text-muted-foreground font-medium">{{ metricas?.prioridades?.media ?? 0 }}</span>
            </div>
            <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div class="bg-amber-500 h-full rounded-full transition-all duration-500" :style="{ width: `${getPorcentaje(metricas?.prioridades?.media ?? 0)}%` }" />
            </div>
          </div>

          <!-- Prioridad Baja -->
          <div class="space-y-1.5 cursor-pointer hover:bg-muted/50 rounded-md transition-colors" @click="router.push({ path: '/despachador/ordenes', query: { tab: 'activas', prioridad: 'Baja', filtroTiempo: filtroTiempo } })">
            <div class="flex justify-between text-xs p-1">
              <span class="font-medium text-foreground">Baja</span>
              <span class="text-muted-foreground font-medium">{{ metricas?.prioridades?.baja ?? 0 }}</span>
            </div>
            <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div class="bg-blue-500 h-full rounded-full transition-all duration-500" :style="{ width: `${getPorcentaje(metricas?.prioridades?.baja ?? 0)}%` }" />
            </div>
          </div>

        </CardContent>
      </Card>

      <!-- Tabla de órdenes recientes (col-span-4) -->
      <Card class="lg:col-span-4 border border-border shadow-sm">
        <CardHeader class="px-5 pt-5 pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle class="text-sm font-semibold text-foreground">
              Órdenes Recientes
            </CardTitle>
            <CardDescription class="text-xs text-muted-foreground mt-0.5">
              Últimas 5 órdenes de trabajo en el sistema.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent class="px-0 pb-0">

          <!-- Skeleton de la tabla -->
          <div v-if="isLoading" class="px-5 space-y-3 pb-5">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3">
              <Skeleton class="h-4 w-8" />
              <Skeleton class="h-4 flex-1" />
              <Skeleton class="h-5 w-20 rounded-full" />
            </div>
          </div>

          <!-- Tabla real -->
          <Table v-else>
            <TableHeader>
              <TableRow class="border-border hover:bg-transparent">
                <TableHead class="pl-5 text-xs font-medium text-muted-foreground w-14">
                  ID
                </TableHead>
                <TableHead class="text-xs font-medium text-muted-foreground">
                  Título
                </TableHead>
                <TableHead class="pr-5 text-xs font-medium text-muted-foreground text-right">
                  Estado
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-if="ordenes.length === 0"
                class="border-border/50"
              >
                <TableCell colspan="3" class="pl-5 py-8 text-center text-sm text-muted-foreground">
                  No hay órdenes para mostrar.
                </TableCell>
              </TableRow>
              <TableRow
                v-for="orden in ordenes"
                :key="orden.id"
                class="border-border/50 hover:bg-accent/40 transition-colors cursor-pointer"
                @click="abrirDetalle(orden.id)"
              >
                <TableCell class="pl-5 py-3 text-xs font-mono text-muted-foreground">
                  #{{ orden.id }}
                </TableCell>
                <TableCell class="py-3 max-w-0">
                  <p class="truncate text-sm font-medium text-foreground">{{ orden.titulo }}</p>
                  <p class="truncate text-xs text-muted-foreground mt-0.5">
                    {{ orden.tecnicoNombre }}
                  </p>
                </TableCell>
                <TableCell class="pr-5 py-3 text-right">
                  <Badge
                    variant="outline"
                    :class="getEstadoBadge(orden.estado).class"
                    class="text-[11px] px-2 py-0.5 font-medium"
                  >
                    {{ getEstadoBadge(orden.estado).label }}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    
    <OrdenDetailSheet v-model="isDetailSheetOpen" :orden-id="selectedOrdenId" />
  </section>
</template>
