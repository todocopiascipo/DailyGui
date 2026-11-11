/**
 * Acceso a los datos. Toda la app pasa por acá, con las mismas rutas:
 * - en desarrollo (y en las pruebas), al servidor local (server/);
 * - en la app publicada, a las funciones de Supabase (lib/rutasSupabase.ts).
 */
import { errorSupabase, rutaARpc } from './rutasSupabase'
import { personaParaSupabase, supabase, usaSupabase } from './supabase'

let personaActiva: string | null = null

/** Persona activa ("¿Quién soy?"): viaja en cada pedido para quedar como autora en el historial. */
export function definirPersonaActiva(id: string | null) {
  personaActiva = id
  personaParaSupabase(id)
}

export class ErrorApi extends Error {
  readonly estado: number
  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

export async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  return usaSupabase ? pedirSupabase<T>(ruta, opciones) : pedirLocal<T>(ruta, opciones)
}

async function pedirLocal<T>(ruta: string, opciones: RequestInit): Promise<T> {
  const headers = new Headers(opciones.headers)
  if (personaActiva) headers.set('x-persona-id', personaActiva)
  if (opciones.body) headers.set('Content-Type', 'application/json')
  let res: Response
  try {
    res = await fetch(`/api${ruta}`, { ...opciones, headers })
  } catch {
    // Sin red o servidor apagado.
    throw new ErrorApi(0, 'Sin conexión con el servidor del local')
  }
  const cuerpo = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) {
    // El proxy de desarrollo responde 5xx sin cuerpo JSON cuando el servidor no está.
    const mensaje =
      cuerpo?.error ??
      (res.status >= 502 ? 'Sin conexión con el servidor del local' : 'Error del servidor')
    throw new ErrorApi(res.status, mensaje)
  }
  return cuerpo as T
}

async function pedirSupabase<T>(ruta: string, opciones: RequestInit): Promise<T> {
  const cuerpo =
    typeof opciones.body === 'string'
      ? (JSON.parse(opciones.body) as Record<string, unknown>)
      : undefined
  const pista = new Headers(opciones.headers).get('x-co-accion')
  const llamada = rutaARpc(opciones.method ?? 'GET', ruta, cuerpo, pista)
  if (!llamada) throw new ErrorApi(404, 'No encontrado')
  let respuesta: { data: unknown; error: { code?: string; message?: string } | null }
  try {
    respuesta = await supabase().rpc(llamada.funcion, llamada.args)
  } catch {
    throw new ErrorApi(0, 'Sin conexión con el servidor')
  }
  if (respuesta.error) {
    const { estado, mensaje } = errorSupabase(respuesta.error)
    throw new ErrorApi(estado, mensaje)
  }
  return respuesta.data as T
}
