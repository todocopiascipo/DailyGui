/**
 * Acceso a los datos del servidor local (prototipo). Toda la app pasa por acá:
 * cuando se migre a Supabase, se reemplaza esta capa y el resto no cambia.
 */

let personaActiva: string | null = null

/** Persona activa ("¿Quién soy?"): viaja en cada pedido para quedar como autora en el historial. */
export function definirPersonaActiva(id: string | null) {
  personaActiva = id
}

export class ErrorApi extends Error {
  readonly estado: number
  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

export async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const headers = new Headers(opciones.headers)
  if (personaActiva) headers.set('x-persona-id', personaActiva)
  if (opciones.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(`/api${ruta}`, { ...opciones, headers })
  const cuerpo = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new ErrorApi(res.status, cuerpo?.error ?? 'Error del servidor')
  return cuerpo as T
}
