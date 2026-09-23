<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useAppFeedback } from '@/composables/useAppFeedback'
import type { AxiosError } from 'axios'

import { RepuestosService } from '@/services/repuestos.service'
import type { CrearRepuestoDto, ActualizarRepuestoDto, ReservaTecnicoDto } from '@/services/repuestos.service'

// shadcn-vue
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// Lucide icons
import { Loader2, ImagePlus, UploadCloud, AlertCircle, Maximize2, X, Trash2, Package, HardHat } from 'lucide-vue-next'

// ─── Props & Emits ────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  modelValue: boolean
  repuesto: any | null
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
  precio: number | ''
  stockTotal: number | ''
  stockReservado: number
}

const form = reactive<FormState>({
  nombre: '',
  descripcion: '',
  precio: '',
  stockTotal: '',
  stockReservado: 0,
})

const fotoFile = ref<File | null>(null)
const fotoPreview = ref<string | null>(null)
const isLoading = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const generalError = ref<string | null>(null)
const feedback = useAppFeedback()

const isImageZoomed = ref(false)

const eliminarFotoFlag = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const reservasActivas = ref<ReservaTecnicoDto[]>([])
const isLoadingReservas = ref(false)

// ─── Computed ─────────────────────────────────────────────────────────────────
const isViewing = computed(() => props.mode === 'view')
const isEditing = computed(() => props.mode === 'edit')

const sheetTitle = computed(() => {
  if (isViewing.value) return 'Detalles del Repuesto'
  return isEditing.value ? 'Editar Repuesto' : 'Nuevo Repuesto'
})

