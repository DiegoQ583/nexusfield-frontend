# NexusField — Field Service Management Platform

**NexusField** es una plataforma B2B de grado empresarial diseñada para orquestar, auditar y optimizar el flujo de trabajo entre despachadores en oficina y técnicos en terreno. Construida bajo una arquitectura **Offline-First (PWA)**, garantiza la continuidad operativa en entornos de baja o nula conectividad (sótanos, zonas industriales, etc.).

Este repositorio contiene el **Frontend** de la aplicación, desarrollado con los más altos estándares de Clean Code, tipado estricto y diseño semántico.

## Stack Tecnológico (Frontend)

- **Core:** Vue.js 3 (Composition API, `<script setup>`), TypeScript estricto, Vite.
- **UI/UX:** Tailwind CSS v4, `shadcn-vue` (Radix UI), `lucide-vue-next`.
- **Estado Global:** Pinia.
- **Peticiones HTTP:** Axios (con interceptores globales).
- **Tiempo Real:** `@microsoft/signalr` (WebSockets).
- **Gráficos:** `@unovis/vue`.
- **Seguridad:** `DOMPurify` (Prevención XSS).
- **Utilidades:** `@vueuse/core` (Network status, Debounce, Dark Mode).

---

## Arquitectura de Seguridad y Comunicación

El sistema está diseñado para cumplir con los lineamientos de seguridad **OWASP Top 10**, estableciendo una comunicación blindada con el backend en .NET 10:

1. **Cero Tokens en el Cliente:** El JWT jamás se almacena en `localStorage` ni `sessionStorage`. El backend lo inyecta directamente en una cookie `HttpOnly; Secure; SameSite=Lax`, mitigando al 100% el robo de sesiones por ataques XSS.
2. **Protección CSRF (Cross-Site Request Forgery):** Se implementó un flujo de *Two-Phase Loading*. Axios intercepta todas las peticiones mutativas (`POST`, `PUT`, `PATCH`, `DELETE`) e inyecta automáticamente el header `X-XSRF-TOKEN` leyendo el token Anti-Forgery emitido por .NET.
3. **Manejo de Errores Estandarizado (RFC 7807):** El frontend decodifica nativamente el formato `ValidationProblemDetails` de ASP.NET Core. Los errores de validación (HTTP 400) se mapean dinámicamente debajo de cada input en los formularios, mientras que los errores de negocio (HTTP 409) disparan modales bloqueantes centralizados.

---

## Módulos del Sistema: Perfil Despachador

---

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

---

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

## Sistema Global de Feedback y Experiencia de Usuario (UX)

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


---

## Módulos del Sistema: Perfil Técnico (Mobile PWA & Offline-First)

---

El perfil del Técnico está diseñado bajo un enfoque **Mobile-First estricto** y una arquitectura **Offline-First pura**, optimizado para el uso con una sola mano en smartphones (360px - 430px) y garantizando operatividad total en sótanos, túneles o zonas industriales sin señal celular.

---

### 1. Centro de Trabajo y Shell Móvil (Dashboard & Layout)
La base operativa del técnico en campo, diseñada para preparar la jornada laboral y consultar asignaciones en 0 milisegundos.

