/**
 * Mover de cuadrante y eliminar (especificación 6.3, 6.5 y 8). Son optimistas:
 * mientras el servidor guarda, la matriz ya muestra el resultado; si lo
 * rechaza, la operación deja de estar en curso y todo vuelve a como estaba.
 */
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { pedir } from '../../lib/api'
import type { TareaMatriz } from './tipos'

export interface Movida {
  id: string
  importante: boolean
  urgencia_manual: number
}

const CLAVE_MOVER = ['mover-tarea']
const CLAVE_ELIMINAR = ['eliminar-tarea']

/** Tras guardar: sigue "en curso" hasta que llega la matriz real (sin parpadeos). */
function useRecargar() {
  const qc = useQueryClient()
  return async (id: string) => {
    await qc.invalidateQueries({ queryKey: ['matriz'] })
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

/** Aplica sobre la matriz los movimientos y eliminaciones que se están guardando. */
export function useCambiosEnCurso(): (tareas: TareaMatriz[]) => TareaMatriz[] {
  const movidas = useMutationState({
    filters: { mutationKey: CLAVE_MOVER, status: 'pending' },
    select: (m) => m.state.variables as Movida,
  })
  const eliminadas = useMutationState({
    filters: { mutationKey: CLAVE_ELIMINAR, status: 'pending' },
    select: (m) => m.state.variables as string,
  })
  return (tareas) => {
    if (movidas.length === 0 && eliminadas.length === 0) return tareas
    return tareas
      .filter((t) => !eliminadas.includes(t.id))
      .map((t) => {
        // Si se movió varias veces seguidas, vale la última.
        const m = [...movidas].reverse().find((x) => x.id === t.id)
        return m ? { ...t, importante: m.importante, urgencia_manual: m.urgencia_manual } : t
      })
  }
}
