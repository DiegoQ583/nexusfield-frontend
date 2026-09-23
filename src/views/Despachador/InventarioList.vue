<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNetwork, refDebounced } from '@vueuse/core'
import { useAppFeedback } from '@/composables/useAppFeedback'
import type { AxiosError } from 'axios'

import { RepuestosService } from '@/services/repuestos.service'
import type { RepuestoResponseDto } from '@/services/repuestos.service'
import RepuestoFormSheet from './components/RepuestoFormSheet.vue'

// shadcn-vue
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  Package,
  Pencil,
  Trash2,
  AlertTriangle,
  WifiOff,
  Loader2,
  Eye
} from 'lucide-vue-next'

const { isOnline } = useNetwork()
const feedback = useAppFeedback()

// ─── Estado Reactivo ──────────────────────────────────────────────────────────
const repuestos = ref<RepuestoResponseDto[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const isSheetOpen = ref(false)
const sheetMode = ref<'create' | 'edit' | 'view'>('create')
const selectedRepuesto = ref<RepuestoResponseDto | null>(null)
const isDeletingId = ref<number | null>(null)

// ─── Búsqueda (Debounce) ──────────────────────────────────────────────────────
const debouncedSearch = refDebounced(searchQuery, 300)

const repuestosFiltrados = computed(() => {
  if (!debouncedSearch.value.trim()) return repuestos.value
  
  const query = debouncedSearch.value.toLowerCase()
  return repuestos.value.filter(r => r.nombre.toLowerCase().includes(query))
})

// ─── Helpers de UI ────────────────────────────────────────────────────────────
function formatMoneda(valor: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(valor)
}

function obtenerUrlFoto(rutaRelativa: string | null): string | null {
  if (!rutaRelativa) return null
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || ''
  return `${baseUrl}${rutaRelativa}`
}

// ─── Data Fetching ────────────────────────────────────────────────────────────
async function fetchRepuestos(): Promise<void> {
  isLoading.value = true
  try {
    repuestos.value = await RepuestosService.obtenerTodos()
  } catch (error) {
    // Interceptor global manejará errores 500
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchRepuestos()
})

// ─── Acciones ─────────────────────────────────────────────────────────────────
function abrirCrear() {
  selectedRepuesto.value = null
  sheetMode.value = 'create'
  isSheetOpen.value = true
}

function abrirEditar(repuesto: RepuestoResponseDto) {
  selectedRepuesto.value = repuesto
  sheetMode.value = 'edit'
  isSheetOpen.value = true
}

function abrirVer(repuesto: RepuestoResponseDto) {
  selectedRepuesto.value = repuesto
  sheetMode.value = 'view'
  isSheetOpen.value = true
}

async function eliminarRepuesto(id: number): Promise<void> {
  if (!confirm('¿Estás seguro de que deseas eliminar este repuesto?')) return
  
  isDeletingId.value = id
  try {
    await RepuestosService.eliminar(id)
    feedback.showSuccess('Repuesto eliminado correctamente.')
    await fetchRepuestos()
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ detail?: string; title?: string }>
    if (axiosError.response?.status === 409) {
      const msg = axiosError.response.data?.detail || axiosError.response.data?.title || 'No se puede eliminar porque está reservado en órdenes activas.'
      feedback.showErrorModal(msg)
    } else {
      feedback.showErrorModal('Ocurrió un error al intentar eliminar el repuesto.')
    }
  } finally {
    isDeletingId.value = null
  }
}
</script>