*   **Shell Ergonómico (`TecnicoLayout.vue`):**
    *   **Viewport Adaptativo (`100dvh`):** Uso estricto de unidades de altura dinámicas (`dvh`) combinadas con safe-area insets (`env(safe-area-inset-bottom)`) para evitar que las barras de herramientas de Safari (iOS) y Chrome (Android) tapen los controles inferiores.
    *   **Topbar Fijo:** 
        *   Isotipo corporativo unificado (`AppLogo.vue`).
        *   **Monitor de Red Reactivo:** Indicador en tiempo real que escucha `navigator.onLine` a través de `@vueuse/core`. Muestra un punto verde ("Online") o ámbar ("Modo Local") para dar certeza visual al operario sobre el estado de su conexión.
        *   Selector de Modo Claro/Oscuro (`ThemeToggle.vue`).
        *   **Cierre de Sesión Seguro:** Interceptado por un `<AlertDialog>` modal de confirmación para prevenir desconexiones accidentales por toques del pulgar en campo. Al confirmar, purga la sesión y ejecuta una redirección limpia a `/login`.
    *   **Bottom Navigation Bar:**
        *   Navegación inferior fija con efecto de desenfoque (`backdrop-blur-lg`) y zonas táctiles de 44px de altura mínima.
        *   **Microinteracciones Táctiles:** Erradicación total de pseudoclases `:hover` (inútiles en pantallas táctiles) a favor de `active:scale-95` para proporcionar respuesta háptica y visual inmediata.
        *   Accesos rápidos a: Inicio (`/tecnico/dashboard`), Cola Sync (`/tecnico/sync` con Badge dinámico rojo indicando mutaciones pendientes) e Historial (`/tecnico/historial`).
    *   **Inyección Global de Feedback:** Montaje del `AppFeedbackProvider` para gestionar modales bloqueantes de negocio y alertas de éxito consistentes en el entorno móvil.

*   **Motor de Pre-Fetch y Rendimiento (`sync.store.ts`):**
    *   **Desacoplamiento Total de Red:** La vista del dashboard **jamás lee de Axios directamente**. Toda la información se extrae de la base de datos local **IndexedDB** (`localforage`), garantizando que la interfaz renderice al instante sin importar si el teléfono está en Modo Avión o sin cobertura.
    *   **Patrón Stale-While-Revalidate:** Al entrar al dashboard, el sistema hidrata la pantalla inmediatamente con las órdenes cacheadas en disco local (`0ms`) y, en segundo plano (sin bloquear la UI con spinners intrusivos), consulta `GET /api/v1/tecnico/mis-ordenes` y `GET /api/v1/tecnico/catalogo-offline` para actualizar la base de datos local silenciosamente.
    *   **Fusión Inteligente (Smart Merge):** Algoritmo de sincronización que previene que la descarga del servidor sobrescriba órdenes que el técnico ya tiene marcadas localmente como `EnProgreso` o `Pausada`, blindando la persistencia frente a desincronizaciones de red.

*   **Dashboard Operativo (`TecnicoDashboardView.vue`):**
    *   **Widget Meteorológico en Tiempo Real (Ejercicio 2):** Integración con la API de *Open-Meteo* consumiendo la geolocalización nativa (`useGeolocation`). Implementa un observador reactivo que espera a obtener coordenadas GPS válidas (evitando bloqueos por valores `Infinity`) y mapea los códigos WMO a iconos y descripciones legibles (ej. "☀️ Despejado", "🌧️ Lluvia").
    *   **Alerta Logística de Almacén:** Analiza reactivamente las órdenes asignadas del día. Si alguna contiene repuestos pre-asignados por el despachador, proyecta un contenedor destacado indicando el consolidado de materiales y cantidades exactas que el técnico debe retirar de la bodega antes de partir a ruta.
    *   **Carrusel Prioritario "En Ejecución":** Contenedor verde de alta jerarquía visual que lista los trabajos que el técnico ya inició. Si el operario retrocede accidentalmente, esta tarjeta le permite reanudar el Wizard con un solo toque (`router.push`) recuperando todo su progreso.
    *   **Lista "Tus Trabajos de Hoy":** Listado de órdenes en estado `Pendiente` con jerarquía tipográfica clara, ubicación física (`MapPin`), badges de prioridad y feedback táctil que redirige a la vista de inspección preliminar (`OrdenPreview.vue`).

---

### 2. Módulo de Ejecución de Orden (El Wizard de Terreno)
El núcleo transaccional del técnico en campo, diseñado como un asistente paso a paso (Stepper/Acordeón) con persistencia local automática y captura multimedia avanzada.

