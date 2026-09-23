<script setup lang="ts">
/**
 * OrdenCreateSheet.vue — Panel lateral para crear una nueva Orden de Trabajo.
 *
 * Flujo de datos al abrir:
 * 1. Precarga técnicos (GET /usuarios?rol=Tecnico) y repuestos (GET /repuestos).
 * 2. El Combobox de Activos dispara búsquedas debounced cuando el usuario escribe.
 * 3. Al submit: valida en cliente → llama OrdenesService.crear() → emite 'created'.
 */

import { ref, reactive, watch, computed } from 'vue'
import { useNetwork, refDebounced } from '@vueuse/core'
import type { AxiosError } from 'axios'
import { useAppFeedback } from '@/composables/useAppFeedback'

import { OrdenesService } from '@/services/ordenes.service'
import type { CrearOrdenDto, OrdenPrioridad } from '@/services/ordenes.service'
import { ActivosService } from '@/services/activos.service'
import type { ActivoLigeroDto } from '@/services/activos.service'
import { RepuestosService } from '@/services/repuestos.service'
import type { RepuestoDto } from '@/services/repuestos.service'
import { UsuariosService } from '@/services/usuarios.service'
import type { UsuarioResponseDto } from '@/services/usuarios.service'

// shadcn-vue
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
// Lucide icons
import { Loader2, ChevronsUpDown, Check, Package, AlertCircle } from 'lucide-vue-next'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface ValidationProblemDetails {
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string[]>
  extensions?: { errors?: Record<string, string[]> }
}

// ─── Props & Emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'created'): void
}>()

// ─── Composables ──────────────────────────────────────────────────────────────

const { isOnline } = useNetwork()

// ─── Estado del Formulario ────────────────────────────────────────────────────

interface FormState {
  titulo: string
  descripcion: string
  activoId: number | null
  tecnicoId: number | null
  prioridad: OrdenPrioridad | ''
  repuestos: { repuestoId: number; cantidad: number }[]
}

const formDefaults: FormState = {
  titulo: '',
  descripcion: '',
  activoId: null,
  tecnicoId: null,
  prioridad: '',
  repuestos: [],
}

const form = reactive<FormState>({ ...formDefaults })
const fieldErrors = ref<Record<string, string>>({})
const generalError = ref<string | null>(null)
const isLoading = ref(false)
const feedback = useAppFeedback()

// ─── Estado de Datos Auxiliares ───────────────────────────────────────────────

const tecnicos = ref<UsuarioResponseDto[]>([])
const repuestos = ref<RepuestoDto[]>([])
const activosResultados = ref<ActivoLigeroDto[]>([])
const activoSeleccionado = ref<ActivoLigeroDto | null>(null)
const isLoadingAuxiliar = ref(false)

// ─── Combobox de Activos (Popover + Command) ──────────────────────────────────

const comboboxOpen = ref(false)
const searchActivo = ref('')
const debouncedSearchActivo = refDebounced(searchActivo, 300)
const isSearchingActivo = ref(false)

watch(debouncedSearchActivo, async (q) => {
  if (q.trim().length < 2) {
    activosResultados.value = []
    return
  }
  isSearchingActivo.value = true
  try {
    activosResultados.value = await ActivosService.buscar(q)
  } catch {
    activosResultados.value = []
  } finally {
    isSearchingActivo.value = false
  }
})

function seleccionarActivo(activo: ActivoLigeroDto): void {
  activoSeleccionado.value = activo
  form.activoId = activo.id
  comboboxOpen.value = false
  searchActivo.value = ''
  activosResultados.value = []
}

// ─── Computed ─────────────────────────────────────────────────────────────────

const comboboxButtonLabel = computed(() =>
  activoSeleccionado.value ? activoSeleccionado.value.nombre : 'Buscar activo / máquina...'
)

// ─── Carga de Datos Auxiliares ────────────────────────────────────────────────

async function cargarDatosAuxiliares(): Promise<void> {
  isLoadingAuxiliar.value = true
  try {
    const [tecnicosRes, repuestosRes] = await Promise.all([
      UsuariosService.obtenerTodos('Tecnico'),
      RepuestosService.obtenerTodos(),
    ])
    tecnicos.value = tecnicosRes.data
    repuestos.value = repuestosRes
  } catch {
    // Los errores de red son manejados por el interceptor global
  } finally {
    isLoadingAuxiliar.value = false
  }
}

