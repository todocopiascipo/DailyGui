/**
 * Operaciones sobre la base local. Cada operación corre en una transacción,
 * aplica las reglas automáticas y registra el historial (una sola vía).
 */
import { randomUUID } from 'node:crypto'
import { enTransaccion, type BaseDeDatos } from './db.ts'
import { eventoDeTarea, reglasAlGuardar, type Evento, type Pista, type Tarea } from './reglas.ts'

export interface Contexto {
  /** Persona activa ("¿Quién soy?"); se ignora si no existe. */
  persona: string | null
  pista?: Pista
  /** Hora de la operación (ISO). Por defecto, ahora. */
  ahora?: string
}

export type DatosNuevaTarea = Partial<Omit<Tarea, 'id'>> & Pick<Tarea, 'titulo' | 'importante'>

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
): Tarea {
  const ahora = ctx.ahora ?? new Date().toISOString()
  return enTransaccion(db, () => {
    const persona = personaValida(db, ctx.persona)
    const base: Tarea = {
      tipo: 'pedido',
      descripcion: null,
      categoria_id: null,
      proyecto_id: null,
      cliente_id: null,
      sena: 0,
      saldo: 0,
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
      id: randomUUID(),
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
      subtarea.run(randomUUID(), tarea.id, s.titulo, s.responsable_id ?? null, i)
      // El responsable de una subtarea se suma a los de la tarea.
      if (s.responsable_id) responsable.run(tarea.id, s.responsable_id)
    })

    registrar(db, eventoDeTarea(null, tarea, persona), ahora)
    return leerTarea(db, tarea.id)!
  })
}

/** Modifica campos de una tarea, aplica las reglas y registra el historial. */
export function actualizarTarea(
  db: BaseDeDatos,
  ctx: Contexto,
  id: string,
  cambios: Partial<Omit<Tarea, 'id' | 'created_at' | 'creada_por'>>,
): Tarea {
  const ahora = ctx.ahora ?? new Date().toISOString()
  return enTransaccion(db, () => {
    const anterior = leerTarea(db, id)
    if (!anterior) throw new ErrorNoEncontrado('La tarea no existe')
    const persona = personaValida(db, ctx.persona)
    const nueva = reglasAlGuardar(anterior, { ...anterior, ...cambios }, persona, ahora)
    const columnas = COLUMNAS_TAREA.filter((c) => c !== 'id' && c !== 'updated_at')
    db.prepare(`UPDATE tareas SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
      ...columnas.map((c) => aSqlite(nueva[c])),
      id,
    )
    registrar(db, eventoDeTarea(anterior, nueva, persona, ctx.pista), ahora)
    return leerTarea(db, id)!
  })
}

export class ErrorNoEncontrado extends Error {}
