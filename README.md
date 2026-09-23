# ⚡ NexusField — Field Service Management Platform

**NexusField** es una plataforma B2B de grado empresarial diseñada para orquestar, auditar y optimizar el flujo de trabajo entre despachadores en oficina y técnicos en terreno. Construida bajo una arquitectura **Offline-First (PWA)**, garantiza la continuidad operativa en entornos de baja o nula conectividad (sótanos, zonas industriales, etc.).

Este repositorio contiene el **Frontend** de la aplicación, desarrollado con los más altos estándares de Clean Code, tipado estricto y diseño semántico.

## 🛠️ Stack Tecnológico (Frontend)

- **Core:** Vue.js 3 (Composition API, `<script setup>`), TypeScript estricto, Vite.
- **UI/UX:** Tailwind CSS v4, `shadcn-vue` (Radix UI), `lucide-vue-next`.
- **Estado Global:** Pinia.
- **Peticiones HTTP:** Axios (con interceptores globales).
- **Tiempo Real:** `@microsoft/signalr` (WebSockets).
- **Gráficos:** `@unovis/vue`.
- **Seguridad:** `DOMPurify` (Prevención XSS).
- **Utilidades:** `@vueuse/core` (Network status, Debounce, Dark Mode).

---

## 🛡️ Arquitectura de Seguridad y Comunicación

El sistema está diseñado para cumplir con los lineamientos de seguridad **OWASP Top 10**, estableciendo una comunicación blindada con el backend en .NET 10:

1. **Cero Tokens en el Cliente:** El JWT jamás se almacena en `localStorage` ni `sessionStorage`. El backend lo inyecta directamente en una cookie `HttpOnly; Secure; SameSite=Lax`, mitigando al 100% el robo de sesiones por ataques XSS.
2. **Protección CSRF (Cross-Site Request Forgery):** Se implementó un flujo de *Two-Phase Loading*. Axios intercepta todas las peticiones mutativas (`POST`, `PUT`, `PATCH`, `DELETE`) e inyecta automáticamente el header `X-XSRF-TOKEN` leyendo el token Anti-Forgery emitido por .NET.
3. **Manejo de Errores Estandarizado (RFC 7807):** El frontend decodifica nativamente el formato `ValidationProblemDetails` de ASP.NET Core. Los errores de validación (HTTP 400) se mapean dinámicamente debajo de cada input en los formularios, mientras que los errores de negocio (HTTP 409) disparan modales bloqueantes centralizados.

---

## 📦 Módulos del Sistema: Perfil Despachador

El perfil del Despachador (Admin) está diseñado bajo un enfoque **Desktop-First**, priorizando la densidad de información, el uso de DataGrids complejos y la navegación Drill-down.

---

### 1. Módulo de Autenticación y Seguridad (Login)
Puerta de entrada al sistema, diseñada con una UX premium y validaciones en tiempo real.

*   **Flujo de Autenticación Seguro:**
    *   Al enviar las credenciales, el sistema solicita primero un token CSRF de "Invitado".
    *   Tras validar las credenciales (`POST /auth/login`), el backend establece la cookie `HttpOnly` con el JWT.
    *   Inmediatamente, el frontend solicita un **nuevo token CSRF** atado a la identidad del usuario autenticado (prevención de *Session Fixation*).
    *   Pinia almacena únicamente el perfil público del usuario (`nombre`, `rol`) para mantener la sesión visual.
*   **Protección Offline:** Utiliza `useNetwork()` para detectar la conexión. Si el usuario no tiene internet en su primer acceso, el formulario se bloquea automáticamente y muestra un banner de advertencia, evitando peticiones fallidas.
*   **Manejo de Estados de Red:** Si el servidor está caído o hay un error de CORS, el sistema atrapa la excepción antes de que colapse y muestra una alerta controlada en la UI.
*   **Enrutamiento Inteligente (Role-Based):** Tras un login exitoso, el *Navigation Guard* de Vue Router evalúa el rol del usuario y lo redirige a su entorno de trabajo correspondiente (`/despachador/dashboard` o `/tecnico/dashboard`).

### 2. Módulo de Centro de Comando (Dashboard del Despachador)
El panel de control operativo ofrece una visión panorámica en tiempo real de toda la operación, permitiendo la toma de decisiones basada en datos sin saturar al usuario.

