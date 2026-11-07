// @vitest-environment node
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { crearServidor } from './app.ts'
import { abrirBase, type BaseDeDatos } from './db.ts'
import { actualizarTarea, crearTarea } from './servicio.ts'

let db: BaseDeDatos
let servidor: Server
let base: string

beforeEach(async () => {
  db = abrirBase(':memory:')
  servidor = crearServidor(db)
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})

afterEach(async () => {
  await new Promise((ok) => servidor.close(ok))
  db.close()
})

describe('API', () => {
  it('salud', async () => {
    const r = await fetch(`${base}/api/salud`)
    expect(await r.json()).toEqual({ ok: true })
  })

  it('ruta desconocida devuelve 404', async () => {
    expect((await fetch(`${base}/api/nada`)).status).toBe(404)
  })

  it('matriz: tareas activas con responsables y avance; excluye eliminadas y entregadas', async () => {
    const p = crypto.randomUUID()
    db.prepare("INSERT INTO personas (id, nombre, iniciales) VALUES (?, 'Uno', 'U')").run(p)
    const ctx = { persona: p }
    const visible = crearTarea(
      db,
      ctx,
      { titulo: 'Visible', importante: true },
      [p],
      [{ titulo: 'Paso 1' }, { titulo: 'Paso 2' }],
    )
    const eliminada = crearTarea(db, ctx, { titulo: 'Eliminada', importante: true })
    actualizarTarea(db, ctx, eliminada.id, { eliminada_at: new Date().toISOString() })
    const entregada = crearTarea(db, ctx, { titulo: 'Entregada', importante: true })
    actualizarTarea(db, ctx, entregada.id, { estado: 'entregada' })
    const interna = crearTarea(db, ctx, { titulo: 'Interna', importante: true, tipo: 'interna' })
    actualizarTarea(db, ctx, interna.id, { estado: 'terminada' })

    const r = (await (await fetch(`${base}/api/matriz`)).json()) as {
      tareas: { id: string; titulo: string; responsables: unknown[]; subtareas: unknown }[]
      configuracion: { clave: string }[]
    }
    expect(r.tareas.map((t) => t.titulo)).toEqual(['Visible'])
    expect(r.tareas[0]!.id).toBe(visible.id)
    expect(r.tareas[0]!.responsables).toEqual([{ id: p, nombre: 'Uno', iniciales: 'U' }])
    expect(r.tareas[0]!.subtareas).toEqual({ total: 2, hechas: 0 })
    expect(r.configuracion.map((c) => c.clave).sort()).toEqual([
      'disposicion_cuadrantes',
      'umbrales_urgencia',
    ])
  })
})

