import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { pedir } from '../../lib/api'
import type { PersonaBreve, TareaMatriz } from '../matriz/tipos'
import type { Catalogos, Cliente, DetalleTarea } from './tipos'

export function useCatalogos() {
  return useQuery({
    queryKey: ['catalogos'],
    queryFn: () => pedir<Catalogos>('/catalogos'),
  })
}

export function useDetalle(id: string) {
  return useQuery({
    queryKey: ['tarea', id],
    queryFn: () => pedir<DetalleTarea>(`/tareas/${encodeURIComponent(id)}`),
  })
}

export function buscarClientes(telefono: string) {
  return pedir<Cliente[]>(`/clientes?telefono=${encodeURIComponent(telefono.trim())}`)
}

/** Tras guardar: el detalle queda al día y la matriz se vuelve a pedir. */
function useAlGuardar() {
  const qc = useQueryClient()
  return (d: DetalleTarea) => {
    qc.setQueryData(['tarea', d.tarea.id], d)
    return qc.invalidateQueries({ queryKey: ['matriz'] })
  }
}

const json = (metodo: string, cuerpo: unknown): RequestInit => ({
  method: metodo,
  body: JSON.stringify(cuerpo),
})

interface AltaTarea {
  cuerpo: unknown
  /** Cómo se ve en la matriz mientras se guarda. */
  provisoria: TareaMatriz
}

const CLAVE_ALTA = ['crear-tarea']

/**
 * Alta de tarea. Es optimista (especificación 8): mientras se guarda, la
 * matriz la muestra con un id provisorio (ver `useTareasProvisorias`).
 */
export function useCrearTarea() {
  const alGuardar = useAlGuardar()
  return useMutation({
    mutationKey: CLAVE_ALTA,
    mutationFn: ({ cuerpo }: AltaTarea) => pedir<DetalleTarea>('/tareas', json('POST', cuerpo)),
    // Sigue "en curso" hasta que llega la matriz real, así no hay parpadeo.
    onSuccess: alGuardar,
  })
}

/**
 * Tareas que se están guardando. Si el servidor rechaza una, deja de estar
 * en curso y desaparece sola de la matriz.
 */
export function useTareasProvisorias(): TareaMatriz[] {
  return useMutationState({
    filters: { mutationKey: CLAVE_ALTA, status: 'pending' },
    select: (m) => (m.state.variables as AltaTarea).provisoria,
  })
}

export function useEditarTarea(id: string) {
  const alGuardar = useAlGuardar()
  return useMutation({
    mutationFn: (cuerpo: unknown) =>
      pedir<DetalleTarea>(`/tareas/${encodeURIComponent(id)}`, json('PATCH', cuerpo)),
    onSuccess: alGuardar,
  })
}

export type OperacionSubtarea =
  | { tipo: 'crear'; titulo: string; responsable_id: string | null }
  | {
      tipo: 'editar'
      id: string
      cambios: { titulo?: string; responsable_id?: string | null; hecha?: boolean }
    }
  | { tipo: 'borrar'; id: string }

export function useSubtareas(tareaId: string) {
  const alGuardar = useAlGuardar()
  const qc = useQueryClient()
  return useMutation({
    onError: () => qc.invalidateQueries({ queryKey: ['tarea', tareaId] }),
    mutationFn: (op: OperacionSubtarea) => {
      if (op.tipo === 'crear') {
        return pedir<DetalleTarea>(
          `/tareas/${encodeURIComponent(tareaId)}/subtareas`,
          json('POST', { titulo: op.titulo, responsable_id: op.responsable_id }),
        )
      }
      const ruta = `/subtareas/${encodeURIComponent(op.id)}`
      return op.tipo === 'editar'
        ? pedir<DetalleTarea>(ruta, json('PATCH', op.cambios))
        : pedir<DetalleTarea>(ruta, { method: 'DELETE' })
    },
    onSuccess: alGuardar,
  })
}

export function useCrearPersona() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nombre: string) => pedir<PersonaBreve>('/personas', json('POST', { nombre })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogos'] }),
  })
}