// ─── Reset del formulario ─────────────────────────────────────────────────────

function resetForm(): void {
  form.titulo = ''
  form.descripcion = ''
  form.activoId = null
  form.tecnicoId = null
  form.prioridad = ''
  form.repuestos = []
  activoSeleccionado.value = null
  searchActivo.value = ''
  activosResultados.value = []
  fieldErrors.value = {}
  generalError.value = null
}

// ─── Watcher: carga datos al abrir el Sheet ───────────────────────────────────

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return
    resetForm()
    cargarDatosAuxiliares()
  }
)

// ─── Manejo de Multi-Select de Repuestos ──────────────────────────────────────

function isRepuestoSelected(id: number): boolean {
  return form.repuestos.some((r) => r.repuestoId === id)
}

function toggleRepuesto(repuesto: RepuestoDto, checked: boolean | 'indeterminate'): void {
  if (checked === true) {
    const exists = form.repuestos.find(r => r.repuestoId === repuesto.id)
    if (!exists) {
      form.repuestos.push({ repuestoId: repuesto.id, cantidad: 1 })
    }
  } else {
    const index = form.repuestos.findIndex(r => r.repuestoId === repuesto.id)
    if (index !== -1) {
      form.repuestos.splice(index, 1)
    }
  }
}

// ─── Validación Frontend ──────────────────────────────────────────────────────

function validateForm(): boolean {
  fieldErrors.value = {}
  let isValid = true

  if (!form.titulo.trim()) {
    fieldErrors.value.titulo = 'El título de la orden es obligatorio.'
    isValid = false
  }
  if (!form.activoId) {
    fieldErrors.value.activoId = 'Debes seleccionar un activo o máquina.'
    isValid = false
  }
  if (!form.tecnicoId) {
    fieldErrors.value.tecnicoId = 'Debes asignar un técnico.'
    isValid = false
  }
  if (!form.prioridad) {
    fieldErrors.value.prioridad = 'La prioridad es obligatoria.'
    isValid = false
  }

  return isValid
}

// ─── Mapeo de Errores del Backend ────────────────────────────────────────────

function mapValidationErrors(data: ValidationProblemDetails): boolean {
  const source = data?.errors ?? data?.extensions?.errors ?? {}
  const keys = Object.keys(source)
  if (keys.length === 0) return false

  const mapped: Record<string, string> = {}
  for (const key of keys) {
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1)
    mapped[camelKey] = source[key][0] ?? 'Campo inválido.'
  }
  fieldErrors.value = mapped
  return true
}

// ─── Submit ───────────────────────────────────────────────────────────────────

