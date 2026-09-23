<script setup lang="ts">
/**
 * ThemeToggle.vue — Botón de cambio de tema claro/oscuro.
 * Usa useDark de @vueuse/core para persistir la preferencia del usuario
 * en localStorage y sincronizarla con la clase .dark del <html>.
 */

import { useDark, useToggle } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Sun, Moon } from 'lucide-vue-next'

const isDark = useDark()
const toggleDark = useToggle(isDark)
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    :aria-label="isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
    @click="toggleDark()"
  >
    <Transition
      mode="out-in"
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 rotate-90 scale-75"
      enter-to-class="opacity-100 rotate-0 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 rotate-0 scale-100"
      leave-to-class="opacity-0 -rotate-90 scale-75"
    >
      <Sun
        v-if="isDark"
        key="sun"
        class="w-5 h-5 text-slate-500 dark:text-zinc-400"
      />
      <Moon
        v-else
        key="moon"
        class="w-5 h-5 text-slate-500 dark:text-zinc-400"
      />
    </Transition>
  </Button>
</template>
