import {
  aspectoDe,
  compararParaCuadrante,
  cuadranteDeNiveles,
  type Cuadrante as IdCuadrante,
} from '../../lib/urgencia'
import type { ItemMatriz } from './Cuadrante'
import type { TareaMatriz } from './tipos'

/** Ubica cada tarea en su cuadrante, con su aspecto, ordenadas por prioridad. */
export function agruparPorCuadrante(
  tareas: TareaMatriz[],
  ahora: Date,
): Record<IdCuadrante, ItemMatriz[]> {
  const grupos: Record<
    IdCuadrante,
    (ItemMatriz & { orden: Parameters<typeof compararParaCuadrante>[0] })[]
  > = {
    hacer: [],
    planificar: [],
    delegar: [],
    eliminar: [],
  }
  for (const tarea of tareas) {
    const entrega = tarea.fecha_entrega ? new Date(tarea.fecha_entrega) : null
    const importancia = tarea.nivel_importancia
    const urgencia = tarea.nivel_urgencia
    grupos[cuadranteDeNiveles(importancia, urgencia)].push({
      tarea,
      aspecto: aspectoDe({ estado: tarea.estado, entrega, urgencia, ahora }),
      orden: { importancia, urgencia, entrega },
    })
  }
  const resultado = {} as Record<IdCuadrante, ItemMatriz[]>
  for (const id of Object.keys(grupos) as IdCuadrante[]) {
    resultado[id] = grupos[id]
      .sort((a, b) => compararParaCuadrante(a.orden, b.orden))
      .map(({ tarea, aspecto }) => ({ tarea, aspecto }))
  }
  return resultado
}
