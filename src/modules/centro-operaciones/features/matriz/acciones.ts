/**
 * Mover de cuadrante, eliminar, terminar, entregar y devolver (especificación
 * 6.3–6.5 y 8). Son optimistas: mientras el servidor guarda, la matriz ya
 * muestra el resultado; si lo rechaza, la operación deja de estar en curso y
 * todo vuelve a como estaba.
 */
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromZonedTime } from 'date-fns-tz'
import { pedir } from '../../lib/api'
import { diaLocal, ZONA_HORARIA } from '../../lib/tiempo'
import type { TareaMatriz } from './tipos'

export interface Movida {
  id: string
  importante: boolean
  urgencia_manual: number
}

export type CambioEstado = 'terminar' | 'entregar' | 'devolver'

export interface PedidoEstado {
  id: string
  cambio: CambioEstado
  tipo: TareaMatriz['tipo']
}

const CLAVE_MOVER = ['mover-tarea']
const CLAVE_ELIMINAR = ['eliminar-tarea']
const CLAVE_ESTADO = ['estado-tarea']

/** Tras guardar: sigue "en curso" hasta que llega la matriz real (sin parpadeos). */
function useRecargar() {
  const qc = useQueryClient()
  return async (id: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['matriz'] }),
      qc.invalidateQueries({ queryKey: ['hechas'] }),
    ])
    void qc.invalidateQueries({ queryKey: ['tarea', id] })
    void qc.invalidateQueries({ queryKey: ['papelera'] })
  }
}

export function useMoverTarea() {
  const recargar = useRecargar()
  return useMutation({
    mutationKey: CLAVE_MOVER,
    mutationFn: ({ id, importante, urgencia_manual }: Movida) =>
      pedir(`/tareas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        // Queda en el historial como "movida de cuadrante".
        headers: { 'x-co-accion': 'movida_cuadrante' },
        body: JSON.stringify({ cambios: { importante, urgencia_manual } }),
      }),
    onSuccess: (_r, { id }) => recargar(id),
  })
}

export function useEliminarTarea() {
  const recargar = useRecargar()
  return useMutation({
    mutationKey: CLAVE_ELIMINAR,
    mutationFn: (id: string) =>
      pedir(`/tareas/${encodeURIComponent(id)}/eliminar`, { method: 'POST' }),
    onSuccess: (_r, id) => recargar(id),
  })
}

/** Terminar, entregar o devolver al estado anterior. */
export function useCambiarEstado() {
  const recargar = useRecargar()
  return useMutation({
    mutationKey: CLAVE_ESTADO,
    mutationFn: ({ id, cambio }: PedidoEstado) =>
      pedir(`/tareas/${encodeURIComponent(id)}/${cambio}`, { method: 'POST' }),
    onSuccess: (_r, { id }) => recargar(id),
  })
}

/** Aplica sobre la matriz los cambios que se están guardando. */
export function useCambiosEnCurso(): (tareas: TareaMatriz[]) => TareaMatriz[] {
  const movidas = useMutationState({
    filters: { mutationKey: CLAVE_MOVER, status: 'pending' },
    select: (m) => m.state.variables as Movida,
  })
  const eliminadas = useMutationState({
    filters: { mutationKey: CLAVE_ELIMINAR, status: 'pending' },
    select: (m) => m.state.variables as string,
  })
  const estados = useMutationState({
    filters: { mutationKey: CLAVE_ESTADO, status: 'pending' },
    select: (m) => m.state.variables as PedidoEstado,
  })
  return (tareas) => {
    if (movidas.length + eliminadas.length + estados.length === 0) return tareas
    // Entregar (o terminar una interna) la saca de la matriz.
    const salen = new Set([
      ...eliminadas,
      ...estados
        .filter((e) => e.cambio === 'entregar' || (e.cambio === 'terminar' && e.tipo === 'interna'))
        .map((e) => e.id),
    ])
    return tareas
      .filter((t) => !salen.has(t.id))
      .map((t) => {
        // Si se movió varias veces seguidas, vale la última.
        const m = [...movidas].reverse().find((x) => x.id === t.id)
        const terminada = estados.some((e) => e.id === t.id && e.cambio === 'terminar')
        return {
          ...t,
          ...(m ? { importante: m.importante, urgencia_manual: m.urgencia_manual } : {}),
          ...(terminada ? { estado: 'terminada' as const, estado_anterior: t.estado } : {}),
        }
      })
  }
}

export interface HechasHoy {
  terminadas: TareaMatriz[]
  entregadas: TareaMatriz[]
}

/** Comienzo del día en el local (Buenos Aires), como instante ISO. */
export function comienzoDelDia(ahora: Date): string {
  return fromZonedTime(`${diaLocal(ahora)}T00:00:00`, ZONA_HORARIA).toISOString()
}

/**
 * Panel "Hechas hoy" (especificación 7.8). Se reinicia solo al cambiar el día:
 * la consulta depende del comienzo del día.
 */
export function useHechasHoy(ahora: Date) {
  const desde = comienzoDelDia(ahora)
  return useQuery({
    queryKey: ['hechas', desde],
    queryFn: () => pedir<HechasHoy>(`/hechas?desde=${encodeURIComponent(desde)}`),
  })
}
