<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TecnicoService } from '@/services/tecnico.service'
import type { OrdenDetalleDto } from '@/services/ordenes.service'
import DOMPurify from 'dompurify'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, MapPin, Package, Wrench, CheckCircle2, XCircle } from 'lucide-vue-next'
import { useAppFeedback } from '@/composables/useAppFeedback'

const route = useRoute()
const router = useRouter()
const feedback = useAppFeedback()

const orden = ref<OrdenDetalleDto | null>(null)
const isLoading = ref(true)

onMounted(async () => {
  const idStr = route.params.id as string
  if (!idStr) {
    router.replace('/tecnico/historial')
    return
  }

  const id = parseInt(idStr, 10)
  try {
    orden.value = await TecnicoService.obtenerDetalleOrden(id)
  } catch (error) {
    console.error('Error al obtener el detalle de la orden:', error)
    feedback.showErrorModal('No se pudo cargar el detalle de la orden.')
    router.replace('/tecnico/historial')
  } finally {
    isLoading.value = false
  }
})

const notasSanitizadas = computed(() => {
  if (!orden.value || !orden.value.notasTecnico) return ''
  return DOMPurify.sanitize(orden.value.notasTecnico, { ALLOWED_ATTR: [] })
})

function formatFecha(fecha: string) {
  const d = new Date(fecha)
  return d.toLocaleString()
}

function obtenerUrlFoto(ruta: string | null | undefined): string {
  if (!ruta) return ''
  if (ruta.startsWith('http') || ruta.startsWith('data:')) return ruta
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || ''
  return `${baseUrl}${ruta}`
}

// ─── Lightbox / Zoom de Foto ───
const isImageZoomed = ref(false)
const fotoPreview = ref<string | null>(null)

function abrirZoom(url: string) {
  fotoPreview.value = obtenerUrlFoto(url)
  isImageZoomed.value = true
}

function cerrarZoom() {
  isImageZoomed.value = false
  fotoPreview.value = null
}
</script>

