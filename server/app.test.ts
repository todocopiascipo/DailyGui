// @vitest-environment node
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { crearServidor } from './app.ts'
import { abrirBase, type BaseDeDatos } from './db.ts'
import { actualizarTarea, crearTarea, purgarPapelera } from './servicio.ts'

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
      'confeti_activado',
      'disposicion_cuadrantes',
      'papelera_dias',
      'plantilla_mensaje',
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

/** Abre el canal de cambios y junta los eventos que llegan. */
async function escucharCanal() {
  const control = new AbortController()
  const r = await fetch(`${base}/api/cambios`, { signal: control.signal })
  expect(r.headers.get('content-type')).toContain('text/event-stream')
  const eventos: { evento: string; datos: any }[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any
  const lector = r.body!.getReader()
  const decodificador = new TextDecoder()
  let resto = ''
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await lector.read()
        if (done) return
        resto += decodificador.decode(value, { stream: true })
        const bloques = resto.split('\n\n')
        resto = bloques.pop() ?? ''
        for (const b of bloques) {
          const evento = /^event: (.+)$/m.exec(b)?.[1]
          const datos = /^data: (.+)$/m.exec(b)?.[1]
          if (evento && datos) eventos.push({ evento, datos: JSON.parse(datos) })
        }
      }
    } catch {
      // Cortado por la prueba.
    }
  })()
  return { eventos, cerrar: () => control.abort() }
}

