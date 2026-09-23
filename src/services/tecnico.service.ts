import api from '@/services/api'
import type { OrdenDetalleDto } from '@/services/ordenes.service'

export interface OrdenTecnicoDto {
  id: number
  titulo: string
  descripcion: string
  activoNombre: string
  ubicacion: string
  linkGoogleMaps: string | null
  telefonoContacto: string | null
  prioridad: 'Baja' | 'Media' | 'Alta'
  estado: 'Pendiente' | 'EnProgreso' | 'Pausada' | 'Completada'
  fechaCreacion?: string
  repuestosPreAsignados: { repuestoId: number; nombre: string; cantidad: number }[]
}

export interface CatalogoLigeroDto {
  id: number
  nombre: string
  precio: number
  stockDisponible: number
}

export interface HistorialPaginadoResponse {
  data: OrdenTecnicoDto[]
  totalRecords: number
  currentPage: number
  totalPages: number
}

export const TecnicoService = {
  async obtenerMisOrdenes(): Promise<OrdenTecnicoDto[]> {
    const { data } = await api.get<OrdenTecnicoDto[]>('/tecnico/mis-ordenes')
    return data
  },
  
  async obtenerHistorial(page: number, pageSize: number, estado: string, q?: string): Promise<HistorialPaginadoResponse> {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())
    params.append('estado', estado)
    if (q) params.append('q', q)
    const { data } = await api.get<HistorialPaginadoResponse>(`/tecnico/historial?${params.toString()}`)
    return data
  },
  
  async obtenerDetalleOrden(id: number): Promise<OrdenDetalleDto> {
    const response = await api.get<OrdenDetalleDto>(`/ordenes/${id}`)
    return response.data
  },
  
  async obtenerCatalogoOffline(): Promise<CatalogoLigeroDto[]> {
    const { data } = await api.get<CatalogoLigeroDto[]>('/tecnico/catalogo-offline')
    return data
  },

  async iniciarOrden(id: number): Promise<void> {
    await api.post(`/tecnico/ordenes/${id}/iniciar`)
  },

  async rechazarOrden(id: number, motivoRechazo: string): Promise<void> {
    await api.post(`/tecnico/ordenes/${id}/rechazar`, { motivoRechazo })
  },

  async pausarOrden(id: number, motivo: string): Promise<void> {
    await api.post(`/tecnico/ordenes/${id}/pausar`, { motivoPausa: motivo })
  },
  
  async reanudarOrden(id: number): Promise<void> {
    await api.post(`/tecnico/ordenes/${id}/reanudar`)
  },

  async completarOrden(id: number, data: FormData): Promise<void> {
    await api.post(`/tecnico/ordenes/${id}/completar`, data, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}
