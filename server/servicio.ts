/**
 * Operaciones sobre la base local. Cada operación corre en una transacción,
 * aplica las reglas automáticas y registra el historial (una sola vía).
 */
import { randomUUID } from 'node:crypto'
import { enTransaccion, type BaseDeDatos } from './db.ts'
import {
  diferencias,
  eventoDeTarea,
  reglasAlGuardar,
  type AccionEvento,
  type Evento,
  type Pista,
  type Tarea,
} from './reglas.ts'

export interface Contexto {
  /** Persona activa ("¿Quién soy?"); se ignora si no existe. */
  persona: string | null
  pista?: Pista
  /** Hora de la operación (ISO). Por defecto, ahora. */
  ahora?: string
}

export type DatosNuevaTarea = Partial<Tarea> & Pick<Tarea, 'titulo' | 'importante'>

const COLUMNAS_TAREA = [
  'id',
  'tipo',
  'titulo',
  'descripcion',
  'categoria_id',
  'proyecto_id',
  'cliente_id',
  'sena',
  'saldo',
  'sena_medio',
  'saldo_medio',
  'importante',
  'urgencia_manual',
  'estado',
  'estado_anterior',
  'motivo_espera',
  'motivo_espera_detalle',
  'fecha_inicio',
  'fecha_entrega',
  'terminada_at',
  'entregada_at',
  'mostrar_en_matriz',
  'eliminada_at',
  'eliminada_por',
  'creada_por',
  'actualizada_por',
  'created_at',
  'updated_at',
] as const satisfies readonly (keyof Tarea)[]

type Fila = Record<string, unknown>

/** Fila de SQLite → Tarea (booleanos y números con su tipo). */
export function aTarea(fila: Fila): Tarea {
  return {
    ...(fila as unknown as Tarea),
    importante: fila.importante === 1,
    mostrar_en_matriz: fila.mostrar_en_matriz === 1,
    sena: Number(fila.sena),
    saldo: Number(fila.saldo),
  }
}

function aSqlite(valor: unknown): string | number | null {
  if (typeof valor === 'boolean') return valor ? 1 : 0
  if (valor === undefined) return null
  return valor as string | number | null
}

export function personaValida(db: BaseDeDatos, id: string | null): string | null {
  if (!id) return null
  const fila = db.prepare('SELECT id FROM personas WHERE id = ?').get(id) as Fila | undefined
  return fila ? String(fila.id) : null
}

export function leerTarea(db: BaseDeDatos, id: string): Tarea | null {
  const fila = db.prepare('SELECT * FROM tareas WHERE id = ?').get(id) as Fila | undefined
  return fila ? aTarea(fila) : null
}

