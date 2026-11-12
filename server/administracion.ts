/**
 * Fase 9: personas y categorías desde Configuración, historial global con
 * filtros y respaldo completo (especificación 7.11 y 7.12).
 */
import { randomUUID } from 'node:crypto'
import type {
  CategoriaConfig,
  EventoHistorial,
  PaginaHistorial,
  PersonaConfig,
} from '../src/modules/centro-operaciones/features/configuracion/tipos.ts'
import { enTransaccion, type BaseDeDatos } from './db.ts'
import { ErrorNoEncontrado, ErrorValidacion, inicialesDe } from './servicio.ts'

type Fila = Record<string, unknown>
type Objeto = Record<string, unknown>

function falla(mensaje: string): never {
  throw new ErrorValidacion(mensaje)
}

function objeto(v: unknown, nombre: string): Objeto {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) falla(`${nombre}: formato inválido`)
  return v as Objeto
}

function texto(v: unknown, nombre: string, max: number): string {
  if (typeof v !== 'string') falla(`${nombre}: tiene que ser texto`)
  const t = v.trim().replace(/\s+/g, ' ')
  if (t.length === 0) falla(`${nombre}: no puede quedar vacío`)
  if (t.length > max) falla(`${nombre}: máximo ${max} caracteres`)
  return t
}

function booleano(v: unknown, nombre: string): boolean {
  if (typeof v !== 'boolean') falla(`${nombre}: tiene que ser Sí o No`)
  return v
}

function listaIds(v: unknown, nombre: string): string[] {
  if (!Array.isArray(v) || v.length > 500) falla(`${nombre}: formato inválido`)
  return v.map((x) => {
    if (typeof x !== 'string' || !/^[0-9a-f-]{36}$/i.test(x))
      falla(`${nombre}: identificador inválido`)
    return x
  })
}

/** Ids en el orden de la lista → columna `orden` de 10 en 10. */
function ordenar(db: BaseDeDatos, tabla: 'personas' | 'categorias', ids: string[]) {
  enTransaccion(db, () => {
    const actualizar = db.prepare(`UPDATE ${tabla} SET orden = ? WHERE id = ? AND orden <> ?`)
    ids.forEach((id, i) => actualizar.run((i + 1) * 10, id, (i + 1) * 10))
  })
}

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

export function listarPersonas(db: BaseDeDatos): PersonaConfig[] {
  return (
    db
      .prepare(
        `SELECT id, nombre, iniciales, activa, pin_hash IS NOT NULL AS tiene_pin FROM personas
         ORDER BY activa DESC, orden, nombre`,
      )
      .all() as Fila[]
  ).map((p) => ({
    id: String(p.id),
    nombre: String(p.nombre),
    iniciales: (p.iniciales ?? null) as string | null,
    activa: p.activa === 1,
    tiene_pin: p.tiene_pin === 1,
  }))
}

