<script setup lang="ts">


import { ref, onMounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useNetwork } from '@vueuse/core'
import { useAuthStore } from '@/store/auth.store'
import { useNotificationStore } from '@/store/notification.store'
import { watch } from 'vue'
import AppFeedbackProvider from '@/components/ui/AppFeedbackProvider.vue'

// shadcn-vue components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import AppLogo from '@/components/ui/AppLogo.vue'

// Lucide icons
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  Monitor,
  Bell,
  Menu,
  LogOut,
  ChevronRight,
  Wifi,
  WifiOff,
} from 'lucide-vue-next'

// ─── Composables ──────────────────────────────────────────────────────────────

const router = useRouter()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const { isOnline } = useNetwork()

const showOnlineText = ref(false)
let onlineTimer: ReturnType<typeof setTimeout>

// Escucha cuando regresa el internet para mostrar el texto por 3 segundos
watch(isOnline, (newVal) => {
  if (newVal) {
    showOnlineText.value = true
    clearTimeout(onlineTimer)
    onlineTimer = setTimeout(() => {
      showOnlineText.value = false
    }, 3000)
  }
})

// ─── Estado ───────────────────────────────────────────────────────────────────

const isMobileMenuOpen = ref(false)

// ─── Navegación ───────────────────────────────────────────────────────────────

