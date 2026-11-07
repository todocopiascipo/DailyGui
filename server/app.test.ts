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