/** Renombrar, cambiar iniciales, dar de baja o reactivar. */
export function editarPersona(db: BaseDeDatos, id: string, cuerpo: unknown): void {
  const o = objeto(cuerpo, 'Persona')
  enTransaccion(db, () => {
    const p = db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as Fila | undefined
    if (!p) throw new ErrorNoEncontrado('La persona no existe')
    const nombre = 'nombre' in o ? texto(o.nombre, 'Nombre', 60) : String(p.nombre)
    const iniciales =
      'iniciales' in o
        ? o.iniciales === null || o.iniciales === ''
          ? inicialesDe(nombre)
          : texto(o.iniciales, 'Iniciales', 4)
        : ((p.iniciales ?? null) as string | null)
    const activa = 'activa' in o ? booleano(o.activa, 'Activa') : p.activa === 1
    if (activa) {
      const repetida = db
        .prepare('SELECT 1 FROM personas WHERE lower(nombre) = lower(?) AND activa = 1 AND id <> ?')
        .get(nombre, id)
      if (repetida) falla('Ya hay una persona con ese nombre')
    }
    db.prepare(
      `UPDATE personas SET nombre = ?, iniciales = ?, activa = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ).run(nombre, iniciales, activa ? 1 : 0, id)
  })
}

export function ordenarPersonas(db: BaseDeDatos, cuerpo: unknown): void {
  ordenar(db, 'personas', listaIds(objeto(cuerpo, 'Orden').personas, 'Orden'))
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

const TIPOS_CATEGORIA = ['pedido', 'interna', 'ambos']

function tipoCategoria(v: unknown): CategoriaConfig['tipo_aplica'] {
  if (typeof v !== 'string' || !TIPOS_CATEGORIA.includes(v))
    falla('Para qué es: valor no permitido')
  return v as CategoriaConfig['tipo_aplica']
}

export function listarCategorias(db: BaseDeDatos): CategoriaConfig[] {
  return (
    db
      .prepare('SELECT id, nombre, tipo_aplica, activa FROM categorias ORDER BY orden, nombre')
      .all() as Fila[]
  ).map((c) => ({
    id: String(c.id),
    nombre: String(c.nombre),
    tipo_aplica: c.tipo_aplica as CategoriaConfig['tipo_aplica'],
    activa: c.activa === 1,
  }))
}

function nombreLibre(db: BaseDeDatos, nombre: string, id: string | null) {
  const repetida = db
    .prepare('SELECT 1 FROM categorias WHERE lower(nombre) = lower(?) AND id <> ?')
    .get(nombre, id ?? '')
  if (repetida) falla('Ya hay una categoría con ese nombre')
}

export function crearCategoria(db: BaseDeDatos, cuerpo: unknown): CategoriaConfig {
  const o = objeto(cuerpo, 'Categoría')
  const nombre = texto(o.nombre, 'Nombre de la categoría', 60)
  const tipo = 'tipo_aplica' in o ? tipoCategoria(o.tipo_aplica) : 'ambos'
  return enTransaccion(db, () => {
    nombreLibre(db, nombre, null)
    const orden = Number(
      (db.prepare('SELECT coalesce(max(orden), 0) + 10 AS n FROM categorias').get() as Fila).n,
    )
    const id = randomUUID()
    db.prepare('INSERT INTO categorias (id, nombre, tipo_aplica, orden) VALUES (?, ?, ?, ?)').run(
      id,
      nombre,
      tipo,
      orden,
    )
    return { id, nombre, tipo_aplica: tipo, activa: true }
  })
}

export function editarCategoria(db: BaseDeDatos, id: string, cuerpo: unknown): void {
  const o = objeto(cuerpo, 'Categoría')
  enTransaccion(db, () => {
    const c = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id) as Fila | undefined
    if (!c) throw new ErrorNoEncontrado('La categoría no existe')
    const nombre = 'nombre' in o ? texto(o.nombre, 'Nombre de la categoría', 60) : String(c.nombre)
    const tipo = 'tipo_aplica' in o ? tipoCategoria(o.tipo_aplica) : String(c.tipo_aplica)
    const activa = 'activa' in o ? booleano(o.activa, 'Activa') : c.activa === 1
    nombreLibre(db, nombre, id)
    db.prepare(
      `UPDATE categorias SET nombre = ?, tipo_aplica = ?, activa = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    ).run(nombre, tipo, activa ? 1 : 0, id)
  })
}

export function ordenarCategorias(db: BaseDeDatos, cuerpo: unknown): void {
  ordenar(db, 'categorias', listaIds(objeto(cuerpo, 'Orden').categorias, 'Orden'))
}

// ---------------------------------------------------------------------------
// Historial global (7.11): filtros por persona, tarea, fechas y texto; paginado.
// ---------------------------------------------------------------------------

export const POR_PAGINA = 50

export interface FiltrosHistorial {
  persona: string | null
  tarea: string | null
  desde: string | null
  hasta: string | null
  texto: string | null
  /** "created_at|id" del último evento de la página anterior. */
  antes: string | null
}

const fechaOpcional = (v: string | null, nombre: string) => {
  if (!v) return null
  if (Number.isNaN(Date.parse(v))) falla(`${nombre}: fecha inválida`)
  return new Date(v).toISOString()
}

export function leerFiltrosHistorial(q: URLSearchParams): FiltrosHistorial {
  const id = (v: string | null, nombre: string) => {
    if (!v) return null
    if (!/^[0-9a-f-]{36}$/i.test(v)) falla(`${nombre}: identificador inválido`)
    return v
  }
  const antes = q.get('antes')
  if (antes && !/^[^|]+\|[0-9a-f-]{36}$/i.test(antes)) falla('Página inválida')
  const t = (q.get('texto') ?? '').trim().slice(0, 100)
  return {
    persona: id(q.get('persona'), 'Persona'),
    tarea: id(q.get('tarea'), 'Tarea'),
    desde: fechaOpcional(q.get('desde'), 'Desde'),
    hasta: fechaOpcional(q.get('hasta'), 'Hasta'),
    texto: t === '' ? null : t,
    antes: antes || null,
  }
}

