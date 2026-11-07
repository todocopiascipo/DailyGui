import type { Enums } from '../../lib/database.types'
import type { Disposicion, Umbrales } from '../../lib/urgencia'

export interface PersonaBreve {
  id: string
  nombre: string
  iniciales: string | null
}

/** Lo que la matriz necesita de cada tarea. */
export interface TareaMatriz {
  id: string
  tipo: Enums<'tipo_tarea'>
  titulo: string
  importante: boolean
  urgencia_manual: number | null
  estado: Enums<'estado_tarea'>
  motivo_espera: Enums<'motivo_espera'> | null
  motivo_espera_detalle: string | null
  fecha_entrega: string | null
  responsables: PersonaBreve[]
  subtareas: { total: number; hechas: number }
}

export interface ConfigMatriz {
  umbrales: Umbrales
  disposicion: Disposicion
}
