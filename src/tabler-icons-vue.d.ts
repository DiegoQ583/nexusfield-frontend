/**
 * Declaración de módulo para @tabler/icons-vue.
 *
 * El paquete no incluye tipos TypeScript y no existen @types correspondientes.
 * Este shim permite que vue-tsc resuelva el módulo correctamente.
 * Se usa exclusivamente en los componentes generados por shadcn-vue.
 */

declare module '@tabler/icons-vue' {
  import type { DefineComponent } from 'vue'

  // Tipo genérico para todos los iconos de Tabler
  type TablerIcon = DefineComponent<{
    size?: string | number
    strokeWidth?: string | number
    stroke?: string
    class?: string
  }>

  // ── Iconos usados por Sonner (shadcn-vue) ────────────────────────────────
  export const IconCircleCheck: TablerIcon
  export const IconInfoCircle: TablerIcon
  export const IconLoader2: TablerIcon
  export const IconOctagonOff: TablerIcon
  export const IconAlertTriangle: TablerIcon
  export const IconX: TablerIcon

  // ── Iconos usados por DropdownMenu (shadcn-vue) ──────────────────────────
  export const IconCheck: TablerIcon
  export const IconCircle: TablerIcon
  export const IconChevronRight: TablerIcon

  // ── Iconos usados por Select (shadcn-vue) ────────────────────────────────
  export const IconChevronDown: TablerIcon
  export const IconChevronUp: TablerIcon

  // ── Iconos usados por Sheet (shadcn-vue) ─────────────────────────────────
  export const IconChevronLeft: TablerIcon

  // ── Wildcard: permite importar cualquier ícono adicional sin error ────────
  const _default: Record<string, TablerIcon>
  export default _default
}
