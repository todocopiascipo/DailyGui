import type {
  PersonaBreve,
  TareaMatriz,
} from '../src/modules/centro-operaciones/features/matriz/tipos.ts'
import type {
  Catalogos,
  Categoria,
  Cliente,
  DetalleTarea,
  EventoDetalle,
} from '../src/modules/centro-operaciones/features/tarea/tipos.ts'
import type { BaseDeDatos } from './db.ts'
import { aSubtarea, leerTarea } from './servicio.ts'

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

/** Personas y categorías activas, para los formularios. */
export function cargarCatalogos(db: BaseDeDatos): Catalogos {
  const personas = db
    .prepare('SELECT id, nombre, iniciales FROM personas WHERE activa = 1 ORDER BY orden, nombre')
    .all() as unknown as PersonaBreve[]
  const categorias = db
    .prepare(
      'SELECT id, nombre, tipo_aplica FROM categorias WHERE activa = 1 ORDER BY orden, nombre',
    )
    .all() as unknown as Categoria[]
  return { personas, categorias }
}

/** Clientes con ese teléfono (para ofrecer reutilizarlos). */
export function buscarClientes(db: BaseDeDatos, telefono: string): Cliente[] {
  const t = telefono.trim()
  if (t.length < 3) return []
  return db
    .prepare(
      'SELECT id, nombre_apellido, telefono FROM clientes WHERE telefono = ? ORDER BY updated_at DESC LIMIT 5',
    )
    .all(t) as unknown as Cliente[]
}

/** Todo lo que muestra el detalle de una tarea, con su historial. */
export function cargarDetalle(db: BaseDeDatos, id: string): DetalleTarea | null {
  const tarea = leerTarea(db, id)
  if (!tarea) return null
  const responsables = db
    .prepare(
      `SELECT p.id, p.nombre, p.iniciales FROM tarea_responsables r
       JOIN personas p ON p.id = r.persona_id WHERE r.tarea_id = ? ORDER BY p.orden, p.nombre`,
    )
    .all(id) as unknown as PersonaBreve[]
  const subtareas = (
    db
      .prepare('SELECT * FROM subtareas WHERE tarea_id = ? ORDER BY orden, created_at')
      .all(id) as Record<string, unknown>[]
  ).map((f) => {
    const s = aSubtarea(f)
    return {
      id: s.id,
      titulo: s.titulo,
      responsable_id: s.responsable_id,
      hecha: s.hecha,
      orden: s.orden,
    }
  })
  const cliente = tarea.cliente_id
    ? ((db
        .prepare('SELECT id, nombre_apellido, telefono FROM clientes WHERE id = ?')
        .get(tarea.cliente_id) as unknown as Cliente | undefined) ?? null)
    : null
  const creada_por = tarea.creada_por
    ? ((db
        .prepare('SELECT id, nombre, iniciales FROM personas WHERE id = ?')
        .get(tarea.creada_por) as unknown as PersonaBreve | undefined) ?? null)
    : null
  const eventos = (
    db
      .prepare(
        `SELECT e.id, e.accion, p.nombre AS persona, e.cambios, e.created_at
         FROM eventos e LEFT JOIN personas p ON p.id = e.persona_id
         WHERE e.tarea_id = ? ORDER BY e.created_at DESC, e.rowid DESC LIMIT 100`,
      )
      .all(id) as Record<string, unknown>[]
  ).map((e): EventoDetalle => ({
    id: String(e.id),
    accion: String(e.accion),
    persona: (e.persona ?? null) as string | null,
    cambios: JSON.parse(String(e.cambios)) as Record<string, unknown>,
    created_at: String(e.created_at),
  }))
  return { tarea, responsables, subtareas, cliente, creada_por, eventos }
}
