<script setup lang="ts">
/**
 * OrdenesList.vue — Vista principal del módulo de Gestión de Órdenes.
 *
 * Responsabilidades:
 * - Mostrar órdenes paginadas del servidor con filtros de tab, búsqueda y prioridad.
 * - Debounce en la búsqueda para no saturar el backend con cada tecla.
 * - Paginación server-side con navegación Anterior/Siguiente.
 * - Skeletons de carga y estado vacío.
 */

import { ref, reactive, watch, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNetwork, refDebounced } from '@vueuse/core'
import { useAppFeedback } from '@/composables/useAppFeedback'
import { OrdenesService } from '@/services/ordenes.service'
import type { OrdenDto, OrdenPrioridad, OrdenEstado } from '@/services/ordenes.service'
import OrdenCreateSheet from './components/OrdenCreateSheet.vue'
import OrdenDetailSheet from './components/OrdenDetailSheet.vue'

// shadcn-vue
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

// Lucide icons
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  WifiOff,
  ClipboardList,
} from 'lucide-vue-next'

// ─── Composables ──────────────────────────────────────────────────────────────

const { isOnline } = useNetwork()

// ─── Estado ───────────────────────────────────────────────────────────────────

const ordenes = ref<OrdenDto[]>([])
const totalRecords = ref(0)
const totalPages = ref(0)
const isLoading = ref(true)
const isCreateSheetOpen = ref(false)
const isDetailSheetOpen = ref(false)
const selectedOrdenId = ref<number | null>(null)

function abrirDetalle(id: number): void {
  selectedOrdenId.value = id
  isDetailSheetOpen.value = true
}

// Objeto de parámetros de consulta unificado (fuente única de verdad para filtros)
const queryParams = reactive({
  page: 1,
  pageSize: 10,
  tab: 'activas',
  prioridad: 'todas',
  filtroTiempo: 'todos',
})
const feedback = useAppFeedback()

const selectedEstados = ref<string[]>([])

const labelFiltroEstado = computed(() => {
  if (selectedEstados.value.length === 0) return 'Estado: Todos'
  if (selectedEstados.value.length === 1) return `Estado: ${selectedEstados.value[0]}`
  return `Estados (${selectedEstados.value.length})`
})

const opcionesEstado = computed(() => {
  return queryParams.tab === 'activas'
    ? ['Pendiente', 'EnProgreso', 'Pausada']
    : ['Completada', 'Cancelada']
})

function toggleEstado(opcion: string, checked: boolean | 'indeterminate'): void {
  if (checked === true) {
    if (!selectedEstados.value.includes(opcion)) {
      selectedEstados.value.push(opcion)
    }
  } else {
    // Usamos splice para garantizar la reactividad en Vue 3
    const index = selectedEstados.value.indexOf(opcion)
    if (index > -1) {
      selectedEstados.value.splice(index, 1)
    }
  }
}

// La búsqueda se separa como ref independiente para poder pasarla a refDebounced.
// refDebounced requiere un Ref<T>, no un getter de reactive.
const searchQuery = ref('')
const debouncedQ = refDebounced(searchQuery, 300)

// ─── Helpers de UI ────────────────────────────────────────────────────────────

interface BadgeStyle { class: string; label: string }

function getPrioridadBadge(prioridad: OrdenPrioridad): BadgeStyle {
  switch (prioridad) {
    case 'Alta':
      return {
        class: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',
        label: 'Alta',
      }
    case 'Media':
      return {
        class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
        label: 'Media',
      }
    case 'Baja':
      return {
        class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent',
        label: 'Baja',
      }
  }
}

function getEstadoBadge(estado: OrdenEstado): BadgeStyle {
  switch (estado) {
    case 'Completada':
      return {
        class: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
        label: 'Completada',
      }
    case 'Pendiente':
      return {
        class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
        label: 'Pendiente',
      }
    case 'EnProgreso':
      return {
        class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
        label: 'En Progreso',
      }
    case 'Pausada':
      return {
        class: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-transparent',
        label: 'Pausada',
      }
    case 'Cancelada':
      return {
        class: 'bg-muted text-muted-foreground border-transparent',
        label: 'Cancelada',
      }
  }
}

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchOrdenes(): Promise<void> {
  isLoading.value = true
  try {
    const result = await OrdenesService.obtenerPaginadas({
      page: queryParams.page,
      pageSize: queryParams.pageSize,
      q: searchQuery.value,
      tab: queryParams.tab,
      prioridad: queryParams.prioridad,
      filtroTiempo: queryParams.filtroTiempo,
      estado: selectedEstados.value.length > 0 ? selectedEstados.value.join(',') : undefined,
    })
    ordenes.value = result.data
    totalRecords.value = result.totalRecords
    totalPages.value = result.totalPages
  } catch {
    feedback.showErrorModal('Ocurrió un error al cargar las órdenes.')
    // El interceptor global de Axios muestra el toast de error 500
  } finally {
    isLoading.value = false
  }
}

