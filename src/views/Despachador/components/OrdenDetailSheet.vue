<script setup lang="ts">
/**
 * OrdenDetailSheet.vue — Panel lateral de solo lectura para el detalle completo
 * de una Orden de Trabajo.
 *
 * Características clave:
 * - DOMPurify sanitiza las notas del técnico antes de v-html (prevención XSS).
 * - Sección de resolución solo visible cuando estado === 'Completada'.
 * - CSS de impresión integrado: window.print() genera un documento A4 limpio.
 * - Desglose financiero con subtotales de repuestos y costo total formateado.
 */

import { ref, computed, watch } from 'vue'
import DOMPurify from 'dompurify'
import { OrdenesService } from '@/services/ordenes.service'
import type { OrdenDetalleDto, OrdenPrioridad, OrdenEstado } from '@/services/ordenes.service'
import { UsuariosService } from '@/services/usuarios.service'
import type { UsuarioResponseDto } from '@/services/usuarios.service'
import { useAppFeedback } from '@/composables/useAppFeedback'

// shadcn-vue
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

// Lucide icons
import {
  Printer,
  MapPin,
  User,
  Wrench,
  CalendarCheck,
  Camera,
  PenLine,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Phone,
  Maximize2,
  X
} from 'lucide-vue-next'

// ─── Props & Emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  modelValue: boolean
  ordenId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'saved'): void
}>()

// ─── Estado ───────────────────────────────────────────────────────────────────

const orden = ref<OrdenDetalleDto | null>(null)
const isLoading = ref(false)
const loadError = ref<string | null>(null)
const tecnicos = ref<UsuarioResponseDto[]>([])
const isReasignando = ref(false)
const feedback = useAppFeedback()

// ─── Computed de Seguridad XSS ────────────────────────────────────────────────
// DOMPurify permite solo tags seguros (p, b, i, ul, li…) y elimina
// scripts, event handlers y cualquier vector de inyección conocido.

const notasSanitizadas = computed((): string => {
  if (!orden.value?.notasTecnico) return ''
  return DOMPurify.sanitize(orden.value.notasTecnico, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'h3', 'h4'],
    ALLOWED_ATTR: [],
  })
})

// ─── Helpers de UI ────────────────────────────────────────────────────────────

interface BadgeStyle { class: string; label: string }

