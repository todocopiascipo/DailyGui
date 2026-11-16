import type { Enums } from '../../lib/database.types'
import type { Disposicion } from '../../lib/urgencia'

export interface PersonaBreve {
  id: string
  nombre: string
  iniciales: string | null
  /** Si configuró un PIN para "¿Quién soy?" (solo en los catálogos). */
  tiene_pin?: boolean
}

/** Una tarea de la que depende otra (Fase 14). `hecha` = ya terminada. */
export interface Dependencia {
  id: string
  titulo: string
  hecha: boolean
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
  /** Tarea interna relacionada con un pedido (orden de trabajo). */
  pedido?: { id: string; titulo: string } | null
  /** Tareas a las que espera (de la misma OT). */
  depende_de?: Dependencia[]
  /** Solo en la lista de OT: avance de sus tareas. */
  tareas_ot?: { total: number; hechas: number }
  /** Importancia y urgencia de 0 a 10 (de 6 a 10 = "sí"). */
  nivel_importancia: number
  nivel_urgencia: number
  responsables: PersonaBreve[]
  subtareas: { total: number; hechas: number }
  /** Se está guardando (creación optimista): todavía no se puede abrir. */
  provisoria?: boolean
}

export interface ConfigMatriz {
  disposicion: Disposicion
  /** Confeti al terminar (configuracion.confeti_activado). */
  confeti: boolean
  /** Plantilla de "Copiar mensaje", con {nombre}, {trabajo} y {saldo}. */
  plantilla: string
  /** Días que una tarea queda en la papelera (configuracion.papelera_dias). */
  papeleraDias: number
}
