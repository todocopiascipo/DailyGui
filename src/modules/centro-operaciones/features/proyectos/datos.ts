import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pedir } from '../../lib/api'
import type { ProyectoDetalle, ProyectoResumen } from './tipos'

export function useProyectos() {
  return useQuery({
    queryKey: ['proyectos'],
    queryFn: () => pedir<ProyectoResumen[]>('/proyectos'),
  })
}

export function useProyecto(id: string) {
  return useQuery({
    queryKey: ['proyecto', id],
    queryFn: () => pedir<ProyectoDetalle>(`/proyectos/${encodeURIComponent(id)}`),
  })
}

/** Lo que cambia en un proyecto toca la lista, los formularios (catálogos) y la matriz. */
function useAlCambiar() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['proyectos'] }),
      qc.invalidateQueries({ queryKey: ['proyecto'] }),
      qc.invalidateQueries({ queryKey: ['catalogos'] }),
      qc.invalidateQueries({ queryKey: ['matriz'] }),
    ])
}

export type CamposProyecto = Partial<{
  nombre: string
  descripcion: string | null
  estado: ProyectoResumen['estado']
  fecha_inicio: string | null
  fecha_objetivo: string | null
  responsable_id: string | null
  categoria_id: string | null
}>

export function useCrearProyecto() {
  const alCambiar = useAlCambiar()
  return useMutation({
    mutationFn: (datos: CamposProyecto & { nombre: string }) =>
      pedir<ProyectoDetalle>('/proyectos', { method: 'POST', body: JSON.stringify(datos) }),
    onSuccess: alCambiar,
  })
}

export function useEditarProyecto(id: string) {
  const qc = useQueryClient()
  const alCambiar = useAlCambiar()
  return useMutation({
    mutationFn: (cambios: CamposProyecto) =>
      pedir<ProyectoDetalle>(`/proyectos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(cambios),
      }),
    onSuccess: (d) => {
      qc.setQueryData(['proyecto', id], d)
      return alCambiar()
    },
  })
}

export function useBorrarProyecto() {
  const alCambiar = useAlCambiar()
  return useMutation({
    mutationFn: (id: string) => pedir(`/proyectos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: alCambiar,
  })
}

/** Reordenar: se ve al instante; si el servidor rechaza, vuelve a como estaba. */
export function useOrdenarTareas(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      pedir<ProyectoDetalle>(`/proyectos/${encodeURIComponent(id)}/orden`, {
        method: 'PUT',
        body: JSON.stringify({ tareas: ids }),
      }),
    onMutate: (ids) => {
      const antes = qc.getQueryData<ProyectoDetalle>(['proyecto', id])
      if (antes) {
        const porId = new Map(antes.tareas.map((t) => [t.id, t]))
        qc.setQueryData<ProyectoDetalle>(['proyecto', id], {
          ...antes,
          tareas: ids.flatMap((t) => porId.get(t) ?? []),
        })
      }
      return { antes }
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.antes) qc.setQueryData(['proyecto', id], ctx.antes)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['proyecto', id] }),
  })
}

/** Prender o apagar "Mostrar en la matriz" de una tarea del proyecto. */
export function useMostrarEnMatriz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, mostrar }: { id: string; mostrar: boolean }) =>
      pedir(`/tareas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ cambios: { mostrar_en_matriz: mostrar } }),
      }),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['proyecto'] }),
        qc.invalidateQueries({ queryKey: ['matriz'] }),
        qc.invalidateQueries({ queryKey: ['tarea'] }),
      ]),
  })
}