<template>
  <section class="space-y-6">
    <!-- ── Cabecera y Filtros ─────────────────────────────────────────────── -->
    <div class="flex flex-col md:flex-row flex-wrap md:items-center justify-between gap-4 w-full">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          Catálogo de Repuestos
        </h1>
        <p class="mt-0.5 text-sm text-muted-foreground">
          Gestiona el inventario y disponibilidad.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
        <!-- Aviso offline -->
        <div
          v-if="!isOnline"
          class="flex items-center gap-1.5 text-xs text-destructive shrink-0"
        >
          <WifiOff class="w-3.5 h-3.5" />
          Sin conexión
        </div>

        <div class="relative flex-1 min-w-[200px]">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            v-model="searchQuery"
            type="search"
            placeholder="Buscar por nombre..."
            class="pl-9"
          />
        </div>

        <Button :disabled="!isOnline" class="shrink-0 gap-2" @click="abrirCrear">
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Nuevo Repuesto</span>
          <span class="sm:hidden">Nuevo</span>
        </Button>
      </div>
    </div>

    <!-- ── Tabla ──────────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <!-- Skeleton de carga -->
      <div v-if="isLoading" class="p-5 space-y-3">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <Skeleton class="h-10 w-10 shrink-0 rounded-md" />
          <Skeleton class="h-4 flex-1" />
          <Skeleton class="h-4 w-20 hidden md:block" />
          <Skeleton class="h-4 w-16 hidden lg:block" />
          <Skeleton class="h-4 w-16 hidden lg:block" />
          <Skeleton class="h-8 w-16 shrink-0" />
        </div>
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow class="border-border hover:bg-transparent">
            <TableHead class="w-16 pl-5">Foto</TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground">Nombre</TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground w-32">Precio</TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground w-28 text-center hidden sm:table-cell">Stock Total</TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground w-28 text-center hidden md:table-cell">Reservado</TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground w-32 text-center">Disponible</TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground w-28 pr-5 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <!-- Estado vacío -->
          <TableRow v-if="repuestosFiltrados.length === 0" class="border-border/50">
            <TableCell colspan="7" class="py-16">
              <div class="flex flex-col items-center gap-3 text-muted-foreground">
                <Package class="w-10 h-10 opacity-30" />
                <p class="text-sm font-medium">No se encontraron repuestos</p>
                <p class="text-xs opacity-70">
                  {{ searchQuery ? 'Intenta con un término diferente.' : 'Comienza agregando un nuevo repuesto al catálogo.' }}
                </p>
              </div>
            </TableCell>
          </TableRow>

          <!-- Filas de datos -->
          <TableRow
            v-for="repuesto in repuestosFiltrados"
            :key="repuesto.id"
            class="border-border/50 hover:bg-accent/40 transition-colors"
            :class="{ 'opacity-60': !repuesto.activo }"
          >
            <!-- Foto -->
            <TableCell class="pl-5 py-3">
              <Avatar class="w-10 h-10 rounded-md">
                <AvatarImage
                  v-if="obtenerUrlFoto(repuesto.fotoUrl)"
                  :src="obtenerUrlFoto(repuesto.fotoUrl)!"
                  class="object-cover"
                />
                <AvatarFallback class="rounded-md bg-muted">
                  <Package class="w-5 h-5 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </TableCell>

            <!-- Nombre -->
            <TableCell class="py-3 max-w-0">
              <p class="text-sm font-medium text-foreground truncate">
                {{ repuesto.nombre }}
              </p>
              <p v-if="!repuesto.activo" class="text-xs text-destructive mt-0.5 font-medium">
                Inactivo
              </p>
            </TableCell>

            <!-- Precio -->
            <TableCell class="py-3">
              <span class="text-sm text-muted-foreground">
                {{ formatMoneda(repuesto.precio) }}
              </span>
            </TableCell>

            <!-- Stock Total -->
            <TableCell class="py-3 text-center hidden sm:table-cell">
              <span class="text-sm text-muted-foreground">
                {{ repuesto.stockTotal }}
              </span>
            </TableCell>

            <!-- Reservado -->
            <TableCell class="py-3 text-center hidden md:table-cell">
              <span class="text-sm text-muted-foreground">
                {{ repuesto.stockReservado }}
              </span>
            </TableCell>

            <!-- Disponible (Wow feature) -->
            <TableCell class="py-3 text-center">
              <div
                v-if="repuesto.stockDisponible <= 5"
                class="inline-flex items-center gap-1.5 text-destructive font-bold text-sm"
              >
                <AlertTriangle class="w-4 h-4" />
                {{ repuesto.stockDisponible }}
              </div>
              <span v-else class="text-sm text-foreground">
                {{ repuesto.stockDisponible }}
              </span>
            </TableCell>

            <!-- Acciones -->
            <TableCell class="pr-5 py-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-foreground"
                  @click="abrirVer(repuesto)"
                  title="Ver detalles"
                >
                  <Eye class="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-foreground"
                  :disabled="!isOnline"
                  @click="abrirEditar(repuesto)"
                  title="Editar"
                >
                  <Pencil class="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-destructive"
                  :disabled="!isOnline || isDeletingId === repuesto.id"
                  @click="eliminarRepuesto(repuesto.id)"
                  title="Eliminar"
                >
                  <Loader2 v-if="isDeletingId === repuesto.id" class="w-4 h-4 animate-spin" />
                  <Trash2 v-else class="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <RepuestoFormSheet v-model="isSheetOpen" :repuesto="selectedRepuesto" :mode="sheetMode" @saved="fetchRepuestos" />
  </section>
</template>
