<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { dbOrdenes } from '@/store/sync.store'
import { TecnicoService } from '@/services/tecnico.service'
import type { OrdenTecnicoDto } from '@/services/tecnico.service'
import { useAppFeedback } from '@/composables/useAppFeedback'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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

// Lucide icons
import { ArrowLeft, MapPin, PhoneCall, Package, Play, XCircle, Navigation, Cpu, AlertCircle } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const feedback = useAppFeedback()

const orden = ref<OrdenTecnicoDto | null>(null)
const isLoading = ref(true)

const isRechazarOpen = ref(false)
const motivoRechazo = ref('')
const isRechazando = ref(false)
const isIniciando = ref(false)

onMounted(async () => {
  const idStr = route.params.id as string
  if (!idStr) {
    router.replace('/tecnico/dashboard')
    return
  }

  const id = parseInt(idStr, 10)
  try {
    const ordenes = await dbOrdenes.getItem<OrdenTecnicoDto[]>('mis_ordenes')
    if (ordenes) {
      const encontrada = ordenes.find(o => o.id === id)
      if (encontrada) {
        orden.value = encontrada
      }
    }
  } catch (err) {
    console.error('Error reading indexedDB', err)
  } finally {
    isLoading.value = false
  }
})

function getBadgeProps(prioridad: string) {
  if (prioridad === 'Alta') return { class: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent' }
  if (prioridad === 'Media') return { class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent' }
  return { class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent' }
}

async function confirmarRechazo() {
  if (!motivoRechazo.value.trim() || !orden.value) return

  isRechazando.value = true
  try {
    // 1. Llamar a la API
    await TecnicoService.rechazarOrden(orden.value.id, motivoRechazo.value)
    
    // 2. Eliminar localmente y refrescar
    const ordenesLocales = await dbOrdenes.getItem<OrdenTecnicoDto[]>('mis_ordenes')
    if (ordenesLocales) {
      const filtradas = ordenesLocales.filter(o => o.id !== orden.value!.id)
      await dbOrdenes.setItem('mis_ordenes', filtradas)
    }

    feedback.showSuccess('Orden rechazada exitosamente')
    router.replace('/tecnico/dashboard')
  } catch (error) {
    feedback.showErrorModal('No se pudo rechazar la orden. Verifique su conexión e inténtalo de nuevo.')
  } finally {
    isRechazando.value = false
    isRechazarOpen.value = false
  }
}

async function iniciarTrabajo() {
  if (!orden.value) return

  isIniciando.value = true
  try {
    // 1. Llamar a la API
    await TecnicoService.iniciarOrden(orden.value.id)

    // 2. Actualizar estado localmente a 'EnProgreso'
    const ordenesLocales = await dbOrdenes.getItem<OrdenTecnicoDto[]>('mis_ordenes')
    if (ordenesLocales) {
      const idx = ordenesLocales.findIndex(o => o.id === orden.value!.id)
      if (idx !== -1) {
        ordenesLocales[idx].estado = 'EnProgreso'
        await dbOrdenes.setItem('mis_ordenes', ordenesLocales)
      }
    }

    // 3. Navegar a vista de ejecución
    router.replace(`/tecnico/orden/${orden.value.id}/ejecucion`)
  } catch (error) {
    feedback.showErrorModal('No se pudo iniciar la orden. Verifique su conexión e inténtalo de nuevo.')
  } finally {
    isIniciando.value = false
  }
}
</script>

<template>
  <div v-if="isLoading" class="p-4 flex justify-center mt-10 max-w-md mx-auto w-full">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>

  <div v-else-if="!orden" class="max-w-md mx-auto w-full p-4 flex flex-col items-center justify-center py-20 text-center space-y-4">
    <XCircle class="w-12 h-12 text-muted-foreground opacity-50" />
    <div>
      <h2 class="text-lg font-semibold text-foreground">Orden no encontrada</h2>
      <p class="text-sm text-muted-foreground">La orden no existe o no se pudo cargar offline.</p>
    </div>
    <Button variant="outline" @click="router.replace('/tecnico/dashboard')">
      Volver al Inicio
    </Button>
  </div>

  <div v-else class="max-w-md mx-auto w-full p-4 space-y-5 pb-40">
    <!-- 1. Encabezado Integrado -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <button 
          @click="router.back()" 
          class="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 text-foreground active:scale-95 transition-transform"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm text-muted-foreground font-medium">Orden #{{ orden.id }}</span>
          <Badge :class="getBadgeProps(orden.prioridad).class" variant="outline" class="text-[10px]">
            {{ orden.prioridad }}
          </Badge>
        </div>
      </div>
      <h1 class="text-xl font-bold tracking-tight text-foreground mt-2 leading-tight">
        {{ orden.titulo }}
      </h1>
    </div>

    <!-- 2. Tarjeta de Activo y Ubicación (Hero Card) -->
    <div class="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
      <div class="flex items-start gap-3">
        <div class="p-2 bg-muted/50 rounded-lg shrink-0">
          <Cpu class="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Máquina / Activo</span>
          <p class="text-sm font-medium text-foreground leading-snug">{{ orden.activoNombre }}</p>
        </div>
      </div>
      
      <div class="flex items-start gap-3">
        <div class="p-2 bg-muted/50 rounded-lg shrink-0">
          <MapPin class="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ubicación Física</span>
          <p class="text-sm text-foreground leading-snug">{{ orden.ubicacion }}</p>
        </div>
      </div>

      <!-- Fila Compacta: Acciones Externas Nativas -->
      <div class="flex gap-2 pt-2 border-t border-border/50">
        <a
          :href="orden.linkGoogleMaps || `https://maps.google.com/?q=${encodeURIComponent(orden.activoNombre + ' ' + orden.ubicacion)}`" 
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-border bg-transparent text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground active:scale-[0.98] transition-all"
        >
          <Navigation class="w-3.5 h-3.5" /> Abrir Mapa
        </a>
        <a
          :href="orden.telefonoContacto ? `tel:${orden.telefonoContacto}` : 'tel:+123456789'" 
          class="flex-1 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-border bg-transparent text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground active:scale-[0.98] transition-all"
        >
          <PhoneCall class="w-3.5 h-3.5" /> {{ orden.telefonoContacto ? 'Llamar al Cliente' : 'Llamar a Central' }}
        </a>
      </div>
    </div>

    <!-- 3. Reporte del Problema (Callout) -->
    <div class="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-2">
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <AlertCircle class="w-4 h-4" />
        <span class="text-xs font-semibold uppercase tracking-wider">Reporte del Cliente</span>
      </div>
      <p class="text-sm text-foreground leading-relaxed">{{ orden.descripcion }}</p>
    </div>

    <!-- 4. Inventario de Materiales Pre-Asignados -->
    <div v-if="orden.repuestosPreAsignados && orden.repuestosPreAsignados.length > 0" class="space-y-2">
      <div class="flex items-center gap-1.5 text-muted-foreground pl-1 mb-2">
        <Package class="w-4 h-4" />
        <span class="text-xs font-semibold uppercase tracking-wider">Materiales Requeridos</span>
      </div>
      <div class="bg-card border border-border rounded-xl shadow-sm divide-y divide-border/50">
        <div 
          v-for="rep in orden.repuestosPreAsignados" 
          :key="rep.repuestoId" 
          class="flex items-center justify-between p-3"
        >
          <span class="text-sm font-medium text-foreground">{{ rep.nombre }}</span>
          <Badge variant="secondary" class="bg-muted/50 text-muted-foreground font-semibold border border-border/50">x{{ rep.cantidad }} uds</Badge>
        </div>
      </div>
    </div>

  </div>

  <!-- Bottom Action Bar (Fixed) -->
  <div 
    v-if="orden"
    class="fixed bottom-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border p-3"
  >
    <div class="max-w-md mx-auto flex items-center gap-3">
      <Button 
        variant="outline" 
        class="flex-1 h-12 text-destructive border-destructive/30 hover:bg-destructive/10 active:scale-95 transition-transform gap-2"
        @click="isRechazarOpen = true"
        :disabled="isIniciando"
      >
        <XCircle class="w-4 h-4" /> Rechazar
      </Button>
      
      <Button 
        class="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base active:scale-95 transition-transform gap-2 shadow-lg shadow-emerald-500/20"
        @click="iniciarTrabajo"
        :disabled="isIniciando"
      >
        <span v-if="isIniciando" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
        <template v-else>
          <Play class="w-5 h-5 fill-current" /> Comenzar Trabajo
        </template>
      </Button>
    </div>
  </div>

  <!-- Modal de Rechazo -->
  <AlertDialog :open="isRechazarOpen" @update:open="isRechazarOpen = $event">
    <AlertDialogContent class="max-w-[320px] rounded-2xl p-5">
      <AlertDialogHeader>
        <AlertDialogTitle>Rechazar Orden</AlertDialogTitle>
        <AlertDialogDescription>
          Indica el motivo por el cual no puedes tomar este trabajo.
        </AlertDialogDescription>
      </AlertDialogHeader>
      
      <div class="py-2">
        <Textarea 
          v-model="motivoRechazo" 
          placeholder="Ej: El equipo no se encuentra en el domicilio..."
          class="min-h-[100px] resize-none"
        />
      </div>

      <AlertDialogFooter class="flex flex-row items-center gap-2 sm:gap-0 mt-2">
        <AlertDialogCancel class="mt-0 flex-1" :disabled="isRechazando">Cancelar</AlertDialogCancel>
        <AlertDialogAction 
          @click.prevent="confirmarRechazo" 
          class="flex-[2] bg-destructive text-destructive-foreground hover:bg-destructive/90 m-0"
          :disabled="isRechazando || motivoRechazo.trim().length < 5"
        >
          <span v-if="isRechazando" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          Rechazar
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

</template>
