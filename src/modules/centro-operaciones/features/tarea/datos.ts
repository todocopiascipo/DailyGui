import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pedir } from '../../lib/api'
import type { PersonaBreve } from '../matriz/tipos'
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

export function useCrearTarea() {
  const alGuardar = useAlGuardar()
  return useMutation({
    mutationFn: (cuerpo: unknown) => pedir<DetalleTarea>('/tareas', json('POST', cuerpo)),
    onSuccess: alGuardar,
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
