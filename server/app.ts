import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { crearCanal, type Aviso } from './canal.ts'
import { buscarClientes, cargarCatalogos, cargarDetalle, cargarMatriz } from './consultas.ts'
import type { BaseDeDatos } from './db.ts'
import type { Pista } from './reglas.ts'
import {
  actualizarSubtarea,
  actualizarTarea,
  crearPersona,
  crearSubtarea,
  crearTarea,
  eliminarSubtarea,
  ErrorNoEncontrado,
  ErrorValidacion,
  type Contexto,
} from './servicio.ts'
import {
  validarEdicionSubtarea,
  validarEdicionTarea,
  validarNuevaPersona,
  validarNuevaSubtarea,
  validarNuevaTarea,
} from './validar.ts'

interface Pedido {
  db: BaseDeDatos
  /** Parámetros de la ruta (`:id`). */
  params: Record<string, string>
  query: URLSearchParams
  cuerpo: unknown
  ctx: Contexto
}

type Manejador = (p: Pedido) => unknown

/** Rutas de la API: método, patrón y manejador que devuelve el cuerpo JSON. */
const RUTAS: [string, string, Manejador][] = [
  ['GET', '/api/salud', () => ({ ok: true })],
  ['GET', '/api/matriz', ({ db }) => cargarMatriz(db)],
  ['GET', '/api/catalogos', ({ db }) => cargarCatalogos(db)],
  ['GET', '/api/clientes', ({ db, query }) => buscarClientes(db, query.get('telefono') ?? '')],
  ['POST', '/api/personas', ({ db, cuerpo }) => crearPersona(db, validarNuevaPersona(cuerpo))],
  [
    'POST',
    '/api/tareas',
    ({ db, ctx, cuerpo }) => {
      const p = validarNuevaTarea(cuerpo)
      const t = crearTarea(db, ctx, p.datos, p.responsables, p.subtareas, p.cliente)
      return cargarDetalle(db, t.id)
    },
  ],
  [
    'GET',
    '/api/tareas/:id',
    ({ db, params }) => {
      const detalle = cargarDetalle(db, params.id!)
      if (!detalle) throw new ErrorNoEncontrado('La tarea no existe')
      return detalle
    },
  ],
  [
    'PATCH',
    '/api/tareas/:id',
    ({ db, ctx, params, cuerpo }) => {
      const { cambios, extras } = validarEdicionTarea(cuerpo)
      actualizarTarea(db, ctx, params.id!, cambios, extras)
      return cargarDetalle(db, params.id!)
    },
  ],
  [
    'POST',
    '/api/tareas/:id/subtareas',
    ({ db, ctx, params, cuerpo }) => {
      crearSubtarea(db, ctx, params.id!, validarNuevaSubtarea(cuerpo))
      return cargarDetalle(db, params.id!)
    },
  ],
  [
    'PATCH',
    '/api/subtareas/:id',
    ({ db, ctx, params, cuerpo }) => {
      const s = actualizarSubtarea(db, ctx, params.id!, validarEdicionSubtarea(cuerpo))
      return cargarDetalle(db, s.tarea_id)
    },
  ],
  [
    'DELETE',
    '/api/subtareas/:id',
    ({ db, ctx, params }) => {
      const fila = db.prepare('SELECT tarea_id FROM subtareas WHERE id = ?').get(params.id!) as
        { tarea_id: string } | undefined
      if (!fila) throw new ErrorNoEncontrado('La subtarea no existe')
      eliminarSubtarea(db, ctx, params.id!)
      return cargarDetalle(db, fila.tarea_id)
    },
  ],
]

/** Busca la ruta que coincide y extrae los parámetros. */
function encontrar(metodo: string, ruta: string) {
  const partes = ruta.split('/')
  for (const [m, patron, manejador] of RUTAS) {
    if (m !== metodo) continue
    const p = patron.split('/')
    if (p.length !== partes.length) continue
    const params: Record<string, string> = {}
    const coincide = p.every((segmento, i) => {
      if (segmento.startsWith(':')) {
        params[segmento.slice(1)] = decodeURIComponent(partes[i]!)
        return partes[i] !== ''
      }
      return segmento === partes[i]
    })
    if (coincide) return { manejador, params }
  }
  return null
}

