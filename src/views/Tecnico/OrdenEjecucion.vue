<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { dbOrdenes, dbCatalogo, useSyncStore } from '@/store/sync.store'
import { useAppFeedback } from '@/composables/useAppFeedback'
import { TecnicoService } from '@/services/tecnico.service'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

import {
  ArrowLeft,
  PhoneCall,
  ChevronDown,
  ChevronUp,
  Navigation,
  Wrench,
  Package,
  Camera,
  AlertCircle,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  MapPin,
  XCircle,
  Play
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const feedback = useAppFeedback()
const syncStore = useSyncStore()

const orden = ref<any | null>(null)
const isLoading = ref(true)

// -- Fase 4: Múltiples pasos abiertos --
const pasosAbiertos = ref<number[]>([1])

// -- Fase 2: Catálogo Offline --
interface CatalogoItem {
  id: number;
  nombre: string;
  precio: number;
  stockDisponible: number;
}
interface RepuestoSeleccionado {
  id: number;
  nombre: string;
  cantidad: number;
  stockDisponible: number;
}

const catalogoOffline = ref<CatalogoItem[]>([])
const isCatalogoOpen = ref(false)
const searchRepuesto = ref('')
const debouncedSearchRepuesto = refDebounced(searchRepuesto, 300)

const catalogoFiltrado = computed(() => {
  if (!debouncedSearchRepuesto.value.trim()) return catalogoOffline.value
  const query = debouncedSearchRepuesto.value.toLowerCase()
  return catalogoOffline.value.filter(item => item.nombre.toLowerCase().includes(query))
})

const form = ref({
  horasTrabajadas: '' as number | '',
  notasTecnico: '',
  repuestos: [] as RepuestoSeleccionado[],
  fotosBase64: [] as string[],
  firmaBase64: null as string | null
})

// Auto-Guardado Infalible
watch(form, async (newVal) => {
  if (orden.value) {
    await dbOrdenes.setItem('draft_orden_' + orden.value.id, JSON.parse(JSON.stringify(newVal)))
  }
}, { deep: true })

// -- Fase 3: Hardware y Multimedia --
const fileInputRef = ref<HTMLInputElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let isDrawing = false
let hasDrawn = false

// Lightbox
const isImageZoomed = ref(false)
const fotoPreview = ref<string | null>(null)

function abrirZoom(base64: string) {
  fotoPreview.value = base64
  isImageZoomed.value = true
}

function cerrarZoom() {
  isImageZoomed.value = false
  fotoPreview.value = null
}

// -- Fase 4: Pausa y Completado --
const isPausarOpen = ref(false)
const motivoPausa = ref('')
const isPausando = ref(false)
const isCompletando = ref(false)
const isReanudando = ref(false)

function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

async function procesarFoto(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const file = target.files[0]
  if (!file.type.startsWith('image/')) {
    feedback.showErrorModal('El archivo seleccionado no es una imagen válida.')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string
    const img = new Image()
    img.onload = () => {
      let width = img.width
      let height = img.height

      const MAX_WIDTH = 1200
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width)
        width = MAX_WIDTH
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85)
        if (form.value.fotosBase64.length < 5) {
          form.value.fotosBase64.push(compressedBase64)
        }
      }
    }
    img.src = dataUrl
  }
  reader.readAsDataURL(file)
}

function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
}

function startDrawing(e: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.setPointerCapture(e.pointerId)
  isDrawing = true
  hasDrawn = true
  const rect = canvas.getBoundingClientRect()
  ctx.beginPath()
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
}

function draw(e: PointerEvent) {
  if (!isDrawing) return
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rect = canvas.getBoundingClientRect()
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
  ctx.stroke()
}

function stopDrawing(e: PointerEvent) {
  if (!isDrawing) return
  isDrawing = false
  const canvas = canvasRef.value
  if (canvas) {
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {}
  }
}