export function cargarHistorial(db: BaseDeDatos, f: FiltrosHistorial): PaginaHistorial {
  const condiciones: string[] = []
  const valores: (string | number)[] = []
  if (f.persona) {
    condiciones.push('e.persona_id = ?')
    valores.push(f.persona)
  }
  if (f.tarea) {
    condiciones.push('e.tarea_id = ?')
    valores.push(f.tarea)
  }
  if (f.desde) {
    condiciones.push('e.created_at >= ?')
    valores.push(f.desde)
  }
  if (f.hasta) {
    condiciones.push('e.created_at < ?')
    valores.push(f.hasta)
  }
  if (f.texto) {
    condiciones.push(
      `(instr(lower(e.cambios), lower(?)) > 0 OR instr(lower(coalesce(t.titulo, '')), lower(?)) > 0
        OR instr(lower(coalesce(p.nombre, '')), lower(?)) > 0
        OR instr(lower(coalesce(y.nombre, '')), lower(?)) > 0)`,
    )
    valores.push(f.texto, f.texto, f.texto, f.texto)
  }
  if (f.antes) {
    const [fecha, id] = f.antes.split('|') as [string, string]
    condiciones.push('(e.created_at < ? OR (e.created_at = ? AND e.id < ?))')
    valores.push(fecha, fecha, id)
  }
  const filas = db
    .prepare(
      `SELECT e.id, e.accion, e.persona_id, p.nombre AS persona, e.tarea_id, t.titulo AS tarea_titulo,
              e.proyecto_id, y.nombre AS proyecto_nombre, e.cambios, e.created_at
       FROM eventos e
       LEFT JOIN personas p ON p.id = e.persona_id
       LEFT JOIN tareas t ON t.id = e.tarea_id
       LEFT JOIN proyectos y ON y.id = e.proyecto_id
       ${condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : ''}
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT ?`,
    )
    .all(...valores, POR_PAGINA + 1) as Fila[]
  const texto = (v: unknown) => (v ?? null) as string | null
  const eventos: EventoHistorial[] = filas.slice(0, POR_PAGINA).map((e) => ({
    id: String(e.id),
    accion: String(e.accion),
    persona: texto(e.persona),
    persona_id: texto(e.persona_id),
    tarea_id: texto(e.tarea_id),
    tarea_titulo: texto(e.tarea_titulo),
    proyecto_id: texto(e.proyecto_id),
    proyecto_nombre: texto(e.proyecto_nombre),
    cambios: JSON.parse(String(e.cambios)) as Record<string, unknown>,
    created_at: String(e.created_at),
  }))
  const ultimo = eventos.at(-1)
  return {
    eventos,
    siguiente: filas.length > POR_PAGINA && ultimo ? `${ultimo.created_at}|${ultimo.id}` : null,
  }
}

// ---------------------------------------------------------------------------
// Respaldo (7.12): todo lo guardado, en un solo JSON. Los PIN no viajan.
// ---------------------------------------------------------------------------

const TABLAS_RESPALDO = [
  'personas',
  'clientes',
  'categorias',
  'proyectos',
  'tareas',
  'tarea_responsables',
  'subtareas',
  'eventos',
  'configuracion',
] as const

export function armarRespaldo(db: BaseDeDatos) {
  const tablas: Record<string, unknown[]> = {}
  for (const tabla of TABLAS_RESPALDO) {
    const filas = db.prepare(`SELECT * FROM ${tabla}`).all() as Fila[]
    tablas[tabla] = filas.map((f) => {
      const { pin_hash, ...resto } = f
      const fila: Fila = tabla === 'personas' ? { ...resto, tiene_pin: pin_hash != null } : resto
      for (const k of ['cambios', 'valor'] as const) {
        if (typeof fila[k] === 'string') fila[k] = JSON.parse(fila[k]) as unknown
      }
      return fila
    })
  }
  return {
    aplicacion: 'TODOCOPIAS · Centro de operaciones',
    version: 1,
    generado: new Date().toISOString(),
    tablas,
  }
}