const navItems = [
  { label: 'Inicio',     to: '/despachador/dashboard',   icon: LayoutDashboard },
  { label: 'Órdenes',    to: '/despachador/ordenes',     icon: ClipboardList   },
  { label: 'Inventario', to: '/despachador/inventario',  icon: Package         },
  { label: 'Usuarios',   to: '/despachador/usuarios',    icon: Users           },
  { label: 'Activos',    to: '/despachador/activos',     icon: Monitor         },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | undefined): string {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

async function handleLogout(): Promise<void> {
  await authStore.logout()
  router.push('/login')
}

//Formatea la fecha de una notificación de forma legible y compacta. Muestra la hora si es hoy, la fecha si es anterior
function formatNotifFecha(fecha: Date): string {
  const ahora = new Date()
  const mismaFecha =
    fecha.getDate() === ahora.getDate() &&
    fecha.getMonth() === ahora.getMonth() &&
    fecha.getFullYear() === ahora.getFullYear()

  if (mismaFecha) {
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  notificationStore.initSignalR()
})
</script>

<template>
  <div class="min-h-screen bg-background flex">

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- SIDEBAR — solo visible en escritorio                                    -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <aside class="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-card">

      <!-- Logo / Cabecera -->
      <div class="flex items-center justify-between h-16 px-5 border-b border-border shrink-0">
        <AppLogo size="sm" />
        <Badge
          variant="outline"
          class="text-[10px] px-1.5 py-0 border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400"
        >
          Despachador
        </Badge>
      </div>

      <!-- Navegación -->
      <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <p class="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Menú Principal
        </p>
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150 group"
          active-class="bg-accent text-accent-foreground"
        >
          <component
            :is="item.icon"
            class="w-4 h-4 shrink-0 text-muted-foreground group-[.router-link-active]:text-indigo-600 dark:group-[.router-link-active]:text-indigo-400"
          />
          {{ item.label }}
          <ChevronRight
            class="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-60 text-muted-foreground transition-opacity duration-150"
          />
        </RouterLink>
      </nav>
    </aside>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- CONTENEDOR DERECHO                                                       -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div class="flex-1 flex flex-col min-w-0">

      <!-- ── TOPBAR ─────────────────────────────────────────────────────────── -->
      <header class="h-16 shrink-0 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">

        <!-- Izquierda: botón hamburguesa (solo móvil) -->
        <Sheet v-model:open="isMobileMenuOpen">
          <SheetTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="md:hidden"
              aria-label="Abrir menú de navegación"
            >
              <Menu class="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" class="w-64 p-0 bg-card">
            <!-- Logo móvil -->
            <div class="flex items-center h-16 px-5 border-b border-border">
              <AppLogo size="sm" />
            </div>
            <!-- Navegación móvil -->
            <nav class="p-3 space-y-0.5">
              <RouterLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                active-class="bg-accent text-accent-foreground"
                @click="isMobileMenuOpen = false"
              >
                <component :is="item.icon" class="w-4 h-4 shrink-0" />
                {{ item.label }}
              </RouterLink>
            </nav>
          </SheetContent>
        </Sheet>

        <!-- Spacer (ocupa espacio en desktop donde no hay hamburguesa) -->
        <div class="hidden md:block" />

        <!-- Derecha: red + tema + notificaciones + avatar -->
        <div class="flex items-center gap-2">

          <!-- Indicador de estado de red -->
          <Transition mode="out-in" enter-active-class="transition-all duration-200" leave-active-class="transition-all duration-150">
            <div
              v-if="isOnline"
              key="online"
              class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10"
              title="Conexión activa"
            >
              <Wifi class="w-5 h-5 text-emerald-500" />
              <span v-if="showOnlineText" class="text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-left-1">Online</span>
            </div>
            <div
              v-else
              key="offline"
              class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10"
              title="Sin conexión"
            >
              <WifiOff class="w-5 h-5 text-destructive" />
              <span class="text-xs font-medium text-destructive">Offline</span>
            </div>
          </Transition>

          <!-- Toggle de tema claro/oscuro -->
          <ThemeToggle />

          <!-- ── Centro de Notificaciones ─────────────────────────────────── -->
          <DropdownMenu @update:open="(open) => { if (open) notificationStore.markAllRead() }">
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="relative"
                aria-label="Centro de notificaciones"
              >
                <Bell class="w-6 h-6 text-muted-foreground" />
                <Transition
                  enter-active-class="transition-all duration-200 ease-out"
                  enter-from-class="opacity-0 scale-50"
                  enter-to-class="opacity-100 scale-100"
                  leave-active-class="transition-all duration-150 ease-in"
                  leave-from-class="opacity-100 scale-100"
                  leave-to-class="opacity-0 scale-50"
                >
                  <span
                    v-if="notificationStore.unreadCount > 0"
                    class="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white leading-none"
                  >
                    {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
                  </span>
                </Transition>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-80 p-0">

              <!-- Cabecera del panel -->
              <div class="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 class="text-sm font-semibold text-foreground">Notificaciones</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  @click="notificationStore.markAllRead()"
                >
                  Marcar leídas
                </Button>
              </div>

              <!-- Lista de notificaciones -->
              <div class="max-h-96 overflow-y-auto">

                <!-- Estado vacío -->
                <div
                  v-if="notificationStore.notificaciones.length === 0"
                  class="flex flex-col items-center justify-center py-10 gap-2"
                >
                  <Bell class="w-8 h-8 text-muted-foreground/30" />
                  <p class="text-sm text-muted-foreground text-center">
                    No hay notificaciones recientes.
                  </p>
                </div>

                <!-- Ítems de notificación -->
                <div
                  v-for="notif in notificationStore.notificaciones"
                  :key="notif.id"
                  class="flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-accent/50 transition-colors"
                >
                  <!-- Indicador de no leída -->
                  <div class="mt-1.5 shrink-0">
                    <span
                      v-if="!notif.leida"
                      class="block w-2 h-2 rounded-full bg-blue-500"
                      title="No leída"
                    />
                    <span
                      v-else
                      class="block w-2 h-2 rounded-full bg-transparent"
                    />
                  </div>

                  <!-- Contenido -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-foreground leading-snug">{{ notif.mensaje }}</p>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ formatNotifFecha(notif.fecha) }}
                    </p>
                  </div>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- ── Dropdown del usuario ────────────────────────────────────────── -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" class="flex items-center gap-2 h-8 px-2 rounded-lg">
                <Avatar class="w-7 h-7">
                  <AvatarFallback class="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                    {{ getInitials(authStore.user?.nombreCompleto) }}
                  </AvatarFallback>
                </Avatar>
                <span class="hidden sm:block text-sm font-medium text-foreground max-w-32 truncate">
                  {{ authStore.user?.nombreCompleto }}
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuLabel class="font-normal">
                <div class="flex flex-col gap-0.5">
                  <p class="text-sm font-medium text-foreground truncate">
                    {{ authStore.user?.nombreCompleto }}
                  </p>
                  <p class="text-xs text-muted-foreground truncate">
                    {{ authStore.user?.rol }}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                @click="handleLogout"
              >
                <LogOut class="w-4 h-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <!-- ── CONTENIDO PRINCIPAL ────────────────────────────────────────────── -->
      <main class="flex-1 p-6 overflow-auto bg-background">
        <div class="max-w-[1600px] mx-auto w-full">
          <RouterView />
        </div>
      </main>
    </div>

    <!-- Provider Global de Feedback (Éxitos y Errores Bloqueantes) -->
    <AppFeedbackProvider />
  </div>
</template>