*   **Métricas KPI y Agrupación Dinámica:**
    *   Tarjetas visuales con estado reactivo para: Órdenes Pendientes, Órdenes Completadas, Técnicos Activos y Costo Total (formateado con la API nativa `Intl.NumberFormat`).
    *   Filtro temporal global (`hoy`, `semana`, `mes`) que actualiza todas las métricas en paralelo mediante `Promise.all`.
*   **Visualización de Datos (Unovis Charts):**
    *   Gráfico de barras apiladas (`VisStackedBar`) que se adapta dinámicamente: muestra rangos de horas para el filtro de "Hoy", días para "Semana" y semanas para "Mes".
    *   Formateo del Eje Y forzado a números enteros para evitar la representación errónea de fracciones de órdenes.
*   **Distribución de Carga de Trabajo (Prioridades):**
    *   Widget con barras de progreso horizontales estilizadas en Tailwind que calculan en tiempo real el porcentaje de órdenes en prioridad Alta (rojo), Media (ámbar) y Baja (azul).
*   **Integración en Tiempo Real (SignalR / WebSockets):**
    *   Conexión persistente mediante `@microsoft/signalr` configurada con `.withAutomaticReconnect()` y `{ withCredentials: true }` para el handshake autenticado con la cookie `HttpOnly`.
    *   **Refresco Silencioso:** Al recibir el evento `"ActualizarDashboard"`, el store de notificaciones incrementa un trigger reactivo que dispara un re-fetch de datos en segundo plano sin activar los Skeletons de carga, evitando parpadeos molestos en la UI.
    *   Bandeja de notificaciones en el Topbar con contador de no leídas y modal desplegable para auditoría de eventos.
*   **Navegación Drill-down (Preservación de Contexto):**
    *   Las tarjetas KPI y las barras de prioridad actúan como enlaces directos: al hacer clic, teletransportan al usuario hacia el DataGrid de Órdenes inyectando los filtros en la URL (`/despachador/ordenes?tab=activas&prioridad=Alta&filtroTiempo=mes`).
    *   La tabla de "Órdenes Recientes" integra el visor de detalles directamente en el Dashboard, permitiendo inspeccionar un trabajo sin cambiar de pantalla.

---

### 3. Módulo de Gestión de Órdenes (Núcleo Transaccional)
Diseñado para manipular grandes volúmenes de registros con alta densidad de datos, búsqueda instantánea y controles de seguridad estrictos.

*   **DataGrid con Paginación Server-Side:**
    *   Paginación eficiente delegada al backend (`GET /ordenes?page=X&pageSize=10`) para garantizar un consumo mínimo de memoria RAM en el navegador.
    *   Pestañas de segmentación rápida: "Activas" (Pendiente, En Progreso, Pausada) e "Historial" (Completada, Cancelada).
    *   **Filtro Múltiple de Estados:** Selector desplegable con checkboxes que serializa selecciones complejas en strings separados por comas (`?estado=Pendiente,EnProgreso`).
    *   **Búsqueda Debounced:** Input de texto libre con retraso de 300ms mediante `refDebounced` de VueUse para no saturar la base de datos con peticiones intermedias mientras se escribe.
    *   **Lectura Inteligente de URL:** Al montarse (`onMounted`), el componente hidrata sus filtros leyendo los query parameters de la URL, permitiendo compartir enlaces filtrados o navegar desde el Dashboard sin perder el contexto.
*   **Formulario Lateral de Asignación (`OrdenCreateSheet.vue`):**
    *   Panel deslizante accesible que permite crear órdenes sin perder de vista la tabla principal.
    *   **Combobox de Activos (Typeahead en Tiempo Real):** Buscador optimizado que consulta el endpoint ligero `GET /activos/buscar?q=...` tras 300ms de inactividad, evitando descargar catálogos masivos. Integra prevención de colisiones de filtrado local en Radix UI (`:filter-function`).
    *   **Reserva Atómica de Repuestos:** Selector múltiple que consulta el inventario en paralelo (`Promise.all`). Al marcar un repuesto, despliega un control numérico con validación de límite superior en el cliente (`:max="repuesto.stockDisponible"`), impidiendo que el despachador reserve más piezas de las existentes antes de enviar el payload.