// ─── Watchers (responsabilidades separadas) ───────────────────────────────────

// 1. Búsqueda con debounce: resetea a la primera página para que los resultados
//    no queden desplazados si el usuario ya estaba en página 3.
watch(debouncedQ, () => {
  queryParams.page = 1
  fetchOrdenes()
})

// 2. Cambio de Tab: resetea estados y página 1.
watch(
  () => queryParams.tab,
  (newTab, oldTab) => {
    if (newTab !== oldTab) {
      selectedEstados.value = []
      queryParams.page = 1
      fetchOrdenes()
    }
  }
)

// 3. Cambio de Prioridad: resetea página 1.
watch(
  () => queryParams.prioridad,
  () => {
    queryParams.page = 1
    fetchOrdenes()
  }
)

// 4. Cambio de Estado: resetea página 1.
watch(
  () => [...selectedEstados.value],
  () => {
    queryParams.page = 1
    fetchOrdenes()
  }
)

// 5. Cambio de Tiempo: resetea página 1.
watch(
  () => queryParams.filtroTiempo,
  () => {
    queryParams.page = 1
    fetchOrdenes()
  }
)

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const route = useRoute()

onMounted(() => {
  if (route.query.filtroTiempo) {
    queryParams.filtroTiempo = route.query.filtroTiempo as string
  }
  if (route.query.tab) queryParams.tab = route.query.tab as string
  if (route.query.prioridad) queryParams.prioridad = route.query.prioridad as string
  if (route.query.estado) {
    const estadosUrl = route.query.estado as string
    selectedEstados.value = estadosUrl.split(',')
  }
  fetchOrdenes()
})
</script>

