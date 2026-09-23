/**
 * usuarios.service.ts — Capa de servicio para el módulo de Usuarios.
 *
 * Encapsula todas las llamadas HTTP al endpoint /usuarios para que los
 * componentes (Smart Views) no manejen Axios directamente.
 */

import api from '@/services/api'

// ─── Interfaces TypeScript (DTOs) ────────────────────────────────────────────

export interface UsuarioResponseDto {
  id: number
  nombreCompleto: string
  nombreUsuario: string
  correo: string
  telefono: string | null
  especialidad: string | null
  tarifaPorHora: number
  rol: string
  activo: boolean
}

export interface CrearUsuarioDto {
  nombreCompleto: string
  nombreUsuario: string
  correo: string
  clave: string
  telefono: string
  especialidad: string
  tarifaPorHora: number
  rol: string
}

export interface ActualizarUsuarioDto {
  nombreCompleto: string
  correo: string
  telefono: string
  especialidad: string
  tarifaPorHora: number
}

// ─── Objeto de servicio ───────────────────────────────────────────────────────

export const UsuariosService = {
  /**
   * Obtiene la lista de usuarios.
   * Si se pasa `rol`, filtra en el servidor por ese rol.
   */
  obtenerTodos(rol?: string): Promise<{ data: UsuarioResponseDto[] }> {
    const params = rol ? { rol } : {}
    return api.get<UsuarioResponseDto[]>('/usuarios', { params }).then((res) => ({
      data: res.data,
    }))
  },

  /**
   * Obtiene un usuario por ID para prellenar el formulario de edición.
   */
  obtenerPorId(id: number): Promise<UsuarioResponseDto> {
    return api.get<UsuarioResponseDto>(`/usuarios/${id}`).then((res) => res.data)
  },

  /**
   * Crea un nuevo usuario. Requiere nombreUsuario, clave y rol.
   */
  crear(data: CrearUsuarioDto): Promise<UsuarioResponseDto> {
    return api.post<UsuarioResponseDto>('/usuarios', data).then((res) => res.data)
  },

  /**
   * Actualiza datos editables del usuario. NO incluye nombreUsuario, clave ni rol.
   */
  actualizar(id: number, data: ActualizarUsuarioDto): Promise<UsuarioResponseDto> {
    return api.put<UsuarioResponseDto>(`/usuarios/${id}`, data).then((res) => res.data)
  },

  /**
   * Alterna el estado activo/inactivo de un usuario.
   * Puede fallar con 400 si el técnico tiene órdenes activas asignadas.
   */
  cambiarEstado(id: number): Promise<void> {
    return api.patch(`/usuarios/${id}/estado`).then(() => undefined)
  },
}