const LIMITE_CUERPO = 256 * 1024

async function leerCuerpo(pedido: IncomingMessage): Promise<unknown> {
  if (pedido.method === 'GET' || pedido.method === 'DELETE') return undefined
  const trozos: Buffer[] = []
  let total = 0
  for await (const trozo of pedido) {
    total += (trozo as Buffer).length
    if (total > LIMITE_CUERPO) throw new ErrorValidacion('El pedido es demasiado grande')
    trozos.push(trozo as Buffer)
  }
  if (total === 0) return undefined
  try {
    return JSON.parse(Buffer.concat(trozos).toString('utf8')) as unknown
  } catch {
    throw new ErrorValidacion('El pedido no es JSON válido')
  }
}

function responder(res: ServerResponse, estado: number, cuerpo: unknown) {
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(cuerpo))
}

function encabezado(pedido: IncomingMessage, nombre: string): string | null {
  const v = pedido.headers[nombre]
  return typeof v === 'string' && v !== '' ? v : null
}

function pistaDe(valor: string | null): Pista | undefined {
  return valor === 'movida_cuadrante' || valor === 'devuelta' ? valor : undefined
}

/** Qué avisar a las pantallas conectadas después de un cambio que salió bien. */
function avisoDe(metodo: string, ruta: string, resultado: unknown): Aviso {
  if (ruta.startsWith('/api/personas')) return { recursos: ['personas'] }
  const tareaId =
    typeof resultado === 'object' && resultado !== null && 'tarea' in resultado
      ? ((resultado as { tarea: { id?: string } }).tarea.id ?? null)
      : null
  return { recursos: ['tareas'], tarea_id: metodo === 'GET' ? null : tareaId }
}

export function crearServidor(db: BaseDeDatos, opciones: { latidoMs?: number } = {}) {
  const canal = crearCanal(opciones)
  const servidor = createServer(async (pedido, res) => {
    const url = new URL(pedido.url ?? '/', 'http://local')
    if (pedido.method === 'GET' && url.pathname === '/api/cambios') {
      return canal.abrir(pedido, res)
    }
    const ruta = encontrar(pedido.method ?? 'GET', url.pathname)
    if (!ruta) return responder(res, 404, { error: 'No encontrado' })
    try {
      const cuerpo = await leerCuerpo(pedido)
      const ctx: Contexto = {
        persona: encabezado(pedido, 'x-persona-id'),
        pista: pistaDe(encabezado(pedido, 'x-co-accion')),
      }
      const resultado = await ruta.manejador({
        db,
        params: ruta.params,
        query: url.searchParams,
        cuerpo,
        ctx,
      })
      responder(res, pedido.method === 'POST' ? 201 : 200, resultado ?? { ok: true })
      if (pedido.method !== 'GET')
        canal.avisar(avisoDe(pedido.method ?? '', url.pathname, resultado))
    } catch (error) {
      if (error instanceof ErrorNoEncontrado) return responder(res, 404, { error: error.message })
      if (error instanceof ErrorValidacion) return responder(res, 400, { error: error.message })
      // Restricciones de la base (claves foráneas, rangos): dato inválido, no error interno.
      if (error instanceof Error && /constraint failed/i.test(error.message)) {
        return responder(res, 400, { error: 'Datos inválidos' })
      }
      console.error(error)
      responder(res, 500, { error: 'Error interno del servidor' })
    }
  })
  // Al cerrar el servidor, cortar también las conexiones del canal (si no, close() no termina).
  const cerrarOriginal = servidor.close.bind(servidor)
  servidor.close = ((cb?: (err?: Error) => void) => {
    canal.cerrar()
    return cerrarOriginal(cb)
  }) as typeof servidor.close
  return servidor
}
