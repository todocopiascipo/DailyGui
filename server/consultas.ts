import type {
  PersonaBreve,
  TareaMatriz,
} from '../src/modules/centro-operaciones/features/matriz/tipos.ts'
import type { BaseDeDatos } from './db.ts'

export interface RespuestaMatriz {
  tareas: TareaMatriz[]
  configuracion: { clave: string; valor: unknown }[]
}

/** Lo que muestra la matriz: tareas activas, con responsables y avance de subtareas. */
export function cargarMatriz(db: BaseDeDatos): RespuestaMatriz {
  const filas = db
    .prepare(
      `SELECT t.id, t.tipo, t.titulo, t.importante, t.urgencia_manual, t.estado,
              t.motivo_espera, t.motivo_espera_detalle, t.fecha_entrega,
              (SELECT count(*) FROM subtareas s WHERE s.tarea_id = t.id) AS sub_total,
              (SELECT count(*) FROM subtareas s WHERE s.tarea_id = t.id AND s.hecha = 1) AS sub_hechas
       FROM tareas t
       WHERE t.eliminada_at IS NULL
         AND t.mostrar_en_matriz = 1
         AND t.estado IN ('pendiente', 'en_proceso', 'en_espera', 'terminada')
         -- Las tareas internas terminadas pasan directo a "Hechas hoy".
         AND NOT (t.tipo = 'interna' AND t.estado = 'terminada')`,
    )
    .all() as Record<string, unknown>[]

  const responsables = new Map<string, PersonaBreve[]>()
  const filasResp = db
    .prepare(
      `SELECT r.tarea_id, p.id, p.nombre, p.iniciales
       FROM tarea_responsables r JOIN personas p ON p.id = r.persona_id
       ORDER BY p.orden, p.nombre`,
    )
    .all() as { tarea_id: string; id: string; nombre: string; iniciales: string | null }[]
  for (const r of filasResp) {
    const lista = responsables.get(r.tarea_id) ?? []
    lista.push({ id: r.id, nombre: r.nombre, iniciales: r.iniciales })
    responsables.set(r.tarea_id, lista)
  }

  const tareas: TareaMatriz[] = filas.map((f) => ({
    id: String(f.id),
    tipo: f.tipo as TareaMatriz['tipo'],
    titulo: String(f.titulo),
    importante: f.importante === 1,
    urgencia_manual: f.urgencia_manual === null ? null : Number(f.urgencia_manual),
    estado: f.estado as TareaMatriz['estado'],
    motivo_espera: (f.motivo_espera ?? null) as TareaMatriz['motivo_espera'],
    motivo_espera_detalle: (f.motivo_espera_detalle ?? null) as string | null,
    fecha_entrega: (f.fecha_entrega ?? null) as string | null,
    responsables: responsables.get(String(f.id)) ?? [],
    subtareas: { total: Number(f.sub_total), hechas: Number(f.sub_hechas) },
  }))

  const configuracion = (
    db
      .prepare(
        `SELECT clave, valor FROM configuracion
         WHERE clave IN ('umbrales_urgencia', 'disposicion_cuadrantes')`,
      )
      .all() as { clave: string; valor: string }[]
  ).map((c) => ({ clave: c.clave, valor: JSON.parse(c.valor) as unknown }))

  return { tareas, configuracion }
}