function registrar(db: BaseDeDatos, evento: Evento | null, ahora: string) {
  if (!evento) return
  db.prepare(
    `INSERT INTO eventos (id, tarea_id, proyecto_id, persona_id, accion, cambios, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    evento.tarea_id,
    evento.proyecto_id,
    evento.persona_id,
    evento.accion,
    JSON.stringify(evento.cambios),
    ahora,
  )
}

/**
 * Alta de una tarea con sus responsables y subtareas, en un solo paso.
 * El historial registra un único evento "creada".
 */
export function crearTarea(
  db: BaseDeDatos,
  ctx: Contexto,
  datos: DatosNuevaTarea,
  responsables: string[] = [],
  subtareas: { titulo: string; responsable_id?: string | null }[] = [],
  cliente?: DatosCliente | null,
): Tarea {
  const ahora = ctx.ahora ?? new Date().toISOString()
  return enTransaccion(db, () => {
    const persona = personaValida(db, ctx.persona)
    const clienteId = cliente ? guardarCliente(db, cliente) : (datos.cliente_id ?? null)
    const base: Tarea = {
      tipo: 'pedido',
      descripcion: null,
      categoria_id: null,
      proyecto_id: null,
      sena: 0,
      saldo: 0,
      sena_medio: null,
      saldo_medio: null,
      urgencia_manual: null,
      estado: 'pendiente',
      estado_anterior: null,
      motivo_espera: null,
      motivo_espera_detalle: null,
      fecha_inicio: null,
      fecha_entrega: null,
      terminada_at: null,
      entregada_at: null,
      mostrar_en_matriz: true,
      eliminada_at: null,
      eliminada_por: null,
      creada_por: null,
      actualizada_por: null,
      updated_at: ahora,
      ...datos,
      cliente_id: clienteId,
      id: datos.id ?? randomUUID(),
      created_at: ahora,
    }
    const tarea = reglasAlGuardar(null, base, persona, ahora)
    db.prepare(
      `INSERT INTO tareas (${COLUMNAS_TAREA.join(', ')})
       VALUES (${COLUMNAS_TAREA.map(() => '?').join(', ')})`,
    ).run(...COLUMNAS_TAREA.map((c) => aSqlite(tarea[c])))

    const responsable = db.prepare(
      'INSERT OR IGNORE INTO tarea_responsables (tarea_id, persona_id) VALUES (?, ?)',
    )
    for (const id of responsables) responsable.run(tarea.id, id)

    const subtarea = db.prepare(
      'INSERT INTO subtareas (id, tarea_id, titulo, responsable_id, orden) VALUES (?, ?, ?, ?, ?)',
    )
    subtareas.forEach((s, i) => {
      subtarea.run(randomUUID(), tarea.id, s.titulo.trim(), s.responsable_id ?? null, i)
      // El responsable de una subtarea se suma a los de la tarea.
      if (s.responsable_id) responsable.run(tarea.id, s.responsable_id)
    })

    registrar(db, eventoDeTarea(null, tarea, persona), ahora)
    return leerTarea(db, tarea.id)!
  })
}

export type CambiosTarea = Partial<Omit<Tarea, 'id' | 'created_at' | 'creada_por'>>

export interface ExtrasEdicion {
  /** Lista completa de responsables (reemplaza la anterior). */
  responsables?: string[]
  /** Cliente del pedido: datos para crear o actualizar, o null para quitarlo. */
  cliente?: DatosCliente | null
}

/**
 * Modifica campos de una tarea (y opcionalmente sus responsables y cliente),
 * aplica las reglas y registra el historial.
 */
export function actualizarTarea(
  db: BaseDeDatos,
  ctx: Contexto,
  id: string,
  cambios: CambiosTarea,
  extras: ExtrasEdicion = {},
): Tarea {
  const ahora = ctx.ahora ?? new Date().toISOString()
  return enTransaccion(db, () => {
    const anterior = leerTarea(db, id)
    if (!anterior) throw new ErrorNoEncontrado('La tarea no existe')
    const persona = personaValida(db, ctx.persona)
    const datos: CambiosTarea = { ...cambios }
    if (extras.cliente !== undefined) {
      datos.cliente_id = extras.cliente ? guardarCliente(db, extras.cliente) : null
    }
    const nueva = reglasAlGuardar(anterior, { ...anterior, ...datos }, persona, ahora)
    const columnas = COLUMNAS_TAREA.filter((c) => c !== 'id' && c !== 'updated_at')
    db.prepare(`UPDATE tareas SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
      ...columnas.map((c) => aSqlite(nueva[c])),
      id,
    )
    registrar(db, eventoDeTarea(anterior, nueva, persona, ctx.pista), ahora)
    if (extras.responsables) reasignar(db, nueva, extras.responsables, persona, ahora)
    return leerTarea(db, id)!
  })
}

function idsResponsables(db: BaseDeDatos, tareaId: string): string[] {
  return (
    db
      .prepare('SELECT persona_id FROM tarea_responsables WHERE tarea_id = ? ORDER BY persona_id')
      .all(tareaId) as { persona_id: string }[]
  ).map((r) => r.persona_id)
}

function nombresDe(db: BaseDeDatos, ids: string[]): string[] {
  const leer = db.prepare('SELECT nombre FROM personas WHERE id = ?')
  return ids.map((id) => String((leer.get(id) as Fila | undefined)?.nombre ?? '—'))
}

