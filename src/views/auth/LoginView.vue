<script setup lang="ts">
/**
 * LoginView.vue — Vista de autenticación premium para NexusField.
 *
 * Responsabilidades:
 * - Renderizar formulario con validación de errores locales (HTTP 400).
 * - Detectar estado de red offline con @vueuse/core y deshabilitar el submit.
 * - Detectar fallos de red (sin response) antes de asumir errores del servidor.
 * - Delegar la lógica de negocio al authStore (patrón Smart/Dumb).
 */

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOnline } from '@vueuse/core'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/store/auth.store'

// shadcn-vue components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Lucide icons (reemplaza @tabler/icons-vue)
import { Wifi, WifiOff, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-vue-next'

// ─── Tipos locales ─────────────────────────────────────────────────────────────

interface ValidationProblemDetails {
  title?: string
  status?: number
  extensions?: {
    errors?: Record<string, string[]>
  }
}

// ─── Composables ───────────────────────────────────────────────────────────────

const router = useRouter()
const authStore = useAuthStore()
const isOnline = useOnline()

// ─── Estado del formulario ─────────────────────────────────────────────────────

const nombreUsuario = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)

// Errores de campo (HTTP 400 → ValidationProblemDetails)
const fieldErrors = ref<Record<string, string>>({})

// Error general (HTTP 401 o fallo de red/CORS)
const generalError = ref<string | null>(null)

// ─── Computed ──────────────────────────────────────────────────────────────────

const isSubmitDisabled = computed(() => !isOnline.value || isLoading.value)

const inputTypePassword = computed(() => (showPassword.value ? 'text' : 'password'))

const hasUserError = computed(
  () => !!fieldErrors.value['NombreUsuario'] || !!fieldErrors.value['nombreUsuario']
)
const hasPasswordError = computed(
  () => !!fieldErrors.value['Password'] || !!fieldErrors.value['password']
)

const userErrorMessage = computed(
  () => fieldErrors.value['NombreUsuario'] ?? fieldErrors.value['nombreUsuario'] ?? ''
)
const passwordErrorMessage = computed(
  () => fieldErrors.value['Password'] ?? fieldErrors.value['password'] ?? ''
)

// ─── Handlers ──────────────────────────────────────────────────────────────────

function clearErrors(): void {
  fieldErrors.value = {}
  generalError.value = null
}

function handleValidationError(data: ValidationProblemDetails): void {
  const rawErrors = data.extensions?.errors ?? {}
  const mapped: Record<string, string> = {}

  for (const [key, messages] of Object.entries(rawErrors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      mapped[key] = messages[0]
    }
  }

  fieldErrors.value = mapped
}

async function handleSubmit(): Promise<void> {
  clearErrors()
  isLoading.value = true

  try {
    await authStore.login({
      nombreUsuario: nombreUsuario.value.trim(),
      clave: password.value,
    })

    // Auditoría: verificar qué rol devuelve el backend para diagnosticar redirecciones
    console.log('Usuario logueado:', authStore.user)

    // Login exitoso → redirigir según query param o rol
    const redirectTo = (router.currentRoute.value.query.redirect as string) ?? undefined
    if (redirectTo) {
      await router.push(redirectTo)
    } else {
      await router.push(resolveRoleRoute(authStore.user?.rol))
    }
  } catch (err) {
    const axiosError = err as AxiosError<ValidationProblemDetails>

    // ── Validación crítica: fallo de red / CORS / servidor caído ──────────────
    if (!axiosError.response) {
      generalError.value =
        'Error de conexión. Verifica que el servidor esté encendido y el CORS configurado.'
      return
    }

    const status = axiosError.response.status

    if (status === 400) {
      const data = axiosError.response.data
      if (data) handleValidationError(data)
    } else if (status === 401) {
      generalError.value = 'Credenciales incorrectas. Verifica tu usuario y contraseña.'
    } else if (status === 429) {
      const data = axiosError.response.data as Record<string, unknown>
      generalError.value =
        (data?.title as string) ??
        (data?.detail as string) ??
        'Ha superado el límite de intentos. Por favor espere 1 minuto.'
    }
  } finally {
    isLoading.value = false
  }
}

function resolveRoleRoute(rol: string | undefined): string {
  if (rol === 'Despachador' || rol === 'Admin') return '/despachador/dashboard'
  if (rol === 'Tecnico') return '/tecnico/dashboard'
  return '/login'
}
</script>

