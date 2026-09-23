<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dbSyncQueue, useSyncStore } from '@/store/sync.store'
import { useNetwork } from '@vueuse/core'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Trash2, Loader2, ArrowLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAppFeedback } from '@/composables/useAppFeedback'

const router = useRouter()
const syncStore = useSyncStore()
const { isOnline } = useNetwork()
const feedback = useAppFeedback()

const items = ref<{ key: string; data: any }[]>([])
const isLoading = ref(true)
const isSyncingLocal = ref(false)

async function cargarItems() {
  isLoading.value = true
  items.value = []
  try {
    const keys = await dbSyncQueue.keys()
    for (const key of keys) {
      const data = await dbSyncQueue.getItem<any>(key)
      if (data) {
        items.value.push({ key, data })
      }
    }
    // Sort by fecha descending (oldest first or newest first) - let's do oldest first
    items.value.sort((a, b) => (a.data.fecha || 0) - (b.data.fecha || 0))
  } catch (error) {
    console.error('Error cargando cola de sincronización', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  cargarItems()
})

async function forzarSync() {
  isSyncingLocal.value = true
  try {
    await syncStore.procesarSyncQueue()
    await cargarItems()
  } finally {
    isSyncingLocal.value = false
  }
}

async function descartarItem(key: string) {
  try {
    await dbSyncQueue.removeItem(key)
    const remainingKeys = await dbSyncQueue.keys()
    syncStore.pendingSyncCount = remainingKeys.length
    await cargarItems()
    feedback.showSuccess('Elemento descartado correctamente.')
  } catch (error) {
    feedback.showErrorModal('Error al descartar el elemento.')
  }
}

function formatDate(ms: number) {
  if (!ms) return ''
  return new Date(ms).toLocaleString()
}
</script>

<template>
  <div class="max-w-md mx-auto w-full p-4 space-y-5 pb-24 min-h-screen bg-background">
    <!-- Cabecera -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button 
          @click="router.back()" 
          class="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 text-foreground active:scale-95 transition-transform"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>
        <h1 class="text-xl font-bold text-foreground">Cola Offline</h1>
      </div>
      
      <Button 
        :disabled="!isOnline || items.length === 0 || isSyncingLocal || syncStore.isSyncing"
        @click="forzarSync"
        class="active:scale-95"
      >
        <Loader2 v-if="isSyncingLocal || syncStore.isSyncing" class="w-4 h-4 mr-2 animate-spin" />
        Sincronizar
      </Button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-10">
      <Loader2 class="w-8 h-8 animate-spin text-primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="items.length === 0" class="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div class="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
        <CheckCircle2 class="w-8 h-8" />
      </div>
      <div>
        <h3 class="text-lg font-semibold text-foreground">Todo está sincronizado</h3>
        <p class="text-sm text-muted-foreground mt-1">No hay tareas pendientes por enviar.</p>
      </div>
    </div>

    <!-- Lista de Cola -->
    <div v-else class="space-y-3">
      <Card 
        v-for="item in items" 
        :key="item.key"
        class="border-border/50 bg-card p-4 rounded-2xl shadow-sm space-y-3"
      >
        <div class="flex items-start justify-between">
          <div>
            <h4 class="font-bold text-foreground text-sm">
              Orden #{{ item.data.ordenId }}
            </h4>
            <div class="text-xs text-muted-foreground mt-1">
              {{ formatDate(item.data.fecha) }}
            </div>
          </div>
          
          <Badge 
            :variant="item.data.tipo === 'completar' ? 'default' : 'secondary'"
            :class="item.data.tipo === 'completar' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'"
            class="text-[10px] capitalize border-transparent"
          >
            {{ item.data.tipo }}
          </Badge>
        </div>

        <div class="flex justify-end pt-2 border-t border-border/50">
          <Button 
            variant="ghost" 
            size="sm" 
            class="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 active:scale-95"
            @click="descartarItem(item.key)"
          >
            <Trash2 class="w-4 h-4 mr-2" />
            Descartar
          </Button>
        </div>
      </Card>
    </div>
  </div>
</template>