function nombreDe(db: BaseDeDatos, id: string | null): string | null {
  return id ? (nombresDe(db, [id])[0] ?? null) : null
}

/** Reemplaza los responsables de la tarea y registra "reasignada" si cambiaron. */
function reasignar(
  db: BaseDeDatos,
  tarea: Tarea,
  nuevos: string[],
  persona: string | null,
  ahora: string,
) {
  const antes = idsResponsables(db, tarea.id)
  const despues = [...new Set(nuevos)].sort()
  if (JSON.stringify(antes) === JSON.stringify(despues)) return
  db.prepare('DELETE FROM tarea_responsables WHERE tarea_id = ?').run(tarea.id)
  const insertar = db.prepare('INSERT INTO tarea_responsables (tarea_id, persona_id) VALUES (?, ?)')
  for (const p of despues) insertar.run(tarea.id, p)
  registrar(
    db,
    {
      accion: 'reasignada',
      tarea_id: tarea.id,
      proyecto_id: tarea.proyecto_id,
      persona_id: persona,
      cambios: {
        responsables: { antes: nombresDe(db, antes), despues: nombresDe(db, despues) },
        titulo: tarea.titulo,
      },
    },
    ahora,
  )
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export interface DatosCliente {
  /** Cliente existente a reutilizar (se actualiza con los datos de abajo). */
  id?: string | null
  nombre_apellido: string
  telefono?: string | null
}

/** Crea el cliente, o actualiza el existente si viene `id`. Devuelve su id. */
function guardarCliente(db: BaseDeDatos, c: DatosCliente): string {
  const telefono = c.telefono?.trim() || null
  if (c.id) {
    const r = db
      .prepare('UPDATE clientes SET nombre_apellido = ?, telefono = ? WHERE id = ?')
      .run(c.nombre_apellido.trim(), telefono, c.id)
    if (r.changes === 0) throw new ErrorNoEncontrado('El cliente no existe')
    return c.id
  }
  const id = randomUUID()
  db.prepare('INSERT INTO clientes (id, nombre_apellido, telefono) VALUES (?, ?, ?)').run(
    id,
    c.nombre_apellido.trim(),
    telefono,
  )
  return id
}

// ---------------------------------------------------------------------------
// Subtareas
// ---------------------------------------------------------------------------

export interface Subtarea {
  id: string
  tarea_id: string
  titulo: string
  responsable_id: string | null
  hecha: boolean
  hecha_at: string | null
  orden: number
}

export function aSubtarea(f: Fila): Subtarea {
  return {
    id: String(f.id),
    tarea_id: String(f.tarea_id),
    titulo: String(f.titulo),
    responsable_id: (f.responsable_id ?? null) as string | null,
    hecha: f.hecha === 1,
    hecha_at: (f.hecha_at ?? null) as string | null,
    orden: Number(f.orden),
  }
}

function leerSubtarea(db: BaseDeDatos, id: string): Subtarea | null {
  const f = db.prepare('SELECT * FROM subtareas WHERE id = ?').get(id) as Fila | undefined
  return f ? aSubtarea(f) : null
}

function tareaExistente(db: BaseDeDatos, id: string): Tarea {
  const t = leerTarea(db, id)
  if (!t) throw new ErrorNoEncontrado('La tarea no existe')
  return t
}

function eventoSubtarea(
  db: BaseDeDatos,
  accion: AccionEvento,
  tarea: Tarea,
  persona: string | null,
  cambios: Record<string, unknown>,
  ahora: string,
) {
  registrar(
    db,
    {
      accion,
      tarea_id: tarea.id,
      proyecto_id: tarea.proyecto_id,
      persona_id: persona,
      cambios: { ...cambios, titulo: tarea.titulo },
    },
    ahora,
  )
}

/** El responsable de una subtarea se suma a los de la tarea. */
function sumarResponsable(db: BaseDeDatos, tareaId: string, personaId: string | null) {
  if (!personaId) return
  db.prepare('INSERT OR IGNORE INTO tarea_responsables (tarea_id, persona_id) VALUES (?, ?)').run(
    tareaId,
    personaId,
  )
}

export function crearSubtarea(
  db: BaseDeDatos,
  ctx: Contexto,
  tareaId: string,
  datos: { titulo: string; responsable_id?: string | null },
): Subtarea {
  const ahora = ctx.ahora ?? new Date().toISOString()
  return enTransaccion(db, () => {
    const tarea = tareaExistente(db, tareaId)
    const persona = personaValida(db, ctx.persona)
    const orden = Number(
      (
        db
          .prepare('SELECT coalesce(max(orden), -1) + 1 AS n FROM subtareas WHERE tarea_id = ?')
          .get(tareaId) as Fila
      ).n,
    )
    const id = randomUUID()
    const titulo = datos.titulo.trim()
    const responsable = datos.responsable_id ?? null
    db.prepare(
      'INSERT INTO subtareas (id, tarea_id, titulo, responsable_id, orden) VALUES (?, ?, ?, ?, ?)',
    ).run(id, tareaId, titulo, responsable, orden)
    sumarResponsable(db, tareaId, responsable)
    eventoSubtarea(
      db,
      'subtarea_creada',
      tarea,
      persona,
      { subtarea: titulo, responsable: nombreDe(db, responsable) },
      ahora,
    )
    return leerSubtarea(db, id)!
  })
}

export function actualizarSubtarea(
  db: BaseDeDatos,
  ctx: Contexto,
  id: string,
  cambios: { titulo?: string; responsable_id?: string | null; hecha?: boolean },
): Subtarea {
  const ahora = ctx.ahora ?? new Date().toISOString()
  return enTransaccion(db, () => {
    const antes = leerSubtarea(db, id)
    if (!antes) throw new ErrorNoEncontrado('La subtarea no existe')
    const tarea = tareaExistente(db, antes.tarea_id)
    const persona = personaValida(db, ctx.persona)
    const titulo = cambios.titulo?.trim() ?? antes.titulo
    const responsable =
      cambios.responsable_id !== undefined ? cambios.responsable_id : antes.responsable_id
    const hecha = cambios.hecha ?? antes.hecha
    const hechaAt = hecha ? (antes.hecha ? antes.hecha_at : ahora) : null
    db.prepare(
      'UPDATE subtareas SET titulo = ?, responsable_id = ?, hecha = ?, hecha_at = ? WHERE id = ?',
    ).run(titulo, responsable, hecha ? 1 : 0, hechaAt, id)
    sumarResponsable(db, antes.tarea_id, responsable)

    if (hecha !== antes.hecha) {
      eventoSubtarea(
        db,
        hecha ? 'subtarea_hecha' : 'subtarea_deshecha',
        tarea,
        persona,
        { subtarea: titulo },
        ahora,
      )
    }
    const editada = diferencias(
      { subtarea: antes.titulo, responsable: nombreDe(db, antes.responsable_id) },
      { subtarea: titulo, responsable: nombreDe(db, responsable) },
      [],
    )
    if (Object.keys(editada).length > 0) {
      eventoSubtarea(db, 'subtarea_editada', tarea, persona, { ...editada, nombre: titulo }, ahora)
    }
    return leerSubtarea(db, id)!
  })
}

export function eliminarSubtarea(db: BaseDeDatos, ctx: Contexto, id: string): void {
  const ahora = ctx.ahora ?? new Date().toISOString()
  enTransaccion(db, () => {
    const antes = leerSubtarea(db, id)
    if (!antes) throw new ErrorNoEncontrado('La subtarea no existe')
    const tarea = tareaExistente(db, antes.tarea_id)
    const persona = personaValida(db, ctx.persona)
    db.prepare('DELETE FROM subtareas WHERE id = ?').run(id)
    eventoSubtarea(db, 'subtarea_eliminada', tarea, persona, { subtarea: antes.titulo }, ahora)
  })
}

// ---------------------------------------------------------------------------
// Personas: alta desde el formulario. La gestión completa (orden, baja, PIN)
// queda para Configuración (Fase 9).
// ---------------------------------------------------------------------------

/** "Ana María" → "AM"; "Juan" → "J". */
export function inicialesDe(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase('es-AR'))
    .join('')
}