<template>
  <div v-if="isLoading" class="p-4 flex justify-center items-center mt-20 w-full min-h-screen bg-background">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>

  <div v-else-if="orden" class="max-w-md mx-auto w-full pb-10 min-h-screen bg-background">
    <!-- Cabecera Fija (Top) -->
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border p-4 space-y-3">
      <!-- Fila 1 -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button 
            @click="router.back()" 
            class="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 text-foreground active:scale-95 transition-transform"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <span class="font-mono text-sm text-muted-foreground font-medium">Orden #{{ orden.id }}</span>
        </div>
        <Badge class="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent text-[10px]" variant="outline">
          Completada
        </Badge>
      </div>
      
      <!-- Fila 2 -->
      <h1 class="text-lg font-bold leading-tight text-foreground">
        {{ orden.titulo }}
      </h1>
    </div>

    <!-- Cuerpo (Scroll Continuo) -->
    <div class="p-4 space-y-6">
      
      <!-- Bloque 1: Información General -->
      <div class="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
            <Wrench class="w-4 h-4" />
          </div>
          <span class="font-semibold text-sm text-foreground">{{ orden.activoNombre }}</span>
        </div>
        <div class="flex items-start gap-3 text-muted-foreground">
          <MapPin class="w-4 h-4 shrink-0 mt-0.5" />
          <span class="text-xs leading-tight">{{ orden.ubicacion }}</span>
        </div>
        <div class="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 pt-2 border-t border-border/50">
          <CheckCircle2 class="w-4 h-4 shrink-0" />
          <span class="text-xs font-medium">
            Completado el {{ orden.fechaCompletada ? formatFecha(orden.fechaCompletada) : 'N/A' }}
          </span>
        </div>
      </div>

      <!-- Bloque 2: Reporte Original -->
      <div>
        <h3 class="text-xs font-semibold text-muted-foreground mb-2 px-1">Reporte del Cliente</h3>
        <div class="bg-muted/30 border border-border/60 p-3 rounded-xl text-sm text-foreground leading-relaxed">
          {{ orden.descripcion || 'Sin descripción registrada.' }}
        </div>
      </div>

      <!-- Bloque 3: Resolución del Técnico -->
      <div>
        <h3 class="text-xs font-semibold text-muted-foreground mb-2 px-1">Tu Reporte de Trabajo</h3>
        <div class="bg-muted/30 border border-border/60 p-3 rounded-xl text-sm text-foreground leading-relaxed">
          <div 
            v-if="notasSanitizadas" 
            class="prose prose-sm dark:prose-invert max-w-none" 
            v-html="notasSanitizadas"
          ></div>
          <div v-else>No hay notas registradas.</div>
        </div>
      </div>

      <!-- Bloque 4: Repuestos Usados -->
      <div v-if="orden.repuestos && orden.repuestos.length > 0">
        <div class="flex items-center gap-2 mb-2 px-1">
          <Package class="w-4 h-4 text-muted-foreground" />
          <h3 class="text-xs font-semibold text-muted-foreground">Materiales Utilizados</h3>
        </div>
        <div class="bg-card border border-border rounded-xl divide-y divide-border/50 overflow-hidden shadow-sm">
          <div 
            v-for="rep in orden.repuestos" 
            :key="rep.repuestoNombre" 
            class="p-3 flex justify-between items-center"
          >
            <span class="text-sm font-medium text-foreground">{{ rep.repuestoNombre }}</span>
            <Badge variant="secondary" class="text-xs shrink-0 bg-muted text-muted-foreground">
              x{{ rep.cantidad }} uds
            </Badge>
          </div>
        </div>
      </div>

      <!-- Bloque 5: Evidencia y Firma -->
      <div v-if="(orden.fotosUrl && orden.fotosUrl.length > 0) || orden.firmaClienteBase64">
        <h3 v-if="orden.fotosUrl && orden.fotosUrl.length > 0" class="text-xs font-semibold text-muted-foreground mb-2 px-1">Evidencia Fotográfica</h3>
        
        <div v-if="orden.fotosUrl && orden.fotosUrl.length > 0" class="grid grid-cols-2 gap-3 mb-4">
          <img 
            v-for="(url, idx) in orden.fotosUrl" 
            :key="idx" 
            :src="obtenerUrlFoto(url)" 
            class="aspect-square object-cover w-full rounded-xl border border-border bg-muted cursor-zoom-in active:scale-95 transition-transform"
            alt="Evidencia fotográfica"
            @click="abrirZoom(url)"
          />
        </div>
        
        <Separator v-if="(orden.fotosUrl && orden.fotosUrl.length > 0) && orden.firmaClienteBase64" class="my-4" />

        <div v-if="orden.firmaClienteBase64">
          <h3 class="text-xs font-semibold text-muted-foreground mb-2 px-1">Firma de Conformidad</h3>
          <div class="bg-white border border-border rounded-xl p-2 h-32 flex items-center justify-center shadow-sm">
            <img :src="obtenerUrlFoto(orden.firmaClienteBase64)" class="max-h-full max-w-full object-contain" alt="Firma del cliente" />
          </div>
        </div>
      </div>
      
    </div>
  </div>

  <!-- Lightbox (Zoom Fotografía en Pantalla Completa) -->
  <Teleport to="body">
    <div 
      v-if="isImageZoomed && fotoPreview" 
      class="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity cursor-zoom-out"
      style="pointer-events: auto !important;"
      @click.self="cerrarZoom"
    >
      <button 
        type="button"
        class="absolute top-4 right-4 text-white/80 hover:text-white p-2 bg-black/50 hover:bg-black/80 rounded-full transition-colors cursor-pointer"
        style="pointer-events: auto !important;"
        @click="cerrarZoom"
      >
        <XCircle class="w-8 h-8 pointer-events-none" />
      </button>
      <img 
        :src="fotoPreview" 
        class="max-w-full max-h-full object-contain shadow-2xl rounded-lg cursor-default select-none animate-in zoom-in-95 duration-200"
        style="pointer-events: auto !important;"
        @click.stop
      />
    </div>
  </Teleport>
</template>
