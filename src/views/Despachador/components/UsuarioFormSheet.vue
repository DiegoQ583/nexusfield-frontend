<script setup lang="ts">
/**
 * UsuarioFormSheet.vue — Panel lateral de creación/edición/vista de usuarios.
 *
 * Modos:
 * - 'create' : Muestra todos los campos. El submit llama a UsuariosService.crear().
 * - 'edit'   : Oculta clave. NombreUsuario y Rol son readonly. Submit llama a actualizar().
 * - 'view'   : Todos los campos disabled. No hay botón de guardar.
 *
 * El Bug de Auto-Cierre fue causado por el await de obtenerPorId dentro del watch
 * (el componente se cerraba antes de que la petición terminara). Ahora los datos
 * vienen pre-cargados vía la prop `usuario`, eliminando la petición HTTP en el watch.
 */

import { ref, computed, watch } from 'vue'
import type { AxiosError } from 'axios'
import { UsuariosService } from '@/services/usuarios.service'
import type { UsuarioResponseDto, CrearUsuarioDto, ActualizarUsuarioDto } from '@/services/usuarios.service'
import { formatTelefonoVE } from '@/lib/utils'

// shadcn-vue
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
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

// Lucide icons
import { Loader2, AlertCircle } from 'lucide-vue-next'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface ValidationProblemDetails {
  title?: string
  detail?: string
  status?: number
  // Estándar nativo de ASP.NET Core (ModelState)
  errors?: Record<string, string[]>
  // Extensiones del ProblemDetails wrapper customizado
  extensions?: {
    errors?: Record<string, string[]>
  }
}

interface FormState {
  nombreCompleto: string
  nombreUsuario: string
  correo: string
  clave: string
  telefono: string
  especialidad: string
  tarifaPorHora: number | ''
  rol: string
}

// ─── Props & Emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  modelValue: boolean
  usuario: UsuarioResponseDto | null
  mode: 'create' | 'edit' | 'view'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'saved'): void
}>()

// ─── Estado ───────────────────────────────────────────────────────────────────

const isLoading = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const generalError = ref<string | null>(null)

const formDefaults: FormState = {
  nombreCompleto: '',
  nombreUsuario: '',
  correo: '',
  clave: '',
  telefono: '',
  especialidad: '',
  tarifaPorHora: '',
  rol: '',
}

const form = ref<FormState>({ ...formDefaults })

// ─── Computed ─────────────────────────────────────────────────────────────────

const isViewing = computed(() => props.mode === 'view')
const isEditing = computed(() => props.mode === 'edit')
const isCreate  = computed(() => props.mode === 'create')

const sheetTitle = computed(() => {
  if (isViewing.value) return 'Detalles del Usuario'
  if (isEditing.value) return 'Editar Usuario'
  return 'Nuevo Usuario'
})

const sheetDescription = computed(() => {
  if (isViewing.value) return 'Información de solo lectura del usuario seleccionado.'
  if (isEditing.value) return 'Modifica los datos del usuario. El nombre de usuario y rol no son editables.'
  return 'Completa el formulario para registrar un nuevo miembro del equipo.'
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetForm(): void {
  form.value = { ...formDefaults }
  fieldErrors.value = {}
  generalError.value = null
}

function fillForm(usuario: UsuarioResponseDto): void {
  form.value = {
    nombreCompleto: usuario.nombreCompleto,
    nombreUsuario: usuario.nombreUsuario,
    correo: usuario.correo,
    clave: '',
    telefono: usuario.telefono ?? '',
    especialidad: usuario.especialidad ?? '',
    tarifaPorHora: usuario.tarifaPorHora,
    rol: usuario.rol,
  }
}

/**
 * Busca errores de campo en `data.errors` (ASP.NET Core nativo) y en
 * `data.extensions?.errors` (wrapper customizado), priorizando el primero.
 * Normaliza las claves a camelCase para coincidir con los campos del form.
 * @returns `true` si encontró al menos un error de campo, `false` si no.
 */
function mapValidationErrors(data: ValidationProblemDetails): boolean {
  const source = data?.errors ?? data?.extensions?.errors ?? {}
  const keys = Object.keys(source)
  if (keys.length === 0) return false

  const mapped: Record<string, string> = {}
  for (const key of keys) {
    // Normaliza PascalCase → camelCase tolerando cualquier convención del backend
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1)
    mapped[camelKey] = source[key][0] ?? 'Campo inválido.'
  }
  fieldErrors.value = mapped
  return true
}

// ─── Watcher: sincroniza el form cuando se abre el Sheet ─────────────────────
// La prop `usuario` llega pre-cargada desde el padre, eliminando el await
// dentro del watch que causaba el bug de auto-cierre.

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return
    resetForm()
    if (props.usuario) {
      fillForm(props.usuario)
    }
  }
)

