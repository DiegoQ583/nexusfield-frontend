<script setup lang="ts">

import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNetwork, refDebounced } from '@vueuse/core'
import { useAppFeedback } from '@/composables/useAppFeedback'
import type { AxiosError } from 'axios'
import { UsuariosService } from '@/services/usuarios.service'
import type { UsuarioResponseDto } from '@/services/usuarios.service'
import UsuarioFormSheet from './components/UsuarioFormSheet.vue'

// shadcn-vue
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'


// Lucide icons
import {
  Search,
  UserPlus,
  Pencil,
  PowerOff,
  Power,
  WifiOff,
  Eye,
} from 'lucide-vue-next'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface ApiProblemDetails {
  title?: string
  detail?: string
}

// ─── Composables ──────────────────────────────────────────────────────────────

const { isOnline } = useNetwork()
const feedback = useAppFeedback()

// ─── Estado ───────────────────────────────────────────────────────────────────

const usuarios = ref<UsuarioResponseDto[]>([])
const isLoading = ref(true)
const isTogglingId = ref<number | null>(null)

// Filtros
const filtroRol = ref<'todos' | 'Despachador' | 'Tecnico'>('todos')
const searchQuery = ref('')

// Debounce de 300ms para la búsqueda: evita filtrar en cada pulsación
const debouncedSearch = refDebounced(searchQuery, 300)

// Sheet
const isSheetOpen = ref(false)
const selectedUsuario = ref<UsuarioResponseDto | null>(null)
const sheetMode = ref<'create' | 'edit' | 'view'>('create')

// Nueva función para manejar el guardado del Sheet
async function handleUsuarioGuardado() {
  await fetchUsuarios()
  feedback.showSuccess(
    sheetMode.value === 'create' 
      ? 'Usuario creado exitosamente.' 
      : 'Usuario actualizado exitosamente.'
  )
}

// ─── Computed ─────────────────────────────────────────────────────────────────

/**
 * Filtra la lista local usando el valor debounced de la búsqueda.
 * El filtro por rol se delega al servidor en `fetchUsuarios`.
 */
const usuariosFiltrados = computed(() => {
  const q = debouncedSearch.value.trim().toLowerCase()
  if (!q) return usuarios.value
  return usuarios.value.filter(
    (u) =>
      u.nombreCompleto.toLowerCase().includes(q) ||
      u.correo.toLowerCase().includes(q) ||
      u.nombreUsuario.toLowerCase().includes(q)
  )
})

// ─── Helpers de UI ────────────────────────────────────────────────────────────

interface BadgeStyle { class: string; label: string }

function getRolBadge(rol: string): BadgeStyle {
  switch (rol) {
    case 'Despachador':
      return {
        class: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-transparent',
        label: 'Despachador',
      }
    case 'Tecnico':
      return {
        class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent',
        label: 'Técnico',
      }
    default:
      return {
        class: 'bg-muted text-muted-foreground border-transparent',
        label: rol,
      }
  }
}