function getPrioridadBadge(prioridad: OrdenPrioridad): BadgeStyle {
  const map: Record<OrdenPrioridad, BadgeStyle> = {
    Alta:  { class: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',   label: 'Alta' },
    Media: { class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent', label: 'Media' },
    Baja:  { class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent', label: 'Baja' },
  }
  return map[prioridad]
}

function getEstadoBadge(estado: OrdenEstado): BadgeStyle {
  const map: Record<OrdenEstado, BadgeStyle> = {
    Completada: { class: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent', label: 'Completada' },
    Pendiente:  { class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',  label: 'Pendiente' },
    EnProgreso: { class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',  label: 'En Progreso' },
    Pausada:    { class: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-transparent', label: 'Pausada' },
    Cancelada:  { class: 'bg-muted text-muted-foreground border-transparent', label: 'Cancelada' },
  }
  return map[estado]
}

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function formatMoneda(valor: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(valor)
}

function obtenerUrlFoto(ruta: string | null | undefined): string {
  if (!ruta) return ''
  if (ruta.startsWith('http') || ruta.startsWith('data:')) return ruta
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || ''
  return `${baseUrl}${ruta}`
}

// ─── Zoom / Lightbox ──────────────────────────────────────────────────────────
const isZoomOpen = ref(false)
const zoomImageUrl = ref<string | null>(null)

function abrirZoom(url: string | null | undefined) {
  if (!url) return
  zoomImageUrl.value = obtenerUrlFoto(url)
  isZoomOpen.value = true
}

// ─── Lógica de Impresión ──────────────────────────────────────────────────────
// window.print() abre el diálogo de impresión del navegador.
// El @media print en <style scoped> oculta el chrome del Sheet y fuerza
// fondo blanco y texto negro para una hoja A4 legible.

function imprimirOrden(): void {
  window.print()
}

// ─── Lógica de Reasignación ───────────────────────────────────────────────────

async function reasignarTecnico(nuevoId: number) {
  if (!orden.value) return
  isReasignando.value = true
  try {
    await OrdenesService.reasignar(orden.value.id, nuevoId)
    feedback.showSuccess('Orden reasignada exitosamente')
    
    const tech = tecnicos.value.find(t => t.id === nuevoId)
    if (tech) orden.value.tecnicoNombre = tech.nombreCompleto
    
    emit('saved')
  } catch (err) {
    feedback.showErrorModal('No se pudo reasignar la orden. Verifique su conexión e inténtalo de nuevo.')
  } finally {
    isReasignando.value = false
  }
}

// ─── Watcher: fetch al abrir ──────────────────────────────────────────────────

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (!isOpen) {
      // Al cerrar, limpiamos con un pequeño delay para evitar flicker
      setTimeout(() => {
        orden.value = null
        loadError.value = null
      }, 300)
      return
    }

    if (!props.ordenId) return

    isLoading.value = true
    loadError.value = null
    orden.value = null

    try {
      orden.value = await OrdenesService.obtenerPorId(props.ordenId)
      
      if (tecnicos.value.length === 0) {
        UsuariosService.obtenerTodos('Tecnico')
          .then(res => tecnicos.value = res.data)
          .catch(() => {})
      }
    } catch {
      loadError.value = 'No se pudo cargar el detalle de la orden. Intenta de nuevo.'
    } finally {
      isLoading.value = false
    }
  }
)


</script>

<template>
  <Sheet
    :open="modelValue"
    @update:open="(val) => emit('update:modelValue', val)"
  >
    <SheetContent
      side="right"
      class="w-full sm:max-w-2xl h-full flex flex-col p-0 print:shadow-none print:border-none [&>button]:hidden"
      @pointer-down-outside="(e) => { if (isZoomOpen) e.preventDefault() }"
      @interact-outside="(e) => { if (isZoomOpen) e.preventDefault() }"
    >
      <!-- ── Cabecera ─────────────────────────────────────────────────────── -->
      <SheetHeader class="px-6 py-5 border-b border-border shrink-0 print:border-b-2 print:border-black">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-2 min-w-0">
            <SheetTitle class="text-base font-semibold text-foreground leading-snug truncate">
              <template v-if="orden">
                Orden #{{ orden.id }} — {{ orden.titulo }}
              </template>
              <template v-else>Cargando orden…</template>
            </SheetTitle>

            <!-- Badges de estado y prioridad -->
            <div v-if="orden" class="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                :class="getEstadoBadge(orden.estado).class"
                class="text-xs font-medium px-2 py-0.5"
              >
                {{ getEstadoBadge(orden.estado).label }}
              </Badge>
              <Badge
                variant="outline"
                :class="getPrioridadBadge(orden.prioridad).class"
                class="text-xs font-medium px-2 py-0.5"
              >
                Prioridad {{ getPrioridadBadge(orden.prioridad).label }}
              </Badge>
            </div>

            <SheetDescription class="text-sm text-muted-foreground sr-only">
              Vista de detalle de la orden de trabajo.
            </SheetDescription>
          </div>

          <div class="flex items-center gap-2">
            <!-- Botón de Reasignar -->
            <Popover v-if="orden && orden.estado === 'Pendiente'">
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="shrink-0 print:hidden" :disabled="isReasignando">
                  <Loader2 v-if="isReasignando" class="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Reasignar
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" class="w-56 p-3">
                <p class="text-sm font-semibold mb-3">Seleccionar nuevo técnico</p>
                <div class="space-y-1 max-h-48 overflow-y-auto">
                  <Button
                    v-for="tec in tecnicos"
                    :key="tec.id"
                    variant="ghost"
                    size="sm"
                    class="w-full justify-start text-left"
                    @click="reasignarTecnico(tec.id)"
                  >
                    {{ tec.nombreCompleto }}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <!-- Botón de impresión (oculto al imprimir) -->
            <Button
              v-if="orden"
              variant="outline"
              size="sm"
              class="shrink-0 gap-1.5 print:hidden"
              @click="imprimirOrden"
            >
              <Printer class="w-3.5 h-3.5" />
              Imprimir
            </Button>
          </div>
        </div>
      </SheetHeader>

      <!-- ── Estado de Carga ──────────────────────────────────────────────── -->
      <div v-if="isLoading" class="flex-1 flex items-center justify-center">
        <div class="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 class="w-7 h-7 animate-spin" />
          <p class="text-sm">Cargando detalle…</p>
        </div>
      </div>

      <!-- ── Estado de Error ─────────────────────────────────────────────── -->
      <div v-else-if="loadError" class="flex-1 flex items-center justify-center px-6">
        <div class="flex flex-col items-center gap-3 text-center">
          <AlertTriangle class="w-8 h-8 text-destructive opacity-70" />
          <p class="text-sm font-medium text-foreground">Error al cargar</p>
          <p class="text-xs text-muted-foreground">{{ loadError }}</p>
          <Button variant="outline" size="sm" @click="emit('update:modelValue', false)">
            Cerrar
          </Button>
        </div>
      </div>

      <!-- ── Contenido Principal ─────────────────────────────────────────── -->
      <div v-else-if="orden" class="flex-1 overflow-y-auto p-6">
        <div class="space-y-6 print:px-0 print:py-4">

          <!-- ─ Sección 1: Información General ─────────────────────────── -->
          <section>
            <h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Información General
            </h2>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3.5">

              <div class="space-y-0.5">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wrench class="w-3 h-3" /> Activo / Máquina
                </dt>
                <dd class="text-sm font-medium text-foreground">{{ orden.activoNombre }}</dd>
              </div>

              <div class="space-y-0.5">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin class="w-3 h-3" /> Ubicación
                </dt>
                <dd class="text-sm font-medium text-foreground">
                  <a 
                    v-if="orden.linkGoogleMaps" 
                    :href="orden.linkGoogleMaps" 
                    target="_blank" 
                    class="text-primary hover:underline flex items-center gap-1"
                  >
                    {{ orden.ubicacion }}
                    <ExternalLink class="w-3 h-3" />
                  </a>
                  <span v-else>{{ orden.ubicacion || '—' }}</span>
                </dd>
              </div>

              <!-- Contacto en Sitio -->
              <div class="space-y-0.5" v-if="orden.telefonoContacto">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone class="w-3 h-3" /> Contacto en Sitio
                </dt>
                <dd class="text-sm font-medium text-foreground">
                  <a :href="`tel:${orden.telefonoContacto}`" class="text-primary hover:underline">
                    {{ orden.telefonoContacto }}
                  </a>
                </dd>
              </div>

              <div class="space-y-0.5">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User class="w-3 h-3" /> Cliente
                </dt>
                <dd class="text-sm font-medium text-foreground">{{ orden.clienteHistorico || '—' }}</dd>
              </div>

              <div class="space-y-0.5">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wrench class="w-3 h-3" /> Técnico Asignado
                </dt>
                <dd class="text-sm font-medium text-foreground">{{ orden.tecnicoNombre }}</dd>
              </div>

              <div class="col-span-2 space-y-0.5">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarCheck class="w-3 h-3" /> Fecha de Creación
                </dt>
                <dd class="text-sm font-medium text-foreground">{{ formatFecha(orden.fechaCreacion) }}</dd>
              </div>

              <div v-if="orden.fechaCompletada" class="col-span-2 space-y-0.5">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarCheck class="w-3 h-3 text-emerald-500" /> Fecha de Completado
                </dt>
                <dd class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {{ formatFecha(orden.fechaCompletada) }}
                </dd>
              </div>

            </dl>
          </section>

          <!-- ─ Sección 2: El Problema ──────────────────────────────────── -->
          <section>
            <h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Descripción del Problema
            </h2>
            <div class="bg-muted/50 p-4 rounded-lg">
              <p class="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {{ orden.descripcion || 'Sin descripción registrada.' }}
              </p>
            </div>
          </section>

          <!-- ─ Sección: Repuestos Reservados (solo si NO completada) ────────────────── -->
          <div v-if="orden.estado !== 'Completada' && orden.repuestos && orden.repuestos.length > 0">
            <h4 class="text-sm font-semibold text-foreground mb-3">
              Repuestos Reservados
            </h4>
            <div>
              <div 
                v-for="rep in orden.repuestos" 
                :key="rep.repuestoNombre"
                class="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
              >
                <span class="text-sm text-foreground">{{ rep.repuestoNombre }}</span>
                <span class="text-sm font-medium text-muted-foreground">{{ rep.cantidad }}</span>
              </div>
            </div>
          </div>

          <!-- ─ Sección 3: Resolución y Costos (solo si Completada) ────── -->
          <template v-if="orden.estado === 'Completada'">
            <Separator class="print:border-black" />

            <!-- Título de resolución -->
            <section>
              <h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Resolución del Trabajo
              </h2>

              <!-- Notas del Técnico (XSS-safe con DOMPurify) -->
              <div v-if="orden.notasTecnico" class="space-y-2">
                <h3 class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <PenLine class="w-3.5 h-3.5 text-muted-foreground" />
                  Notas del Técnico
                </h3>
                <!-- DOMPurify sanitiza el HTML antes de renderizarlo. -->
                <!-- NUNCA usar v-html con datos del usuario sin sanitizar. -->
                <div
                  class="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4 text-foreground [&_p]:text-foreground [&_li]:text-foreground"
                  v-html="notasSanitizadas"
                />
              </div>
              <p v-else class="text-sm text-muted-foreground italic">Sin notas del técnico.</p>
            </section>

            <!-- Evidencia Fotográfica -->
            <section v-if="orden.fotosUrl && orden.fotosUrl.length > 0" class="space-y-3">
              <h3 class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Camera class="w-3.5 h-3.5 text-muted-foreground" />
                Evidencia Fotográfica
              </h3>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div 
                  v-for="(foto, idx) in orden.fotosUrl" 
                  :key="idx"
                  class="aspect-square rounded-xl overflow-hidden border border-border bg-muted/20 relative group"
                >
                  <img
                    :src="obtenerUrlFoto(foto)"
                    alt="Evidencia fotográfica"
                    class="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform"
                    @click="abrirZoom(foto)"
                  />
                  <div class="absolute bottom-1.5 right-1.5 p-1 bg-black/60 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Maximize2 class="w-3 h-3" />
                  </div>
                </div>
              </div>
            </section>


            <!-- Desglose Financiero -->
            <section class="space-y-3">
              <h3 class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <DollarSign class="w-3.5 h-3.5 text-muted-foreground" />
                Desglose Financiero
              </h3>
              <div class="bg-muted/30 border border-border rounded-xl p-5 space-y-4">
                <div class="space-y-3 text-sm">
                  <!-- Mano de Obra -->
                  <div class="flex justify-between items-center text-muted-foreground">
                    <div class="flex flex-col">
                      <span class="text-foreground font-medium">Mano de Obra</span>
                      <span class="text-xs">{{ orden.horasTrabajadas }} horas &times; {{ formatMoneda(orden.tarifaTecnico) }}/hr</span>
                    </div>
                    <span class="font-medium text-foreground">{{ formatMoneda(orden.subtotalManoObra) }}</span>
                  </div>

                  <!-- Repuestos Usados Detallados -->
                  <template v-if="orden.repuestos && orden.repuestos.length > 0">
                    <Separator class="bg-border/50 my-2" />
                    <div class="space-y-2">
                      <span class="text-foreground font-medium block">Repuestos Usados</span>
                      <div 
                        v-for="rep in orden.repuestos" 
                        :key="rep.repuestoNombre"
                        class="flex justify-between items-center text-muted-foreground"
                      >
                        <div class="flex items-center gap-2">
                          <span>{{ rep.repuestoNombre }}</span>
                          <Badge variant="outline" class="text-[10px] px-1 py-0 h-4 border-transparent bg-muted text-muted-foreground">x{{ rep.cantidad }}</Badge>
                        </div>
                        <span>{{ formatMoneda(rep.cantidad * rep.precioHistorico) }}</span>
                      </div>
                      <div class="flex justify-between items-center text-muted-foreground pt-1 border-t border-border/40 border-dashed mt-2">
                        <span class="italic text-xs">Subtotal Repuestos</span>
                        <span class="font-medium text-foreground">{{ formatMoneda(orden.subtotalRepuestos) }}</span>
                      </div>
                    </div>
                  </template>
                </div>

                <Separator class="bg-border" />
                <div class="flex justify-between items-center">
                  <span class="font-bold text-foreground">Total</span>
                  <span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                    {{ formatMoneda(orden.costoTotal) }}
                  </span>
                </div>
              </div>
            </section>

            <!-- Firma del Cliente -->
            <section v-if="orden.firmaClienteBase64" class="space-y-2">
              <h3 class="text-sm font-semibold text-foreground">Firma de Conformidad del Cliente</h3>
              <div class="flex items-center justify-center p-3 border border-border rounded-xl bg-white h-44 overflow-hidden relative group shadow-sm">
                <img
                  :src="obtenerUrlFoto(orden.firmaClienteBase64)"
                  alt="Firma del cliente"
                  class="max-h-full max-w-full object-contain cursor-zoom-in select-none"
                  @click="abrirZoom(orden.firmaClienteBase64)"
                />
                <div class="absolute bottom-2 right-2 p-1.5 bg-black/60 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <Maximize2 class="w-3.5 h-3.5" />
                </div>
              </div>
            </section>

          </template>
          <!-- Fin de la sección condicional Completada -->

          <!-- Estado de Orden No Completada (info amigable) -->
          <div
            v-if="orden.estado !== 'Completada'"
            class="rounded-lg border border-dashed border-border p-5 text-center text-muted-foreground"
          >
            <Wrench class="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p class="text-sm">La sección de resolución estará disponible cuando la orden sea marcada como <strong class="text-foreground">Completada</strong>.</p>
          </div>

        </div>
      </div>

      <!-- ── Footer ───────────────────────────────────────────────────────── -->
      <div
        v-if="!isLoading && !loadError"
        class="shrink-0 border-t border-border p-4 flex justify-end bg-card print:hidden"
      >
        <Button
          variant="outline"
          @click="emit('update:modelValue', false)"
        >
          Cerrar
        </Button>
      </div>
    </SheetContent>
  </Sheet>

  <!-- Modal Lightbox (Zoom en Pantalla Completa) -->
  <Teleport to="body">
    <div 
      v-if="isZoomOpen && zoomImageUrl" 
      class="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
      style="pointer-events: auto !important;"
      @click.self="isZoomOpen = false"
    >
        <button 
          type="button" 
          class="absolute top-5 right-5 text-white/80 hover:text-white bg-black/60 hover:bg-black/90 rounded-full p-2.5 transition-colors z-[10000] cursor-pointer shadow-lg"
          @click.stop="isZoomOpen = false"
          @pointerdown.stop
        >
          <X class="w-6 h-6 pointer-events-none" />
        </button>
        <img 
          :src="zoomImageUrl" 
          class="max-w-[90vw] max-h-[85vh] object-contain shadow-2xl rounded-xl bg-white p-2 select-none"
        @click.stop 
      />
    </div>
  </Teleport>
</template>

<style scoped>
@media print {
  @page { margin: 1.5cm; size: A4 portrait; }
  body { margin: 0; padding: 0; background: white; }
  :deep([data-slot="sheet-content"]) {
    position: static !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    transform: none !important;
  }
  :deep([data-slot="sheet-overlay"]), .print\:hidden { display: none !important; }
}
</style>
