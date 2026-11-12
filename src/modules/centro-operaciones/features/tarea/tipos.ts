import type { Enums, Tables } from '../../lib/database.types'
import type { PersonaBreve } from '../matriz/tipos'

export type Tarea = Tables<'tareas'>

export interface Categoria {
  id: string
  nombre: string
  tipo_aplica: Enums<'tipo_categoria'>
}

/** Opciones para los formularios (personas activas y categorías activas). */
export interface Catalogos {
  personas: PersonaBreve[]
  categorias: Categoria[]
  /** Proyectos abiertos (activos o en pausa), para el campo "Proyecto". */
  proyectos?: { id: string; nombre: string }[]
}

export interface Cliente {
  id: string
  nombre_apellido: string
  telefono: string | null
}

export interface SubtareaDetalle {
  id: string
  titulo: string
  responsable_id: string | null
  hecha: boolean
  orden: number
}

export interface EventoDetalle {
  id: string
  accion: Tables<'eventos'>['accion']
  persona: string | null
  cambios: Record<string, unknown>
  created_at: string
}

export interface DetalleTarea {
  tarea: Tarea
  responsables: PersonaBreve[]
  subtareas: SubtareaDetalle[]
  cliente: Cliente | null
  creada_por: PersonaBreve | null
  eventos: EventoDetalle[]
  /** Pedido relacionado (si es una tarea interna enlazada a una OT). */
  pedido?: { id: string; titulo: string } | null
  /** Proyecto interno al que pertenece. */
  proyecto?: { id: string; nombre: string } | null
}
