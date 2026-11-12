import type { Enums } from '../../lib/database.types'
import type { PersonaBreve, TareaMatriz } from '../matriz/tipos'
import type { EventoDetalle } from '../tarea/tipos'

export type EstadoProyecto = Enums<'estado_proyecto'>

/** Un proyecto en la lista, con su avance (tareas hechas / totales). */
export interface ProyectoResumen {
  id: string
  nombre: string
  descripcion: string | null
  estado: EstadoProyecto
  fecha_inicio: string | null
  fecha_objetivo: string | null
  categoria_id: string | null
  responsable: PersonaBreve | null
  progreso: { total: number; hechas: number }
}

/** Un proyecto abierto: sus tareas en orden y su historial. */
export interface ProyectoDetalle {
  proyecto: ProyectoResumen
  tareas: TareaMatriz[]
  eventos: EventoDetalle[]
}

export const NOMBRE_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  activo: 'Activo',
  en_pausa: 'En pausa',
  terminado: 'Terminado',
  cancelado: 'Cancelado',
}
