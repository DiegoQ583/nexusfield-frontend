<script setup lang="ts">
import { useAppFeedback } from '@/composables/useAppFeedback'
import { CheckCircle2, AlertTriangle } from 'lucide-vue-next'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction
} from '@/components/ui/alert-dialog'

const { successMessage, errorMessage, isErrorModalOpen, closeErrorModal } = useAppFeedback()
</script>

<template>
  <!-- Píldora Flotante de Éxito -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-8 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-8 scale-95"
  >
    <div
      v-if="successMessage"
      class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-full bg-emerald-500 dark:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
    >
      <CheckCircle2 class="w-4 h-4 shrink-0" />
      <p class="text-sm font-medium tracking-wide">{{ successMessage }}</p>
    </div>
  </Transition>

  <!-- Modal Bloqueante de Error -->
  <AlertDialog :open="isErrorModalOpen" @update:open="isErrorModalOpen = $event">
    <AlertDialogContent class="sm:max-w-[425px]">
      <AlertDialogHeader>
        <AlertDialogTitle class="flex items-center gap-2 text-destructive">
          <AlertTriangle class="w-5 h-5 shrink-0" />
          Operación no permitida
        </AlertDialogTitle>
        <AlertDialogDescription class="text-sm text-foreground mt-2">
          {{ errorMessage }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogAction @click="closeErrorModal" class="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
          Entendido
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
