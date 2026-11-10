import type { Enums } from './database.types'
import { esMismoDia } from './tiempo'

/** Umbrales de la urgencia estimada, en horas (configuracion.umbrales_urgencia). */
export interface Umbrales {
  nivel_5_horas: number
  nivel_3_horas: number
  nivel_2_horas: number
}

export const UMBRALES_POR_DEFECTO: Umbrales = {
  nivel_5_horas: 2,
  nivel_3_horas: 24,
  nivel_2_horas: 72,
}

export type Nivel = 1 | 2 | 3 | 4 | 5

/**
 * Urgencia estimada (especificación 6.1):
 * 5 → vencida o vence en ≤ 2 h · 4 → vence hoy · 3 → ≤ 24 h · 2 → ≤ 72 h · 1 → más o sin fecha.
 */
export function urgenciaEstimada(
  entrega: Date | null,
  ahora: Date,
  umbrales: Umbrales = UMBRALES_POR_DEFECTO,
): Nivel {
  if (!entrega) return 1
  const horas = (entrega.getTime() - ahora.getTime()) / 3_600_000
  if (horas <= umbrales.nivel_5_horas) return 5
  if (esMismoDia(entrega, ahora)) return 4
  if (horas <= umbrales.nivel_3_horas) return 3
  if (horas <= umbrales.nivel_2_horas) return 2
  return 1
}

/** Manda la urgencia manual; si no hay, la estimada. */
export function urgenciaEfectiva(manual: number | null, estimada: Nivel): Nivel {
  if (manual !== null && manual >= 1 && manual <= 5) return manual as Nivel
  return estimada
}

export function esUrgente(efectiva: Nivel): boolean {
  return efectiva >= 3
}

export type Cuadrante = 'hacer' | 'planificar' | 'delegar' | 'eliminar'

export function cuadranteDe(importante: boolean, urgente: boolean): Cuadrante {
  if (importante) return urgente ? 'hacer' : 'planificar'
  return urgente ? 'delegar' : 'eliminar'
}

/** Títulos visibles: describen la combinación de urgencia e importancia. */
export const NOMBRES_CUADRANTE: Record<Cuadrante, string> = {
  hacer: 'Urgente e importante',
  planificar: 'No urgente e importante',
  delegar: 'Urgente y no importante',
  eliminar: 'No urgente y no importante',
}

/** Posición de cada cuadrante en pantalla (configuracion.disposicion_cuadrantes). */
export interface Disposicion {
  arriba_izquierda: Cuadrante
  arriba_derecha: Cuadrante
  abajo_izquierda: Cuadrante
  abajo_derecha: Cuadrante
}

export const DISPOSICION_POR_DEFECTO: Disposicion = {
  arriba_izquierda: 'planificar',
  arriba_derecha: 'hacer',
  abajo_izquierda: 'eliminar',
  abajo_derecha: 'delegar',
}

/**
 * Aspecto visual del globo (especificación 6.6 y 9.4). Lo que define el aspecto
 * siempre va acompañado de un icono o texto: nunca solo color.
 */
export type Aspecto =
  | 'neutro' // urgencia 1–2
  | 'media' // 3: tinte verde
  | 'alta' // 4: naranja → rojizo
  | 'muy_alta' // 5 sin ser hoy (urgencia manual): rojizo intenso
  | 'dia_entrega' // vence hoy: rojizo intenso + "!" + pulso
  | 'vencida' // rojo muy oscuro → casi negro + calavera
  | 'terminada' // azul
  | 'en_espera' // vidrio atenuado + pausa

export function aspectoDe(params: {
  estado: Enums<'estado_tarea'>
  entrega: Date | null
  efectiva: Nivel
  ahora: Date
}): Aspecto {
  const { estado, entrega, efectiva, ahora } = params
  if (estado === 'terminada') return 'terminada'
  if (entrega && entrega.getTime() < ahora.getTime()) return 'vencida'
  if (estado === 'en_espera') return 'en_espera'
  if (entrega && esMismoDia(entrega, ahora)) return 'dia_entrega'
  if (efectiva === 5) return 'muy_alta'
  if (efectiva === 4) return 'alta'
  if (efectiva === 3) return 'media'
  return 'neutro'
}

/** Orden dentro del cuadrante: urgencia efectiva (mayor primero) y entrega más cercana. */
export function compararParaCuadrante(
  a: { efectiva: Nivel; entrega: Date | null },
  b: { efectiva: Nivel; entrega: Date | null },
): number {
  if (a.efectiva !== b.efectiva) return b.efectiva - a.efectiva
  const ta = a.entrega?.getTime() ?? Number.POSITIVE_INFINITY
  const tb = b.entrega?.getTime() ?? Number.POSITIVE_INFINITY
  return ta - tb
}

/**
 * Qué cambia al arrastrar una tarea a otro cuadrante (especificación 6.3):
 * `importante` según la fila de destino y `urgencia_manual` según la columna
 * (a urgente → max(efectiva, 3); a no urgente → min(efectiva, 2)).
 * Devuelve null si ya está en ese cuadrante.
 */
export function movimiento(
  tarea: { importante: boolean; urgencia_manual: number | null; fecha_entrega: string | null },
  destino: Cuadrante,
  umbrales: Umbrales,
  ahora: Date,
): { importante: boolean; urgencia_manual: Nivel } | null {
  const entrega = tarea.fecha_entrega ? new Date(tarea.fecha_entrega) : null
  const efectiva = urgenciaEfectiva(
    tarea.urgencia_manual,
    urgenciaEstimada(entrega, ahora, umbrales),
  )
  if (cuadranteDe(tarea.importante, esUrgente(efectiva)) === destino) return null
  const urgente = destino === 'hacer' || destino === 'delegar'
  return {
    importante: destino === 'hacer' || destino === 'planificar',
    urgencia_manual: (urgente ? Math.max(efectiva, 3) : Math.min(efectiva, 2)) as Nivel,
  }
}
