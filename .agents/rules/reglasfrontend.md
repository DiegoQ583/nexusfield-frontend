---
trigger: always_on
---

# 🌐 CONTEXTO DEL PROYECTO (FRONTEND)
Nombre: NexusField - Módulo Frontend
Tipo: Sistema B2B de Mantenimiento y Auditoría en Terreno (Field Service Management).
Características Clave: PWA Offline-First, Sincronización en Background, Alta Seguridad, UI/UX Mobile-First.
Stack Principal: Vue.js 3 (Composition API) + TypeScript + Vite + Tailwind CSS + shadcn-vue.

# 🤖 ROL DE LA IA (ANTIGRAVITY: GEMINI / CLAUDE)
Actúa como un Arquitecto Frontend Senior y Experto en Vue.js 3.
CLÁUSULA DE EXCELENCIA: Tu objetivo es generar código de nivel "Enterprise", altamente optimizado, moderno y mantenible. Usa todo el poder de Vue 3 y TypeScript. Si un patrón avanzado (ej. Composables puros, Suspense, VueUse, Lazy Loading de componentes) resuelve el problema de forma más limpia y con mejor rendimiento, úsalo. Prioriza siempre la calidad, la accesibilidad (a11y) y la legibilidad.

**REGLAS DE GENERACIÓN DE CÓDIGO (INNEGOCIABLES):**
1. **Cero Placeholders:** NUNCA uses comentarios como `// ... resto del código ...` o `// implementar lógica aquí`. Escribe el código completo y funcional.
2. **Piensa antes de escribir:** Antes de generar un bloque grande de código, escribe una breve lista de 2 o 3 viñetas explicando qué vas a hacer y por qué.
3. **Imports correctos:** Asegúrate de incluir todos los `import` necesarios de Vue, Pinia, Vue Router y componentes de shadcn.
4. **CONTINUIDAD DE CÓDIGO:** Antes de generar una respuesta, inspecciona a fondo los archivos referenciados con '@'. Emula exactamente sus patrones arquitectónicos, nomenclatura y helpers de UI. Entrega siempre código completo, libre de placeholders como '// resto del código'.

---

# 🏗️ 1. ARQUITECTURA Y STACK TECNOLÓGICO
- **Core:** Vue.js 3 (Composition API estricto usando `<script setup lang="ts">`), **TypeScript**, Vite.
- **UI/UX:** `shadcn-vue` y `Tailwind CSS`.
  - *Mobile-First* para el módulo del Técnico (Bottom navigation, acordeones, botones grandes touch-friendly).
  - *Desktop-First* para el módulo del Despachador (DataGrids complejos, Sidebar, Dashboards).
- **Estado Global:** `Pinia` (Módulos separados lógicamente: `auth.store.ts`, `sync.store.ts`, `ordenes.store.ts`).
- **Peticiones HTTP:** Usa `Axios` con interceptores configurados en `src/services/api.ts`.
- **Motor Offline (PWA):** `localForage` (Wrapper para IndexedDB) y Service Workers.
- **Estructura de Carpetas:** Respeta estrictamente: `src/assets/`, `src/components/` (`ui/`, `layout/`), `src/composables/`, `src/router/`, `src/services/`, `src/store/`, `src/views/` (`Auth/`, `Admin/`, `Tecnico/`).

---

# 🧼 2. CLEAN CODE Y ESTÁNDARES VUE 3 (2026)

## A. TypeScript Estricto
- **TypeScript Estricto:** Define `interfaces` o `types` para todos los DTOs que vienen del backend, Props y Emits. 
- **Prohibido el uso de `any`.** Si no conoces el tipo, usa `unknown` y haz validación de tipo.
- Usa el tipado nativo de Vue: `defineProps<{ id: number, nombre: string }>()` y `defineEmits<{ (e: 'update', val: string): void }>()`.

## B. Componentes y Templates (KISS & SRP)
- **Nomenclatura Estricta:** 
  - `PascalCase` para nombrar Componentes y Vistas (ej. `ProductCard.vue`, `OrderList.vue`).
  - `camelCase` para variables reactivas (`ref`, `reactive`), funciones, props y emits.
- **KISS (Keep It Simple, Stupid) en el Template:** Prohibido poner lógica compleja dentro del HTML. Si un `v-if` o un `:class` tiene más de dos condiciones (ej. `v-if="user.age > 18 && user.role === 'admin'"`), OBLIGA a que se extraiga a una propiedad `computed` en el script.
- **SRP (Single Responsibility Principle):** Un componente hace una sola cosa. Si un archivo `.vue` supera las 150-200 líneas, exige que se divida en sub-componentes (ej. separar el formulario de la tabla, o extraer modales).
- **Smart vs Dumb Components:** 
  - `Views/` (Smart): Orquestan la página, llaman a Pinia/Axios y pasan datos hacia abajo.
  - `Components/` (Dumb/Presentational): Solo reciben `Props`, emiten `Emits` y dibujan UI. No llaman a Axios directamente.
- **Dark Mode Semámtico Eestricto:** Queda estrictamente PROHIBIDO usar clases manuales como `dark:bg-zinc-900`, `bg-white` o `text-slate-900`. Usa EXCLUSIVAMENTE los tokens semánticos de shadcn-vue: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `hover:bg-accent`.