/** Pedido JSON a la API; devuelve estado y cuerpo. */
async function api(metodo: string, ruta: string, cuerpo?: unknown, persona?: string) {
  const headers: Record<string, string> = {}
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  if (persona) headers['x-persona-id'] = persona
  const r = await fetch(`${base}/api${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  return { estado: r.status, cuerpo: (await r.json()) as any } // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('API de edición', () => {
  it('alta de personas: iniciales automáticas y sin repetidos', async () => {
    const a = await api('POST', '/personas', { nombre: '  Ana   María ' })
    expect(a.estado).toBe(201)
    expect(a.cuerpo).toMatchObject({ nombre: 'Ana María', iniciales: 'AM' })
    expect((await api('POST', '/personas', { nombre: 'ana maría' })).estado).toBe(400)
    expect((await api('POST', '/personas', { nombre: '' })).estado).toBe(400)
    const cat = await api('GET', '/catalogos')
    expect(cat.cuerpo.personas).toHaveLength(1)
    expect(cat.cuerpo.categorias).toHaveLength(16)
  })

  it('crea un pedido completo y devuelve el detalle', async () => {
    const ana = (await api('POST', '/personas', { nombre: 'Ana' })).cuerpo.id as string
    const beto = (await api('POST', '/personas', { nombre: 'Beto' })).cuerpo.id as string
    const r = await api(
      'POST',
      '/tareas',
      {
        tarea: {
          titulo: ' Imprimir vinilo ',
          importante: true,
          fecha_entrega: '2026-11-07T17:00:00.000Z',
          sena: '1500.5',
          saldo: 3000,
        },
        responsables: [ana],
        subtareas: [{ titulo: 'Cortar', responsable_id: beto }, { titulo: 'Imprimir' }],
        cliente: { nombre_apellido: 'Cliente Prueba', telefono: '2994000000' },
      },
      ana,
    )
    expect(r.estado).toBe(201)
    const d = r.cuerpo
    expect(d.tarea).toMatchObject({ titulo: 'Imprimir vinilo', sena: 1500.5, saldo: 3000 })
    expect(d.tarea.creada_por).toBe(ana)
    // El responsable de la subtarea se suma a los de la tarea.
    expect(d.responsables.map((p: { nombre: string }) => p.nombre)).toEqual(['Ana', 'Beto'])
    expect(d.subtareas.map((s: { titulo: string }) => s.titulo)).toEqual(['Cortar', 'Imprimir'])
    expect(d.cliente).toMatchObject({ nombre_apellido: 'Cliente Prueba', telefono: '2994000000' })
    expect(d.eventos.map((e: { accion: string }) => e.accion)).toEqual(['creada'])
    expect(d.eventos[0].persona).toBe('Ana')

    // El teléfono permite reutilizar el cliente.
    const c = await api('GET', '/clientes?telefono=2994000000')
    expect(c.cuerpo).toHaveLength(1)
  })

  it('edita campos, responsables y cliente, con historial', async () => {
    const ana = (await api('POST', '/personas', { nombre: 'Ana' })).cuerpo.id as string
    const beto = (await api('POST', '/personas', { nombre: 'Beto' })).cuerpo.id as string
    const creada = await api('POST', '/tareas', {
      tarea: { titulo: 'Folletos', importante: false },
      responsables: [ana],
    })
    const id = creada.cuerpo.tarea.id as string

    const e = await api(
      'PATCH',
      `/tareas/${id}`,
      {
        cambios: {
          importante: true,
          urgencia_manual: 4,
          estado: 'en_espera',
          motivo_espera: 'pago',
        },
        responsables: [beto],
        cliente: { nombre_apellido: 'Otro Cliente', telefono: null },
      },
      beto,
    )
    expect(e.estado).toBe(200)
    expect(e.cuerpo.tarea).toMatchObject({
      importante: true,
      urgencia_manual: 4,
      estado: 'en_espera',
      motivo_espera: 'pago',
      actualizada_por: beto,
    })
    expect(e.cuerpo.responsables.map((p: { nombre: string }) => p.nombre)).toEqual(['Beto'])
    expect(e.cuerpo.cliente.nombre_apellido).toBe('Otro Cliente')
    const acciones = e.cuerpo.eventos.map((x: { accion: string }) => x.accion)
    expect(acciones).toEqual(['reasignada', 'estado', 'creada'])
    expect(e.cuerpo.eventos[0].cambios.responsables).toEqual({ antes: ['Ana'], despues: ['Beto'] })

    // Salir de "en espera" borra el motivo; pasar a interna quita el cliente.
    const f = await api('PATCH', `/tareas/${id}`, {
      cambios: { estado: 'en_proceso', tipo: 'interna', urgencia_manual: null },
    })
    expect(f.cuerpo.tarea).toMatchObject({
      estado: 'en_proceso',
      motivo_espera: null,
      tipo: 'interna',
      cliente_id: null,
      urgencia_manual: null,
    })
  })

  it('subtareas: alta, marcar hecha, editar y borrar', async () => {
    const ana = (await api('POST', '/personas', { nombre: 'Ana' })).cuerpo.id as string
    const id = (await api('POST', '/tareas', { tarea: { titulo: 'Libro', importante: true } }))
      .cuerpo.tarea.id as string

    const a = await api('POST', `/tareas/${id}/subtareas`, {
      titulo: 'Encuadernar',
      responsable_id: ana,
    })
    expect(a.estado).toBe(201)
    const sub = a.cuerpo.subtareas[0].id as string
    expect(a.cuerpo.responsables.map((p: { id: string }) => p.id)).toEqual([ana])

    const h = await api('PATCH', `/subtareas/${sub}`, { hecha: true, titulo: 'Encuadernar tapa' })
    expect(h.cuerpo.subtareas[0]).toMatchObject({ hecha: true, titulo: 'Encuadernar tapa' })

    const m = await (await fetch(`${base}/api/matriz`)).json()
    expect(m.tareas[0].subtareas).toEqual({ total: 1, hechas: 1 })

    const b = await api('DELETE', `/subtareas/${sub}`)
    expect(b.cuerpo.subtareas).toEqual([])
    expect(b.cuerpo.eventos.map((x: { accion: string }) => x.accion)).toEqual([
      'subtarea_eliminada',
      'subtarea_editada',
      'subtarea_hecha',
      'subtarea_creada',
      'creada',
    ])
  })

  it('rechaza datos inválidos sin guardar nada', async () => {
    const casos = [
      { tarea: { titulo: '', importante: true } },
      { tarea: { titulo: 'x' } },
      { tarea: { titulo: 'x', importante: true, urgencia_manual: 7 } },
      { tarea: { titulo: 'x', importante: true, saldo: -5 } },
      { tarea: { titulo: 'x', importante: true, fecha_entrega: 'mañana' } },
      { tarea: { titulo: 'x', importante: true, estado: 'en_espera' } },
      { tarea: { titulo: 'x', importante: true }, responsables: ['no-es-un-id'] },
      // Persona inexistente: lo frena la clave foránea de la base.
      { tarea: { titulo: 'x', importante: true }, responsables: [crypto.randomUUID()] },
      {
        tarea: { titulo: 'x', importante: true, tipo: 'interna' },
        cliente: { nombre_apellido: 'C' },
      },
    ]
    for (const cuerpo of casos) {
      const r = await api('POST', '/tareas', cuerpo)
      expect(r.estado, JSON.stringify(cuerpo)).toBe(400)
      expect(typeof r.cuerpo.error).toBe('string')
    }
    const n = db.prepare('SELECT count(*) n FROM tareas').get() as { n: number }
    expect(n.n).toBe(0)
    expect((await api('PATCH', `/tareas/${crypto.randomUUID()}`, { cambios: {} })).estado).toBe(404)
    expect((await api('GET', `/tareas/${crypto.randomUUID()}`)).estado).toBe(404)
  })
})