<template>
  <main
    id="login-page"
    class="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground"
  >

    <!-- ── Controles flotantes (esquina superior derecha) ── -->
    <div class="fixed top-4 right-4 z-50 flex items-center gap-2">
      <ThemeToggle />

      <!-- Indicador de red flotante -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-1 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-1 scale-95"
        mode="out-in"
      >
        <div
          v-if="isOnline"
          key="online"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 text-xs font-medium text-emerald-700 dark:text-emerald-400 shadow-sm"
          role="status"
          aria-label="Estado de conexión: en línea"
        >
          <Wifi class="w-3.5 h-3.5" />
          En línea
        </div>
        <div
          v-else
          key="offline"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-700 text-xs font-medium text-red-700 dark:text-red-400 shadow-sm animate-pulse"
          role="alert"
          aria-live="assertive"
          aria-label="Estado de conexión: sin conexión"
        >
          <WifiOff class="w-3.5 h-3.5" />
          Modo Offline
        </div>
      </Transition>
    </div>

    <!-- ── Contenedor principal ── -->
    <div class="w-full max-w-sm px-4 animate-in fade-in duration-500">

      <!-- ── Branding ── -->
      <header class="flex flex-col items-center mb-8 text-center">
        <AppLogo size="lg" layout="col" class="mb-2" />
        <p class="text-sm text-muted-foreground mt-1">
          Field Service Management Platform
        </p>
      </header>

      <!-- ── Card del formulario ── -->
      <Card class="max-w-sm w-full shadow-xl border border-border rounded-2xl bg-card text-card-foreground">
        <CardHeader class="pb-4 pt-6 px-6 flex flex-col items-center text-center">
          <CardTitle class="text-base font-semibold text-foreground">
            Iniciar sesión
          </CardTitle>
          <CardDescription class="text-muted-foreground text-sm">
            Ingresa tus credenciales para acceder al sistema.
          </CardDescription>
        </CardHeader>

        <CardContent class="space-y-5 px-6 pb-6">

          <!-- Error general (HTTP 401 / fallo de red) -->
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 -translate-y-1 scale-98"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <Alert
              v-if="generalError"
              id="general-error-alert"
              class="border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 py-3 animate-in fade-in zoom-in-95 duration-300"
            >
              <AlertCircle class="w-4 h-4 text-red-600 dark:text-red-400" />
              <AlertTitle class="text-red-800 dark:text-red-300 text-sm font-medium">
                Acceso denegado
              </AlertTitle>
              <AlertDescription class="text-red-700 dark:text-red-400 text-xs mt-0.5">
                {{ generalError }}
              </AlertDescription>
            </Alert>
          </Transition>

          <!-- Formulario -->
          <form
            id="login-form"
            novalidate
            class="space-y-4"
            @submit.prevent="handleSubmit"
          >

            <!-- ── Campo: Usuario ── -->
            <div class="space-y-1.5">
              <Label
                for="input-usuario"
                class="text-sm font-medium text-foreground"
              >
                Usuario
              </Label>
              <Input
                id="input-usuario"
                v-model="nombreUsuario"
                type="text"
                name="nombreUsuario"
                placeholder="nombre de usuario"
                autocomplete="username"
                :disabled="isLoading"
                :class="[
                  'h-10 transition-colors duration-200',
                  hasUserError
                    ? 'border-red-400 dark:border-red-600 focus-visible:ring-red-400/30 dark:focus-visible:ring-red-600/30'
                    : ''
                ]"
                aria-required="true"
                :aria-invalid="hasUserError"
                :aria-describedby="hasUserError ? 'error-usuario' : undefined"
              />
              <Transition
                enter-active-class="transition-all duration-200"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
              >
                <p
                  v-if="hasUserError"
                  id="error-usuario"
                  role="alert"
                  class="text-sm text-red-500 dark:text-red-400"
                >
                  {{ userErrorMessage }}
                </p>
              </Transition>
            </div>

            <!-- ── Campo: Contraseña ── -->
            <div class="space-y-1.5">
              <Label
                for="input-password"
                class="text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Contraseña
              </Label>
              <div class="relative">
                <Input
                  id="input-password"
                  v-model="password"
                  :type="inputTypePassword"
                  name="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  :disabled="isLoading"
                  :class="[
                    'h-10 pr-10 transition-colors duration-200',
                    hasPasswordError
                      ? 'border-red-400 dark:border-red-600 focus-visible:ring-red-400/30 dark:focus-visible:ring-red-600/30'
                      : ''
                  ]"
                  aria-required="true"
                  :aria-invalid="hasPasswordError"
                  :aria-describedby="hasPasswordError ? 'error-password' : undefined"
                />
                <!-- Botón toggle show/hide password -->
                <button
                  id="btn-toggle-password"
                  type="button"
                  class="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md"
                  :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  :aria-pressed="showPassword"
                  :disabled="isLoading"
                  @click="showPassword = !showPassword"
                >
                  <Transition
                    mode="out-in"
                    enter-active-class="transition-opacity duration-150"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition-opacity duration-150"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                  >
                    <EyeOff v-if="showPassword" key="hide" class="w-4 h-4" />
                    <Eye v-else key="show" class="w-4 h-4" />
                  </Transition>
                </button>
              </div>
              <Transition
                enter-active-class="transition-all duration-200"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
              >
                <p
                  v-if="hasPasswordError"
                  id="error-password"
                  role="alert"
                  class="text-sm text-red-500 dark:text-red-400"
                >
                  {{ passwordErrorMessage }}
                </p>
              </Transition>
            </div>

            <!-- ── Banner sin conexión (inline en el form) ── -->
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
            >
              <p
                v-if="!isOnline"
                class="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5"
              >
                <WifiOff class="w-3.5 h-3.5 shrink-0" />
                Requiere conexión a internet para iniciar sesión.
              </p>
            </Transition>

            <!-- ── Botón de submit ── -->
            <Button
              id="btn-submit-login"
              type="submit"
              class="w-full h-10 font-medium bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isSubmitDisabled"
            >
              <Transition
                mode="out-in"
                enter-active-class="transition-opacity duration-150"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition-opacity duration-150"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <span v-if="isLoading" key="loading" class="flex items-center gap-2">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Verificando...
                </span>
                <span v-else key="idle">
                  Iniciar sesión
                </span>
              </Transition>
            </Button>
          </form>

        </CardContent>
      </Card>

      <!-- ── Footer ── -->
      <footer class="mt-6 text-center">
        <p class="text-xs text-muted-foreground">
          NexusField &copy; {{ new Date().getFullYear() }} &middot; Acceso restringido a personal autorizado
        </p>
      </footer>
    </div>
  </main>
</template>