*   **Modo Detalle y Auditoría (`OrdenDetailSheet.vue`):**
    *   Panel de lectura profunda con scroll nativo desacoplado y footer fijo de acción.
    *   **Trazabilidad de Repuestos:** Muestra los repuestos asignados en cualquier fase de la orden (como "Reservados" si está activa, o como "Usados" si está finalizada).
    *   **Prevención de Vulnerabilidades XSS (DOMPurify):** Las notas escritas por los técnicos en campo se renderizan mediante `v-html` pasando obligatoriamente por una lista blanca estricta de `DOMPurify` (`ALLOWED_ATTR: []`). Esto neutraliza cualquier intento de inyección de scripts maliciosos (`<script>`, `onerror`, `onclick`).
    *   **Motor de Impresión Nativo (B2B Document Export):** Utiliza reglas avanzadas de CSS `@media print` con selectores `:deep()` para trascender el Shadow DOM de Radix UI. Al hacer clic en "Imprimir", el sistema oculta menús, overlays oscuros y botones, formateando la orden como una hoja membretada A4 limpia para enviar al cliente como comprobante fiscal o de servicio, sin requerir librerías pesadas de PDF.

    ### 4. Módulo de Gestión de Inventario (Catálogo de Repuestos)
Administración del stock físico, control de costos y manejo avanzado de archivos binarios (`multipart/form-data`).

*   **DataGrid de Disponibilidad en Tiempo Real:**
    *   Visualización de métricas críticas por repuesto: Stock Total, Stock Reservado (en órdenes activas) y Stock Disponible.
    *   **Alerta de Stock Crítico:** Si el `stockDisponible <= 5`, el texto se resalta en color destructivo (`text-destructive font-bold`) acompañado de un icono de advertencia (`AlertTriangle`) para alertar al despachador sobre la necesidad de reabastecimiento.
    *   Miniatura circular de la fotografía oficial del repuesto con fallback automático al icono de paquete si no cuenta con imagen.
*   **Gestión Multimedia y Subida de Archivos (`RepuestoFormSheet.vue`):**
    *   **Transformación a `FormData` Nativo:** El servicio construye peticiones `multipart/form-data`, permitiendo subir archivos `.jpg`, `.png` y `.webp` de hasta 2MB con validación en el cliente antes de consumir ancho de banda.
    *   **Lógica de 3 Vías en Edición:** 
        1. *Reemplazo:* Envía el nuevo binario en el campo `foto`. El backend destruye la imagen anterior del disco y almacena la nueva.
        2. *Eliminación:* Envía el flag booleano `eliminarFoto: true` sin archivo. El backend limpia el almacenamiento físico y setea `fotoUrl = null`.
        3. *Conservación:* No envía campos multimedia; el backend conserva la imagen previa sin alteraciones.
    *   **Control de Fugas de Memoria:** Uso estricto de `URL.createObjectURL` para previsualización inmediata y `URL.revokeObjectURL` para destruir los blobs en el motor V8 al cambiar o descartar archivos.
    *   **Visor Inmersivo (Lightbox / Zoom):** Modal flotante en pantalla completa (`Teleport to="body"`) con fondo desenfocado (`backdrop-blur-sm`), resolución optimizada y aislamiento estricto de eventos de puntero (`pointer-events: auto !important`) para no colisionar con el foco de Radix UI.
*   **Trazabilidad de Reservas B2B (Patrón Two-Phase Loading):**
    *   Al inspeccionar un repuesto con unidades apartadas, el componente ejecuta una hidratación síncrona inmediata con los datos locales de la tabla (evitando el cierre involuntario del Sheet) y, en segundo plano, consulta `GET /repuestos/{id}` para obtener la lista `reservasActivas`.
    *   Muestra qué técnicos tienen piezas en su poder, la cantidad exacta y el enlace a la orden asociada (`Orden #X`).
*   **Integridad Referencial y Errores 409 (Conflict):** Si el usuario intenta eliminar un repuesto que forma parte de una orden activa, el sistema captura el error HTTP 409 y despliega un modal bloqueante impidiendo la acción.

---

### 5. Módulo de Gestión de Usuarios (Directorio de Personal)
Control de acceso, administración de perfiles y segregación de roles para Despachadores y Técnicos.

*   **Directorio Segmentado:**
    *   Pestañas de filtrado rápido por rol: "Todos", "Despachadores" y "Técnicos" (delegado al backend mediante query parameters `?rol=`).
    *   Buscador reactivo con debounce de 300ms sobre nombres, correos y nombres de usuario.