*   **Ficha de Inspección Preliminar (`OrdenPreview.vue`):**
    *   **Hidratación Local:** Lee los detalles de la orden directamente desde `IndexedDB` (`0ms`), permitiendo al técnico evaluar la tarea sin depender de cobertura de red.
    *   **Integraciones Nativas con el Sistema Operativo:**
        *   *Navegación GPS:* Enlace nativo `<a>` hacia Google Maps que concatena contextualmente el nombre del activo y la dirección física (`q=Activo+Ubicacion`), o consume el enlace exacto si fue configurado por el despachador.
        *   *Llamada de Contacto:* Botón telefónico directo `<a href="tel:...">` formateado con el código internacional de Venezuela (`+58`), llamando al contacto del sitio o a la central de despacho.
    *   **Acciones Operativas:**
        *   *Rechazo de Trabajo:* Modal con validación que exige un motivo de rechazo; al confirmar, despacha `POST /tecnico/ordenes/{id}/rechazar`, elimina la orden de la base de datos local y regresa al dashboard.
        *   *Inicio de Trabajo:* Invoca `POST /tecnico/ordenes/{id}/iniciar`, muta el estado local a `EnProgreso` y navega inmediatamente al Wizard.

*   **El Wizard de Ejecución (`OrdenEjecucion.vue`):**
    *   **Acordeón Multi-Paso Flexible:** Permite abrir y cerrar los 4 pasos de forma independiente (`pasosAbiertos: number[]`), facilitando que el técnico consulte el diagnóstico (Paso 1) mientras redacta el reporte final (Paso 3) sin colisiones visuales.
    *   **Paso 1 — Diagnóstico Centralizado:** Exhibe el equipo a intervenir, la ubicación detallada y el reporte original del cliente, manteniendo los atajos de GPS y llamada a mano.
    *   **Paso 2 — Catálogo de Materiales 100% Offline:**
        *   *Inyección de Pre-Asignados:* Al abrir la orden por primera vez, el sistema precarga automáticamente los repuestos reservados por el despachador, cruzando sus IDs con el catálogo local para mostrar el stock real.
        *   *Buscador en Memoria:* Modal flotante que consulta `dbCatalogo` (IndexedDB) aplicando filtrado en el cliente con debounce de 300ms.
        *   *Control de Límites:* Selectores de cantidad con botones táctiles (`+` y `-`) con validación de frontera superior (`:max="stockDisponible"`), impidiendo reservar más piezas de las físicamente disponibles.
    *   **Paso 3 — Ejecución:** Registro de horas trabajadas (validación numérica estricta) y reporte técnico en área de texto libre.
    *   **Paso 4 — Hardware y Evidencia Multimedia:**
        *   *Acceso al Lente Trasero:* Input con atributo estándar `capture="environment"` para abrir la cámara principal del smartphone directamente.
        *   **Motor de Compresión Canvas en Cliente:** Una rutina asíncrona intercepta la fotografía capturada (5MB a 12MB), la proyecta sobre un `<canvas>` virtual en memoria, la redimensiona a un ancho máximo de **1200px** y exporta un Base64 JPEG con compresión al **85%**. Esto reduce el peso final a menos de ~250KB, protegiendo la memoria RAM del teléfono y el almacenamiento de IndexedDB.
        *   *Galería Multi-Foto:* Cuadrícula responsiva que aloja hasta **5 evidencias fotográficas** con eliminación individual.
        *   *Lightbox Inmersivo:* Visor a pantalla completa montado vía `<Teleport to="body">`, blindado con `pointer-events: auto !important` para anular bloqueos de capas de Radix UI y permitir cerrar la foto tocando el fondo o el botón flotante.
        *   **Firma Digital Nativa (0 KB Dependencias):** Motor de dibujo en Canvas HTML5 desarrollado desde cero con la API W3C **Pointer Events** (`pointerdown`, `pointermove`, `pointerup`). Integra `setPointerCapture` para evitar que el trazo se corte si el dedo sale del recuadro, e implementa resolución dinámica con `getBoundingClientRect` al abrir el acordeón para evitar deformaciones del trazo.
    *   **Persistencia Continua (Auto-Guardado Infalible):**
        *   Un *Deep Watcher* reactivo observa el formulario completo (`form`). Cualquier tecla presionada, material modificado, foto tomada o firma trazada se escribe **inmediatamente** en IndexedDB bajo la clave `'draft_orden_' + id`.
        *   Si el smartphone se apaga por batería o el navegador se cierra bruscamente, el operario recupera el 100% de su progreso al reabrir la orden.