export function crearPersona(
  db: BaseDeDatos,
  datos: { nombre: string; iniciales?: string | null },
): { id: string; nombre: string; iniciales: string | null } {
  const nombre = datos.nombre.trim().replace(/\s+/g, ' ')
  const iniciales = datos.iniciales?.trim() || inicialesDe(nombre)
  return enTransaccion(db, () => {
    const repetida = db
      .prepare('SELECT id FROM personas WHERE lower(nombre) = lower(?) AND activa = 1')
      .get(nombre)
    if (repetida) throw new ErrorValidacion('Ya hay una persona con ese nombre')
    const orden = Number(
      (db.prepare('SELECT coalesce(max(orden), 0) + 10 AS n FROM personas').get() as Fila).n,
    )
    const id = randomUUID()
    db.prepare('INSERT INTO personas (id, nombre, iniciales, orden) VALUES (?, ?, ?, ?)').run(
      id,
      nombre,
      iniciales,
      orden,
    )
    return { id, nombre, iniciales }
  })
}

// ---------------------------------------------------------------------------
// Ciclo terminar / entregar / devolver (especificación 6.4)
// ---------------------------------------------------------------------------

const ACTIVOS = ['pendiente', 'en_proceso', 'en_espera']

function activa(db: BaseDeDatos, id: string): Tarea {
  const t = leerTarea(db, id)
  if (!t || t.eliminada_at) throw new ErrorNoEncontrado('La tarea no existe')
  return t
}

