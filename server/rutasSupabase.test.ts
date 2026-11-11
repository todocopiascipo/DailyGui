// @vitest-environment node
import { readFileSync } from 'node:fs'
import { errorSupabase, rutaARpc } from '../src/modules/centro-operaciones/lib/rutasSupabase.ts'

const ID = '0c145903-584b-44d0-8fdd-7562cf7000cf'

describe('rutas → funciones de Supabase', () => {
  it.each([
    ['GET', '/matriz', undefined, 'co_matriz', {}],
    ['GET', '/catalogos', undefined, 'co_catalogos', {}],
    ['GET', '/papelera', undefined, 'co_papelera', {}],
    ['GET', '/clientes?telefono=2994', undefined, 'co_clientes', { p_telefono: '2994' }],
    [
      'GET',
      '/hechas?desde=2026-11-10T03%3A00%3A00.000Z',
      undefined,
      'co_hechas',
      { p_desde: '2026-11-10T03:00:00.000Z' },
    ],
    ['POST', '/personas', { nombre: 'Ana' }, 'co_crear_persona', { p: { nombre: 'Ana' } }],
    [
      'POST',
      `/personas/${ID}/verificar`,
      { pin: '1234' },
      'co_verificar_pin',
      { p_id: ID, p_pin: '1234' },
    ],
    [
      'PUT',
      `/personas/${ID}/pin`,
      { pin_nuevo: null },
      'co_cambiar_pin',
      { p_id: ID, p: { pin_nuevo: null } },
    ],
    ['GET', `/personas/${ID}/tareas`, undefined, 'co_mis_tareas', { p_persona: ID }],
    ['POST', '/tareas', { tarea: {} }, 'co_crear_tarea', { p: { tarea: {} } }],
    ['GET', `/tareas/${ID}`, undefined, 'co_detalle', { p_id: ID }],
    ['DELETE', `/tareas/${ID}`, undefined, 'co_borrar_definitiva', { p_id: ID }],
    [
      'POST',
      `/tareas/${ID}/terminar`,
      undefined,
      'co_tarea_accion',
      { p_id: ID, p_accion: 'terminar' },
    ],
    [
      'POST',
      `/tareas/${ID}/devolver`,
      undefined,
      'co_tarea_accion',
      { p_id: ID, p_accion: 'devolver' },
    ],
    [
      'POST',
      `/tareas/${ID}/subtareas`,
      { titulo: 'x' },
      'co_crear_subtarea',
      { p_tarea: ID, p: { titulo: 'x' } },
    ],
    [
      'PATCH',
      `/subtareas/${ID}`,
      { hecha: true },
      'co_editar_subtarea',
      { p_id: ID, p: { hecha: true } },
    ],
    ['DELETE', `/subtareas/${ID}`, undefined, 'co_borrar_subtarea', { p_id: ID }],
    [
      'PUT',
      '/configuracion/confeti_activado',
      { valor: false },
      'co_guardar_configuracion',
      { p_clave: 'confeti_activado', p: { valor: false } },
    ],
  ] as const)('%s %s', (metodo, ruta, cuerpo, funcion, args) => {
    expect(rutaARpc(metodo, ruta, cuerpo as Record<string, unknown> | undefined)).toEqual({
      funcion,
      args,
    })
  })

  it('la edición lleva la pista para el historial (mover de cuadrante)', () => {
    expect(rutaARpc('PATCH', `/tareas/${ID}`, { cambios: {} }, 'movida_cuadrante')).toEqual({
      funcion: 'co_editar_tarea',
      args: { p_id: ID, p: { cambios: {} }, p_pista: 'movida_cuadrante' },
    })
  })

  it('una ruta desconocida no existe', () => {
    expect(rutaARpc('GET', '/nada', undefined)).toBeNull()
    expect(rutaARpc('POST', `/tareas/${ID}/volar`, undefined)).toBeNull()
  })

  it('cubre todas las rutas del servidor local (salvo las propias de él)', () => {
    // Las rutas se leen de server/app.ts: si se agrega una, esta prueba avisa.
    const codigo = readFileSync('server/app.ts', 'utf8')
    const rutas = [...codigo.matchAll(/\[\s*'(GET|POST|PUT|PATCH|DELETE)',\s*'([^']+)'/g)].map(
      (r) => [r[1]!, r[2]!] as const,
    )
    const acciones = [...codigo.matchAll(/\['(\w+)', (\w+Tarea)\]/g)].map((r) => r[1]!)
    expect(rutas.length).toBeGreaterThan(10)
    const faltan = [
      ...rutas
        // salud y cambios son del servidor local (Supabase tiene su propio tiempo real).
        .filter(([, ruta]) => ruta !== '/api/salud')
        .map(
          ([metodo, ruta]) =>
            [
              metodo,
              ruta.replace('/api', '').replaceAll(':id', ID).replace(':clave', 'x'),
            ] as const,
        ),
      ...acciones.map((a) => ['POST', `/tareas/${ID}/${a}`] as const),
    ].filter(([metodo, ruta]) => rutaARpc(metodo, ruta, {}) === null)
    expect(faltan).toEqual([])
  })
})

describe('errores de Supabase', () => {
  it('se traducen a los del servidor local', () => {
    expect(errorSupabase({ code: 'P0001', message: 'PIN incorrecto' })).toEqual({
      estado: 400,
      mensaje: 'PIN incorrecto',
    })
    expect(errorSupabase({ code: 'P0002', message: 'La tarea no existe' }).estado).toBe(404)
    expect(errorSupabase({ code: '22P02' }).estado).toBe(404)
    expect(errorSupabase({ code: '42501' }).estado).toBe(403)
    expect(errorSupabase({ code: '' }).estado).toBe(0)
    expect(errorSupabase({ code: 'XX000' }).estado).toBe(500)
  })
})