*   **Ciclo de Vida: Pausar y Reanudar:**
    *   *Pausar Orden:* Abre un diálogo exigiendo el motivo de la pausa; muta el estado a `Pausada`, **conserva el borrador intacto en IndexedDB** y redirige al historial.
    *   *Reanudar Trabajo:* Al abrir una orden pausada, el sistema oculta los botones de cierre y presenta un único botón verde destacado: **"Reanudar Trabajo"**. Al presionarlo, invoca `POST /tecnico/ordenes/{id}/reanudar` (inyectando token CSRF fresco), muta el estado local a `EnProgreso` y desbloquea los controles de trabajo.

---

### 3. Motor de Sincronización y Cola Offline (SyncQueue)
La infraestructura que permite al técnico completar órdenes y pausar trabajos en sótanos o túneles sin conexión a internet, garantizando la entrega garantizada hacia el backend en .NET 10.

*   **Arquitectura de la Cola de Sincronización (`src/store/sync.store.ts`):**
    *   **Sanitización contra DataCloneError:** Para almacenar el trabajo en IndexedDB sin fallos, el store aplica una purificación profunda:
        ```typescript
        const dataLimpia = JSON.parse(JSON.stringify(data))
        await dbSyncQueue.setItem(id, { tipo, payload: dataLimpia, ordenId, fecha: Date.now() })
        ```
        Esto elimina los *Proxies Reactivos* internos de Vue 3 que hacen colapsar el algoritmo *Structured Clone* de los navegadores móviles, almacenando objetos planos puros.
    *   **Reconstrucción Dinámica de Multipart/FormData:** Al momento del envío, el motor extrae los strings Base64 de las evidencias y los convierte en binarios `File` nativos (`base64ToFile`), reconstruyendo un `FormData` en caliente que respeta la indexación de arrays exigida por el Model Binder de ASP.NET Core:
        ```typescript
        formData.append(`repuestos[${index}].repuestoId`, rep.id.toString())
        formData.append(`repuestos[${index}].cantidad`, rep.cantidad.toString())
        ```
    *   **Refresco Proactivo de Seguridad (CSRF):** Antes de vaciar la cola, el store ejecuta `await fetchCsrfToken()` para garantizar que todas las peticiones encoladas viajen con un token Anti-Forgery válido, evitando rechazos con código HTTP 400.
    *   **Resolución de Conflictos:** Si el servidor rechaza una orden encolada con HTTP 400 o 404 (ej. la orden fue cancelada por el despachador en oficina), el motor la descarta automáticamente de la cola para prevenir bucles infinitos de reintentos que drenen la batería del smartphone.

*   **Gatillo Automático (Background Sync Híbrido):**
    *   Un observador reactivo escucha el estado de red (`watch(isOnline, ..., { immediate: true })`).
    *   En el instante milimétrico en que el dispositivo recupera señal Wi-Fi o 4G, el sistema verifica si existen tareas pendientes (`pendingSyncCount > 0`) y ejecuta `procesarSyncQueue()` en segundo plano sin intervención del usuario.
    *   Al finalizar, despacha un mensaje de éxito, destruye el borrador local y actualiza los catálogos del día con `descargarDatosDelDia()`.

*   **Panel de Monitoreo Offline (`SyncQueueView.vue`):**
    *   Vista accesible desde la barra de navegación inferior (`/tecnico/sync`) que lista cronológicamente las órdenes guardadas en el dispositivo.
    *   Exhibe tarjetas informativas con el ID de la orden, el tipo de acción (Completada o Pausada) y la fecha de guardado en el teléfono.
    *   Permite forzar la sincronización manual mediante el botón "Sincronizar Ahora" o descartar ítems manualmente con confirmación.