describe('canal de cambios', () => {
  it('avisa a las pantallas conectadas cuando se guarda algo', async () => {
    const canal = await escucharCanal()
    await expect.poll(() => canal.eventos.map((e) => e.evento)).toContain('hola')

    const r = await api('POST', '/tareas', { tarea: { titulo: 'Aviso', importante: true } })
    await expect
      .poll(() => canal.eventos.filter((e) => e.evento === 'cambio'))
      .toEqual([{ evento: 'cambio', datos: { recursos: ['tareas'], tarea_id: r.cuerpo.tarea.id } }])

    await api('POST', '/personas', { nombre: 'Nueva' })
    await expect.poll(() => canal.eventos.filter((e) => e.evento === 'cambio').length).toBe(2)
    expect(canal.eventos.at(-1)!.datos).toEqual({ recursos: ['personas'] })

    // Lo que falla no avisa; leer tampoco.
    await api('POST', '/tareas', { tarea: { titulo: '' } })
    await api('GET', '/matriz')
    await new Promise((ok) => setTimeout(ok, 50))
    expect(canal.eventos.filter((e) => e.evento === 'cambio')).toHaveLength(2)
    canal.cerrar()
  })

  it('manda latidos para detectar cortes', async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()))
    servidor = crearServidor(db, { latidoMs: 30 })
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok))
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
    const canal = await escucharCanal()
    await expect
      .poll(() => canal.eventos.filter((e) => e.evento === 'latido').length)
      .toBeGreaterThanOrEqual(2)
    canal.cerrar()
  })
})

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

  it('respeta el id que manda la pantalla (creación optimista) y no lo repite', async () => {
    const id = crypto.randomUUID()
    const a = await api('POST', '/tareas', { tarea: { id, titulo: 'Con id', importante: true } })
    expect(a.cuerpo.tarea.id).toBe(id)
    const b = await api('POST', '/tareas', { tarea: { id, titulo: 'Repetida', importante: true } })
    expect(b.estado).toBe(400)
    const c = await api('POST', '/tareas', {
      tarea: { id: 'x', titulo: 'Mal id', importante: true },
    })
    expect(c.estado).toBe(400)
  })

  it('medios de pago de la seña y del saldo', async () => {
    const r = await api('POST', '/tareas', {
      tarea: { titulo: 'OT', importante: true, sena_medio: 'posnet', saldo_medio: 'efectivo' },
    })
    expect(r.cuerpo.tarea).toMatchObject({ sena_medio: 'posnet', saldo_medio: 'efectivo' })
    const e = await api('PATCH', `/tareas/${r.cuerpo.tarea.id}`, {
      cambios: { saldo_medio: 'transferencia', sena_medio: null },
    })
    expect(e.cuerpo.tarea).toMatchObject({ sena_medio: null, saldo_medio: 'transferencia' })
    const mal = await api('POST', '/tareas', {
      tarea: { titulo: 'OT', importante: true, sena_medio: 'cheque' },
    })
    expect(mal.estado).toBe(400)
  })

  it('papelera: eliminar, restaurar, borrar definitivo y purga por plazo', async () => {
    const ana = (await api('POST', '/personas', { nombre: 'Ana' })).cuerpo.id as string
    const crear = async (titulo: string) =>
      (await api('POST', '/tareas', { tarea: { titulo, importante: true } })).cuerpo.tarea
        .id as string
    const a = await crear('A')
    const b = await crear('B')

    const el = await api('POST', `/tareas/${a}/eliminar`, undefined, ana)
    expect(el.cuerpo.tarea.eliminada_por).toBe(ana)
    const titulos = async () =>
      ((await api('GET', '/matriz')).cuerpo.tareas as { titulo: string }[]).map((t) => t.titulo)
    expect(await titulos()).toEqual(['B'])
    const pap = await api('GET', '/papelera')
    expect(pap.cuerpo).toHaveLength(1)
    expect(pap.cuerpo[0]).toMatchObject({ id: a, titulo: 'A', eliminada_por: 'Ana' })
    // Se borra sola a los 30 días.
    expect(Date.parse(pap.cuerpo[0].se_borra_el) - Date.parse(pap.cuerpo[0].eliminada_at)).toBe(
      30 * 86_400_000,
    )

    // Solo se borra para siempre lo que está en la papelera.
    expect((await api('DELETE', `/tareas/${b}`)).estado).toBe(400)

    await api('POST', `/tareas/${a}/restaurar`)
    expect((await titulos()).sort()).toEqual(['A', 'B'])
    expect((await api('POST', `/tareas/${a}/restaurar`)).estado).toBe(400)
    const hist = (await api('GET', `/tareas/${a}`)).cuerpo.eventos.map(
      (e: { accion: string }) => e.accion,
    )
    expect(hist).toEqual(['restaurada', 'eliminada', 'creada'])

    await api('POST', `/tareas/${b}/eliminar`)
    expect((await api('DELETE', `/tareas/${b}`)).estado).toBe(200)
    expect((await api('GET', `/tareas/${b}`)).estado).toBe(404)
    const borrado = db
      .prepare("SELECT cambios FROM eventos WHERE accion = 'borrada_definitiva'")
      .get() as { cambios: string }
    expect(JSON.parse(borrado.cambios)).toMatchObject({ tarea_id: b, titulo: 'B' })

    // Purga: lo que lleva más de 30 días se borra solo.
    await api('POST', `/tareas/${a}/eliminar`)
    expect(purgarPapelera(db, new Date(Date.now() + 29 * 86_400_000))).toBe(0)
    expect(purgarPapelera(db, new Date(Date.now() + 31 * 86_400_000))).toBe(1)
    expect((await api('GET', '/papelera')).cuerpo).toEqual([])
  })

  it('catálogos: primero las personas asignadas más recientemente', async () => {
    const uno = (await api('POST', '/personas', { nombre: 'Uno' })).cuerpo.id as string
    const dos = (await api('POST', '/personas', { nombre: 'Dos' })).cuerpo.id as string
    await api('POST', '/tareas', { tarea: { titulo: 'x', importante: true }, responsables: [dos] })
    let nombres = (await api('GET', '/catalogos')).cuerpo.personas.map(
      (p: { nombre: string }) => p.nombre,
    )
    expect(nombres).toEqual(['Dos', 'Uno'])
    await new Promise((ok) => setTimeout(ok, 5))
    await api('POST', '/tareas', { tarea: { titulo: 'y', importante: true }, responsables: [uno] })
    nombres = (await api('GET', '/catalogos')).cuerpo.personas.map(
      (p: { nombre: string }) => p.nombre,
    )
    expect(nombres).toEqual(['Uno', 'Dos'])
  })

  it('ciclo completo: terminar, entregar y devolver, con historial', async () => {
    const id = (
      await api('POST', '/tareas', {
        tarea: { titulo: 'Ciclo', importante: true, saldo: 3000 },
        cliente: { nombre_apellido: 'Cliente Ciclo', telefono: '2990001111' },
      })
    ).cuerpo.tarea.id as string
    const desde = new Date(Date.now() - 3_600_000).toISOString()
    const hechas = async () =>
      (await api('GET', `/hechas?desde=${encodeURIComponent(desde)}`)).cuerpo as {
        terminadas: { id: string }[]
        entregadas: { id: string }[]
      }

    // No se entrega sin terminar.
    expect((await api('POST', `/tareas/${id}/entregar`)).estado).toBe(400)

    const t = await api('POST', `/tareas/${id}/terminar`)
    expect(t.cuerpo.tarea.estado).toBe('terminada')
    // Sigue en la matriz (azul) y figura en "Terminadas hoy"; trae cliente y saldo.
    const m = (await api('GET', '/matriz')).cuerpo.tareas[0]
    expect(m).toMatchObject({
      estado: 'terminada',
      estado_anterior: 'pendiente',
      saldo: 3000,
      cliente: { nombre: 'Cliente Ciclo', telefono: '2990001111' },
    })
    expect((await hechas()).terminadas.map((x) => x.id)).toEqual([id])
    expect((await api('POST', `/tareas/${id}/terminar`)).estado).toBe(400)

    await api('POST', `/tareas/${id}/entregar`)
    expect((await api('GET', '/matriz')).cuerpo.tareas).toEqual([])
    expect(await hechas()).toMatchObject({ terminadas: [], entregadas: [{ id }] })

    // Devolver: de entregada a terminada, y otra vez a la matriz.
    const d = await api('POST', `/tareas/${id}/devolver`)
    expect(d.cuerpo.tarea.estado).toBe('terminada')
    expect((await api('GET', '/matriz')).cuerpo.tareas).toHaveLength(1)

    const acciones = d.cuerpo.eventos.map((e: { accion: string }) => e.accion)
    expect(acciones).toEqual(['devuelta', 'estado', 'estado', 'creada'])
  })

  it('internas: terminar las saca de la matriz y no se entregan', async () => {
    const id = (
      await api('POST', '/tareas', {
        tarea: { titulo: 'Interna', importante: true, tipo: 'interna' },
      })
    ).cuerpo.tarea.id as string
    await api('POST', `/tareas/${id}/terminar`)
    expect((await api('GET', '/matriz')).cuerpo.tareas).toEqual([])
    expect((await api('POST', `/tareas/${id}/entregar`)).estado).toBe(400)
    const desde = new Date(Date.now() - 60_000).toISOString()
    const h = (await api('GET', `/hechas?desde=${encodeURIComponent(desde)}`)).cuerpo
    expect(h.terminadas.map((x: { titulo: string }) => x.titulo)).toEqual(['Interna'])
    // Lo de ayer no aparece.
    const manana = new Date(Date.now() + 60_000).toISOString()
    expect(
      (await api('GET', `/hechas?desde=${encodeURIComponent(manana)}`)).cuerpo.terminadas,
    ).toEqual([])
  })

  it('devolver siempre va hacia atrás: entregada → terminada → en curso', async () => {
    const id = (await api('POST', '/tareas', { tarea: { titulo: 'Atrás', importante: true } }))
      .cuerpo.tarea.id as string
    await api('PATCH', `/tareas/${id}`, { cambios: { estado: 'en_proceso' } })
    await api('POST', `/tareas/${id}/terminar`)
    await api('POST', `/tareas/${id}/entregar`)
    expect((await api('POST', `/tareas/${id}/devolver`)).cuerpo.tarea.estado).toBe('terminada')
    // Ya no se recuerda en estado_anterior (dice "entregada"): sale del historial.
    expect((await api('POST', `/tareas/${id}/devolver`)).cuerpo.tarea.estado).toBe('en_proceso')
    // De en proceso (que venía de terminada) no se "devuelve" a terminada.
    expect((await api('POST', `/tareas/${id}/devolver`)).estado).toBe(400)
  })

  it('devolver a "en espera" conserva el motivo', async () => {
    const id = (await api('POST', '/tareas', { tarea: { titulo: 'Espera', importante: true } }))
      .cuerpo.tarea.id as string
    await api('PATCH', `/tareas/${id}`, { cambios: { estado: 'en_espera', motivo_espera: 'pago' } })
    await api('POST', `/tareas/${id}/terminar`)
    const d = await api('POST', `/tareas/${id}/devolver`)
    expect(d.cuerpo.tarea).toMatchObject({ estado: 'en_espera', motivo_espera: 'pago' })
    const nueva = (await api('POST', '/tareas', { tarea: { titulo: 'Nueva', importante: true } }))
      .cuerpo.tarea.id as string
    expect((await api('POST', `/tareas/${nueva}/devolver`)).estado).toBe(400)
  })

  it('configuración: confeti y plantilla, validados', async () => {
    expect((await api('PUT', '/configuracion/confeti_activado', { valor: false })).estado).toBe(200)
    expect(
      (await api('PUT', '/configuracion/plantilla_mensaje', { valor: 'Hola {nombre}' })).estado,
    ).toBe(200)
    const config = (await api('GET', '/matriz')).cuerpo.configuracion as {
      clave: string
      valor: unknown
    }[]
    expect(config.find((c) => c.clave === 'confeti_activado')!.valor).toBe(false)
    expect(config.find((c) => c.clave === 'plantilla_mensaje')!.valor).toBe('Hola {nombre}')
    expect((await api('PUT', '/configuracion/confeti_activado', { valor: 'no' })).estado).toBe(400)
    expect((await api('PUT', '/configuracion/plantilla_mensaje', { valor: '' })).estado).toBe(400)
    expect((await api('PUT', '/configuracion/nada', { valor: 1 })).estado).toBe(404)
  })

  it('configuración completa: umbrales, disposición y días de papelera, validados', async () => {
    const ok = [
      ['umbrales_urgencia', { nivel_5_horas: 1, nivel_3_horas: 12, nivel_2_horas: 48 }],
      [
        'disposicion_cuadrantes',
        {
          arriba_izquierda: 'hacer',
          arriba_derecha: 'planificar',
          abajo_izquierda: 'delegar',
          abajo_derecha: 'eliminar',
        },
      ],
      ['papelera_dias', 15],
    ] as const
    for (const [clave, valor] of ok) {
      expect((await api('PUT', `/configuracion/${clave}`, { valor })).estado).toBe(200)
    }
    const config = (await api('GET', '/matriz')).cuerpo.configuracion as {
      clave: string
      valor: unknown
    }[]
    expect(config.find((c) => c.clave === 'papelera_dias')!.valor).toBe(15)
    const malos = [
      ['umbrales_urgencia', { nivel_5_horas: 30, nivel_3_horas: 12, nivel_2_horas: 48 }],
      ['umbrales_urgencia', { nivel_5_horas: -1, nivel_3_horas: 12, nivel_2_horas: 48 }],
      [
        'disposicion_cuadrantes',
        {
          arriba_izquierda: 'hacer',
          arriba_derecha: 'hacer',
          abajo_izquierda: 'delegar',
          abajo_derecha: 'eliminar',
        },
      ],
      ['papelera_dias', 0],
      ['papelera_dias', 2.5],
    ] as const
    for (const [clave, valor] of malos) {
      expect((await api('PUT', `/configuracion/${clave}`, { valor })).estado, clave).toBe(400)
    }
  })

  it('personas en Configuración: renombrar, dar de baja, reactivar y ordenar', async () => {
    const ana = (await api('POST', '/personas', { nombre: 'Ana' })).cuerpo.id as string
    const beto = (await api('POST', '/personas', { nombre: 'Beto' })).cuerpo.id as string
    let l = (await api('PATCH', `/personas/${ana}`, { nombre: 'Ana María', iniciales: null }))
      .cuerpo
    expect(l.find((p: { id: string }) => p.id === ana)).toMatchObject({
      nombre: 'Ana María',
      iniciales: 'AM',
      activa: true,
    })
    l = (await api('PATCH', `/personas/${beto}`, { activa: false })).cuerpo
    expect(l.find((p: { id: string }) => p.id === beto).activa).toBe(false)
    // Dada de baja, ya no se ofrece en los formularios.
    const cat = (await api('GET', '/catalogos')).cuerpo
    expect(cat.personas.some((p: { id: string }) => p.id === beto)).toBe(false)
    await api('PUT', '/personas/orden', { personas: [beto, ana] })
    await api('PATCH', `/personas/${beto}`, { activa: true })
    l = (await api('GET', '/personas')).cuerpo
    expect(l.map((p: { nombre: string }) => p.nombre)).toEqual(['Beto', 'Ana María'])
    // Otra activa con el mismo nombre: no.
    expect((await api('PATCH', `/personas/${beto}`, { nombre: 'ana maría' })).estado).toBe(400)
    expect((await api('PATCH', `/personas/${crypto.randomUUID()}`, {})).estado).toBe(404)
  })

  it('categorías: alta, editar, desactivar y ordenar', async () => {
    const nueva = await api('POST', '/categorias', { nombre: 'Sublimación', tipo_aplica: 'pedido' })
    expect(nueva.estado).toBe(201)
    const id = nueva.cuerpo.id as string
    expect((await api('POST', '/categorias', { nombre: 'sublimación' })).estado).toBe(400)
    expect((await api('POST', '/categorias', { nombre: 'X', tipo_aplica: 'otro' })).estado).toBe(
      400,
    )
    let l = (await api('PATCH', `/categorias/${id}`, { activa: false })).cuerpo
    expect(l.find((c: { id: string }) => c.id === id).activa).toBe(false)
    const cat = (await api('GET', '/catalogos')).cuerpo
    expect(cat.categorias.some((c: { id: string }) => c.id === id)).toBe(false)
    const todas = (await api('GET', '/categorias')).cuerpo as { id: string }[]
    l = (
      await api('PUT', '/categorias/orden', {
        categorias: [id, ...todas.filter((c) => c.id !== id).map((c) => c.id)],
      })
    ).cuerpo
    expect(l[0].id).toBe(id)
  })

  it('historial global: filtros por persona, tarea, texto y fecha, paginado', async () => {
    const ana = (await api('POST', '/personas', { nombre: 'Ana Historial' })).cuerpo.id as string
    const t = (
      await api('POST', '/tareas', { tarea: { titulo: 'Folletos', importante: true } }, ana)
    ).cuerpo.tarea.id as string
    await api('POST', '/tareas', { tarea: { titulo: 'Otra cosa', importante: false } })
    for (let i = 0; i < 55; i++) {
      await api('PATCH', `/tareas/${t}`, { cambios: { descripcion: `v${i}` } }, ana)
    }
    const p1 = (await api('GET', `/historial?persona=${ana}`)).cuerpo
    expect(p1.eventos).toHaveLength(50)
    expect(p1.eventos[0]).toMatchObject({ persona: 'Ana Historial', tarea_titulo: 'Folletos' })
    const p2 = (
      await api('GET', `/historial?persona=${ana}&antes=${encodeURIComponent(p1.siguiente)}`)
    ).cuerpo
    expect(p2.eventos).toHaveLength(6) // 55 ediciones + el alta
    expect(p2.siguiente).toBeNull()
    expect((await api('GET', `/historial?tarea=${t}`)).cuerpo.eventos.length).toBe(50)
    const porTexto = (await api('GET', '/historial?texto=otra cosa')).cuerpo.eventos
    expect(porTexto).toHaveLength(1)
    expect((await api('GET', '/historial?desde=2099-01-01T00:00:00Z')).cuerpo.eventos).toHaveLength(
      0,
    )
    expect((await api('GET', '/historial?persona=nada')).estado).toBe(400)
  })

  it('respaldo: todas las tablas, sin los PIN', async () => {
    const id = (await api('POST', '/personas', { nombre: 'Con PIN respaldo' })).cuerpo.id
    await api('PUT', `/personas/${id}/pin`, { pin_actual: null, pin_nuevo: '1234' })
    await api('POST', '/tareas', { tarea: { titulo: 'Para respaldar', importante: true } })
    const r = (await api('GET', '/respaldo')).cuerpo
    expect(Object.keys(r.tablas).sort()).toEqual([
      'categorias',
      'clientes',
      'configuracion',
      'eventos',
      'personas',
      'proyectos',
      'subtareas',
      'tarea_responsables',
      'tareas',
    ])
    expect(r.tablas.tareas[0].titulo).toBe('Para respaldar')
    const p = r.tablas.personas.find((x: { id: string }) => x.id === id)
    expect(p.tiene_pin).toBe(true)
    expect(JSON.stringify(r)).not.toContain('scrypt')
  })

  it('PIN: se guarda como hash, se verifica y para cambiarlo hay que saber el actual', async () => {
    const id = (await api('POST', '/personas', { nombre: 'Con PIN' })).cuerpo.id as string
    const tienePin = async () =>
      (await api('GET', '/catalogos')).cuerpo.personas.find((p: { id: string }) => p.id === id)
        .tiene_pin
    expect(await tienePin()).toBe(false)
    // Sin PIN, elegirse no pide nada.
    expect((await api('POST', `/personas/${id}/verificar`, { pin: '' })).estado).toBe(201)

    expect((await api('PUT', `/personas/${id}/pin`, { pin_nuevo: '12' })).estado).toBe(400)
    expect((await api('PUT', `/personas/${id}/pin`, { pin_nuevo: '4321' })).estado).toBe(200)
    expect(await tienePin()).toBe(true)
    const guardado = (
      db.prepare('SELECT pin_hash FROM personas WHERE id = ?').get(id) as {
        pin_hash: string
      }
    ).pin_hash
    expect(guardado).not.toContain('4321')
    expect(guardado).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/)

    expect((await api('POST', `/personas/${id}/verificar`, { pin: '0000' })).estado).toBe(400)
    expect((await api('POST', `/personas/${id}/verificar`, { pin: '4321' })).estado).toBe(201)

    // Cambiar o quitar exige el PIN actual.
    expect((await api('PUT', `/personas/${id}/pin`, { pin_nuevo: null })).estado).toBe(400)
    expect(
      (await api('PUT', `/personas/${id}/pin`, { pin_actual: '4321', pin_nuevo: null })).estado,
    ).toBe(200)
    expect(await tienePin()).toBe(false)
  })

  it('mis tareas: lo asignado (también por subtarea), con sus pasos y por entrega', async () => {
    const ana = (await api('POST', '/personas', { nombre: 'Ana' })).cuerpo.id as string
    const beto = (await api('POST', '/personas', { nombre: 'Beto' })).cuerpo.id as string
    const en = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()
    await api('POST', '/tareas', {
      tarea: { titulo: 'Después', importante: true, fecha_entrega: en(5) },
      responsables: [ana],
    })
    await api('POST', '/tareas', {
      tarea: { titulo: 'Antes', importante: true, fecha_entrega: en(2) },
      responsables: [beto],
      subtareas: [
        { titulo: 'Cortar', responsable_id: ana },
        { titulo: 'Imprimir', responsable_id: beto },
      ],
    })
    await api('POST', '/tareas', {
      tarea: { titulo: 'De otro', importante: true },
      responsables: [beto],
    })
    const terminada = (
      await api('POST', '/tareas', {
        tarea: { titulo: 'Interna hecha', importante: true, tipo: 'interna' },
        responsables: [ana],
      })
    ).cuerpo.tarea.id as string
    await api('POST', `/tareas/${terminada}/terminar`)

    const r = await api('GET', `/personas/${ana}/tareas`)
    expect(r.cuerpo.map((t: { titulo: string }) => t.titulo)).toEqual(['Antes', 'Después'])
    expect(r.cuerpo[0].pasos).toMatchObject([
      { titulo: 'Cortar', hecha: false, responsable: { nombre: 'Ana' } },
      { titulo: 'Imprimir', responsable: { nombre: 'Beto' } },
    ])
    expect((await api('GET', `/personas/${crypto.randomUUID()}/tareas`)).estado).toBe(404)
  })

  it('tarea interna relacionada con un pedido (OT)', async () => {
    const ot = (
      await api('POST', '/tareas', {
        tarea: { titulo: 'Vinilo vidriera', importante: true },
        cliente: { nombre_apellido: 'Ana Cliente' },
      })
    ).cuerpo.tarea.id as string
    const interna = await api('POST', '/tareas', {
      tarea: { titulo: 'Comprar vinilo', importante: false, tipo: 'interna', pedido_id: ot },
    })
    expect(interna.estado).toBe(201)
    expect(interna.cuerpo.pedido).toEqual({ id: ot, titulo: 'Vinilo vidriera' })
    const m = (await api('GET', '/matriz')).cuerpo.tareas.find(
      (t: { titulo: string }) => t.titulo === 'Comprar vinilo',
    )
    expect(m.pedido).toEqual({ id: ot, titulo: 'Vinilo vidriera' })

    // Solo internas, y solo hacia un pedido existente.
    const casos = [
      { tarea: { titulo: 'x', importante: true, tipo: 'pedido', pedido_id: ot } },
      { tarea: { titulo: 'x', importante: true, tipo: 'interna', pedido_id: crypto.randomUUID() } },
      {
        tarea: {
          titulo: 'x',
          importante: true,
          tipo: 'interna',
          pedido_id: interna.cuerpo.tarea.id,
        },
      },
    ]
    for (const c of casos) expect((await api('POST', '/tareas', c)).estado).toBe(400)

    // Pasar a pedido quita el enlace.
    const e = await api('PATCH', `/tareas/${interna.cuerpo.tarea.id}`, {
      cambios: { tipo: 'pedido' },
    })
    expect(e.cuerpo.tarea.pedido_id).toBeNull()
  })

  it('proyectos: alta, tareas, avance, regla de la matriz, orden y borrado', async () => {
    const p = await api('POST', '/proyectos', { nombre: 'Vidriera nueva' })
    expect(p.estado).toBe(201)
    expect(p.cuerpo.proyecto).toMatchObject({
      nombre: 'Vidriera nueva',
      estado: 'activo',
      progreso: { total: 0, hechas: 0 },
    })
    const pid = p.cuerpo.proyecto.id as string
    const crear = async (titulo: string, extra: Record<string, unknown> = {}) =>
      (
        await api('POST', '/tareas', {
          tarea: { titulo, importante: false, tipo: 'interna', proyecto_id: pid, ...extra },
        })
      ).cuerpo
    const sinFecha = await crear('Medir vidriera')
    const conFecha = await crear('Pedir presupuesto', {
      fecha_entrega: '2026-12-01T15:00:00.000Z',
    })
    // Sin fecha ni "en proceso" no aparece en la matriz; con fecha, sí.
    expect(sinFecha.tarea.mostrar_en_matriz).toBe(false)
    expect(conFecha.tarea.mostrar_en_matriz).toBe(true)
    expect(sinFecha.proyecto).toEqual({ id: pid, nombre: 'Vidriera nueva' })
    const enMatriz = async () =>
      ((await api('GET', '/matriz')).cuerpo.tareas as { titulo: string }[]).map((t) => t.titulo)
    expect(await enMatriz()).toContain('Pedir presupuesto')
    expect(await enMatriz()).not.toContain('Medir vidriera')

    // Pasar a "en proceso" la prende sola; el interruptor manda.
    const id1 = sinFecha.tarea.id as string
    let e = await api('PATCH', `/tareas/${id1}`, { cambios: { estado: 'en_proceso' } })
    expect(e.cuerpo.tarea.mostrar_en_matriz).toBe(true)
    e = await api('PATCH', `/tareas/${id1}`, { cambios: { mostrar_en_matriz: false } })
    expect(e.cuerpo.tarea.mostrar_en_matriz).toBe(false)
    e = await api('PATCH', `/tareas/${id1}`, { cambios: { titulo: 'Medir vidriera bien' } })
    expect(e.cuerpo.tarea.mostrar_en_matriz).toBe(false)
    // Sacarla del proyecto la vuelve a mostrar siempre.
    e = await api('PATCH', `/tareas/${id1}`, { cambios: { proyecto_id: null } })
    expect(e.cuerpo.tarea.mostrar_en_matriz).toBe(true)
    e = await api('PATCH', `/tareas/${id1}`, { cambios: { proyecto_id: pid } })
    expect(e.cuerpo.tarea.mostrar_en_matriz).toBe(true) // está en proceso

    // Avance y orden.
    await api('POST', `/tareas/${conFecha.tarea.id}/terminar`)
    let d = (await api('GET', `/proyectos/${pid}`)).cuerpo
    expect(d.proyecto.progreso).toEqual({ total: 2, hechas: 1 })
    expect(d.tareas.map((t: { titulo: string }) => t.titulo)).toEqual([
      'Pedir presupuesto',
      'Medir vidriera bien',
    ])
    d = (await api('PUT', `/proyectos/${pid}/orden`, { tareas: [id1, conFecha.tarea.id] })).cuerpo
    expect(d.tareas[0].id).toBe(id1)

    // Edición con historial; estado solo → "proyecto_estado".
    const ana = (await api('POST', '/personas', { nombre: 'Ana Proyectos' })).cuerpo.id as string
    d = (await api('PATCH', `/proyectos/${pid}`, { estado: 'en_pausa' }, ana)).cuerpo
    expect(d.proyecto.estado).toBe('en_pausa')
    expect(d.eventos[0]).toMatchObject({ accion: 'proyecto_estado', persona: 'Ana Proyectos' })
    const lista = (await api('GET', '/proyectos')).cuerpo as { id: string }[]
    expect(lista.some((x) => x.id === pid)).toBe(true)
    const cat = (await api('GET', '/catalogos')).cuerpo
    expect(cat.proyectos).toContainEqual({ id: pid, nombre: 'Vidriera nueva' })

    // Reglas: solo internas, proyecto existente, fechas en orden, nombre obligatorio.
    const malos = [
      { tarea: { titulo: 'x', importante: true, tipo: 'pedido', proyecto_id: pid } },
      {
        tarea: { titulo: 'x', importante: true, tipo: 'interna', proyecto_id: crypto.randomUUID() },
      },
    ]
    for (const c of malos) expect((await api('POST', '/tareas', c)).estado).toBe(400)
    expect((await api('POST', '/proyectos', { nombre: '' })).estado).toBe(400)
    expect(
      (
        await api('PATCH', `/proyectos/${pid}`, {
          fecha_inicio: '2026-12-10T00:00:00.000Z',
          fecha_objetivo: '2026-12-01T00:00:00.000Z',
        })
      ).estado,
    ).toBe(400)

    // Con tareas no se borra; sin tareas, sí.
    expect((await api('DELETE', `/proyectos/${pid}`)).estado).toBe(400)
    const vacio = (await api('POST', '/proyectos', { nombre: 'Vacío' })).cuerpo.proyecto.id
    expect((await api('DELETE', `/proyectos/${vacio}`)).estado).toBe(200)
    expect((await api('GET', `/proyectos/${vacio}`)).estado).toBe(404)
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
