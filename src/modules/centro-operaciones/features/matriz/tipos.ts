import type { Enums } from '../../lib/database.types'
import type { Disposicion, Umbrales } from '../../lib/urgencia'

export interface PersonaBreve {
  id: string
  nombre: string
  iniciales: string | null
  /** Si configuró un PIN para "¿Quién soy?" (solo en los catálogos). */
  tiene_pin?: boolean
}

/** Lo que la matriz necesita de cada tarea. */
export interface TareaMatriz {
  id: string
  tipo: Enums<'tipo_tarea'>
  titulo: string
  importante: boolean
  urgencia_manual: number | null
  estado: Enums<'estado_tarea'>
  /** Para "Devolver al estado anterior" (null si no hay a dónde volver). */
  estado_anterior: Enums<'estado_tarea'> | null
  motivo_espera: Enums<'motivo_espera'> | null
  motivo_espera_detalle: string | null
  fecha_entrega: string | null
  /** Hora de inicio prevista (para la línea del día de "Mis tareas"). */
  fecha_inicio?: string | null
  terminada_at: string | null
  entregada_at: string | null
  /** Lo que debe el cliente (para "Copiar mensaje"). */
  saldo: number
  cliente: { nombre: string; telefono: string | null } | null
  responsables: PersonaBreve[]
  subtareas: { total: number; hechas: number }
  /** Se está guardando (creación optimista): todavía no se puede abrir. */
  provisoria?: boolean
}

export interface ConfigMatriz {
  umbrales: Umbrales
  disposicion: Disposicion
  /** Confeti al terminar (configuracion.confeti_activado). */
  confeti: boolean
  /** Plantilla de "Copiar mensaje", con {nombre}, {trabajo} y {saldo}. */
  plantilla: string
}
