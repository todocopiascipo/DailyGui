/**
 * Traducción de cada pedido de la app (las mismas rutas del servidor local)
 * a la función equivalente de Supabase (supabase/migrations/*_api_funciones.sql).
 * Función pura, con pruebas.
 */

export interface LlamadaRpc {
  funcion: string
  args: Record<string, unknown>
}

type Cuerpo = Record<string, unknown> | undefined

const ACCIONES = ['eliminar', 'restaurar', 'terminar', 'entregar', 'devolver']

/** null si la ruta no existe (equivale a un 404 del servidor local). */
export function rutaARpc(
  metodo: string,
  rutaCompleta: string,
  cuerpo: Cuerpo,
  pista: string | null = null,
): LlamadaRpc | null {
  const url = new URL(rutaCompleta, 'http://co')
  const partes = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const m = metodo.toUpperCase()
  const [a, id, b, c] = partes
  const rpc = (funcion: string, args: Record<string, unknown> = {}): LlamadaRpc => ({
    funcion,
    args,
  })

  if (m === 'GET' && partes.length === 1) {
    if (a === 'matriz') return rpc('co_matriz')
    if (a === 'catalogos') return rpc('co_catalogos')
    if (a === 'papelera') return rpc('co_papelera')
    if (a === 'clientes')
      return rpc('co_clientes', { p_telefono: url.searchParams.get('telefono') ?? '' })
    if (a === 'hechas') return rpc('co_hechas', { p_desde: url.searchParams.get('desde') })
  }

  if (a === 'personas') {
    if (m === 'POST' && partes.length === 1) return rpc('co_crear_persona', { p: cuerpo ?? {} })
    if (m === 'POST' && b === 'verificar' && !c) {
      return rpc('co_verificar_pin', { p_id: id, p_pin: String(cuerpo?.pin ?? '') })
    }
    if (m === 'PUT' && b === 'pin' && !c)
      return rpc('co_cambiar_pin', { p_id: id, p: cuerpo ?? {} })
    if (m === 'GET' && b === 'tareas' && !c) return rpc('co_mis_tareas', { p_persona: id })
  }

  if (a === 'tareas') {
    if (m === 'POST' && partes.length === 1) return rpc('co_crear_tarea', { p: cuerpo ?? {} })
    if (partes.length === 2) {
      if (m === 'GET') return rpc('co_detalle', { p_id: id })
      if (m === 'PATCH') {
        return rpc('co_editar_tarea', { p_id: id, p: cuerpo ?? {}, p_pista: pista })
      }
      if (m === 'DELETE') return rpc('co_borrar_definitiva', { p_id: id })
    }
    if (partes.length === 3 && m === 'POST') {
      if (b === 'subtareas') return rpc('co_crear_subtarea', { p_tarea: id, p: cuerpo ?? {} })
      if (b && ACCIONES.includes(b)) return rpc('co_tarea_accion', { p_id: id, p_accion: b })
    }
  }

  if (a === 'subtareas' && partes.length === 2) {
    if (m === 'PATCH') return rpc('co_editar_subtarea', { p_id: id, p: cuerpo ?? {} })
    if (m === 'DELETE') return rpc('co_borrar_subtarea', { p_id: id })
  }

  if (a === 'proyectos') {
    if (partes.length === 1) {
      if (m === 'GET') return rpc('co_proyectos')
      if (m === 'POST') return rpc('co_crear_proyecto', { p: cuerpo ?? {} })
    }
    if (partes.length === 2) {
      if (m === 'GET') return rpc('co_proyecto', { p_id: id })
      if (m === 'PATCH') return rpc('co_editar_proyecto', { p_id: id, p: cuerpo ?? {} })
      if (m === 'DELETE') return rpc('co_borrar_proyecto', { p_id: id })
    }
    if (partes.length === 3 && b === 'orden' && m === 'PUT') {
      return rpc('co_ordenar_proyecto', { p_id: id, p: cuerpo ?? {} })
    }
  }

  if (a === 'configuracion' && partes.length === 2 && m === 'PUT') {
    return rpc('co_guardar_configuracion', { p_clave: id, p: cuerpo ?? {} })
  }

  return null
}

/** Error de Supabase → estado HTTP equivalente al del servidor local, con su mensaje. */
export function errorSupabase(error: { code?: string; message?: string }): {
  estado: number
  mensaje: string
} {
  const codigo = error.code ?? ''
  // Sin código: no llegó a la base (sin red).
  if (codigo === '') return { estado: 0, mensaje: 'Sin conexión con el servidor' }
  if (codigo === 'P0002') return { estado: 404, mensaje: error.message ?? 'No encontrado' }
  // Identificador mal formado en la ruta: para la app, "no existe".
  if (codigo === '22P02') return { estado: 404, mensaje: 'No encontrado' }
  if (codigo === '42501') {
    return { estado: 403, mensaje: 'Sin acceso: abrí el link de acceso del local' }
  }
  if (codigo === 'P0001') return { estado: 400, mensaje: error.message ?? 'Datos inválidos' }
  return { estado: 500, mensaje: 'Error del servidor' }
}
