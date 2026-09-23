import path from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
      },
      manifest: {
        name: 'NexusField FSM',
        short_name: 'NexusField',
        description: 'Plataforma de Field Service Management',
        theme_color: '#09090b', // Color de la barra de estado del celular (Dark)
        background_color: '#09090b', // Color de fondo al abrir la app
        display: 'standalone', // Oculta la barra del navegador de Chrome/Safari
        orientation: 'portrait', // Bloquea la app en vertical (opcional pero recomendado para móviles)
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Requerido por Android para adaptar el icono a círculos/cuadrados
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  }
})