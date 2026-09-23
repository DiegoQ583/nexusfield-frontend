<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useAppFeedback } from '@/composables/useAppFeedback'
import type { AxiosError } from 'axios'
import { formatTelefonoVE } from '@/lib/utils'
import { ActivosService } from '@/services/activos.service'
import type { ActivoResponseDto, GuardarActivoDto, HistorialActivoDto } from '@/services/activos.service'

// shadcn-vue
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Lucide icons
import { Loader2, AlertCircle, Info, Wrench } from 'lucide-vue-next'

// ─── Props & Emits ────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  modelValue: boolean
  activo: ActivoResponseDto | null
  mode?: 'create' | 'edit' | 'view'
}>(), {
  mode: 'create'
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'saved'): void
}>()

// ─── Estado del Formulario ────────────────────────────────────────────────────
interface FormState {
  nombre: string
  descripcion: string
  ubicacion: string
  clienteActual: string
  estado: string
  linkGoogleMaps: string
  telefonoContacto: string
}

const form = reactive<FormState>({
  nombre: '',
  descripcion: '',
  ubicacion: '',
  clienteActual: '',
  estado: 'Operativo',
  linkGoogleMaps: '',
  telefonoContacto: '',
})

const isLoading = ref(false)
const isLoadingHistorial = ref(false)
const historial = ref<HistorialActivoDto[]>([])
const fieldErrors = ref<Record<string, string>>({})
const generalError = ref<string | null>(null)
const feedback = useAppFeedback()

// ─── Computed ─────────────────────────────────────────────────────────────────
const isViewing = computed(() => props.mode === 'view')
const isEditing = computed(() => props.mode === 'edit')

const sheetTitle = computed(() => {
  if (isViewing.value) return 'Detalles del Activo'
  return isEditing.value ? 'Editar Activo' : 'Nuevo Activo'
})

const sheetDescription = computed(() => {
  if (isViewing.value) return 'Información completa del activo.'
  return isEditing.value 
    ? 'Modifica los detalles y el estado del activo.'
    : 'Agrega un nuevo activo al directorio.'
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resetForm(): void {
  form.nombre = ''
  form.descripcion = ''
  form.ubicacion = ''
  form.clienteActual = ''
  form.estado = 'Operativo'
  form.linkGoogleMaps = ''
  form.telefonoContacto = ''
  
  historial.value = []
  isLoadingHistorial.value = false
  fieldErrors.value = {}
  generalError.value = null
}

// ─── Ciclo de Vida ────────────────────────────────────────────────────────────
watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return
    resetForm()
    if (props.activo) {
      form.nombre = props.activo.nombre
      form.descripcion = props.activo.descripcion || ''
      form.ubicacion = props.activo.ubicacion
      form.clienteActual = props.activo.clienteActual
      form.estado = props.activo.estado
      form.linkGoogleMaps = props.activo.linkGoogleMaps || ''
      form.telefonoContacto = props.activo.telefonoContacto || ''

      if (isEditing.value || isViewing.value) {
        isLoadingHistorial.value = true
        ActivosService.obtenerHistorial(props.activo.id)
          .then(data => historial.value = data)
          .catch(() => console.error('Error al cargar el historial'))
          .finally(() => isLoadingHistorial.value = false)
      }
    }
  }
)

// ─── Mapeo de Errores ─────────────────────────────────────────────────────────
interface ValidationProblemDetails {
  errors?: Record<string, string[]>
  extensions?: { errors?: Record<string, string[]> }
}