// ─── Validación Frontend ──────────────────────────────────────────────────────

/**
 * Valida el formulario antes de enviarlo al backend.
 * @returns true si no hay errores, false si hay al menos uno.
 */
function validateForm(): boolean {
  fieldErrors.value = {}
  let isValid = true

  if (!form.value.nombreCompleto.trim()) {
    fieldErrors.value.nombreCompleto = 'El nombre completo es obligatorio.'
    isValid = false
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!form.value.correo.trim()) {
    fieldErrors.value.correo = 'El correo electrónico es obligatorio.'
    isValid = false
  } else if (!emailRegex.test(form.value.correo)) {
    fieldErrors.value.correo = 'El correo electrónico no tiene un formato válido.'
    isValid = false
  }

  if (isCreate.value) {
    if (!form.value.nombreUsuario.trim()) {
      fieldErrors.value.nombreUsuario = 'El nombre de usuario es obligatorio.'
      isValid = false
    }
    if (!form.value.clave) {
      fieldErrors.value.clave = 'La contraseña es obligatoria.'
      isValid = false
    } else if (form.value.clave.length < 8) {
      fieldErrors.value.clave = 'La contraseña debe tener al menos 8 caracteres.'
      isValid = false
    }
    if (!form.value.rol) {
      fieldErrors.value.rol = 'El rol es obligatorio.'
      isValid = false
    }
  }

  if (form.value.rol === 'Tecnico') {
    const tarifa = Number(form.value.tarifaPorHora)
    if (!form.value.tarifaPorHora || isNaN(tarifa) || tarifa <= 0) {
      fieldErrors.value.tarifaPorHora = 'La tarifa por hora es obligatoria y debe ser mayor a 0 para los técnicos.'
      isValid = false
    }
  }

  return isValid
}

// ─── Submit ───────────────────────────────────────────────────────────────────