function limpiarFirma() {
  const canvas = canvasRef.value
  if (canvas) {
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
  form.value.firmaBase64 = null
  hasDrawn = false
  setTimeout(initCanvas, 50)
}

function guardarFirma() {
  const canvas = canvasRef.value
  if (!canvas || !hasDrawn) {
    feedback.showErrorModal('Debes dibujar la firma en el recuadro antes de guardar')
    return
  }
  form.value.firmaBase64 = canvas.toDataURL('image/png')
  feedback.showSuccess('Firma capturada exitosamente')
}

function abrirCamara() {
  fileInputRef.value?.click()
}

function eliminarFoto(index: number) {
  form.value.fotosBase64.splice(index, 1)
}

async function pausarOrden() {
  if (!motivoPausa.value.trim() || !orden.value) return
  isPausando.value = true
  try {
    if (syncStore.isOnline) {
      // 1. LLAMAMOS AL BACKEND PARA QUE REALMENTE SE PAUSE EN BD
      await TecnicoService.pausarOrden(orden.value.id, motivoPausa.value)
      // @ts-ignore
      if (feedback.showSuccess) feedback.showSuccess('Orden pausada correctamente.')
    } else {
      await syncStore.agregarASyncQueue({ motivoPausa: motivoPausa.value, ordenId: orden.value.id }, 'pausar')
      // @ts-ignore
      if (feedback.showSuccess) feedback.showSuccess('Pausa guardada offline. Se sincronizará al recuperar conexión.')
    }

    // 2. ACTUALIZAMOS EN INDEXEDDB A 'Pausada' (¡NO LA BORRAMOS!)
    const ordenesLocales = (await dbOrdenes.getItem<any[]>('mis_ordenes')) || []
    const idx = ordenesLocales.findIndex((o) => o.id === orden.value.id)
    if (idx !== -1) {
      ordenesLocales[idx].estado = 'Pausada'
      await dbOrdenes.setItem('mis_ordenes', ordenesLocales)
    }

    // 3. REDIRIGIMOS DIRECTAMENTE AL HISTORIAL (UN SOLO REPLACE)
    await router.replace('/tecnico/historial')
  } catch (error) {
    feedback.showErrorModal('Error al pausar la orden: Verifique su conexión o inténtelo más tarde')
  } finally {
    isPausando.value = false
    isPausarOpen.value = false
  }
}

async function reanudarOrden() {
  if (!orden.value) return
  isReanudando.value = true
  try {
    if (syncStore.isOnline) {
      await TecnicoService.reanudarOrden(orden.value.id)
    }
    
    // Update local state
    const ordenesLocales = await dbOrdenes.getItem<any[]>('mis_ordenes') || []
    const idx = ordenesLocales.findIndex(o => o.id === orden.value.id)
    if (idx !== -1) {
      ordenesLocales[idx].estado = 'EnProgreso'
      await dbOrdenes.setItem('mis_ordenes', ordenesLocales)
    }
    orden.value.estado = 'EnProgreso'
    
    // @ts-ignore
    if(feedback.showSuccess) feedback.showSuccess('Orden reanudada. Puedes continuar el trabajo.')
    // @ts-ignore
    else if(feedback.showSuccessToast) feedback.showSuccessToast('Orden reanudada. Puedes continuar el trabajo.')
  } catch (error) {
    feedback.showErrorModal('Error al reanudar la orden')
  } finally {
    isReanudando.value = false
  }
}

async function completarOrden() {
  if (!orden.value) return

  const errores: string[] = []
  
  if (!form.value.horasTrabajadas || Number(form.value.horasTrabajadas) <= 0) {
    errores.push('Horas trabajadas')
  }
  if (!form.value.notasTecnico.trim()) {
    errores.push('Reporte del trabajo')
  }
  if (!form.value.firmaBase64) {
    errores.push('Firma del cliente')
  }

  if (errores.length > 0) {
    feedback.showErrorModal('Faltan campos obligatorios: ' + errores.join(', '))
    return
  }

  isCompletando.value = true

  const formData = new FormData()
  formData.append('ordenId', orden.value.id.toString())
  formData.append('horasTrabajadas', form.value.horasTrabajadas.toString())
  formData.append('notasTecnico', form.value.notasTecnico.trim())

  form.value.fotosBase64.forEach((base64, idx) => {
    formData.append('fotos', base64ToFile(base64, `evidencia_${orden.value.id}_${idx}.jpg`))
  })
  
  if (form.value.firmaBase64) {
    formData.append('firma', base64ToFile(form.value.firmaBase64, `firma_${orden.value.id}.png`))
  }

  form.value.repuestos.forEach((rep, index) => {
    formData.append(`repuestos[${index}].repuestoId`, rep.id.toString())
    formData.append(`repuestos[${index}].cantidad`, rep.cantidad.toString())
  })

  try {
    if (syncStore.isOnline) {
      await TecnicoService.completarOrden(orden.value.id, formData)
      feedback.showSuccess('Orden completada exitosamente.')
    } else {
      // Guardamos el objeto limpio con Base64 (100% seguro para IndexedDB)
      await syncStore.agregarASyncQueue({
        ordenId: orden.value.id,
        horasTrabajadas: form.value.horasTrabajadas,
        notasTecnico: form.value.notasTecnico.trim(),
        fotosBase64: [...form.value.fotosBase64],
        firmaBase64: form.value.firmaBase64,
        repuestos: [...form.value.repuestos]
      }, 'completar')
      feedback.showSuccess('Guardado offline. Sincronización pendiente.')
    }

    await dbOrdenes.removeItem('draft_orden_' + orden.value.id)
    const ordenesLocales = await dbOrdenes.getItem<any[]>('mis_ordenes')
    if (ordenesLocales) {
      const filtradas = ordenesLocales.filter(o => o.id !== orden.value!.id)
      await dbOrdenes.setItem('mis_ordenes', filtradas)
    }

    router.replace('/tecnico/dashboard')
  } catch (error) {
    feedback.showErrorModal('Error al completar la orden: Verifique los datos o inténtelo más tarde.')
  } finally {
    isCompletando.value = false
  }
}

onMounted(async () => {
  const idStr = route.params.id as string
  if (!idStr) {
    router.replace('/tecnico/dashboard')
    return
  }

  const id = parseInt(idStr, 10)
  try {
    // 1. Cargamos PRIMERO el catálogo offline para tener los stocks reales en memoria
    const cat = await dbCatalogo.getItem<CatalogoItem[]>('catalogo')
    if (cat) catalogoOffline.value = cat

    // 2. Cargamos la orden
    const ordenes = await dbOrdenes.getItem<any[]>('mis_ordenes')
    if (ordenes) {
      const encontrada = ordenes.find(o => o.id === id)
      if (encontrada) {
        orden.value = encontrada
      }
    }

    if (!orden.value) {
      router.replace('/tecnico/dashboard')
      return
    }

    // 3. Cargamos el borrador (draft) o los repuestos pre-asignados
    const draft = await dbOrdenes.getItem<any>('draft_orden_' + id)
    if (draft) {
      form.value = draft
      if (!form.value.fotosBase64) form.value.fotosBase64 = []

      // FIX MAGISTRAL: Limpiamos el 999 viejo que quedó atrapado en el borrador
      form.value.repuestos.forEach((rep: RepuestoSeleccionado) => {
        const itemCat = catalogoOffline.value.find((c) => c.id === rep.id)
        if (itemCat) {
          rep.stockDisponible = itemCat.stockDisponible
        }
      })
    } else if (orden.value.repuestosPreAsignados && orden.value.repuestosPreAsignados.length > 0) {
      // Si es una orden limpia, inyectamos los pre-asignados con su stock real
      form.value.repuestos = orden.value.repuestosPreAsignados.map((r: any) => {
        const itemCat = catalogoOffline.value.find((c) => c.id === r.repuestoId)
        return {
          id: r.repuestoId,
          nombre: r.nombre,
          cantidad: r.cantidad,
          stockDisponible: itemCat ? itemCat.stockDisponible : 0
        }
      })
      await dbOrdenes.setItem('draft_orden_' + id, JSON.parse(JSON.stringify(form.value)))
    }
  } catch (err) {
    console.error('Error reading indexedDB', err)
  } finally {
    isLoading.value = false
  }
})

function setPaso(paso: number) {
  const idx = pasosAbiertos.value.indexOf(paso)
  if (idx !== -1) {
    pasosAbiertos.value.splice(idx, 1)
  } else {
    pasosAbiertos.value.push(paso)
    
    // Si abre el paso de Evidencia, inicializamos el canvas nativo
    if (paso === 4) {
      setTimeout(() => {
        initCanvas()
      }, 350)
    }

    setTimeout(() => {
      window.scrollTo({ top: window.scrollY + 100, behavior: 'smooth' })
    }, 100)
  }
}

function getBadgeProps(prioridad: string) {
  if (prioridad === 'Alta') return { class: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent' }
  if (prioridad === 'Media') return { class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent' }
  return { class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent' }
}

function agregarRepuesto(item: CatalogoItem) {
  const stock = item.stockDisponible ?? 0
  const idx = form.value.repuestos.findIndex(r => r.id === item.id)
  
  if (idx !== -1) {
    if (form.value.repuestos[idx].cantidad < stock) {
      form.value.repuestos[idx].cantidad++
    } else {
      feedback.showErrorModal(`Stock insuficiente: Solo hay ${stock} unidades disponibles.`)
    }
  } else {
    form.value.repuestos.push({ 
      id: item.id, 
      nombre: item.nombre, 
      cantidad: 1,
      stockDisponible: stock 
    })
  }
  isCatalogoOpen.value = false
  searchRepuesto.value = ''
}

function eliminarRepuesto(index: number) {
  form.value.repuestos.splice(index, 1)
}

function incrementar(index: number) {
  if (form.value.repuestos[index].cantidad < form.value.repuestos[index].stockDisponible) {
    form.value.repuestos[index].cantidad++
  } else {
    feedback.showErrorModal(`Stock insuficiente: Solo hay ${form.value.repuestos[index].stockDisponible} unidades disponibles.`)
  }
}

function decrementar(index: number) {
  if (form.value.repuestos[index].cantidad > 1) {
    form.value.repuestos[index].cantidad--
  } else {
    eliminarRepuesto(index)
  }
}
</script>

<template>
  <div v-if="isLoading" class="p-4 flex justify-center mt-10 w-full bg-background min-h-screen">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>

  <div v-else-if="orden" class="max-w-md mx-auto w-full pb-40 min-h-screen bg-background relative">
    <!-- Cabecera Fija (Top) -->
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border p-4 space-y-3">
      <!-- Fila 1 -->
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
      
      <!-- Fila 2 -->
      <h1 class="text-lg font-bold leading-tight text-foreground truncate">
        {{ orden.titulo }}
      </h1>
    </div>

    <!-- Cuerpo del Acordeón (Pasos) -->
    <div class="p-4 space-y-4">
      
      <!-- Paso 1: Diagnóstico -->
      <Card class="overflow-hidden border-border shadow-sm">
        <div 
          @click="setPaso(1)" 
          class="bg-muted/30 p-4 flex items-center justify-between cursor-pointer active:bg-accent transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
              1
            </div>
            <div class="flex items-center gap-1.5 font-semibold text-foreground">
              <AlertCircle class="w-4 h-4 text-muted-foreground" />
              Diagnóstico
            </div>
          </div>
          <ChevronUp v-if="pasosAbiertos.includes(1)" class="w-5 h-5 text-muted-foreground" />
          <ChevronDown v-else class="w-5 h-5 text-muted-foreground" />
        </div>
        
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-[-10px]"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-[-10px]"
        >
          <div v-show="pasosAbiertos.includes(1)">
            <div class="p-4 pt-2 space-y-4">
              
              <!-- Información del Activo y Ubicación -->
              <div class="bg-muted/30 p-3 rounded-xl border border-border/50 flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <Package class="w-4 h-4 text-primary" />
                  <span class="text-sm font-semibold text-foreground">{{ orden.activoNombre }}</span>
                </div>
                <div class="flex items-center gap-2 text-muted-foreground">
                  <MapPin class="w-4 h-4 shrink-0" />
                  <span class="text-xs leading-tight">{{ orden.ubicacion }}</span>
                </div>
              </div>

              <!-- Reporte del Cliente -->
              <div>
                <h4 class="text-xs font-semibold text-foreground mb-1">Reporte del problema:</h4>
                <div class="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl text-sm leading-relaxed">
                  {{ orden.descripcion || 'Sin descripción registrada.' }}
                </div>
              </div>

              <!-- Botones Nativos de Acción Rápida (movidos del header) -->
              <div class="flex gap-2">
                <Button
                  as="a"
                  :href="orden.linkGoogleMaps || `https://maps.google.com/?q=${encodeURIComponent(orden.activoNombre + ' ' + orden.ubicacion)}`" 
                  target="_blank"
                  variant="outline"
                  class="flex-1 active:scale-[0.98] transition-transform gap-2 h-11"
                >
                  <Navigation class="w-4 h-4" /> Mapa
                </Button>
                <Button
                  as="a"
                  :href="orden.telefonoContacto ? `tel:${orden.telefonoContacto}` : 'tel:+123456789'" 
                  variant="outline"
                  class="flex-1 active:scale-[0.98] transition-transform gap-2 h-11"
                >
                  <PhoneCall class="w-4 h-4" /> Llamar
                </Button>
              </div>
            </div>
          </div>
        </Transition>
      </Card>

      <!-- Paso 2: Materiales -->
      <Card class="overflow-hidden border-border shadow-sm">
        <div 
          @click="setPaso(2)" 
          class="bg-muted/30 p-4 flex items-center justify-between cursor-pointer active:bg-accent transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
              2
            </div>
            <div class="flex items-center gap-1.5 font-semibold text-foreground">
              <Package class="w-4 h-4 text-muted-foreground" />
              Materiales
            </div>
          </div>
          <ChevronUp v-if="pasosAbiertos.includes(2)" class="w-5 h-5 text-muted-foreground" />
          <ChevronDown v-else class="w-5 h-5 text-muted-foreground" />
        </div>
        
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-[-10px]"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-[-10px]"
        >
          <div v-show="pasosAbiertos.includes(2)">
            <div class="p-4 pt-2 space-y-4">
              
              <div v-if="form.repuestos.length === 0" class="flex flex-col items-center justify-center py-6 text-center space-y-2">
                <Package class="w-8 h-8 text-muted-foreground opacity-50" />
                <p class="text-sm text-muted-foreground">No has agregado materiales.</p>
              </div>

              <div v-else>
                <div 
                  v-for="(rep, idx) in form.repuestos" 
                  :key="rep.id"
                  class="bg-card border border-border rounded-xl p-3 flex flex-col gap-2 mb-3 shadow-sm"
                >
                  <div class="flex justify-between items-start">
                    <span class="text-sm font-medium text-foreground leading-tight pr-2">
                      {{ rep.nombre }}
                    </span>
                    <span class="text-xs text-muted-foreground whitespace-nowrap bg-muted px-2 py-0.5 rounded-md">
                      Stock: {{ rep.stockDisponible }}
                    </span>
                  </div>
                  <div class="flex justify-end items-center gap-3 mt-1">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      class="h-8 w-8 rounded-full shrink-0 active:scale-95"
                      @click="decrementar(idx)"
                    >
                      <Minus class="w-3 h-3" />
                    </Button>
                    <span class="w-4 text-center font-bold text-sm text-foreground">
                      {{ rep.cantidad }}
                    </span>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      class="h-8 w-8 rounded-full shrink-0 active:scale-95"
                      @click="incrementar(idx)"
                    >
                      <Plus class="w-3 h-3" />
                    </Button>
                    <div class="w-px h-6 bg-border mx-1"></div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      class="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0 active:scale-95"
                      @click="eliminarRepuesto(idx)"
                    >
                      <Trash2 class="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button 
                type="button" 
                variant="outline" 
                class="w-full border-dashed h-12 mt-2 gap-2 active:scale-[0.98]" 
                @click="isCatalogoOpen = true"
              >
                <Search class="w-4 h-4" /> Buscar en Catálogo
              </Button>
            </div>
          </div>
        </Transition>
      </Card>

      <!-- Paso 3: Ejecución -->
      <Card class="overflow-hidden border-border shadow-sm">
        <div 
          @click="setPaso(3)" 
          class="bg-muted/30 p-4 flex items-center justify-between cursor-pointer active:bg-accent transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
              3
            </div>
            <div class="flex items-center gap-1.5 font-semibold text-foreground">
              <Wrench class="w-4 h-4 text-muted-foreground" />
              Ejecución
            </div>
          </div>
          <ChevronUp v-if="pasosAbiertos.includes(3)" class="w-5 h-5 text-muted-foreground" />
          <ChevronDown v-else class="w-5 h-5 text-muted-foreground" />
        </div>
        
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-[-10px]"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-[-10px]"
        >
          <div v-show="pasosAbiertos.includes(3)">
            <div class="p-4 pt-2 space-y-4">
              <div class="space-y-1.5">
                <Label for="horasTrabajadas" class="text-sm font-medium text-foreground">Horas Trabajadas</Label>
                <Input 
                  id="horasTrabajadas" 
                  type="number" 
                  v-model="form.horasTrabajadas" 
                  placeholder="Ej: 2.5" 
                  class="h-11"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="notasTecnico" class="text-sm font-medium text-foreground">Reporte / Notas del Trabajo</Label>
                <Textarea 
                  id="notasTecnico" 
                  v-model="form.notasTecnico" 
                  :rows="4" 
                  placeholder="Detalla el trabajo realizado..."
                  class="resize-none"
                />
              </div>
            </div>
          </div>
        </Transition>
      </Card>

      <!-- Paso 4: Evidencia -->
      <Card class="overflow-hidden border-border shadow-sm mb-16">
        <div 
          @click="setPaso(4)" 
          class="bg-muted/30 p-4 flex items-center justify-between cursor-pointer active:bg-accent transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
              4
            </div>
            <div class="flex items-center gap-1.5 font-semibold text-foreground">
              <Camera class="w-4 h-4 text-muted-foreground mr-[-2px]" />
              Evidencia
            </div>
          </div>
          <ChevronUp v-if="pasosAbiertos.includes(4)" class="w-5 h-5 text-muted-foreground" />
          <ChevronDown v-else class="w-5 h-5 text-muted-foreground" />
        </div>
        
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-[-10px]"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-[-10px]"
        >
          <div v-show="pasosAbiertos.includes(4)">
            <div class="p-4 pt-2 space-y-4">
              
              <!-- Sección de Fotografía (Múltiples) -->
              <div>
                <div class="flex justify-between items-center mb-3">
                  <p class="text-sm font-semibold text-foreground">Evidencia Fotográfica</p>
                  <p class="text-xs text-muted-foreground">{{ form.fotosBase64.length }} / 5</p>
                </div>
                
                <input 
                  ref="fileInputRef" 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  class="hidden" 
                  @change="procesarFoto" 
                />
                
                <div class="grid grid-cols-2 gap-3 mb-3">
                  <div 
                    v-for="(foto, idx) in form.fotosBase64" 
                    :key="idx"
                    class="w-full h-32 rounded-xl overflow-hidden border border-border relative group"
                  >
                    <img 
                      :src="foto" 
                      class="object-cover w-full h-full cursor-zoom-in" 
                      @click="abrirZoom(foto)"
                    />
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      class="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md" 
                      @click.stop="eliminarFoto(idx)"
                    >
                      <Trash2 class="w-4 h-4" />
                    </Button>
                  </div>

                  <button 
                    v-if="form.fotosBase64.length < 5"
                    type="button" 
                    class="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 flex flex-col items-center justify-center gap-2 transition-colors active:scale-[0.98]" 
                    @click="abrirCamara"
                  >
                    <Camera class="w-6 h-6 text-muted-foreground" />
                    <span class="text-xs font-medium text-foreground">Tomar Foto</span>
                  </button>
                </div>
              </div>

              <div class="h-px w-full bg-border my-6"></div>

              <!-- Sección de Firma Digital -->
              <div>
                <h3 class="text-sm font-semibold text-foreground">Firma de Conformidad</h3>
                <p class="text-xs text-muted-foreground mb-3">Firma del cliente o responsable en sitio</p>
                
                <div v-if="form.firmaBase64">
                  <div class="bg-white border border-border rounded-xl p-2 h-40 flex items-center justify-center">
                    <img :src="form.firmaBase64" class="max-h-full max-w-full object-contain" />
                  </div>
                  <Button variant="outline" class="w-full mt-3" @click="limpiarFirma">
                    Volver a firmar
                  </Button>
                </div>
                
                <div v-else>
                  <div class="bg-white border border-border rounded-xl overflow-hidden h-44 w-full relative touch-none select-none">
                    <canvas
                      ref="canvasRef"
                      class="w-full h-full cursor-crosshair block bg-white"
                      @pointerdown="startDrawing"
                      @pointermove="draw"
                      @pointerup="stopDrawing"
                      @pointercancel="stopDrawing"
                    ></canvas>
                  </div>
                  <div class="flex items-center gap-3 mt-3">
                    <Button variant="ghost" class="text-muted-foreground flex-1" @click="limpiarFirma">
                      Limpiar
                    </Button>
                    <Button variant="secondary" class="flex-[2]" @click="guardarFirma">
                      Guardar Firma
                    </Button>
                  </div>
                </div>
              </div>

              <p class="text-xs text-muted-foreground text-center pt-2 pb-16">Asegúrate de guardar la firma antes de continuar.</p>
              
            </div>
          </div>
        </Transition>
      </Card>

    </div>
  </div>

  <!-- Lightbox (Zoom Fotografía) -->
  <Teleport to="body">
    <div 
      v-if="isImageZoomed && fotoPreview" 
      class="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity"
      style="pointer-events: auto !important;"
      @click.self="cerrarZoom"
    >
      <button 
        class="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors"
        style="pointer-events: auto !important;"
        @click="cerrarZoom"
      >
        <XCircle class="w-8 h-8" />
      </button>
      <img 
        :src="fotoPreview" 
        class="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
        style="pointer-events: auto !important;"
      />
    </div>
  </Teleport>

  <!-- Modal del Catálogo Offline -->
  <Dialog :open="isCatalogoOpen" @update:open="isCatalogoOpen = $event">
    <DialogContent class="w-[95vw] max-w-md rounded-2xl p-0 gap-0 overflow-hidden bg-card [&>button]:hidden">
      <DialogHeader class="p-4 border-b border-border bg-muted/30">
        <DialogTitle>Catálogo de Repuestos</DialogTitle>
        <DialogDescription>
          Selecciona los materiales a utilizar
        </DialogDescription>
      </DialogHeader>
      
      <div class="p-3 border-b border-border">
        <div class="relative flex items-center">
          <Search class="absolute left-3 w-4 h-4 text-muted-foreground" />
          <Input 
            v-model="searchRepuesto" 
            placeholder="Buscar repuesto..." 
            class="pl-9 h-10 bg-background" 
          />
        </div>
      </div>
      
      <div class="max-h-[50vh] overflow-y-auto p-2 space-y-1 bg-background">
        <div v-if="catalogoFiltrado.length === 0" class="flex items-center justify-center py-10">
          <p class="text-sm text-muted-foreground">No se encontraron repuestos en el catálogo offline.</p>
        </div>
        
        <button 
          v-for="item in catalogoFiltrado" 
          :key="item.id"
          type="button" 
          class="w-full text-left p-3 rounded-xl hover:bg-accent active:bg-accent/80 transition-colors flex justify-between items-center border border-transparent active:border-border"
          @click="agregarRepuesto(item)"
        >
          <div class="flex flex-col">
            <span class="text-sm font-medium text-foreground">{{ item.nombre }}</span>
            <span class="text-xs text-muted-foreground">Stock: {{ item.stockDisponible ?? 0 }}</span>
          </div>
          <Plus class="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      
      <DialogFooter class="p-4 border-t border-border bg-muted/10">
        <Button variant="outline" class="w-full h-11" @click="isCatalogoOpen = false">Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Barra de Acciones Inferior (Flotante) -->
  <div 
    v-if="orden" 
    class="fixed bottom-16 left-0 right-0 p-4 z-40 max-w-md mx-auto flex gap-3 pb-safe pointer-events-none"
  >
    <template v-if="orden.estado === 'Pausada'">
      <Button 
        class="w-full h-12 font-bold active:scale-95 text-white shadow-lg pointer-events-auto bg-emerald-600 hover:bg-emerald-700"
        @click="reanudarOrden"
        :disabled="isReanudando"
      >
        <Loader2 v-if="isReanudando" class="w-5 h-5 animate-spin mr-2" />
        <Play v-else class="w-5 h-5 mr-2" />
        Reanudar Trabajo
      </Button>
    </template>
    
    <template v-else>
      <Button 
        variant="outline" 
        class="flex-1 h-12 text-amber-600 border-amber-600/30 hover:bg-amber-600/10 bg-background/90 backdrop-blur active:scale-95 shadow-md pointer-events-auto"
        @click="isPausarOpen = true"
      >
        Pausar Orden
      </Button>
      
      <Button 
        class="flex-[2] h-12 font-bold active:scale-95 text-white shadow-lg pointer-events-auto"
        :class="syncStore.isOnline ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'"
        @click="completarOrden"
        :disabled="isCompletando"
      >
        <template v-if="isCompletando">
          <Loader2 class="w-5 h-5 animate-spin mr-2" />
          Guardando...
        </template>
        <template v-else>
          {{ syncStore.isOnline ? 'Completar Orden' : 'Guardar Localmente' }}
        </template>
      </Button>
    </template>
  </div>

  <!-- Modal de Pausa -->
  <AlertDialog :open="isPausarOpen" @update:open="isPausarOpen = $event">
    <AlertDialogContent class="max-w-[320px] rounded-2xl p-5">
      <AlertDialogHeader>
        <AlertDialogTitle>Pausar Orden</AlertDialogTitle>
        <AlertDialogDescription>
          Indica el motivo por el cual se detiene el trabajo (ej. falta de repuestos, cliente ausente).
        </AlertDialogDescription>
      </AlertDialogHeader>
      
      <div class="py-2">
        <Textarea 
          v-model="motivoPausa" 
          placeholder="Ej: El equipo no se encuentra en el domicilio..."
          class="min-h-[100px] resize-none"
        />
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isPausando">Cancelar</AlertDialogCancel>
        <AlertDialogAction 
          @click.prevent="pausarOrden" 
          class="bg-amber-600 text-white hover:bg-amber-700"
          :disabled="isPausando || motivoPausa.trim().length < 5"
        >
          <Loader2 v-if="isPausando" class="w-4 h-4 animate-spin mr-2" />
          Confirmar Pausa
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

</template>