---

### 4. Módulo de Historial y Modo Auditoría (Solo Lectura)
Diseñado para que el técnico consulte trabajos previos, audite evidencias fotográficas y retome órdenes pausadas en campo con un flujo de interacción móvil continuo.

*   **Bandeja de Trabajos (`HistorialView.vue`):**
    *   **Gestión Híbrida de Almacenamiento (Online / Offline):**
        *   *Pestaña "Pausadas" (100% Offline):* Consulta directamente la base de datos local en IndexedDB (`dbOrdenes`). Permite buscar y filtrar trabajos detenidos en memoria RAM sin requerir cobertura celular.
        *   *Pestaña "Completadas" (Híbrida con Sincronización):* Si el dispositivo está sin red, lee los trabajos completados que residen localmente en la cola (`dbSyncQueue`). Al recuperar internet, consulta el endpoint paginado `GET /api/v1/tecnico/historial` combinando la data local con la del servidor.
    *   **Paginación Ergonómica ("Cargar Más"):** Erradicación de los controles numéricos de escritorio en favor del patrón móvil *Load More*. Calcula si `page < totalPages` para desplegar un botón de bloque completo con indicador de carga (`Loader2`), concatenando los nuevos registros reactivamente al final de la lista.
    *   **Búsqueda Debounced:** Input de filtrado reactivo con retraso de 300ms sobre el título de la orden o el nombre del activo.
    *   **Enrutamiento Condicional Inteligente:**
        *   *Al tocar una orden Pausada:* Navega al Wizard (`/tecnico/orden/:id/ejecucion`), donde el auto-guardado restaura los borradores y presenta el botón para reanudar el trabajo.
        *   *Al tocar una orden Completada:* Redirige a la ficha inmutable de auditoría (`/tecnico/orden/:id/readonly`).
    *   **Auto-Refresco de Ruta:** Implementa un observador sobre `route.path` para forzar la rehidratación de datos desde IndexedDB en el milisegundo exacto en que el técnico es redirigido tras pausar o completar una tarea.

*   **Ficha de Solo Lectura Inmutable (`OrdenDetalleReadOnly.vue`):**
    *   **Diseño de Scroll Continuo (Sin Acordeones):** Para optimizar la velocidad de auditoría en smartphones, se descartó el acordeón del Wizard en favor de una lectura vertical fluida que expone la información sin clics innecesarios.
    *   **Defensa en Profundidad contra XSS (DOMPurify):** Las notas registradas por el técnico se procesan al vuelo antes de inyectarse al DOM con `v-html`:
        ```typescript
        const notasSanitizadas = computed(() => {
          if (!orden.value?.notasTecnico) return ''
          return DOMPurify.sanitize(orden.value.notasTecnico, { ALLOWED_ATTR: [] })
        })
        ```
        La regla `ALLOWED_ATTR: []` elimina cualquier atributo malicioso (`onload`, `onerror`, `style`), permitiendo únicamente etiquetas semánticas de formato.
    *   **Privacidad Financiera B2B:** La sección de materiales utilizados exhibe las cantidades reales consumidas (`x2 uds`), pero omite deliberadamente los precios unitarios y subtotales, reservando la información de costos exclusivamente para la vista del despachador en oficina.
    *   **Mosaico de Evidencia Fotográfica:** Las fotos del trabajo se renderizan en una cuadrícula CSS (`grid-cols-2 gap-3`) con clase `aspect-square object-cover`, garantizando que imágenes capturadas en vertical u horizontal mantengan proporciones geométricas uniformes.
    *   **Visor Multimedia (Lightbox a Pantalla Completa):** Al tocar cualquier fotografía, se despliega un visor flotante inmersivo (`Teleport to="body"`) con fondo desenfocado (`backdrop-blur-sm`), z-index absoluto (`z-[9999]`) y botón táctil de salida (`XCircle`).
    *   **Inspección de Firma Digital:** Contenedor con fondo blanco de alto contraste que proyecta la firma de conformidad trazada por el cliente en el sitio.
    *   **Resolución Dinámica de Archivos:** La rutina `obtenerUrlFoto` evalúa dinámicamente si el origen es una ruta relativa del servidor (concatenando la URL base del backend) o una URI local en Base64, evitando errores de carga 404.

