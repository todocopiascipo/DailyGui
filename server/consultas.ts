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
import type { TareaMia } from '../src/modules/centro-operaciones/features/mis-tareas/tipos.ts'
import type { BaseDeDatos } from './db.ts'
import { aSubtarea, leerTarea } from './servicio.ts'

export interface RespuestaMatriz {
  tareas: TareaMatriz[]
  configuracion: { clave: string; valor: unknown }[]
}

/** Columnas que necesita cada tarjeta (matriz y panel de hechas). */
const COLUMNAS_TARJETA = `t.id, t.tipo, t.titulo, t.importante, t.urgencia_manual, t.estado, t.fecha_inicio,
  t.estado_anterior, t.motivo_espera, t.motivo_espera_detalle, t.fecha_entrega, t.saldo,
  t.terminada_at, t.entregada_at,
  c.nombre_apellido AS cliente_nombre, c.telefono AS cliente_telefono,
  (SELECT count(*) FROM subtareas s WHERE s.tarea_id = t.id) AS sub_total,
  (SELECT count(*) FROM subtareas s WHERE s.tarea_id = t.id AND s.hecha = 1) AS sub_hechas,
  t.pedido_id, (SELECT x.titulo FROM tareas x WHERE x.id = t.pedido_id) AS pedido_titulo
  FROM tareas t LEFT JOIN clientes c ON c.id = t.cliente_id`

/** Lo que muestra la matriz: tareas activas, con responsables y avance de subtareas. */
export function cargarMatriz(db: BaseDeDatos): RespuestaMatriz {
  const filas = db
    .prepare(
      `SELECT ${COLUMNAS_TARJETA}
       WHERE t.eliminada_at IS NULL
         AND t.mostrar_en_matriz = 1
         AND t.estado IN ('pendiente', 'en_proceso', 'en_espera', 'terminada')
         -- Las tareas internas terminadas pasan directo a "Hechas hoy".
         AND NOT (t.tipo = 'interna' AND t.estado = 'terminada')`,
    )
    .all() as Record<string, unknown>[]

  const configuracion = (
    db
      .prepare(
        `SELECT clave, valor FROM configuracion
         WHERE clave IN ('umbrales_urgencia', 'disposicion_cuadrantes', 'confeti_activado',
                         'plantilla_mensaje')`,
      )
      .all() as { clave: string; valor: string }[]
  ).map((c) => ({ clave: c.clave, valor: JSON.parse(c.valor) as unknown }))

  return { tareas: aTarjetas(db, filas), configuracion }
}

export interface RespuestaHechas {
  terminadas: TareaMatriz[]
  entregadas: TareaMatriz[]
}

/**
 * Panel "Hechas hoy" (especificación 7.8): lo terminado y lo entregado desde
 * `desde` (el comienzo del día en el local, que calcula la pantalla).
 */
export function cargarHechas(db: BaseDeDatos, desde: string): RespuestaHechas {
  const leer = (condicion: string) =>
    aTarjetas(
      db,
      db.prepare(`SELECT ${COLUMNAS_TARJETA} ${condicion}`).all(desde) as Record<string, unknown>[],
    )
  return {
    terminadas: leer(
      `WHERE t.eliminada_at IS NULL AND t.estado = 'terminada' AND t.terminada_at >= ?
       ORDER BY t.terminada_at DESC`,
    ),
    entregadas: leer(
      `WHERE t.eliminada_at IS NULL AND t.estado = 'entregada' AND t.entregada_at >= ?
       ORDER BY t.entregada_at DESC`,
    ),
  }
}

/** Filas de tareas → tarjetas, con sus responsables. */
function aTarjetas(db: BaseDeDatos, filas: Record<string, unknown>[]): TareaMatriz[] {
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

  const texto = (v: unknown) => (v ?? null) as string | null
  return filas.map((f) => ({
    id: String(f.id),
    tipo: f.tipo as TareaMatriz['tipo'],
    titulo: String(f.titulo),
    importante: f.importante === 1,
    urgencia_manual: f.urgencia_manual === null ? null : Number(f.urgencia_manual),
    estado: f.estado as TareaMatriz['estado'],
    estado_anterior: (f.estado_anterior ?? null) as TareaMatriz['estado_anterior'],
    motivo_espera: (f.motivo_espera ?? null) as TareaMatriz['motivo_espera'],
    motivo_espera_detalle: texto(f.motivo_espera_detalle),
    fecha_entrega: texto(f.fecha_entrega),
    fecha_inicio: texto(f.fecha_inicio),
    terminada_at: texto(f.terminada_at),
    entregada_at: texto(f.entregada_at),
    saldo: Number(f.saldo),
    cliente: f.cliente_nombre
      ? { nombre: String(f.cliente_nombre), telefono: texto(f.cliente_telefono) }
      : null,
    pedido: f.pedido_id ? { id: String(f.pedido_id), titulo: String(f.pedido_titulo) } : null,
    responsables: responsables.get(String(f.id)) ?? [],
    subtareas: { total: Number(f.sub_total), hechas: Number(f.sub_hechas) },
  }))
}

