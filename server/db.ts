import { randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

export type BaseDeDatos = DatabaseSync

const CARPETA_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), 'migraciones')

/**
 * Abre (o crea) la base local, aplica las migraciones pendientes y carga la
 * semilla. `ruta` puede ser ':memory:' (pruebas).
 */
export function abrirBase(ruta: string): BaseDeDatos {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true })
  const db = new DatabaseSync(ruta)
  db.exec('PRAGMA foreign_keys = ON')
  if (ruta !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA busy_timeout = 5000')
  }
  const versionAnterior = migrar(db)
  // La semilla se carga solo al crear la base: lo que se borre después no vuelve.
  if (versionAnterior === 0) sembrar(db)
  return db
}

/**
 * Aplica en orden los archivos de server/migraciones; la versión vive en `user_version`.
 * Devuelve la versión que tenía la base antes de migrar (0 = base nueva).
 */
function migrar(db: BaseDeDatos): number {
  const actual = Number(
    (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
  )
  const archivos = readdirSync(CARPETA_MIGRACIONES)
    .filter((a) => /^\d{4}_.+\.sql$/.test(a))
    .sort()
  for (const archivo of archivos) {
    const version = Number(archivo.slice(0, 4))
    if (version <= actual) continue
    const sql = readFileSync(join(CARPETA_MIGRACIONES, archivo), 'utf8')
    enTransaccion(db, () => {
      db.exec(sql)
      db.exec(`PRAGMA user_version = ${version}`)
    })
  }
  return actual
}

/** Ejecuta `fn` en una transacción: si algo falla, no queda nada a medias. */
export function enTransaccion<T>(db: BaseDeDatos, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const resultado = fn()
    db.exec('COMMIT')
    return resultado
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** Categorías y configuración por defecto (editables desde la app). */
const CATEGORIAS: [string, 'pedido' | 'interna'][] = [
  ['Impresión B/N', 'pedido'],
  ['Impresión color', 'pedido'],
  ['Vinilos y stickers', 'pedido'],
  ['Libros y encuadernación', 'pedido'],
  ['Anillados', 'pedido'],
  ['Papelería', 'pedido'],
  ['Regalos empresariales', 'pedido'],
  ['Trabajo tercerizado', 'pedido'],
  ['Envíos y logística', 'pedido'],
  ['Finanzas', 'interna'],
  ['Cartelería', 'interna'],
  ['Mejoras edilicias', 'interna'],
  ['Orden y limpieza', 'interna'],
  ['Mantenimiento de máquinas', 'interna'],
  ['Marketing', 'interna'],
  ['Desarrollo comercial', 'interna'],
]

const CONFIGURACION: Record<string, unknown> = {
  confeti_activado: true,
  // Urgencia estimada (sección 6.1). El nivel 4 es "vence hoy" (mismo día calendario).
  umbrales_urgencia: { nivel_5_horas: 2, nivel_3_horas: 24, nivel_2_horas: 72 },
  disposicion_cuadrantes: {
    arriba_izquierda: 'planificar',
    arriba_derecha: 'hacer',
    abajo_izquierda: 'eliminar',
    abajo_derecha: 'delegar',
  },
  plantilla_mensaje:
    'Hola {nombre}, tu trabajo "{trabajo}" ya está listo para retirar. Saldo pendiente: {saldo}.',
  papelera_dias: 30,
}

function sembrar(db: BaseDeDatos) {
  const categoria = db.prepare(
    'INSERT OR IGNORE INTO categorias (id, nombre, tipo_aplica, orden) VALUES (?, ?, ?, ?)',
  )
  const config = db.prepare('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)')
  enTransaccion(db, () => {
    CATEGORIAS.forEach(([nombre, tipo], i) =>
      categoria.run(randomUUID(), nombre, tipo, (i + 1) * 10),
    )
    for (const [clave, valor] of Object.entries(CONFIGURACION))
      config.run(clave, JSON.stringify(valor))
  })
}
