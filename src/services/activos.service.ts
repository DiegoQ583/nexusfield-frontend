import api from '@/services/api'

export interface ActivoResponseDto {
  id: number
  nombre: string
  descripcion: string | null
  ubicacion: string
  clienteActual: string
  estado: 'Operativo' | 'Requiere Mantenimiento'
  activo: boolean
  linkGoogleMaps: string | null
  telefonoContacto: string | null
}

export interface ActivoPaginadoResponse {
  data: ActivoResponseDto[]
  totalRecords: number
  currentPage: number
  totalPages: number
}

export interface ActivoLigeroDto {
  id: number
  nombre: string
}

export interface GuardarActivoDto {
  nombre: string
  descripcion: string | null
  ubicacion: string
  clienteActual: string
  estado: string
  linkGoogleMaps: string | null
  telefonoContacto: string | null
}

export interface HistorialActivoDto {
  ordenId: number
  titulo: string
  tecnicoNombre: string
  fechaCompletada: string
  notasTecnico: string | null
}

export const ActivosService = {
  async obtenerPaginados(page: number, pageSize: number, q?: string): Promise<ActivoPaginadoResponse> {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())
    if (q) {
      params.append('q', q)
    }
    const { data } = await api.get<ActivoPaginadoResponse>(`/activos?${params.toString()}`)
    return data
  },

  async buscar(q: string): Promise<ActivoLigeroDto[]> {
    const { data } = await api.get<ActivoLigeroDto[]>(`/activos/buscar?q=${q}`)
    return data
  },

  async crear(data: GuardarActivoDto): Promise<ActivoResponseDto> {
    const response = await api.post<ActivoResponseDto>('/activos', data)
    return response.data
  },

  async actualizar(id: number, data: GuardarActivoDto): Promise<void> {
    await api.put(`/activos/${id}`, data)
  },

  async cambiarEstado(id: number): Promise<void> {
    await api.patch(`/activos/${id}/estado`)
  },

  async obtenerHistorial(id: number): Promise<HistorialActivoDto[]> {
    const { data } = await api.get<HistorialActivoDto[]>(`/activos/${id}/historial`)
    return data
  }
}
