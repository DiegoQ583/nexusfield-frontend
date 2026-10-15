
import api from '@/services/api'

// ─── Interfaces TypeScript (DTOs) ────────────────────────────────────────────

export type OrdenPrioridad = 'Baja' | 'Media' | 'Alta'
export type OrdenEstado = 'Pendiente' | 'EnProgreso' | 'Pausada' | 'Completada' | 'Cancelada'

export interface OrdenDto {
  id: number
  titulo: string
  activoNombre: string
  tecnicoNombre: string
  prioridad: OrdenPrioridad
  estado: OrdenEstado
  fechaCreacion: string
}

export interface OrdenPaginadaResponse {
  data: OrdenDto[]
  totalRecords: number
  currentPage: number
  totalPages: number
}

export interface OrdenQueryParams {
  page: number
  pageSize: number
  /** Texto libre de búsqueda (por título o técnico) */
  q?: string
  /** Filtro por ID de técnico asignado */
  tecnicoId?: number
  /** Filtro por estado(s) exactos de la orden separados por coma */
  estado?: string | string[]
  /** Tab activo: 'activas' | 'historial' (el backend mapea este valor internamente) */
  tab?: string
  /** Filtro por nivel de prioridad */
  prioridad?: string
  /** Filtro de tiempo: 'hoy', 'semana', 'mes', 'todos' */
  filtroTiempo?: string
}

export interface CrearOrdenDto {
  titulo: string
  descripcion: string
  activoId: number
  tecnicoId: number
  prioridad: OrdenPrioridad
  repuestos: { repuestoId: number; cantidad: number }[]
}

export interface RepuestoUsadoDto {
  repuestoNombre: string
  cantidad: number
  precioHistorico: number
}

export interface OrdenDetalleDto {
  id: number
  titulo: string
  descripcion: string
  activoNombre: string
  ubicacion: string
  clienteHistorico: string
  tecnicoNombre: string
  linkGoogleMaps: string | null
  telefonoContacto: string | null
  prioridad: OrdenPrioridad
  estado: OrdenEstado
  fechaCreacion: string
  fechaCompletada: string | null
  horasTrabajadas: number
  tarifaTecnico: number
  subtotalManoObra: number
  subtotalRepuestos: number
  costoTotal: number
  /** Notas escritas por el técnico al cerrar la orden. Puede contener HTML básico → sanitizar con DOMPurify. */
  notasTecnico: string | null
  /** Rutas de las fotos de evidencia tomadas en campo */
  fotosUrl: string[]
  /** Firma del cliente en Base64 (data URI completo: "data:image/png;base64,...") */
  firmaClienteBase64: string | null
  repuestos: RepuestoUsadoDto[]
}

// ─── Objeto de servicio ───────────────────────────────────────────────────────

export const OrdenesService = {
  /**
   * Obtiene una página de órdenes filtradas.
   * Construye los query parameters de forma dinámica, omitiendo los valores
   * vacíos / 'todas' para no ensuciar la URL con filtros nulos.
   */
  async obtenerPaginadas(params: OrdenQueryParams): Promise<OrdenPaginadaResponse> {
    // Construimos los params limpios: omitimos strings vacíos y el valor 'todas'
    const query: Record<string, string | number> = {
      page: params.page,
      pageSize: params.pageSize,
    }

    if (params.q?.trim()) query['q'] = params.q.trim()
    if (params.tecnicoId) query['tecnicoId'] = params.tecnicoId
    
    // Lógica inteligente de estados según el nuevo contrato del backend
    if (params.estado && params.estado.length > 0) {
      // Si el usuario seleccionó estados específicos, los enviamos unidos por coma
      query['estado'] = Array.isArray(params.estado) ? params.estado.join(',') : params.estado
    } else if (params.tab) {
      // Si no hay estados seleccionados, enviamos el nombre del tab ('activas' o 'historial')
      query['estado'] = params.tab
    }
    if (params.prioridad && params.prioridad !== 'todas') {
      query['prioridad'] = params.prioridad
    }
    if (params.filtroTiempo && params.filtroTiempo !== 'todos') {
      query['filtroTiempo'] = params.filtroTiempo
    }

    const response = await api.get<OrdenPaginadaResponse>('/ordenes', { params: query })
    return response.data
  },

  /**
   * Crea una nueva orden de trabajo con técnico y activo pre-asignados.
   */
  async crear(data: CrearOrdenDto): Promise<OrdenDto> {
    const response = await api.post<OrdenDto>('/ordenes', data)
    return response.data
  },

  /**
   * Obtiene el detalle completo de una orden: repuestos usados, notas, firma y foto.
   */
  async obtenerPorId(id: number): Promise<OrdenDetalleDto> {
    const response = await api.get<OrdenDetalleDto>(`/ordenes/${id}`)
    return response.data
  },

  /**
   * Reasigna una orden a un nuevo técnico.
   */
  async reasignar(id: number, nuevoTecnicoId: number): Promise<void> {
    await api.patch(`/ordenes/${id}/reasignar`, { nuevoTecnicoId })
  }
}
