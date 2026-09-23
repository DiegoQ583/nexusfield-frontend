import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Limpia un número de teléfono dejando solo los dígitos.
 * Si el usuario ya incluyó el +58, lo respeta. Si no, se lo agrega.
 */
export function formatTelefonoVE(telefono: string | null | undefined): string | null {
  if (!telefono || telefono.trim() === '') return null;
  
  // Dejar solo números
  let limpio = telefono.replace(/\D/g, '');
  
  // Si empieza con 58, asumimos que ya tiene el código de país
  if (limpio.startsWith('58')) {
    return `+${limpio}`;
  }
  
  // Si empieza con 0 (ej. 0412), se lo quitamos
  if (limpio.startsWith('0')) {
    limpio = limpio.substring(1);
  }
  
  return `+58${limpio}`;
}