/** Personas y categorías activas, para los formularios. */
export function cargarCatalogos(db: BaseDeDatos): Catalogos {
  // Primero las asignadas más recientemente: acceso rápido a los de siempre.
  const personas = db
    .prepare(
      `SELECT p.id, p.nombre, p.iniciales, p.pin_hash IS NOT NULL AS tiene_pin FROM personas p
       WHERE p.activa = 1
       ORDER BY (SELECT max(r.created_at) FROM tarea_responsables r WHERE r.persona_id = p.id)
                DESC NULLS LAST,
                p.orden, p.nombre`,
    )
    .all()
    .map((p) => ({ ...(p as unknown as PersonaBreve), tiene_pin: p.tiene_pin === 1 }))
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
  const pedido = tarea.pedido_id
    ? ((db.prepare('SELECT id, titulo FROM tareas WHERE id = ?').get(tarea.pedido_id) as unknown as
        { id: string; titulo: string } | undefined) ?? null)
    : null
  return { tarea, responsables, subtareas, cliente, creada_por, eventos, pedido }
}

export interface TareaPapelera {
  id: string
  titulo: string
  tipo: string
  eliminada_at: string
  eliminada_por: string | null
  /** Fecha en que se borra sola. */
  se_borra_el: string
}

/** Tareas en la papelera, las más recientes primero. */
export function cargarPapelera(db: BaseDeDatos, dias: number): TareaPapelera[] {
  const filas = db
    .prepare(
      `SELECT t.id, t.titulo, t.tipo, t.eliminada_at, p.nombre AS eliminada_por
       FROM tareas t LEFT JOIN personas p ON p.id = t.eliminada_por
       WHERE t.eliminada_at IS NOT NULL ORDER BY t.eliminada_at DESC`,
    )
    .all() as Record<string, unknown>[]
  return filas.map((f) => ({
    id: String(f.id),
    titulo: String(f.titulo),
    tipo: String(f.tipo),
    eliminada_at: String(f.eliminada_at),
    eliminada_por: (f.eliminada_por ?? null) as string | null,
    se_borra_el: new Date(Date.parse(String(f.eliminada_at)) + dias * 86_400_000).toISOString(),
  }))
}

/**
 * "Mis tareas" (especificación 7.7): lo que tiene asignado la persona, en
 * curso o terminado sin entregar, ordenado por la entrega más cercana, con
 * todos sus pasos (subtareas) y quién hace cada uno.
 */
export function cargarMisTareas(db: BaseDeDatos, personaId: string): TareaMia[] {
  const filas = db
    .prepare(
      `SELECT ${COLUMNAS_TARJETA}
       WHERE t.eliminada_at IS NULL
         AND t.estado IN ('pendiente', 'en_proceso', 'en_espera', 'terminada')
         AND NOT (t.tipo = 'interna' AND t.estado = 'terminada')
         AND t.id IN (SELECT tarea_id FROM tarea_responsables WHERE persona_id = ?)
       ORDER BY t.fecha_entrega IS NULL, t.fecha_entrega, t.created_at`,
    )
    .all(personaId) as Record<string, unknown>[]
  const pasos = db.prepare(
    `SELECT s.id, s.titulo, s.hecha, p.id AS p_id, p.nombre AS p_nombre, p.iniciales AS p_iniciales
     FROM subtareas s LEFT JOIN personas p ON p.id = s.responsable_id
     WHERE s.tarea_id = ? ORDER BY s.orden, s.created_at`,
  )
  return aTarjetas(db, filas).map((t) => ({
    ...t,
    pasos: (pasos.all(t.id) as Record<string, unknown>[]).map((p) => ({
      id: String(p.id),
      titulo: String(p.titulo),
      hecha: p.hecha === 1,
      responsable: p.p_id
        ? {
            id: String(p.p_id),
            nombre: String(p.p_nombre),
            iniciales: (p.p_iniciales ?? null) as string | null,
          }
        : null,
    })),
  }))
}
