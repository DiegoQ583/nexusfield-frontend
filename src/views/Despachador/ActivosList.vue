<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { refDebounced, useNetwork } from '@vueuse/core'
import { useAppFeedback } from '@/composables/useAppFeedback'

import { ActivosService } from '@/services/activos.service'
import type { ActivoResponseDto } from '@/services/activos.service'

import ActivoFormSheet from './components/ActivoFormSheet.vue'

// shadcn-vue
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  Plus,
  Search,
  Eye,
  Pencil,
  Power,
  PowerOff,
  AlertTriangle,
  WifiOff,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'

// ─── Estado Global ────────────────────────────────────────────────────────────
const { isOnline } = useNetwork()
const feedback = useAppFeedback()

// ─── Estado de la Vista ───────────────────────────────────────────────────────
const page = ref(1)
const pageSize = ref(10)
const activos = ref<ActivoResponseDto[]>([])
const totalRecords = ref(0)
const totalPages = ref(0)
const isLoading = ref(true)

const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 300)

const isSheetOpen = ref(false)
const sheetMode = ref<'create' | 'edit' | 'view'>('create')
const selectedActivo = ref<ActivoResponseDto | null>(null)
const isTogglingId = ref<number | null>(null)

// ─── Data Fetching ────────────────────────────────────────────────────────────
async function fetchActivos() {
  isLoading.value = true
  try {
    const response = await ActivosService.obtenerPaginados(page.value, pageSize.value, debouncedSearch.value)
    activos.value = response.data
    totalRecords.value = response.totalRecords
    totalPages.value = response.totalPages
  } catch (error) {
    feedback.showErrorModal('Ocurrió un error al cargar el directorio de activos.')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchActivos()
})

watch(debouncedSearch, () => {
  page.value = 1
  fetchActivos()
})

watch(page, () => {
  fetchActivos()
})

// ─── Acciones ─────────────────────────────────────────────────────────────────
function abrirCrear() {
  selectedActivo.value = null
  sheetMode.value = 'create'
  isSheetOpen.value = true
}

function abrirEditar(activo: ActivoResponseDto) {
  selectedActivo.value = activo
  sheetMode.value = 'edit'
  isSheetOpen.value = true
}

function abrirVer(activo: ActivoResponseDto) {
  selectedActivo.value = activo
  sheetMode.value = 'view'
  isSheetOpen.value = true
}

async function toggleEstado(id: number) {
  if (!isOnline.value) {
    feedback.showErrorModal('Sin conexión. No puedes cambiar el estado ahora.')
    return
  }

  isTogglingId.value = id
  try {
    await ActivosService.cambiarEstado(id)
    feedback.showSuccess('Estado del activo actualizado correctamente.')
    await fetchActivos()
  } catch (error) {
    feedback.showErrorModal('No se pudo actualizar el estado del activo.')
  } finally {
    isTogglingId.value = null
  }
}

function nextPage() {
  if (page.value < totalPages.value) page.value++
}

function prevPage() {
  if (page.value > 1) page.value--
}
</script>

