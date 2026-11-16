import type { Enums } from './database.types'
import { esMismoDia } from './tiempo'

/**
 * Importancia y urgencia de cada tarea: niveles de 0 a 10 que se eligen con
 * sliders (Fase 12, pedido del usuario). De 0 a 5 es "no"; de 6 a 10, "sí".
 * La urgencia NO cambia sola con la fecha de entrega (decisión del usuario).
 */
export const NIVEL_MAX = 10
export const UMBRAL_SI = 6

export function esAlto(nivel: number): boolean {
  return nivel >= UMBRAL_SI
}

export type Cuadrante = 'hacer' | 'planificar' | 'delegar' | 'eliminar'

export function cuadranteDe(importante: boolean, urgente: boolean): Cuadrante {
  if (importante) return urgente ? 'hacer' : 'planificar'
  return urgente ? 'delegar' : 'eliminar'
}

export function cuadranteDeNiveles(importancia: number, urgencia: number): Cuadrante {
  return cuadranteDe(esAlto(importancia), esAlto(urgencia))
}

/** Títulos visibles: describen la combinación de importancia y urgencia. */
export const NOMBRES_CUADRANTE: Record<Cuadrante, string> = {
  hacer: 'Importante y urgente',
  planificar: 'Importante y no urgente',
  delegar: 'No importante y urgente',
  eliminar: 'No importante y no urgente',
}

/** Posición de cada cuadrante en pantalla (configuracion.disposicion_cuadrantes). */
export interface Disposicion {
  arriba_izquierda: Cuadrante
  arriba_derecha: Cuadrante
  abajo_izquierda: Cuadrante
  abajo_derecha: Cuadrante
}

/** Pedido del usuario (Fase 12): de izquierda a derecha y de arriba a abajo. */
export const DISPOSICION_POR_DEFECTO: Disposicion = {
  arriba_izquierda: 'hacer',
  arriba_derecha: 'planificar',
  abajo_izquierda: 'delegar',
  abajo_derecha: 'eliminar',
}

/**
 * Aspecto visual del globo (especificación 6.6 y 9.4). Lo que define el aspecto
 * siempre va acompañado de un icono o texto: nunca solo color.
 */
export type Aspecto =
  | 'neutro' // urgencia 0–5
  | 'media' // 6–7: tinte verde
  | 'alta' // 8–9: naranja → rojizo
  | 'muy_alta' // 10: rojizo intenso
  | 'dia_entrega' // vence hoy: rojizo intenso + "!" + pulso
  | 'vencida' // rojo muy oscuro → casi negro + calavera
  | 'terminada' // azul
  | 'en_espera' // vidrio atenuado + pausa

export function aspectoDe(params: {
  estado: Enums<'estado_tarea'>
  entrega: Date | null
  urgencia: number
  ahora: Date
}): Aspecto {
  const { estado, entrega, urgencia, ahora } = params
  if (estado === 'terminada') return 'terminada'
  if (entrega && entrega.getTime() < ahora.getTime()) return 'vencida'
  if (estado === 'en_espera') return 'en_espera'
  if (entrega && esMismoDia(entrega, ahora)) return 'dia_entrega'
  if (urgencia >= 10) return 'muy_alta'
  if (urgencia >= 8) return 'alta'
  if (urgencia >= UMBRAL_SI) return 'media'
  return 'neutro'
}

/**
 * Orden dentro del cuadrante (decisión del usuario): primero la mayor suma de
 * importancia + urgencia; si empatan, la entrega más cercana.
 */
export function compararParaCuadrante(
  a: { importancia: number; urgencia: number; entrega: Date | null },
  b: { importancia: number; urgencia: number; entrega: Date | null },
): number {
  const suma = b.importancia + b.urgencia - (a.importancia + a.urgencia)
  if (suma !== 0) return suma
  const ta = a.entrega?.getTime() ?? Number.POSITIVE_INFINITY
  const tb = b.entrega?.getTime() ?? Number.POSITIVE_INFINITY
  return ta - tb
}

/**
 * Qué cambia al arrastrar una tarea a otro cuadrante: cada nivel se ajusta lo
 * mínimo para quedar del lado correcto (a "sí" → al menos 6; a "no" → como
 * mucho 5). Devuelve null si ya está en ese cuadrante.
 */
export function movimiento(
  tarea: { nivel_importancia: number; nivel_urgencia: number },
  destino: Cuadrante,
): { nivel_importancia: number; nivel_urgencia: number } | null {
  if (cuadranteDeNiveles(tarea.nivel_importancia, tarea.nivel_urgencia) === destino) return null
  const importante = destino === 'hacer' || destino === 'planificar'
  const urgente = destino === 'hacer' || destino === 'delegar'
  const ajustar = (n: number, alto: boolean) =>
    alto ? Math.max(n, UMBRAL_SI) : Math.min(n, UMBRAL_SI - 1)
  return {
    nivel_importancia: ajustar(tarea.nivel_importancia, importante),
    nivel_urgencia: ajustar(tarea.nivel_urgencia, urgente),
  }
}
