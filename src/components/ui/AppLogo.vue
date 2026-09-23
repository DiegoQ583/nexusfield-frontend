<script setup lang="ts">
import { Zap } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    showText?: boolean
    layout?: 'row' | 'col'
  }>(),
  {
    size: 'md',
    showText: true,
    layout: 'row',
  }
)
</script>

<template>
  <div
    class="inline-flex select-none"
    :class="layout === 'col' ? 'flex-col items-center gap-3 text-center' : 'items-center gap-2.5'"
  >
    <!-- Isotipo: Rectángulo con esquinas redondeadas suaves (Squircle) -->
    <div
      class="flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0"
      :class="{
        'w-7 h-7 rounded-lg shadow-sm': size === 'sm',
        'w-8 h-8 rounded-lg shadow-sm': size === 'md',
        'w-16 h-16 rounded-2xl shadow-lg shadow-indigo-500/25': size === 'lg',
      }"
    >
      <Zap
        class="text-white"
        :class="{
          'w-3.5 h-3.5': size === 'sm',
          'w-4 h-4': size === 'md',
          'w-8 h-8': size === 'lg',
        }"
        :stroke-width="2.2"
      />
    </div>

    <!-- Texto de Marca -->
    <span
      v-if="showText"
      class="font-bold tracking-tight text-foreground leading-none"
      :class="{
        'text-sm': size === 'sm',
        'text-sm font-semibold': size === 'md',
        'text-2xl': size === 'lg',
      }"
    >
      NexusField
    </span>
  </div>
</template>