*   **Formulario Multimodal Unificado (`UsuarioFormSheet.vue`):**
    *   Un único componente orquestado mediante la prop `mode` (`create`, `edit`, `view`).
    *   **Segregación Estricta de Payloads (Seguridad):** 
        *   *Creación (POST):* Exige `nombreUsuario`, `clave` (con validación mínima de 8 caracteres) y `rol`.
        *   *Edición (PUT):* Bloquea `nombreUsuario` y `rol` como campos de solo lectura y **los excluye del payload JSON enviado a Axios**, garantizando que campos inmutables no puedan ser alterados vía manipulación de red.
    *   **Lógica de Negocio Condicional:** Los campos de "Especialidad" y "Tarifa por Hora" se renderizan exclusivamente si el usuario seleccionado tiene el rol de `Tecnico`.
*   **Ciclo de Vida y Soft Delete Atómico:**
    *   Activación/Desactivación rápida mediante `PATCH /usuarios/{id}/estado`.
    *   **Regla de Negocio Crítica:** Si se intenta desactivar a un técnico con órdenes pendientes o en progreso, el backend devuelve un HTTP 400. El frontend intercepta la excepción y despliega un modal bloqueante explicando el motivo.

---

### 6. Módulo de Gestión de Activos (Parque de Maquinaria)
Registro y auditoría de los equipos, maquinarias e instalaciones sujetas a mantenimiento.

*   **DataGrid Paginado y Diseño Anti-Desbordamiento:**
    *   Paginación server-side con consumo de `GET /activos?page=X&pageSize=10`.
    *   Celdas con anchos relativos controlados y truncamiento de texto (`max-w-0 truncate`) con atributo `title` nativo, garantizando que nombres o descripciones extensas no rompan la estructura visual en resoluciones de 1024px o pantallas ultrapanorámicas.
    *   Badges semánticos para el estado operativo del equipo: "Operativo" (verde) y "Requiere Mantenimiento" (rojo).
*   **Búsqueda Dual (DataGrid vs Autocompletado Ligero):**
    *   El módulo utiliza el endpoint pesado para administración general y expone la interfaz para el endpoint ligero `GET /activos/buscar?q=...` utilizado por los Comboboxes de asignación de órdenes.
*   **Preservación de Auditoría Histórica:**
    *   Al editar un activo, el formulario incluye un tooltip de asistencia técnica educando al despachador: *"Nota: Cambiar el cliente actual solo afectará órdenes futuras; el histórico de órdenes conservará el cliente original"*, garantizando la inmutabilidad de los reportes pasados.

---

## 💎 Sistema Global de Feedback y Experiencia de Usuario (UX)

Para erradicar la inconsistencia visual de las librerías genéricas de toasts (como `vue-sonner`), el proyecto implementa una arquitectura centralizada de retroalimentación basada en el principio **DRY (Don't Repeat Yourself)** y la filosofía de **Fricción Intencional**:

### Arquitectura: `useAppFeedback` + `AppFeedbackProvider`
*   **Singleton en Memoria (`src/composables/useAppFeedback.ts`):** Estado global reactivo que expone métodos limpios (`showSuccess`, `showErrorModal`) accesibles desde cualquier vista o componente sin prop-drilling.
*   **Provider Único (`src/components/ui/AppFeedbackProvider.vue`):** Montado una sola vez en el layout raíz (`DespachadorLayout.vue`). Escucha reactivamente al composable y dibuja los componentes en el DOM.

### Filosofía de Interacción:
1. **Éxitos sin Fricción (Píldora Flotante Verde):**
   *   Las operaciones exitosas (guardar, actualizar, activar) muestran un contenedor píldora flotante (`fixed bottom-8 left-1/2 -translate-x-1/2`) con fondo esmeralda, sombra sutil y animación nativa de entrada/salida.
   *   Desaparece automáticamente a los 3 segundos. **Cero fatiga de clics:** el operador puede continuar trabajando sin interrupciones.
2. **Errores con Fricción Intencional (AlertDialog Bloqueante):**
   *   Las violaciones de reglas de negocio (desactivar técnicos con trabajo, eliminar repuestos en uso, fallos de red) levantan un `<AlertDialog>` modal en el centro de la pantalla con un overlay oscuro (`backdrop-blur-sm`).
   *   Detiene el flujo de la aplicación y obliga al operador a presionar **"Entendido"**, asegurando la asimilación cognitiva del error.