---

## Despliegue PWA y Arquitectura en la Nube

Para superar las restricciones de conectividad y permitir pruebas en dispositivos móviles reales (Android / iOS) con acceso completo a hardware, el sistema implementa una arquitectura híbrida de despliegue:

*   **Alojamiento en Vercel (Frontend):**
    *   Compilación continua automatizada conectada al repositorio de GitHub.
    *   Entrega global bajo protocolo **HTTPS estricto con certificado SSL válido**, requisito indispensable para que los navegadores móviles permitan el uso de la Cámara (`getUserMedia`), la Geolocalización GPS y el registro del Service Worker.
    *   **Enrutamiento SPA (`vercel.json`):** Reglas de reescritura de URLs (`rewrites`) para redirigir todo el tráfico a `index.html`, evitando errores 404 en el modo History de Vue Router al recargar páginas profundas.
*   **Túnel Seguro de Desarrollo (Microsoft Dev Tunnels):**
    *   Exposición segura y persistente del backend local de .NET 10 hacia internet (`https://*.devtunnels.ms`).
    *   Permite que la PWA instalada en el smartphone se comunique en tiempo real con la base de datos SQL Server que corre en la estación de trabajo local, sin depender de redes Wi-Fi locales compartidas.
*   **PWA Instalable (Standalone Mode):**
    *   Manifiesto oficial configurado con íconos de alta densidad (192px y 512px con soporte `maskable` para Android).
    *   Permite la instalación nativa desde Chrome ("Instalar aplicación") y Safari ("Agregar a pantalla de inicio"), ejecutándose sin barras de navegación del navegador y con orientación bloqueada en vertical.

---

## Guía de Despliegue y Pruebas de Campo (Peer Review)

Para evaluar correctamente esta aplicación y probar sus capacidades de hardware (Cámara) y PWA (Instalación y Offline-First) en un dispositivo móvil real, el frontend debe servirse bajo un entorno **HTTPS seguro**. 

A continuación, se detalla el tutorial paso a paso para desplegar el Frontend en **Vercel** y conectarlo a tu Backend local mediante un túnel seguro.

### Paso 1: Preparar el Repositorio (Fork)
Para que Vercel pueda compilar el proyecto, necesitas tenerlo en tu propia cuenta de GitHub.
1. Ve a la parte superior derecha de este repositorio y haz clic en el botón **"Fork"**.
2. Crea el fork en tu cuenta personal de GitHub.

### Paso 2: Exponer el Backend a Internet (Dev Tunnels)
El frontend en la nube necesitará comunicarse con la API de .NET 10 que corre en tu máquina. Usaremos los túneles nativos de Visual Studio.
1. Abre el proyecto del **Backend** en Visual Studio 2022.
2. Al lado del botón verde de "Iniciar" (Play), haz clic en la flecha desplegable.
3. Ve a **Túneles de desarrollo (Dev Tunnels)** -> **Crear un túnel...**
4. Configúralo así:
   - **Nombre:** `nexusfield-api`
   - **Tipo:** Persistente
   - **Acceso:** **Público** (Crítico para que Vercel pueda acceder).
5. Inicia el backend (Play). Se abrirá una consola o navegador mostrando una URL pública de Microsoft (ej. `https://abcd-1234.inc1.devtunnels.ms`). **Copia esta URL base.**
6. *⚠️ Paso de Seguridad:* Abre esa URL copiada en el navegador de tu celular y de tu PC. Si Microsoft muestra una pantalla de advertencia ("You are connecting to a developer tunnel"), haz clic en **"Continue"**. Esto autoriza el tráfico.