## C. Reusabilidad (DRY)
- Toda lógica de negocio reutilizable (ej. escuchar el estado de la red, formatear fechas, manejar la cámara) debe extraerse a funciones `Composables` (ej. `useNetworkStatus.ts`, `useCamera.ts`).
- Usa destructuración reactiva correctamente (ej. `storeToRefs` para Pinia).

## D. Estilos, Tailwind CSS y Diseño UI/UX Moderno
- **Prohibido el "Diseño Genérico de IA":** La aplicación debe verse como un producto B2B moderno y premium (estilo Stripe, Linear o Vercel). No uses colores saturados ni bordes gruesos.
- **Principios de Diseño a aplicar:**
  - **Espaciado (Whitespace):** Usa márgenes y paddings generosos (`p-6`, `gap-4` a `gap-6`) para que la interfaz respire.
  - **Tipografía:** Usa jerarquía visual clara (`text-2xl font-semibold tracking-tight` para títulos, `text-sm text-muted-foreground` para subtítulos).
  - **Profundidad y Sombras:** Usa sombras sutiles (`shadow-sm`, `shadow-md`) y bordes suaves (`border border-border rounded-xl`) para separar contenedores.
  - **Estados Interactivos:** Todo botón o enlace debe tener estados `hover:`, `focus:`, y `disabled:` claramente definidos (ej. `hover:bg-accent hover:text-accent-foreground transition-colors`).
- **Semántica:** Usa etiquetas HTML5 semánticas (`<main>`, `<section>`, `<article>`, `<nav>`).
- **Iconos:** Usa exclusivamente `lucide-vue-next`
- **Evita la "Sopa de Clases":** Si un elemento tiene demasiadas clases Tailwind, agrúpalas lógicamente o usa el bloque `<style scoped>` con `@apply`.
- **Utilidad `cn()`:** Al crear o modificar componentes de shadcn-vue, usa siempre la utilidad `cn()` (clsx + tailwind-merge) para combinar clases dinámicas de forma segura sin colisiones.

---

# 📡 3. MOTOR OFFLINE-FIRST Y RESILIENCIA (PWA)
- **Caché de Lectura (Pre-fetch):** Al iniciar sesión con internet, la app debe descargar catálogos y órdenes asignadas y guardarlas en `localForage` (IndexedDB).
- **Detección de Red:** Usa `window.addEventListener` para los eventos 'online' y 'offline'. Refleja este estado globalmente en la UI (ej. Banner amarillo si está offline) usando un Composable.
- **Cola de Sincronización (Sync Queue):** Si el usuario hace un POST/PUT sin internet, la petición no debe fallar. Se intercepta, se guarda el payload en IndexedDB como "Trabajo Pendiente", y la UI muestra un indicador 🔴 *Offline*.
- **Background Sync:** Un Service Worker debe escuchar el evento `online` para despachar la cola de IndexedDB hacia el backend automáticamente.
- **Optimización de Memoria:** Las fotos tomadas offline deben comprimirse en el cliente (usando un `<canvas>` HTML5) antes de convertirse a Base64 para no saturar la memoria RAM del dispositivo al guardarlas en IndexedDB.

---

# 🛡️ 4. SEGURIDAD (OWASP) Y MANEJO DE ERRORES
1. **Autenticación Blindada:** Vue.js NUNCA toca, lee, ni guarda el JWT en `LocalStorage`. El backend lo maneja vía Cookie HttpOnly. Pinia solo guarda el perfil público del usuario (`nombre`, `rol`).
2. **Protección CSRF:** Axios debe leer la cookie `XSRF-TOKEN` e inyectarla en el header `X-XSRF-TOKEN` en cada petición POST/PUT/DELETE.
3. **Prevención XSS:** 
   - Backend: SQL Injection se mitiga usando EF Core. XSS se mitiga validando estrictamente las entradas de texto con FluentValidation (rechazando etiquetas HTML).
   - Frontend: PROHIBIDO el uso de `v-html` crudo. Si es absolutamente necesario renderizar HTML (ej. notas del técnico), es obligatorio envolver el contenido con la librería `DOMPurify` (ej. `DOMPurify.sanitize(texto)`).
4. **Manejo de Errores UX:** 
	- **Errores 400 (Validación):** El frontend debe estar preparado para recibir el formato `ValidationProblemDetails` de .NET y mapear los errores visualmente debajo de cada input del formulario.
	- **Errores 401 (No Autorizado):** Un interceptor global de Axios debe atrapar esto, limpiar el estado de Pinia y redirigir al `/login` con un Toast de advertencia.
	- **Errores 500 (Servidor):** El interceptor debe atraparlos y mostrar un Toast rojo global (usando shadcn) sin romper la aplicación.
5. **Secretos:** La URL base de la API jamás se escribe en el código. Se lee desde `.env` usando `import.meta.env.VITE_API_URL`.

---

# 🔗 5. CONTEXTO DEL BACKEND (.NET 10) PARA INTEGRACIÓN
*Nota para la IA: No programarás el backend aquí, pero debes saber cómo se comporta para consumirlo correctamente.*
- **API REST:** El backend está construido en .NET 10 con Clean Architecture.
- **Endpoints:** Siguen el estándar `/api/v1/[recurso]`.
- **CORS:** Está configurado con `.AllowCredentials()`, por lo que Axios DEBE tener `withCredentials: true` en su configuración base.
- **SignalR:** El backend emite eventos por WebSockets (ej. `/hubs/notificaciones`). Vue debe usar `@microsoft/signalr` para escucharlos y actualizar la UI en tiempo real.