/** Terminar: solo desde un estado activo. El motivo de espera se conserva para "Devolver". */
export function terminarTarea(db: BaseDeDatos, ctx: Contexto, id: string): Tarea {
  const t = activa(db, id)
  if (!ACTIVOS.includes(t.estado)) throw new ErrorValidacion('La tarea ya no está en curso')
  return actualizarTarea(db, ctx, id, { estado: 'terminada' })
}

/** Entregada: solo pedidos terminados (las internas no tienen este paso). */
export function entregarTarea(db: BaseDeDatos, ctx: Contexto, id: string): Tarea {
  const t = activa(db, id)
  if (t.tipo !== 'pedido') throw new ErrorValidacion('Las tareas internas no se entregan')
  if (t.estado !== 'terminada') throw new ErrorValidacion('Primero hay que terminarla')
  return actualizarTarea(db, ctx, id, { estado: 'entregada' })
}

/**
 * Estado en curso que tenía la tarea antes de terminarla (según el historial).
 * Sirve cuando `estado_anterior` ya no lo dice (por ej., entregada → devuelta).
 */
function estadoAntesDeTerminar(db: BaseDeDatos, id: string): Tarea['estado'] | null {
  const filas = db
    .prepare(
      `SELECT cambios FROM eventos
       WHERE tarea_id = ? AND accion IN ('estado', 'devuelta')
       ORDER BY created_at DESC, rowid DESC`,
    )
    .all(id) as { cambios: string }[]
  for (const f of filas) {
    const c = (JSON.parse(f.cambios) as { estado?: { antes?: string; despues?: string } }).estado
    if (c?.despues === 'terminada' && c.antes && ACTIVOS.includes(c.antes)) {
      return c.antes as Tarea['estado']
    }
  }
  return null
}

/**
 * "Devolver al estado anterior": siempre hacia atrás en el ciclo.
 * Entregada → terminada; terminada → el estado en curso que tenía; en curso →
 * el estado en curso anterior. Queda "devuelta" en el historial.
 */
