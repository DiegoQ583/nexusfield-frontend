<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth.store'
import { useSyncStore } from '@/store/sync.store'
import { useNetwork } from '@vueuse/core'
import { LogOut, Home, RefreshCw, ClipboardCheck } from 'lucide-vue-next'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import AppFeedbackProvider from '@/components/ui/AppFeedbackProvider.vue'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const router = useRouter()

const authStore = useAuthStore()
const syncStore = useSyncStore()
const { isOnline } = useNetwork()

const navItems = [
  { path: '/tecnico/dashboard', name: 'Inicio', icon: Home },
  { path: '/tecnico/sync', name: 'Cola Sync', icon: RefreshCw },
  { path: '/tecnico/historial', name: 'Historial', icon: ClipboardCheck },
]

const isLogoutDialogOpen = ref(false)

function handleLogout() {
  isLogoutDialogOpen.value = true
}

async function confirmLogout() {
  await authStore.logout()
  await router.push('/login')
}
</script>

<template>
  <div class="flex flex-col h-[100dvh] bg-background overflow-hidden">
    <!-- Topbar -->
    <header class="h-14 border-b border-border bg-card/90 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-40">
      <!-- Izquierda: Logo compacto -->
      <AppLogo size="sm" />

      <!-- Network Indicator -->
      <Transition mode="out-in" name="fade">
        <div v-if="isOnline" key="online" class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-xs text-muted-foreground">Online</span>
        </div>
        <div v-else key="offline" class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
          <span class="text-xs font-medium text-amber-600 dark:text-amber-400">Modo Local</span>
        </div>
      </Transition>

      <div class="flex items-center gap-1 -mr-2">
        <ThemeToggle />
        <button @click="handleLogout" class="p-2 text-muted-foreground active:scale-95 transition-transform">
          <LogOut class="w-5 h-5" />
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto pb-20">
      <RouterView />
    </main>

    <!-- Bottom Navigation Bar -->
    <nav class="fixed bottom-0 w-full h-16 bg-card/90 backdrop-blur-lg border-t border-border flex justify-around items-center pb-[env(safe-area-inset-bottom)] z-50">
      <RouterLink 
        v-for="item in navItems" 
        :key="item.path" 
        :to="item.path"
        class="relative flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground transition-transform active:scale-95"
        active-class="text-primary"
      >
        <component :is="item.icon" class="w-5 h-5" />
        <span class="text-[10px] font-medium">{{ item.name }}</span>
        
        <span 
          v-if="item.name === 'Cola Sync' && syncStore.pendingSyncCount > 0" 
          class="absolute top-1 right-1/4 w-4 h-4 flex items-center justify-center rounded-full bg-destructive text-[9px] text-white"
        >
          {{ syncStore.pendingSyncCount }}
        </span>
      </RouterLink>
    </nav>

    <!-- Logout Modal -->
    <AlertDialog :open="isLogoutDialogOpen" @update:open="isLogoutDialogOpen = $event">
      <AlertDialogContent class="max-w-[320px] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar sesión de trabajo?</AlertDialogTitle>
          <AlertDialogDescription>
            Tendrás que ingresar tus credenciales nuevamente para acceder a tus órdenes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction @click="confirmLogout" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Cerrar Sesión
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AppFeedbackProvider />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