### Paso 3: Despliegue del Frontend en Vercel
1. Crea una cuenta gratuita o inicia sesión en [Vercel.com](https://vercel.com/) usando tu cuenta de GitHub.
2. Haz clic en **"Add New..."** -> **"Project"**.
3. Importa el repositorio (Fork) de `nexusfield-frontend` que creaste en el Paso 1.
4. En la pantalla de configuración del despliegue, ve a la sección **Environment Variables** y agrega:
   - **Key:** `VITE_API_URL`
   - **Value:** Pega la URL de tu túnel y agrégale `/api/v1` al final (Ej: `https://abcd-1234.inc1.devtunnels.ms/api/v1`).
5. Haz clic en **Deploy**. En menos de un minuto, Vercel te entregará una URL pública (ej. `https://nexusfield-frontend.vercel.app`). **Copia esta URL.**

### Paso 4: Autorizar Vercel en el Backend (CORS)
Para que el backend acepte las peticiones del frontend desplegado:
1. Vuelve a Visual Studio (Backend) y abre el archivo `Program.cs`.
2. En la configuración de CORS (`AddCors`), agrega la URL exacta que te dio Vercel:
   ```csharp
   policy.WithOrigins(
       "http://localhost:5173",
       "https://tu-url-generada.vercel.app" // <-- Pega aquí la URL de Vercel (sin barra / al final)
   )
   .AllowAnyHeader()
   .AllowAnyMethod()
   .AllowCredentials();
   ```
3. Guarda y **reinicia el backend** en Visual Studio.

---

### Paso 5: Pruebas de Campo (El "Wow Factor")

Con el backend corriendo en tu PC y el frontend en Vercel, toma tu teléfono móvil (con Wi-Fi o datos) y sigue este flujo para evaluar la arquitectura:

1. **Instalación PWA:**
   - Abre Chrome (Android) o Safari (iOS) en tu celular y entra a la URL de Vercel.
   - El navegador te sugerirá **"Instalar aplicación"** o "Agregar a la pantalla de inicio". Acéptalo.
   - Cierra el navegador y abre la app "NexusField" desde el icono en tu pantalla. Se ejecutará en pantalla completa nativa.

2. **Prueba de Hardware y Sincronización:**
   - Inicia sesión con el rol de **Técnico** (Usuario: `tecnico1` / Clave: `Tecnico2026!`).
   - Abre una orden pendiente y haz clic en "Comenzar Trabajo".
   - En el Paso 4 (Evidencia), prueba la **Cámara** (se abrirá el lente trasero nativo) y el **Lienzo de Firma** táctil.

3. **Prueba de Resiliencia Offline (El Sótano):**
   - Pon tu teléfono en **Modo Avión** (apaga Wi-Fi y Datos).
   - Recarga la aplicación. Verás que carga instantáneamente y el indicador superior cambia a "Modo Local" (Amarillo).
   - Completa la orden, toma una foto, firma y presiona **"Guardar Localmente"**.
   - Ve a la pestaña inferior **"Cola Sync"**. Verás tu orden encolada de forma segura en IndexedDB.
   - **Quita el Modo Avión**. En el instante en que el teléfono recupere la señal, el *Background Sync* se disparará automáticamente, enviando el `FormData` al servidor y vaciando la cola.

---

### Solución de Problemas Comunes (Troubleshooting)

- **Error `Network Error` al iniciar sesión:**
  *Causa:* El frontend en Vercel no alcanza tu PC.
  *Solución:* Verifica que Visual Studio esté en ejecución (Play). Asegúrate de haber aceptado la pantalla de advertencia de Dev Tunnels en tu navegador.
- **Error 400 (Anti-Forgery Token) o 403 (CORS):**
  *Causa:* Las políticas de seguridad están bloqueando la petición.
  *Solución:* Verifica que en `Program.cs` la URL de Vercel esté escrita exactamente igual (con `https://` y sin `/` al final) y que el backend haya sido reiniciado después de agregarla.

---

## Licencia y Derechos

Desarrollado por **Diego Quintero** para el Proyecto Final de Capacitación .NET C# y Vue.js
NexusField © 2026 — Todos los derechos reservados