<template>
  <section id="ordenes-view" class="space-y-6">

    <!-- ── Cabecera ───────────────────────────────────────────────────────── -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          Gestión de Órdenes
        </h1>
        <p class="mt-0.5 text-sm text-muted-foreground">
          Monitor de trabajos en terreno
        </p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Aviso offline -->
        <div
          v-if="!isOnline"
          class="flex items-center gap-1.5 text-xs text-destructive"
        >
          <WifiOff class="w-3.5 h-3.5" />
          Sin conexión
        </div>

        <Button :disabled="!isOnline" class="gap-2" @click="isCreateSheetOpen = true">
          <Plus class="w-4 h-4" />
          Nueva Orden
        </Button>
      </div>
    </div>

    <!-- ── Filtros ────────────────────────────────────────────────────────── -->
    <div class="flex flex-col xl:flex-row items-start xl:items-center gap-4 w-full">

      <!-- Tabs: activas vs historial -->
      <Tabs v-model="queryParams.tab" class="shrink-0">
        <TabsList>
          <TabsTrigger value="activas">Activas</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
      </Tabs>

      <!-- Controles del lado derecho -->
      <div class="flex flex-wrap flex-1 items-center gap-3 xl:justify-end w-full">

        <!-- Búsqueda -->
        <div class="relative flex-1 min-w-[200px]">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            id="search-ordenes"
            v-model="searchQuery"
            type="search"
            placeholder="Buscar por título o técnico..."
            class="pl-9"
          />
        </div>

        <!-- Selector Múltiple de Estados -->
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline" class="gap-2 shrink-0 border-dashed min-w-[140px] justify-between">
              {{ labelFiltroEstado }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-48 p-2" align="end">
            <div class="space-y-1">
              <div
                v-for="est in opcionesEstado"
                :key="est"
                class="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent cursor-pointer"
                @click="toggleEstado(est, !selectedEstados.includes(est))"
              >
                <Checkbox
                  :id="'estado-' + est"
                  :model-value="selectedEstados.includes(est)"
                  :checked="selectedEstados.includes(est)"
                  class="pointer-events-none"
                />
                <span class="text-sm leading-none font-normal pointer-events-none">
                  {{ getEstadoBadge(est as OrdenEstado).label }}
                </span>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <!-- Selector de Tiempo -->
        <Select v-model="queryParams.filtroTiempo">
          <SelectTrigger id="filtro-tiempo" class="w-44 shrink-0">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Cualquier fecha</SelectItem>
            <SelectItem value="hoy">Hoy</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes">Este mes</SelectItem>
          </SelectContent>
        </Select>

        <!-- Selector de Prioridad -->
        <Select
          v-model="queryParams.prioridad"
          @update:model-value="() => { queryParams.page = 1; fetchOrdenes(); }"
        >
          <SelectTrigger id="filtro-prioridad" class="w-36 shrink-0">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="Alta">Alta</SelectItem>
            <SelectItem value="Media">Media</SelectItem>
            <SelectItem value="Baja">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- ── Tabla ──────────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

      <!-- Skeleton de carga -->
      <div v-if="isLoading" class="p-5 space-y-3">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <Skeleton class="h-4 w-10 shrink-0" />
          <Skeleton class="h-4 flex-1" />
          <Skeleton class="h-4 w-28 hidden md:block" />
          <Skeleton class="h-5 w-16 rounded-full" />
          <Skeleton class="h-5 w-20 rounded-full" />
          <Skeleton class="h-4 w-20 hidden lg:block" />
        </div>
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow class="border-border hover:bg-transparent">
            <TableHead class="pl-5 w-16 text-sm font-medium text-muted-foreground">
              #
            </TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground">
              Título / Activo
            </TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground hidden md:table-cell">
              Técnico
            </TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground w-24">
              Prioridad
            </TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground w-28">
              Estado
            </TableHead>
            <TableHead class="pr-5 text-sm font-medium text-muted-foreground hidden lg:table-cell w-32">
              Fecha
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>

          <!-- Estado vacío -->
          <TableRow v-if="ordenes.length === 0" class="border-border/50">
            <TableCell colspan="6" class="py-16">
              <div class="flex flex-col items-center gap-3 text-muted-foreground">
                <ClipboardList class="w-10 h-10 opacity-30" />
                <p class="text-sm font-medium">No se encontraron órdenes</p>
                <p class="text-xs opacity-70">
                  {{ searchQuery ? 'Intenta con un término diferente.' : 'No hay órdenes para los filtros seleccionados.' }}
                </p>
              </div>
            </TableCell>
          </TableRow>

          <!-- Filas de datos -->
          <TableRow
            v-for="orden in ordenes"
            :key="orden.id"
            class="border-border/50 hover:bg-accent/40 transition-colors cursor-pointer"
            @click="abrirDetalle(orden.id)"
          >
            <!-- ID -->
            <TableCell class="pl-5 py-3.5">
              <span class="text-sm font-mono text-muted-foreground">
                #{{ orden.id }}
              </span>
            </TableCell>

            <!-- Título + Activo -->
            <TableCell class="py-3.5 max-w-0">
              <p class="text-sm font-semibold text-foreground truncate">
                {{ orden.titulo }}
              </p>
              <p class="text-xs text-muted-foreground truncate mt-0.5">
                {{ orden.activoNombre }}
              </p>
            </TableCell>

            <!-- Técnico -->
            <TableCell class="py-3.5 hidden md:table-cell">
              <Badge
                v-if="!orden.tecnicoNombre || orden.tecnicoNombre === 'Sin asignar'"
                variant="outline"
                class="bg-destructive/10 text-destructive border-transparent text-xs font-medium px-2 py-0.5"
              >
                Sin asignar
              </Badge>
              <span v-else class="text-sm text-muted-foreground">
                {{ orden.tecnicoNombre }}
              </span>
            </TableCell>

            <!-- Prioridad badge -->
            <TableCell class="py-3.5">
              <Badge
                variant="outline"
                :class="getPrioridadBadge(orden.prioridad).class"
                class="text-xs font-medium px-2 py-0.5"
              >
                {{ getPrioridadBadge(orden.prioridad).label }}
              </Badge>
            </TableCell>

            <!-- Estado badge -->
            <TableCell class="py-3.5">
              <Badge
                variant="outline"
                :class="getEstadoBadge(orden.estado).class"
                class="text-xs font-medium px-2 py-0.5"
              >
                {{ getEstadoBadge(orden.estado).label }}
              </Badge>
            </TableCell>

            <!-- Fecha -->
            <TableCell class="pr-5 py-3.5 hidden lg:table-cell">
              <span class="text-sm text-muted-foreground">
                {{ formatFecha(orden.fechaCreacion) }}
              </span>
            </TableCell>
          </TableRow>

        </TableBody>
      </Table>

      <!-- ── Paginación server-side ──────────────────────────────────────── -->
      <div
        v-if="!isLoading && totalRecords > 0"
        class="px-5 py-3.5 border-t border-border/50 flex items-center justify-between gap-4"
      >
        <!-- Info de página -->
        <p class="text-xs text-muted-foreground shrink-0">
          Página
          <span class="font-medium text-foreground">{{ queryParams.page }}</span>
          de
          <span class="font-medium text-foreground">{{ totalPages }}</span>
          &mdash; {{ totalRecords }} registro{{ totalRecords !== 1 ? 's' : '' }}
        </p>

        <!-- Controles de navegación -->
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="queryParams.page <= 1"
            class="gap-1.5 h-8"
            @click="queryParams.page--"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="queryParams.page >= totalPages"
            class="gap-1.5 h-8"
            @click="queryParams.page++"
          >
            Siguiente
            <ChevronRight class="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- ── Sheet de Detalle de Orden ───────────────────────────────────────────── -->
    <OrdenDetailSheet
      v-model="isDetailSheetOpen"
      :orden-id="selectedOrdenId"
      @saved="fetchOrdenes"
    />

    <!-- ── Sheet de Creación ─────────────────────────────────────────────── -->
    <OrdenCreateSheet
      v-model="isCreateSheetOpen"
      @created="fetchOrdenes"
    />

  </section>
</template>