<template>
  <section class="flex flex-col h-full bg-background text-foreground space-y-6">
    <!-- ── Header y Filtros ─────────────────────────────────────────────── -->
    <div class="flex flex-col md:flex-row flex-wrap md:items-center justify-between gap-4 w-full">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Directorio de Activos</h1>
        <p class="text-sm text-muted-foreground mt-1">Administra el parque de equipos e instalaciones.</p>
      </div>

      <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
        <div class="relative flex-1 min-w-[200px]">
          <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Buscar por nombre o ubicación..."
            class="pl-9 bg-card"
          />
        </div>
        <Button
          class="shrink-0 gap-2"
          :disabled="!isOnline"
          @click="abrirCrear"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Nuevo Activo</span>
          <span class="sm:hidden">Nuevo</span>
        </Button>
      </div>
    </div>

    <!-- ── Offline Banner ───────────────────────────────────────────────── -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="!isOnline"
        class="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-600 dark:text-amber-400"
      >
        <WifiOff class="w-5 h-5 shrink-0" />
        <p class="text-sm font-medium">
          Estás sin conexión. Solo puedes buscar o visualizar activos almacenados en caché.
        </p>
      </div>
    </Transition>

    <!-- ── DataGrid ─────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-border bg-card overflow-hidden shadow-sm flex-1 flex flex-col">
      <div class="flex-1 overflow-auto">
        <Table>
          <TableHeader class="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
            <TableRow>
              <TableHead class="w-20">ID</TableHead>
              <TableHead class="w-1/3 min-w-[200px]">Activo</TableHead>
              <TableHead class="w-1/4">Ubicación</TableHead>
              <TableHead class="w-1/4">Cliente Actual</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead class="text-right w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="isLoading">
              <TableRow v-for="i in 5" :key="i">
                <TableCell><Skeleton class="h-5 w-12" /></TableCell>
                <TableCell>
                  <div class="space-y-1.5">
                    <Skeleton class="h-5 w-32" />
                    <Skeleton class="h-3 w-48" />
                  </div>
                </TableCell>
                <TableCell><Skeleton class="h-5 w-24" /></TableCell>
                <TableCell><Skeleton class="h-5 w-28" /></TableCell>
                <TableCell><Skeleton class="h-6 w-24 rounded-full" /></TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Skeleton class="h-8 w-8 rounded-md" />
                    <Skeleton class="h-8 w-8 rounded-md" />
                    <Skeleton class="h-8 w-8 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            </template>
            <template v-else-if="activos.length === 0">
              <TableRow>
                <TableCell colspan="6" class="h-48 text-center">
                  <div class="flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <AlertTriangle class="w-8 h-8 opacity-40" />
                    <p class="text-sm">No se encontraron activos.</p>
                  </div>
                </TableCell>
              </TableRow>
            </template>
            <template v-else>
              <TableRow v-for="activo in activos" :key="activo.id" class="group hover:bg-muted/30 transition-colors">
                <TableCell class="font-medium text-muted-foreground">#{{ activo.id }}</TableCell>
                <TableCell class="max-w-0 w-1/3">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-semibold text-foreground truncate" :class="{'opacity-50 line-through': !activo.activo}" :title="activo.nombre">
                        {{ activo.nombre }}
                      </span>
                      <Badge v-if="!activo.activo" variant="outline" class="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted h-5 px-1.5 border-transparent shrink-0">
                        Inactivo
                      </Badge>
                    </div>
                    <span class="text-xs text-muted-foreground truncate" :title="activo.descripcion || ''">
                      {{ activo.descripcion || 'Sin descripción' }}
                    </span>
                  </div>
                </TableCell>
                <TableCell class="max-w-0 truncate text-foreground text-sm" :title="activo.ubicacion || ''">
                  {{ activo.ubicacion || 'N/A' }}
                </TableCell>
                <TableCell class="max-w-0 truncate text-foreground text-sm" :title="activo.clienteActual || ''">
                  {{ activo.clienteActual || 'N/A' }}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    class="font-medium border-transparent"
                    :class="
                      activo.estado === 'Operativo' 
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                    "
                  >
                    {{ activo.estado }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-muted-foreground hover:text-foreground"
                      @click="abrirVer(activo)"
                      title="Ver detalles"
                    >
                      <Eye class="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-muted-foreground hover:text-foreground"
                      :disabled="!isOnline"
                      @click="abrirEditar(activo)"
                      title="Editar"
                    >
                      <Pencil class="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 transition-colors"
                      :class="activo.activo ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10'"
                      :disabled="!isOnline || isTogglingId === activo.id"
                      @click="toggleEstado(activo.id)"
                      :title="activo.activo ? 'Desactivar activo' : 'Reactivar activo'"
                    >
                      <Loader2 v-if="isTogglingId === activo.id" class="w-4 h-4 animate-spin" />
                      <template v-else>
                        <Power v-if="activo.activo" class="w-4 h-4" />
                        <PowerOff v-else class="w-4 h-4" />
                      </template>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </div>

      <!-- Footer Paginación -->
      <div class="border-t border-border bg-muted/20 px-4 py-3 flex items-center justify-between sm:px-6 shrink-0">
        <p class="text-sm text-muted-foreground">
          Página <span class="font-medium text-foreground">{{ page }}</span> de <span class="font-medium text-foreground">{{ totalPages || 1 }}</span>
          — <span class="font-medium text-foreground">{{ totalRecords }}</span> registros
        </p>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="page === 1 || isLoading"
            @click="prevPage"
            class="h-8 w-8 p-0"
          >
            <span class="sr-only">Anterior</span>
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="page >= totalPages || isLoading"
            @click="nextPage"
            class="h-8 w-8 p-0"
          >
            <span class="sr-only">Siguiente</span>
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <ActivoFormSheet v-model="isSheetOpen" :activo="selectedActivo" :mode="sheetMode" @saved="fetchActivos" />
  </section>
</template>