async function handleSubmit(): Promise<void> {
  fieldErrors.value = {}
  generalError.value = null
  isLoading.value = true

  if (!validateForm()) {
    isLoading.value = false
    return
  }

  try {
    const payload: CrearOrdenDto = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      activoId: form.activoId!,
      tecnicoId: form.tecnicoId!,
      prioridad: form.prioridad as OrdenPrioridad,
      repuestos: [...form.repuestos],
    }

    await OrdenesService.crear(payload)
    feedback.showSuccess('Orden de trabajo asignada correctamente.')
    emit('created')
    emit('update:modelValue', false)

  } catch (err: unknown) {
    const axiosError = err as AxiosError<ValidationProblemDetails>
    const status = axiosError.response?.status
    const data = axiosError.response?.data

    if ((status === 400 || status === 409) && data) {
      const foundFieldErrors = mapValidationErrors(data)
      if (!foundFieldErrors) {
        generalError.value = data.detail ?? data.title ?? 'Ocurrió un error de validación.'
      }
    } else if (status === 404) {
      feedback.showErrorModal('El activo seleccionado ya no existe. Por favor, selecciona otro.')
    }
    // 500 lo maneja el interceptor global
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Sheet
    :open="modelValue"
    @update:open="(val) => emit('update:modelValue', val)"
  >
    <SheetContent
      side="right"
      class="w-full sm:max-w-lg flex flex-col gap-0 p-0 [&>button]:hidden"
    >
      <!-- Cabecera -->
      <SheetHeader class="px-6 py-5 border-b border-border shrink-0">
        <SheetTitle class="text-base font-semibold text-foreground">
          Nueva Orden de Trabajo
        </SheetTitle>
        <SheetDescription class="text-sm text-muted-foreground">
          Completa los datos para crear y asignar la orden al técnico.
        </SheetDescription>
      </SheetHeader>

      <!-- Alerta de error general -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="generalError"
          class="mx-6 mt-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3"
        >
          <AlertCircle class="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p class="text-sm text-destructive">{{ generalError }}</p>
        </div>
      </Transition>

      <!-- Formulario con scroll -->
      <form
        id="form-nueva-orden"
        novalidate
        class="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        @submit.prevent="handleSubmit"
      >
        <!-- Título -->
        <div class="space-y-1.5">
          <Label for="cn-titulo" class="text-sm font-medium text-foreground">
            Título
          </Label>
          <Input
            id="cn-titulo"
            v-model="form.titulo"
            placeholder="Ej: Mantenimiento preventivo compresor"
            :disabled="isLoading"
            :class="fieldErrors.titulo ? 'border-destructive focus-visible:ring-destructive' : ''"
          />
          <p v-if="fieldErrors.titulo" class="text-xs text-destructive">
            {{ fieldErrors.titulo }}
          </p>
        </div>

        <!-- Activo (Combobox) -->
        <div class="space-y-1.5">
          <Label class="text-sm font-medium text-foreground">
            Activo / Máquina
          </Label>
          <Popover v-model:open="comboboxOpen">
            <PopoverTrigger as-child>
              <Button
                id="cn-activo-trigger"
                variant="outline"
                role="combobox"
                :aria-expanded="comboboxOpen"
                :disabled="isLoading"
                :class="[
                  'w-full justify-between font-normal',
                  fieldErrors.activoId ? 'border-destructive focus-visible:ring-destructive' : '',
                  !activoSeleccionado ? 'text-muted-foreground' : 'text-foreground',
                ]"
              >
                {{ comboboxButtonLabel }}
                <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[--radix-popover-trigger-width] p-0" align="start">
              <div class="p-2 border-b border-border">
                <Input
                  v-model="searchActivo"
                  placeholder="Escribe al menos 2 caracteres..."
                  class="h-9 text-sm"
                  autofocus
                />
              </div>

              <div class="max-h-56 overflow-y-auto p-1 space-y-0.5">
                <div v-if="isSearchingActivo" class="py-6 text-center">
                  <Loader2 class="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                </div>
                <template v-else>
                  <div v-if="searchActivo.length < 2" class="p-3 text-xs text-center text-muted-foreground">
                    Escribe al menos 2 caracteres para buscar...
                  </div>
                  <div v-else-if="activosResultados.length === 0" class="p-3 text-xs text-center text-muted-foreground">
                    No se encontraron activos.
                  </div>
                  <button
                    v-for="activo in activosResultados"
                    :key="activo.id"
                    type="button"
                    class="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
                    @click="seleccionarActivo(activo)"
                  >
                    <span>{{ activo.nombre }}</span>
                    <Check v-if="form.activoId === activo.id" class="w-4 h-4 text-primary" />
                  </button>
                </template>
              </div>
            </PopoverContent>
          </Popover>
          <p v-if="fieldErrors.activoId" class="text-xs text-destructive">
            {{ fieldErrors.activoId }}
          </p>
        </div>

        <!-- Descripción -->
        <div class="space-y-1.5">
          <Label for="cn-descripcion" class="text-sm font-medium text-foreground">
            Descripción
          </Label>
          <Textarea
            id="cn-descripcion"
            v-model="form.descripcion"
            placeholder="Detalla el trabajo a realizar, síntomas del problema, etc."
            :rows="3"
            :disabled="isLoading"
            class="resize-none"
          />
        </div>

        <!-- Técnico -->
        <div class="space-y-1.5">
          <Label for="cn-tecnico" class="text-sm font-medium text-foreground">
            Técnico Asignado
          </Label>
          <Select v-model="form.tecnicoId" :disabled="isLoading || isLoadingAuxiliar">
            <SelectTrigger
              id="cn-tecnico"
              :class="fieldErrors.tecnicoId ? 'border-destructive focus-visible:ring-destructive' : ''"
            >
              <SelectValue
                :placeholder="isLoadingAuxiliar ? 'Cargando técnicos...' : 'Selecciona un técnico...'"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="tecnico in tecnicos"
                :key="tecnico.id"
                :value="tecnico.id"
              >
                {{ tecnico.nombreCompleto }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="fieldErrors.tecnicoId" class="text-xs text-destructive">
            {{ fieldErrors.tecnicoId }}
          </p>
        </div>

        <!-- Prioridad -->
        <div class="space-y-1.5">
          <Label for="cn-prioridad" class="text-sm font-medium text-foreground">
            Prioridad
          </Label>
          <Select v-model="form.prioridad" :disabled="isLoading">
            <SelectTrigger
              id="cn-prioridad"
              :class="fieldErrors.prioridad ? 'border-destructive focus-visible:ring-destructive' : ''"
            >
              <SelectValue placeholder="Selecciona la prioridad..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Baja">Baja</SelectItem>
              <SelectItem value="Media">Media</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="fieldErrors.prioridad" class="text-xs text-destructive">
            {{ fieldErrors.prioridad }}
          </p>
        </div>

        <!-- Repuestos Pre-Asignados (Multi-Select con Checkbox) -->
        <div class="space-y-1.5">
          <Label class="text-sm font-medium text-foreground">
            Repuestos Pre-Asignados
            <span class="ml-1.5 text-xs font-normal text-muted-foreground">(opcional)</span>
          </Label>

          <!-- Skeleton mientras cargan los repuestos -->
          <div
            v-if="isLoadingAuxiliar"
            class="border border-border rounded-md p-3 space-y-2"
          >
            <div v-for="i in 4" :key="i" class="flex items-center gap-3">
              <div class="h-4 w-4 bg-muted rounded shrink-0" />
              <div class="h-3.5 bg-muted rounded flex-1" />
              <div class="h-5 w-10 bg-muted rounded-full" />
            </div>
          </div>

          <div
            v-else-if="repuestos.length > 0"
            class="space-y-2 max-h-48 overflow-y-auto pr-1"
          >
            <div
              v-for="repuesto in repuestos"
              :key="repuesto.id"
              class="p-2.5 rounded-lg border border-border bg-card space-y-2"
            >
              <!-- Cabecera del repuesto -->
              <div class="flex items-center justify-between gap-2">
                <div 
                  class="flex items-center gap-2 cursor-pointer"
                  @click="repuesto.stockDisponible > 0 && !isLoading ? toggleRepuesto(repuesto, !isRepuestoSelected(repuesto.id)) : null"
                >
                  <Checkbox
                    :id="'repuesto-' + repuesto.id"
                    :model-value="isRepuestoSelected(repuesto.id)"
                    :checked="isRepuestoSelected(repuesto.id)"
                    :disabled="repuesto.stockDisponible <= 0 || isLoading"
                    class="pointer-events-none"
                  />
                  <span class="text-sm font-medium pointer-events-none">
                    {{ repuesto.nombre }}
                  </span>
                </div>
                <Badge :variant="repuesto.stockDisponible > 0 ? 'outline' : 'destructive'" class="text-[10px]">
                  Stock: {{ repuesto.stockDisponible }}
                </Badge>
              </div>

              <!-- Fila de cantidad a reservar (solo si está marcado) -->
              <div
                v-if="isRepuestoSelected(repuesto.id)"
                class="flex items-center justify-between pt-2 border-t border-border/50 text-xs"
              >
                <span class="text-muted-foreground font-medium">Cantidad a reservar:</span>
                <div class="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="1"
                    :max="repuesto.stockDisponible"
                    v-model.number="form.repuestos.find(r => r.repuestoId === repuesto.id)!.cantidad"
                    :disabled="isLoading"
                    class="w-20 h-8 text-sm text-center"
                    @blur="() => {
                      const item = form.repuestos.find(r => r.repuestoId === repuesto.id);
                      if (item && item.cantidad > repuesto.stockDisponible) item.cantidad = repuesto.stockDisponible;
                      if (item && (!item.cantidad || item.cantidad < 1)) item.cantidad = 1;
                    }"
                  />
                  <span class="text-[11px] text-muted-foreground">máx {{ repuesto.stockDisponible }}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            v-else
            class="border border-border rounded-md p-4 text-center"
          >
            <Package class="w-5 h-5 mx-auto text-muted-foreground opacity-40 mb-1.5" />
            <p class="text-xs text-muted-foreground">No hay repuestos en el catálogo.</p>
          </div>
        </div>

      </form>

      <!-- Footer de botones -->
      <div class="px-6 py-4 border-t border-border shrink-0 flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          :disabled="isLoading"
          @click="emit('update:modelValue', false)"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          form="form-nueva-orden"
          :disabled="isLoading || !isOnline"
          class="min-w-36 gap-2"
        >
          <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
          {{ isLoading ? 'Creando...' : 'Asignar Trabajo' }}
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
