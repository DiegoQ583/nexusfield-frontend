import api from '@/services/api'

// ─── Interfaces TypeScript (DTOs) ────────────────────────────────────────────

export interface RepuestoResponseDto {
  id: number
  nombre: string
  descripcion: string | null
  precio: number
  stockTotal: number
  stockReservado: number
  stockDisponible: number
  fotoUrl: string | null
  activo: boolean
}

export interface ReservaTecnicoDto {
  tecnicoNombre: string
  cantidad: number
  ordenId: number
}

export interface RepuestoDetalleDto extends RepuestoResponseDto {
  reservasActivas: ReservaTecnicoDto[]
}

// Alias de retrocompatibilidad para OrdenCreateSheet.vue (módulo despachador)
export type RepuestoDto = RepuestoResponseDto

export interface CrearRepuestoDto {
  nombre: string
  descripcion: string
  precio: number
  stockTotal: number
  foto: File | null
}

export interface ActualizarRepuestoDto {
  nombre: string
  descripcion: string
  precio: number
  stockTotal: number
  foto: File | null
  eliminarFoto?: boolean
}

// ─── Objeto de Servicio ───────────────────────────────────────────────────────

export const RepuestosService = {
  /**
   * Obtiene la lista completa del catálogo de repuestos.
   */
  async obtenerTodos(): Promise<RepuestoResponseDto[]> {
    const response = await api.get<RepuestoResponseDto[]>('/repuestos')
    return response.data
  },

  /**
   * Obtiene el detalle de un repuesto por su ID.
   */
  async obtenerPorId(id: number): Promise<RepuestoDetalleDto> {
    const { data } = await api.get<RepuestoDetalleDto>(`/repuestos/${id}`)
    return data
  },

  /**
   * Elimina (o da de baja lógica) un repuesto por su ID.
   */
  async eliminar(id: number): Promise<void> {
    await api.delete(`/repuestos/${id}`)
  },

  /**
   * Crea un nuevo repuesto, enviando los datos como multipart/form-data.
   */
  async crear(data: CrearRepuestoDto): Promise<RepuestoResponseDto> {
    const formData = new FormData()
    formData.append('nombre', data.nombre)
    formData.append('descripcion', data.descripcion)
    formData.append('precio', data.precio.toString())
    formData.append('stockTotal', data.stockTotal.toString())

    if (data.foto instanceof File) {
      formData.append('foto', data.foto)
    }

    const response = await api.post<RepuestoResponseDto>('/repuestos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  /**
   * Actualiza un repuesto existente usando multipart/form-data.
   * Si no se envía una nueva foto, el backend conserva la anterior.
   */
  async actualizar(id: number, data: ActualizarRepuestoDto): Promise<void> {
    const formData = new FormData()
    formData.append('nombre', data.nombre)
    formData.append('descripcion', data.descripcion || '')
    formData.append('precio', data.precio.toString())
    formData.append('stockTotal', data.stockTotal.toString())

    if (data.eliminarFoto === true) {
      formData.append('eliminarFoto', 'true')
    } else if (data.foto instanceof File) {
      formData.append('foto', data.foto)
    }

    await api.put(`/repuestos/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
}