const sheetDescription = computed(() => {
  if (isViewing.value) return 'Información completa del repuesto en catálogo.'
  return isEditing.value 
    ? 'Modifica los detalles y el inventario del repuesto.'
    : 'Agrega un nuevo repuesto al catálogo.'
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function obtenerUrlFoto(ruta: string | null): string | null {
  if (!ruta) return null
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || ''
  return `${baseUrl}${ruta}`
}

function resetForm(): void {
  form.nombre = ''
  form.descripcion = ''
  form.precio = ''
  form.stockTotal = ''
  form.stockReservado = 0
  
  fotoFile.value = null
  if (fotoPreview.value && fotoPreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(fotoPreview.value)
  }
  fotoPreview.value = null
  eliminarFotoFlag.value = false
  
  fieldErrors.value = {}
  generalError.value = null
  isImageZoomed.value = false
  reservasActivas.value = []
  isLoadingReservas.value = false
}

// ─── Manejo de Archivos ───────────────────────────────────────────────────────
function triggerFileInput(): void {
  fileInputRef.value?.click()
}

function quitarFoto(): void {
  if (fotoPreview.value && fotoPreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(fotoPreview.value)
  }
  fotoFile.value = null
  fotoPreview.value = null
  eliminarFotoFlag.value = true
  
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function handleFotoChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Validación
  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!validTypes.includes(file.type)) {
    feedback.showErrorModal('Formato inválido. Solo se permite JPEG, PNG o WEBP.')
    input.value = ''
    return
  }

  const maxSize = 2 * 1024 * 1024 // 2MB
  if (file.size > maxSize) {
    feedback.showErrorModal('La imagen supera el límite de 2MB. Por favor, elige una más ligera.')
    input.value = ''
    return
  }

  fotoFile.value = file
  eliminarFotoFlag.value = false
  
  // Limpiar preview anterior si era blob
  if (fotoPreview.value && fotoPreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(fotoPreview.value)
  }
  
  fotoPreview.value = URL.createObjectURL(file)
}

// ─── Ciclo de Vida ────────────────────────────────────────────────────────────
watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return
    resetForm()
    if (props.repuesto) {
      // Fase Síncrona
      form.nombre = props.repuesto.nombre
      form.descripcion = props.repuesto.descripcion || ''
      form.precio = props.repuesto.precio
      form.stockTotal = props.repuesto.stockTotal
      form.stockReservado = props.repuesto.stockReservado
      fotoPreview.value = obtenerUrlFoto(props.repuesto.fotoUrl)
      
      // Fase Asíncrona (Trazabilidad de Reservas)
      if (props.repuesto.stockReservado > 0) {
        isLoadingReservas.value = true
        RepuestosService.obtenerPorId(props.repuesto.id)
          .then(detalle => {
            reservasActivas.value = detalle.reservasActivas || []
          })
          .catch(() => {
            reservasActivas.value = []
          })
          .finally(() => {
            isLoadingReservas.value = false
          })
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
    const precioNum = Number(form.precio)
    const stockNum = Number(form.stockTotal)
    
    if (isEditing.value && props.repuesto) {
      const payload: ActualizarRepuestoDto = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        precio: isNaN(precioNum) ? 0 : precioNum,
        stockTotal: isNaN(stockNum) ? 0 : stockNum,
        foto: fotoFile.value,
        eliminarFoto: eliminarFotoFlag.value
      }
      await RepuestosService.actualizar(props.repuesto.id, payload)
      feedback.showSuccess('Repuesto actualizado correctamente.')
    } else {
      const payload: CrearRepuestoDto = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        precio: isNaN(precioNum) ? 0 : precioNum,
        stockTotal: isNaN(stockNum) ? 0 : stockNum,
        foto: fotoFile.value
      }
      await RepuestosService.crear(payload)
      feedback.showSuccess('Repuesto creado correctamente.')
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
      generalError.value = 'Ocurrió un error inesperado al guardar el repuesto.'
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
      @pointer-down-outside="(e) => { if (isImageZoomed) e.preventDefault() }"
      @interact-outside="(e) => { if (isImageZoomed) e.preventDefault() }"
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
        id="form-repuesto"
        novalidate
        class="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        @submit.prevent="handleSubmit"
      >
        <!-- Sección de Foto UX Premium -->
        <div class="flex flex-col items-center gap-3 py-2">
          <!-- Input oculto -->
          <input
            ref="fileInputRef"
            v-if="!isViewing"
            type="file"
            id="foto-upload"
            class="hidden"
            accept="image/jpeg, image/png, image/webp"
            @change="handleFotoChange"
          />

          <!-- CASO 1: HAY FOTO -->
          <template v-if="fotoPreview">
            <div class="w-32 h-32 rounded-xl overflow-hidden border border-border shadow-sm relative group">
              <img 
                :src="fotoPreview" 
                class="w-full h-full object-cover cursor-zoom-in"
                @click="isImageZoomed = true"
              />
              <div class="absolute top-2 right-2 p-1 bg-black/40 rounded text-white pointer-events-none">
                <Maximize2 class="w-4 h-4" />
              </div>
            </div>

            <!-- Botones de Acción de Foto -->
            <div v-if="!isViewing" class="flex items-center justify-center gap-2 mt-1">
              <Button type="button" variant="outline" size="sm" @click="triggerFileInput">
                <UploadCloud class="w-4 h-4 mr-1.5" />
                Cambiar
              </Button>
              <Button type="button" variant="ghost" size="sm" class="text-destructive hover:text-destructive hover:bg-destructive/10" @click="quitarFoto">
                <Trash2 class="w-4 h-4 mr-1.5" />
                Eliminar
              </Button>
            </div>
          </template>

          <!-- CASO 2: NO HAY FOTO -->
          <template v-else>
            <!-- Solo lectura -->
            <div v-if="isViewing" class="w-32 h-32 rounded-xl bg-muted border border-border flex flex-col items-center justify-center gap-2">
              <Package class="w-8 h-8 text-muted-foreground opacity-50" />
              <span class="text-xs text-muted-foreground">Sin foto</span>
            </div>
            
            <!-- Interactiva (Create/Edit) -->
            <div 
              v-else 
              class="w-32 h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors bg-muted/50"
              @click="triggerFileInput"
            >
              <ImagePlus class="w-8 h-8 text-muted-foreground" />
              <span class="text-xs text-muted-foreground">Subir foto</span>
            </div>
          </template>
        </div>

        <!-- Nombre -->
        <div class="space-y-1.5">
          <Label for="rp-nombre" class="text-sm font-medium text-foreground">Nombre</Label>
          <Input
            id="rp-nombre"
            v-model="form.nombre"
            :disabled="isLoading"
            :readonly="isViewing"
            :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.nombre }]"
          />
          <p v-if="fieldErrors.nombre" class="text-xs text-destructive">{{ fieldErrors.nombre }}</p>
        </div>

        <!-- Descripción -->
        <div class="space-y-1.5">
          <Label for="rp-descripcion" class="text-sm font-medium text-foreground">Descripción</Label>
          <Textarea
            id="rp-descripcion"
            v-model="form.descripcion"
            :rows="3"
            :disabled="isLoading"
            :readonly="isViewing"
            class="resize-none"
            :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.descripcion }]"
          />
          <p v-if="fieldErrors.descripcion" class="text-xs text-destructive">{{ fieldErrors.descripcion }}</p>
        </div>

        <!-- Precio -->
        <div class="space-y-1.5">
          <Label for="rp-precio" class="text-sm font-medium text-foreground">Precio</Label>
          <Input
            id="rp-precio"
            v-model="form.precio"
            type="number"
            step="0.01"
            min="0"
            :disabled="isLoading"
            :readonly="isViewing"
            :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.precio }]"
          />
          <p v-if="fieldErrors.precio" class="text-xs text-destructive">{{ fieldErrors.precio }}</p>
        </div>

        <!-- Stock Total -->
        <div class="space-y-1.5">
          <Label for="rp-stock" class="text-sm font-medium text-foreground">Stock Total</Label>
          <Input
            id="rp-stock"
            v-model="form.stockTotal"
            type="number"
            min="0"
            :disabled="isLoading"
            :readonly="isViewing"
            :class="[{ 'opacity-70 bg-muted cursor-not-allowed': isViewing }, { 'border-destructive focus-visible:ring-destructive': fieldErrors.stockTotal }]"
          />
          <p v-if="fieldErrors.stockTotal" class="text-xs text-destructive">{{ fieldErrors.stockTotal }}</p>
        </div>

        <!-- Stock Reservado (solo lectura en edición o view) -->
        <div v-if="isEditing || isViewing" class="space-y-1.5">
          <Label for="rp-reservado" class="text-sm font-medium text-foreground">Stock Reservado</Label>
          <Input
            id="rp-reservado"
            v-model="form.stockReservado"
            type="number"
            readonly
            class="opacity-70 bg-muted cursor-not-allowed"
          />
        </div>

        <!-- Trazabilidad de Reservas (B2B Enterprise Style) -->
        <div v-if="form.stockReservado > 0" class="space-y-3 mt-4">
          <h3 class="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Técnicos con Unidades Reservadas
          </h3>
          
          <div v-if="isLoadingReservas" class="space-y-2">
            <Skeleton class="h-12 w-full rounded-lg" />
            <Skeleton class="h-12 w-full rounded-lg" />
          </div>
          
          <div v-else-if="reservasActivas.length > 0" class="border border-border rounded-lg divide-y divide-border bg-muted/20">
            <div 
              v-for="(reserva, index) in reservasActivas" 
              :key="index"
              class="flex items-center justify-between p-3"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-background border border-border shadow-sm rounded-md">
                  <HardHat class="w-4 h-4 text-muted-foreground" />
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-foreground leading-none mb-1">{{ reserva.tecnicoNombre }}</span>
                  <span class="text-xs text-muted-foreground">Orden #{{ reserva.ordenId }}</span>
                </div>
              </div>
              <Badge variant="secondary" class="font-medium text-xs">
                {{ reserva.cantidad }} {{ reserva.cantidad === 1 ? 'und' : 'unds' }}
              </Badge>
            </div>
          </div>
          
          <div v-else class="text-xs text-muted-foreground italic bg-muted/50 p-3 rounded-lg text-center border border-dashed border-border">
            No se pudo cargar el detalle de reservas.
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
            form="form-repuesto"
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

  <!-- Modal Lightbox (Blindado contra el bloqueo de Radix UI) -->
  <Teleport to="body">
    <div 
      v-if="isImageZoomed" 
      class="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out"
      style="pointer-events: auto !important;"
      @click.self="isImageZoomed = false"
    >
      <!-- Botón X con prioridad absoluta -->
      <button 
        type="button"
        class="absolute top-5 right-5 text-white/70 hover:text-white bg-black/60 hover:bg-black/90 rounded-full p-2.5 transition-all z-[101] cursor-pointer shadow-lg"
        style="pointer-events: auto !important;"
        @click="isImageZoomed = false"
      >
        <X class="w-6 h-6 pointer-events-none" />
      </button>

      <!-- Imagen -->
      <img 
        v-if="fotoPreview" 
        :src="fotoPreview" 
        class="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 cursor-default select-none" 
        style="pointer-events: auto !important;"
        @click.stop 
      />
    </div>
  </Teleport>
</template>
