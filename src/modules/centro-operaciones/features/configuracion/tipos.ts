import type { Enums } from '../../lib/database.types'

/** Una persona del equipo en Configuración (también las dadas de baja). */
export interface PersonaConfig {
  id: string
  nombre: string
  iniciales: string | null
  activa: boolean
  tiene_pin: boolean
}

/** Una categoría en Configuración (también las desactivadas). */
export interface CategoriaConfig {
  id: string
  nombre: string
  tipo_aplica: Enums<'tipo_categoria'>
  activa: boolean
}

/** Un evento del historial global (especificación 7.11). */
export interface EventoHistorial {
  id: string
  accion: string
  persona: string | null
  persona_id: string | null
  tarea_id: string | null
  tarea_titulo: string | null
  proyecto_id: string | null
  proyecto_nombre: string | null
  cambios: Record<string, unknown>
  created_at: string
}

export interface PaginaHistorial {
  eventos: EventoHistorial[]
  /** Para pedir la página siguiente (null = no hay más). */
  siguiente: string | null
}
