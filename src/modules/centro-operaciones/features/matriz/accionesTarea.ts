/**
 * Acciones sobre una tarea, para el menú de tres puntitos del globo, el panel
 * "Hechas hoy" y el detalle (especificación 6.4, 6.7 y 7.2).
 */
import { createContext, useContext } from 'react'
import type { TareaMatriz } from './tipos'

export type AccionTarea =
  'abrir' | 'terminar' | 'entregar' | 'devolver' | 'copiar-mensaje' | 'copiar-telefono' | 'eliminar'

/** Lo mínimo de una tarea para decidir y ejecutar acciones. */
export type RefTarea = Pick<
  TareaMatriz,
  'id' | 'tipo' | 'titulo' | 'estado' | 'estado_anterior' | 'saldo' | 'cliente'
>

export const ESTADOS_EN_CURSO = ['pendiente', 'en_proceso', 'en_espera'] as const

export const NOMBRES_ACCION: Record<AccionTarea, string> = {
  abrir: 'Editar',
  terminar: 'Terminar',
  entregar: 'Entregada',
  devolver: 'Devolver al estado anterior',
  'copiar-mensaje': 'Copiar mensaje',
  'copiar-telefono': 'Copiar teléfono',
  eliminar: 'Eliminar',
}

export const enCurso = (t: RefTarea) => (ESTADOS_EN_CURSO as readonly string[]).includes(t.estado)

/**
 * "Devolver" va siempre hacia atrás en el ciclo (igual que el servidor):
 * terminadas y entregadas siempre; en curso, si antes estaba en otro estado en curso.
 */
export function sePuedeDevolver(t: RefTarea): boolean {
  if (t.estado === 'terminada' || t.estado === 'entregada') return true
  return (
    enCurso(t) &&
    t.estado_anterior !== null &&
    t.estado_anterior !== t.estado &&
    (ESTADOS_EN_CURSO as readonly string[]).includes(t.estado_anterior)
  )
}

/** Qué se puede hacer con la tarea, en el orden del menú. */
export function accionesDisponibles(t: RefTarea): AccionTarea[] {
  const lista: AccionTarea[] = []
  if (enCurso(t)) lista.push('terminar')
  if (t.estado === 'terminada' && t.tipo === 'pedido') lista.push('entregar')
  lista.push('abrir')
  if (sePuedeDevolver(t)) lista.push('devolver')
  if (t.tipo === 'pedido') lista.push('copiar-mensaje')
  if (t.cliente?.telefono) lista.push('copiar-telefono')
  lista.push('eliminar')
  return lista
}

export type EjecutarAccion = (accion: AccionTarea, tarea: RefTarea) => void

/** null cuando no hay acciones (por ej., en la demo). */
export const ContextoAcciones = createContext<EjecutarAccion | null>(null)

export function useAcciones() {
  return useContext(ContextoAcciones)
}
