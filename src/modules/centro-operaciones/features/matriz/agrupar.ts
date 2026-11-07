import {
  aspectoDe,
  compararParaCuadrante,
  cuadranteDe,
  esUrgente,
  urgenciaEfectiva,
  urgenciaEstimada,
  type Cuadrante as IdCuadrante,
} from '../../lib/urgencia'
import type { ItemMatriz } from './Cuadrante'
import type { ConfigMatriz, TareaMatriz } from './tipos'

/** Ubica cada tarea en su cuadrante, con su aspecto, ordenadas por prioridad. */
export function agruparPorCuadrante(
  tareas: TareaMatriz[],
  config: ConfigMatriz,
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
    const estimada = urgenciaEstimada(entrega, ahora, config.umbrales)
    const efectiva = urgenciaEfectiva(tarea.urgencia_manual, estimada)
    const cuadrante = cuadranteDe(tarea.importante, esUrgente(efectiva))
    grupos[cuadrante].push({
      tarea,
      aspecto: aspectoDe({ estado: tarea.estado, entrega, efectiva, ahora }),
      orden: { efectiva, entrega },
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
