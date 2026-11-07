import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { cargarMatriz } from './consultas.ts'
import type { BaseDeDatos } from './db.ts'
import { ErrorNoEncontrado } from './servicio.ts'

type Manejador = (pedido: IncomingMessage, db: BaseDeDatos) => unknown

/** Rutas de la API: "MÉTODO /ruta" → manejador que devuelve el cuerpo JSON. */
const RUTAS: Record<string, Manejador> = {
  'GET /api/salud': () => ({ ok: true }),
  'GET /api/matriz': (_pedido, db) => cargarMatriz(db),
}

function responder(res: ServerResponse, estado: number, cuerpo: unknown) {
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(cuerpo))
}

export function crearServidor(db: BaseDeDatos) {
  return createServer(async (pedido, res) => {
    const ruta = new URL(pedido.url ?? '/', 'http://local').pathname
    const manejador = RUTAS[`${pedido.method} ${ruta}`]
    if (!manejador) return responder(res, 404, { error: 'No encontrado' })
    try {
      responder(res, 200, await manejador(pedido, db))
    } catch (error) {
      if (error instanceof ErrorNoEncontrado) return responder(res, 404, { error: error.message })
      console.error(error)
      responder(res, 500, { error: 'Error interno del servidor' })
    }
  })
}