export function devolverTarea(db: BaseDeDatos, ctx: Contexto, id: string): Tarea {
  const t = activa(db, id)
  let estado: Tarea['estado'] | null
  if (t.estado === 'entregada') estado = 'terminada'
  else if (t.estado === 'terminada') {
    estado =
      t.estado_anterior && ACTIVOS.includes(t.estado_anterior)
        ? t.estado_anterior
        : (estadoAntesDeTerminar(db, id) ?? 'pendiente')
  } else {
    estado =
      t.estado_anterior && ACTIVOS.includes(t.estado_anterior) && t.estado_anterior !== t.estado
        ? t.estado_anterior
        : null
  }
  if (!estado) throw new ErrorValidacion('No hay un estado anterior al que volver')
  // Si vuelve a "en espera" sin motivo guardado, queda pendiente.
  if (estado === 'en_espera' && !t.motivo_espera) estado = 'pendiente'
  return actualizarTarea(db, { ...ctx, pista: 'devuelta' }, id, { estado })
}

// ---------------------------------------------------------------------------
// Configuración editable desde la app (lo demás llega en la Fase 9)
// ---------------------------------------------------------------------------

/** Guarda un valor de configuración ya validado. */
export function guardarConfiguracion(db: BaseDeDatos, clave: string, valor: unknown): void {
  db.prepare(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`,
  ).run(clave, JSON.stringify(valor))
}

// ---------------------------------------------------------------------------
// Papelera (especificación 6.5): borrado lógico, restaurar, borrado definitivo
// y purga automática pasado el plazo configurable.
// ---------------------------------------------------------------------------

/** Manda la tarea a la papelera. */
export function eliminarTarea(db: BaseDeDatos, ctx: Contexto, id: string): Tarea {
  const ahora = ctx.ahora ?? new Date().toISOString()
  return actualizarTarea(db, { ...ctx, ahora }, id, { eliminada_at: ahora })
}

/** La saca de la papelera, tal como estaba. */
export function restaurarTarea(db: BaseDeDatos, ctx: Contexto, id: string): Tarea {
  const t = leerTarea(db, id)
  if (!t) throw new ErrorNoEncontrado('La tarea no existe')
  if (!t.eliminada_at) throw new ErrorValidacion('La tarea no está en la papelera')
  return actualizarTarea(db, ctx, id, { eliminada_at: null })
}

/** Borra para siempre una tarea que está en la papelera. */
export function borrarDefinitiva(db: BaseDeDatos, ctx: Contexto, id: string): void {
  const ahora = ctx.ahora ?? new Date().toISOString()
  enTransaccion(db, () => {
    const t = leerTarea(db, id)
    if (!t) throw new ErrorNoEncontrado('La tarea no existe')
    if (!t.eliminada_at) throw new ErrorValidacion('Solo se borran tareas de la papelera')
    const persona = personaValida(db, ctx.persona)
    db.prepare('DELETE FROM tareas WHERE id = ?').run(id)
    registrar(db, eventoDeTarea(t, null, persona), ahora)
  })
}

/** Días que una tarea queda en la papelera (configuracion.papelera_dias, 30 por defecto). */
export function diasPapelera(db: BaseDeDatos): number {
  const fila = db.prepare("SELECT valor FROM configuracion WHERE clave = 'papelera_dias'").get() as
    Fila | undefined
  const n = fila ? Number(JSON.parse(String(fila.valor))) : NaN
  return Number.isInteger(n) && n > 0 ? n : 30
}

/** Borra definitivamente lo que lleva en la papelera más del plazo. Devuelve cuántas. */
export function purgarPapelera(db: BaseDeDatos, ahora = new Date()): number {
  const limite = new Date(ahora.getTime() - diasPapelera(db) * 86_400_000).toISOString()
  const vencidas = db
    .prepare('SELECT id FROM tareas WHERE eliminada_at IS NOT NULL AND eliminada_at < ?')
    .all(limite) as { id: string }[]
  for (const { id } of vencidas) {
    borrarDefinitiva(db, { persona: null, ahora: ahora.toISOString() }, id)
  }
  return vencidas.length
}

export class ErrorNoEncontrado extends Error {}
export class ErrorValidacion extends Error {}