async function handleSubmit(): Promise<void> {
  if (isViewing.value) return

  fieldErrors.value = {}
  generalError.value = null
  isLoading.value = true

  if (!validateForm()) {
    isLoading.value = false
    return
  }

  try {
    if (isEditing.value && props.usuario !== null) {
      // Modo edición: payload estricto (sin nombreUsuario, clave ni rol)
      const payload: ActualizarUsuarioDto = {
        nombreCompleto: form.value.nombreCompleto.trim(),
        correo: form.value.correo.trim(),
        telefono: formatTelefonoVE(form.value.telefono) || '',
        especialidad: form.value.especialidad,
        tarifaPorHora: Number(form.value.tarifaPorHora) || 0,
      }
      await UsuariosService.actualizar(props.usuario.id, payload)
    } else {
      // Modo creación: payload completo
      const payload: CrearUsuarioDto = {
        nombreCompleto: form.value.nombreCompleto.trim(),
        nombreUsuario: form.value.nombreUsuario.trim(),
        correo: form.value.correo.trim(),
        clave: form.value.clave,
        telefono: formatTelefonoVE(form.value.telefono) || '',
        especialidad: form.value.especialidad,
        tarifaPorHora: Number(form.value.tarifaPorHora) || 0,
        rol: form.value.rol,
      }
      await UsuariosService.crear(payload)
    }

    emit('saved')
    emit('update:modelValue', false)

  } catch (err: unknown) {
    const axiosError = err as AxiosError<ValidationProblemDetails>
    const status = axiosError.response?.status
    const data = axiosError.response?.data

    if ((status === 400 || status === 409) && data) {
      const foundFieldErrors = mapValidationErrors(data)
      if (!foundFieldErrors) {
        // El backend envió un error sin especificar campos → alerta general
        generalError.value = data.detail ?? data.title ?? 'Ocurrió un error de validación.'
      }
    }
    // Los 401/500 los maneja el interceptor global de Axios
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
      class="w-full sm:max-w-lg flex flex-col gap-0 p-0"
    >
      <!-- Cabecera del panel -->
      <SheetHeader class="px-6 py-5 border-b border-border shrink-0">
        <SheetTitle class="text-base font-semibold text-foreground">
          {{ sheetTitle }}
        </SheetTitle>
        <SheetDescription class="text-sm text-muted-foreground">
          {{ sheetDescription }}
        </SheetDescription>
      </SheetHeader>

      <!-- Alerta de error general (conflicto, negocio, etc.) -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <Alert v-if="generalError" variant="destructive" class="mx-6 mt-4">
          <AlertCircle class="w-4 h-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{{ generalError }}</AlertDescription>
        </Alert>
      </Transition>

      <!-- Cuerpo: formulario con scroll -->
      <form
        id="form-usuario"
        novalidate
        class="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        @submit.prevent="handleSubmit"
      >

        <!-- Nombre Completo -->
        <div class="space-y-1.5">
          <Label for="sf-nombre" class="text-sm font-medium text-foreground">
            Nombre Completo
          </Label>
          <Input
            id="sf-nombre"
            v-model="form.nombreCompleto"
            placeholder="Ej: Ana García López"
            :readonly="isViewing"
            :disabled="isLoading"
            :class="[
              (isViewing) ? 'opacity-70 bg-muted focus-visible:ring-0' : '',
              fieldErrors.nombreCompleto ? 'border-destructive focus-visible:ring-destructive' : '',
            ]"
            :required="!isViewing"
          />
          <p v-if="fieldErrors.nombreCompleto" class="text-xs text-destructive">
            {{ fieldErrors.nombreCompleto }}
          </p>
        </div>

        <!-- Nombre de Usuario (visible siempre, readonly si no es create) -->
        <div class="space-y-1.5">
          <Label for="sf-usuario" class="text-sm font-medium text-foreground">
            Nombre de Usuario
          </Label>
          <Input
            id="sf-usuario"
            v-model="form.nombreUsuario"
            placeholder="Ej: ana.garcia"
            :readonly="!isCreate"
            :disabled="isLoading"
            :class="[
              !isCreate ? 'opacity-70 bg-muted focus-visible:ring-0' : '',
              fieldErrors.nombreUsuario ? 'border-destructive focus-visible:ring-destructive' : '',
            ]"
            :required="isCreate"
          />
          <p v-if="fieldErrors.nombreUsuario" class="text-xs text-destructive">
            {{ fieldErrors.nombreUsuario }}
          </p>
          <p v-if="isEditing" class="text-xs text-muted-foreground">
            El nombre de usuario no puede modificarse.
          </p>
        </div>

        <!-- Correo -->
        <div class="space-y-1.5">
          <Label for="sf-correo" class="text-sm font-medium text-foreground">
            Correo Electrónico
          </Label>
          <Input
            id="sf-correo"
            v-model="form.correo"
            type="email"
            placeholder="correo@ejemplo.com"
            :readonly="isViewing"
            :disabled="isLoading"
            :class="[
              isViewing ? 'opacity-70 bg-muted focus-visible:ring-0' : '',
              fieldErrors.correo ? 'border-destructive focus-visible:ring-destructive' : '',
            ]"
            :required="!isViewing"
          />
          <p v-if="fieldErrors.correo" class="text-xs text-destructive">
            {{ fieldErrors.correo }}
          </p>
        </div>

        <!-- Contraseña (solo en creación) -->
        <div v-if="isCreate" class="space-y-1.5">
          <Label for="sf-clave" class="text-sm font-medium text-foreground">
            Contraseña
          </Label>
          <Input
            id="sf-clave"
            v-model="form.clave"
            type="password"
            placeholder="Mínimo 8 caracteres"
            minlength="8"
            :disabled="isLoading"
            :class="fieldErrors.clave ? 'border-destructive focus-visible:ring-destructive' : ''"
            required
          />
          <p v-if="fieldErrors.clave" class="text-xs text-destructive">
            {{ fieldErrors.clave }}
          </p>
        </div>

        <!-- Rol (visible siempre, readonly si no es create) -->
        <div class="space-y-1.5">
          <Label for="sf-rol" class="text-sm font-medium text-foreground">
            Rol
          </Label>
          <Select
            v-model="form.rol"
            :disabled="!isCreate || isLoading"
          >
            <SelectTrigger
              id="sf-rol"
              :class="[
                !isCreate ? 'opacity-70 bg-muted focus-visible:ring-0' : '',
                fieldErrors.rol ? 'border-destructive focus-visible:ring-destructive' : '',
              ]"
            >
              <SelectValue placeholder="Selecciona un rol..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Despachador">Despachador</SelectItem>
              <SelectItem value="Tecnico">Técnico</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="fieldErrors.rol" class="text-xs text-destructive">
            {{ fieldErrors.rol }}
          </p>
        </div>

        <!-- Separador visual -->
        <div class="border-t border-border pt-2">
          <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Información adicional
          </p>
        </div>

        <!-- Teléfono -->
        <div class="space-y-1.5">
          <Label for="sf-telefono" class="text-sm font-medium text-foreground">
            Teléfono
          </Label>
          <div class="relative flex items-center">
            <span class="absolute left-3 text-sm text-muted-foreground font-medium pointer-events-none">+58</span>
            <Input
              id="sf-telefono"
              v-model="form.telefono"
              type="tel"
              placeholder="412 1234567"
              :readonly="isViewing"
              :disabled="isLoading"
              class="pl-10"
              :class="[
                isViewing ? 'opacity-70 bg-muted focus-visible:ring-0' : '',
                fieldErrors.telefono ? 'border-destructive focus-visible:ring-destructive' : '',
              ]"
            />
          </div>
          <p v-if="fieldErrors.telefono" class="text-xs text-destructive">
            {{ fieldErrors.telefono }}
          </p>
        </div>

        <template v-if="form.rol === 'Tecnico'">
          <!-- Especialidad -->
          <div class="space-y-1.5">
            <Label for="sf-especialidad" class="text-sm font-medium text-foreground">
              Especialidad
            </Label>
            <Input
              id="sf-especialidad"
              v-model="form.especialidad"
              placeholder="Ej: Electricidad, HVAC..."
              :readonly="isViewing"
              :disabled="isLoading"
              :class="[
                isViewing ? 'opacity-70 bg-muted focus-visible:ring-0' : '',
                fieldErrors.especialidad ? 'border-destructive focus-visible:ring-destructive' : '',
              ]"
            />
            <p v-if="fieldErrors.especialidad" class="text-xs text-destructive">
              {{ fieldErrors.especialidad }}
            </p>
          </div>

          <!-- Tarifa por hora -->
          <div class="space-y-1.5">
            <Label for="sf-tarifa" class="text-sm font-medium text-foreground">
              Tarifa por Hora (MXN)
            </Label>
            <Input
              id="sf-tarifa"
              v-model="form.tarifaPorHora"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              :readonly="isViewing"
              :disabled="isLoading"
              :class="[
                isViewing ? 'opacity-70 bg-muted focus-visible:ring-0' : '',
                fieldErrors.tarifaPorHora ? 'border-destructive focus-visible:ring-destructive' : '',
              ]"
            />
            <p v-if="fieldErrors.tarifaPorHora" class="text-xs text-destructive">
              {{ fieldErrors.tarifaPorHora }}
            </p>
          </div>
        </template>

      </form>

      <!-- Pie de página con botones -->
      <div class="px-6 py-4 border-t border-border shrink-0 flex items-center justify-end gap-3">

        <!-- Modo vista: solo botón Cerrar -->
        <template v-if="isViewing">
          <Button
            type="button"
            variant="outline"
            @click="emit('update:modelValue', false)"
          >
            Cerrar
          </Button>
        </template>

        <!-- Modo crear/editar: Cancelar + Guardar -->
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
            form="form-usuario"
            :disabled="isLoading"
            class="min-w-28"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
            {{ isLoading ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Usuario') }}
          </Button>
        </template>
      </div>
    </SheetContent>
  </Sheet>
</template>
