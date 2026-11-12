/**
 * Canal de cambios en tiempo real (Server-Sent Events). Cada pantalla abierta
 * mantiene una conexión a /api/cambios; cuando algo se guarda, todas reciben
 * un aviso y vuelven a pedir lo que muestran. Un "latido" periódico permite
 * detectar conexiones caídas de ambos lados.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface Aviso {
  /** Qué cambió, para que cada pantalla decida qué volver a pedir. */
  recursos: ('tareas' | 'personas' | 'configuracion' | 'proyectos')[]
  tarea_id?: string | null
}

export interface Canal {
  abrir(pedido: IncomingMessage, res: ServerResponse): void
  avisar(aviso: Aviso): void
  cerrar(): void
  readonly conectados: number
}

export function crearCanal({ latidoMs = 5_000 } = {}): Canal {
  const clientes = new Set<ServerResponse>()

  const enviar = (res: ServerResponse, evento: string, datos: unknown) =>
    res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`)

  const latido = setInterval(() => {
    for (const res of clientes) enviar(res, 'latido', { t: Date.now() })
  }, latidoMs)
  latido.unref()

  return {
    abrir(pedido, res) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      // Si se corta, el navegador reintenta a los 2 s.
      res.write('retry: 2000\n\n')
      enviar(res, 'hola', { latidoMs })
      clientes.add(res)
      pedido.on('close', () => clientes.delete(res))
    },
    avisar(aviso) {
      for (const res of clientes) enviar(res, 'cambio', aviso)
    },
    cerrar() {
      clearInterval(latido)
      for (const res of clientes) res.end()
      clientes.clear()
    },
    get conectados() {
      return clientes.size
    },
  }
}