function getEstadoBadge(activo: boolean): BadgeStyle {
  return activo
    ? {
        class: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
        label: 'Activo',
      }
    : {
        class: 'bg-muted text-muted-foreground border-transparent',
        label: 'Inactivo',
      }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchUsuarios(): Promise<void> {
  isLoading.value = true
  searchQuery.value = ''
  try {
    const rol = filtroRol.value === 'todos' ? undefined : filtroRol.value
    const result = await UsuariosService.obtenerTodos(rol)
    usuarios.value = result.data
  } catch {
    // El interceptor global muestra el toast de error
  } finally {
    isLoading.value = false
  }
}

// ─── Toggle de estado ────────────────────────────────────────────────────────

async function toggleEstado(id: number): Promise<void> {
  isTogglingId.value = id
  try {
    await UsuariosService.cambiarEstado(id)
    // Actualización local optimista
    const usuario = usuarios.value.find((u) => u.id === id)
    if (usuario) {
      usuario.activo = !usuario.activo
      feedback.showSuccess('Estado del usuario actualizado.')
      // Solo log en consola (F12), NADA de Toasts
      console.log(`[Auditoría] Estado del usuario ${usuario.nombreUsuario} cambiado a: ${usuario.activo ? 'Activo' : 'Inactivo'}`)
    }
  } catch (err: unknown) {
    const axiosError = err as AxiosError<ApiProblemDetails>
    if (axiosError.response?.status === 400) {
      const data = axiosError.response.data
      feedback.showErrorModal(data?.title ?? data?.detail ?? 'No se puede cambiar el estado de este usuario.')
    }
  } finally {
    isTogglingId.value = null
  }
}

// ─── Acciones del Sheet ───────────────────────────────────────────────────────

function abrirCrear(): void {
  selectedUsuario.value = null
  sheetMode.value = 'create'
  isSheetOpen.value = true
}

function abrirEditar(usuario: UsuarioResponseDto): void {
  selectedUsuario.value = usuario
  sheetMode.value = 'edit'
  isSheetOpen.value = true
}

function abrirVer(usuario: UsuarioResponseDto): void {
  selectedUsuario.value = usuario
  sheetMode.value = 'view'
  isSheetOpen.value = true
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(filtroRol, () => fetchUsuarios())

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const route = useRoute()

onMounted(() => {
  if (route.query.rol) {
    const rolUrl = route.query.rol as string
    if (['todos', 'Despachador', 'Tecnico'].includes(rolUrl)) {
      filtroRol.value = rolUrl as 'todos' | 'Despachador' | 'Tecnico'
    }
  }
  fetchUsuarios()
})
</script>

<template>
  <section id="usuarios-view" class="space-y-6">

    <!-- ── Cabecera ───────────────────────────────────────────────────────── -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          Directorio de Personal
        </h1>
        <p class="mt-0.5 text-sm text-muted-foreground">
          Gestiona los usuarios, roles y estados del equipo.
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

        <Button
          :disabled="!isOnline"
          class="gap-2"
          @click="abrirCrear"
        >
          <UserPlus class="w-4 h-4" />
          Nuevo Usuario
        </Button>
      </div>
    </div>

    <!-- ── Filtros ────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center gap-4 w-full">

      <!-- Tabs de filtro por rol (delega al servidor) -->
      <Tabs v-model="filtroRol" class="shrink-0">
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="Despachador">Despachadores</TabsTrigger>
          <TabsTrigger value="Tecnico">Técnicos</TabsTrigger>
        </TabsList>
      </Tabs>

      <!-- Búsqueda con debounce -->
      <div class="relative flex-1 min-w-[200px]">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          id="search-usuarios"
          v-model="searchQuery"
          type="search"
          placeholder="Buscar por nombre o correo..."
          class="pl-9"
        />
      </div>
    </div>

    <!-- ── Tabla ──────────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

      <!-- Skeleton de carga -->
      <div v-if="isLoading" class="p-6 space-y-3">
        <div v-for="i in 6" :key="i" class="flex items-center gap-4">
          <Skeleton class="h-9 w-9 rounded-full shrink-0" />
          <Skeleton class="h-5 flex-1" />
          <Skeleton class="h-4 w-24" />
          <Skeleton class="h-5 w-20 rounded-full" />
          <Skeleton class="h-5 w-16 rounded-full" />
          <Skeleton class="h-8 w-24 rounded-md" />
        </div>
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow class="border-border hover:bg-transparent">
            <TableHead class="pl-5 text-sm font-medium text-muted-foreground">
              Nombre
            </TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground hidden md:table-cell">
              Usuario
            </TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground">
              Rol
            </TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground hidden lg:table-cell">
              Teléfono
            </TableHead>
            <TableHead class="text-sm font-medium text-muted-foreground w-24">
              Estado
            </TableHead>
            <TableHead class="pr-5 text-sm font-medium text-muted-foreground text-right">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>

          <!-- Estado vacío -->
          <TableRow v-if="usuariosFiltrados.length === 0" class="border-border/50">
            <TableCell
              colspan="6"
              class="py-12 text-center text-sm text-muted-foreground"
            >
              {{ debouncedSearch ? 'No se encontraron resultados para tu búsqueda.' : 'No hay usuarios en este grupo.' }}
            </TableCell>
          </TableRow>

          <!-- Filas de datos -->
          <TableRow
            v-for="usuario in usuariosFiltrados"
            :key="usuario.id"
            class="border-border/50 hover:bg-accent/40 transition-colors"
          >
            <!-- Nombre + correo -->
            <TableCell class="pl-5 py-3.5 max-w-0">
              <p class="text-base font-semibold text-foreground truncate">
                {{ usuario.nombreCompleto }}
              </p>
              <p class="text-sm text-muted-foreground truncate mt-0.5">
                {{ usuario.correo }}
              </p>
            </TableCell>

            <!-- Nombre de usuario -->
            <TableCell class="py-3.5 hidden md:table-cell">
              <span class="text-sm font-mono text-muted-foreground">
                {{ usuario.nombreUsuario }}
              </span>
            </TableCell>

            <!-- Rol badge -->
            <TableCell class="py-3.5">
              <Badge
                variant="outline"
                :class="getRolBadge(usuario.rol).class"
                class="text-xs font-medium px-2 py-0.5"
              >
                {{ getRolBadge(usuario.rol).label }}
              </Badge>
            </TableCell>

            <!-- Teléfono -->
            <TableCell class="py-3.5 hidden lg:table-cell">
              <span class="text-sm text-muted-foreground">
                {{ usuario.telefono ?? '—' }}
              </span>
            </TableCell>

            <!-- Estado badge -->
            <TableCell class="py-3.5">
              <Badge
                variant="outline"
                :class="getEstadoBadge(usuario.activo).class"
                class="text-xs font-medium px-2 py-0.5"
              >
                {{ getEstadoBadge(usuario.activo).label }}
              </Badge>
            </TableCell>

            <!-- Acciones -->
            <TableCell class="pr-5 py-3.5 text-right">
              <div class="flex items-center justify-end gap-1">

                <!-- Ver detalles -->
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Ver detalles"
                  @click="abrirVer(usuario)"
                >
                  <Eye class="w-3.5 h-3.5" />
                </Button>

                <!-- Editar -->
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 text-muted-foreground hover:text-foreground"
                  :disabled="!isOnline"
                  :title="isOnline ? 'Editar usuario' : 'Sin conexión'"
                  @click="abrirEditar(usuario)"
                >
                  <Pencil class="w-3.5 h-3.5" />
                </Button>

                <!-- Activar / Desactivar -->
                <Button
                  variant="ghost"
                  size="icon"
                  :class="[
                    'h-7 w-7 transition-colors',
                    usuario.activo
                      ? 'text-muted-foreground hover:text-destructive'
                      : 'text-muted-foreground hover:text-emerald-600',
                  ]"
                  :disabled="!isOnline || isTogglingId === usuario.id"
                  :title="usuario.activo ? 'Desactivar usuario' : 'Activar usuario'"
                  @click="toggleEstado(usuario.id)"
                >
                  <Power v-if="usuario.activo" class="w-3.5 h-3.5" />
                  <PowerOff v-else class="w-3.5 h-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>

        </TableBody>
      </Table>

      <!-- Pie de la tabla: contador de resultados -->
      <div
        v-if="!isLoading && usuariosFiltrados.length > 0"
        class="px-5 py-3 border-t border-border/50 flex items-center justify-between"
      >
        <p class="text-xs text-muted-foreground">
          {{ usuariosFiltrados.length }}
          {{ usuariosFiltrados.length !== 1 ? 'usuarios encontrados' : 'usuario encontrado' }}
        </p>
      </div>
    </div>

    <!-- ── Sheet de creación / edición / vista ────────────────────────────── -->
    <UsuarioFormSheet
      v-model="isSheetOpen"
      :usuario="selectedUsuario"
      :mode="sheetMode"
      @saved="handleUsuarioGuardado"
    />
  </section>
</template>