function mapValidationErrors(data: ValidationProblemDetails): void {
  const source = data?.errors ?? data?.extensions?.errors ?? {}
  const keys = Object.keys(source)
  
  const mapped: Record<string, string> = {}
  for (const key of keys) {
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1)
    mapped[camelKey] = source[key][0] ?? 'Campo inválido.'
  }
  fieldErrors.value = mapped
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function handleSubmit(): Promise<void> {
  if (isViewing.value) return

  fieldErrors.value = {}
  generalError.value = null
  isLoading.value = true
  
  try {
    const payload: GuardarActivoDto = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion?.trim() || null,
      ubicacion: form.ubicacion.trim(),
      clienteActual: form.clienteActual.trim(),
      estado: form.estado,
      linkGoogleMaps: form.linkGoogleMaps.trim() || null,
      telefonoContacto: formatTelefonoVE(form.telefonoContacto) || null,
    }

    if (isEditing.value && props.activo) {
      await ActivosService.actualizar(props.activo.id, payload)
      feedback.showSuccess('Activo actualizado correctamente.')
    } else {
      await ActivosService.crear(payload)
      feedback.showSuccess('Activo creado correctamente.')
    }
    
    emit('saved')
    emit('update:modelValue', false)
  } catch (err: unknown) {
    const axiosError = err as AxiosError<ValidationProblemDetails>
    if (axiosError.response?.status === 400 && axiosError.response.data) {
      mapValidationErrors(axiosError.response.data)
      if (Object.keys(fieldErrors.value).length === 0) {
        generalError.value = 'Ocurrió un error de validación.'
      }
    } else {
      generalError.value = 'Ocurrió un error inesperado al guardar el activo.'
    }
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
      class="w-full sm:max-w-md flex flex-col gap-0 p-0 [&>button]:hidden"
    >
      <!-- Cabecera -->
      <SheetHeader class="px-6 py-5 border-b border-border shrink-0">
        <SheetTitle class="text-base font-semibold text-foreground">
          {{ sheetTitle }}
        </SheetTitle>
        <SheetDescription class="text-sm text-muted-foreground">
          {{ sheetDescription }}
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

      <!-- Formulario -->
      <form
        id="form-activo"
        novalidate
        class="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        @submit.prevent="handleSubmit"
      >
        <!-- Nombre -->
        <div class="space-y-1.5">
          <Label for="ac-nombre" class="text-sm font-medium text-foreground">Nombre del Activo</Label>
          <Input
            id="ac-nombre"
            v-model="form.nombre"
            :disabled="isLoading"
            :readonly="isViewing"
            :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.nombre }]"
          />
          <p v-if="fieldErrors.nombre" class="text-xs text-destructive">{{ fieldErrors.nombre }}</p>
        </div>

        <!-- Descripción -->
        <div class="space-y-1.5">
          <Label for="ac-descripcion" class="text-sm font-medium text-foreground">Descripción</Label>
          <Textarea
            id="ac-descripcion"
            v-model="form.descripcion"
            :rows="3"
            :disabled="isLoading"
            :readonly="isViewing"
            class="resize-none"
            :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.descripcion }]"
          />
          <p v-if="fieldErrors.descripcion" class="text-xs text-destructive">{{ fieldErrors.descripcion }}</p>
        </div>

        <!-- Ubicación -->
        <div class="space-y-1.5">
          <Label for="ac-ubicacion" class="text-sm font-medium text-foreground">Ubicación</Label>
          <Input
            id="ac-ubicacion"
            v-model="form.ubicacion"
            :disabled="isLoading"
            :readonly="isViewing"
            :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.ubicacion }]"
          />
          <p v-if="fieldErrors.ubicacion" class="text-xs text-destructive">{{ fieldErrors.ubicacion }}</p>
        </div>

        <!-- Teléfono de Contacto -->
        <div class="space-y-1.5">
          <Label for="ac-telefono" class="text-sm font-medium text-foreground">Teléfono de Contacto <span class="text-xs text-muted-foreground font-normal">(Opcional)</span></Label>
          <div class="relative flex items-center">
            <span class="absolute left-3 text-sm text-muted-foreground font-medium pointer-events-none">+58</span>
            <Input
              id="ac-telefono"
              type="tel"
              v-model="form.telefonoContacto"
              placeholder="412 1234567"
              :disabled="isLoading"
              :readonly="isViewing"
              class="pl-10"
              :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.telefonoContacto }]"
            />
          </div>
          <p v-if="fieldErrors.telefonoContacto" class="text-xs text-destructive">{{ fieldErrors.telefonoContacto }}</p>
        </div>

        <!-- Link de Google Maps -->
        <div class="space-y-1.5">
          <Label for="ac-maps" class="text-sm font-medium text-foreground">Link de Google Maps <span class="text-xs text-muted-foreground font-normal">(Opcional)</span></Label>
          <Input
            id="ac-maps"
            type="url"
            v-model="form.linkGoogleMaps"
            placeholder="https://maps.app.goo.gl/..."
            :disabled="isLoading"
            :readonly="isViewing"
            :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.linkGoogleMaps }]"
          />
          <p v-if="fieldErrors.linkGoogleMaps" class="text-xs text-destructive">{{ fieldErrors.linkGoogleMaps }}</p>
        </div>

        <!-- Cliente Actual -->
        <div class="space-y-1.5">
          <Label for="ac-cliente" class="text-sm font-medium text-foreground">Cliente Actual</Label>
          <Input
            id="ac-cliente"
            v-model="form.clienteActual"
            :disabled="isLoading"
            :readonly="isViewing"
            :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.clienteActual }]"
          />
          <p v-if="fieldErrors.clienteActual" class="text-xs text-destructive">{{ fieldErrors.clienteActual }}</p>
          <p class="text-[11px] text-muted-foreground mt-1 flex items-start gap-1.5 leading-tight">
            <Info class="w-3.5 h-3.5 shrink-0" />
            Nota: Cambiar el cliente solo afectará a las órdenes futuras. Las órdenes pasadas conservarán el cliente histórico.
          </p>
        </div>

        <!-- Estado Inicial -->
        <div class="space-y-1.5">
          <Label for="ac-estado" class="text-sm font-medium text-foreground">Estado</Label>
          <Select v-model="form.estado" :disabled="isLoading || isViewing">
            <SelectTrigger
              id="ac-estado"
              :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.estado }]"
            >
              <SelectValue placeholder="Seleccione el estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Operativo">Operativo</SelectItem>
              <SelectItem value="Requiere Mantenimiento">Requiere Mantenimiento</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="fieldErrors.estado" class="text-xs text-destructive">{{ fieldErrors.estado }}</p>
        </div>

        <!-- Últimos Mantenimientos -->
        <div v-if="isEditing || isViewing" class="space-y-3 mt-6">
          <h3 class="text-sm font-semibold text-foreground flex items-center gap-2">
            <Wrench class="w-4 h-4 text-muted-foreground" />
            Últimos Mantenimientos
          </h3>
          
          <div v-if="isLoadingHistorial" class="space-y-3">
            <Skeleton class="h-16 w-full rounded-lg" />
            <Skeleton class="h-16 w-full rounded-lg" />
          </div>
          
          <div v-else-if="historial.length === 0" class="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-lg text-center border border-dashed border-border">
            No hay mantenimientos previos registrados.
          </div>
          
          <div v-else class="space-y-2">
            <div 
              v-for="item in historial" 
              :key="item.ordenId"
              class="bg-muted/30 border border-border rounded-lg p-3 flex flex-col gap-1"
            >
              <div class="flex justify-between items-start">
                <span class="font-medium text-sm text-foreground">{{ item.titulo }}</span>
                <span class="text-xs text-muted-foreground whitespace-nowrap ml-2">
                  {{ new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(item.fechaCompletada)) }}
                </span>
              </div>
              <div class="text-xs text-muted-foreground">Técnico: {{ item.tecnicoNombre }}</div>
              <p v-if="item.notasTecnico" class="text-xs text-foreground mt-1 line-clamp-2" :title="item.notasTecnico">
                {{ item.notasTecnico }}
              </p>
            </div>
          </div>
        </div>
      </form>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-border shrink-0 flex items-center justify-end gap-3">
        <template v-if="isViewing">
          <Button
            type="button"
            variant="outline"
            @click="emit('update:modelValue', false)"
          >
            Cerrar
          </Button>
        </template>
        <template v-else>
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
            form="form-activo"
            :disabled="isLoading"
            class="min-w-32 gap-2"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
            {{ isLoading ? 'Guardando...' : 'Guardar' }}
          </Button>
        </template>
      </div>
    </SheetContent>
  </Sheet>
</template>
