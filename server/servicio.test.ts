// @vitest-environment node
import { abrirBase, type BaseDeDatos } from './db.ts'
import { actualizarTarea, crearTarea } from './servicio.ts'

let db: BaseDeDatos
let uno: string
let dos: string

function eventos() {
  return db
    .prepare('SELECT accion, persona_id, tarea_id, cambios FROM eventos ORDER BY created_at, rowid')
    .all() as {
    accion: string
    persona_id: string | null
    tarea_id: string | null
    cambios: string
  }[]
}

function persona(nombre: string) {
  const id = crypto.randomUUID()
  db.prepare('INSERT INTO personas (id, nombre) VALUES (?, ?)').run(id, nombre)
  return id
}

beforeEach(() => {
  db = abrirBase(':memory:')
  uno = persona('Uno')
  dos = persona('Dos')
})

describe('base local', () => {
  it('se crea con la semilla de categorías y configuración', () => {
    const cuenta = (t: string) =>
      (db.prepare(`SELECT count(*) n FROM ${t}`).get() as { n: number }).n
    expect(cuenta('categorias')).toBe(16)
    expect(cuenta('configuracion')).toBe(5)
    expect(cuenta('personas')).toBe(2)
  })

  it('rechaza datos inválidos', () => {
    const insertar = (sql: string) => () => db.prepare(sql).run()
    expect(
      insertar(
        "INSERT INTO tareas (id, titulo, importante, estado) VALUES ('x', 't', 1, 'en_espera')",
      ),
    ).toThrow()
    expect(
      insertar(
        "INSERT INTO tareas (id, titulo, importante, tipo, estado) VALUES ('x', 't', 1, 'interna', 'entregada')",
      ),
    ).toThrow()
    expect(
      insertar(
        "INSERT INTO tareas (id, titulo, importante, urgencia_manual) VALUES ('x', 't', 1, 6)",
      ),
    ).toThrow()
    expect(
      insertar("INSERT INTO tareas (id, titulo, importante, saldo) VALUES ('x', 't', 1, -1)"),
    ).toThrow()
    expect(insertar("INSERT INTO tareas (id, titulo, importante) VALUES ('x', '   ', 1)")).toThrow()
  })
})

describe('crearTarea', () => {
  it('alta en un paso: un solo evento, autoría y responsables de subtareas', () => {
    const t = crearTarea(
      db,
      { persona: uno },
      { titulo: 'Vinilo', importante: true },
      [uno],
      [{ titulo: 'Cortar', responsable_id: dos }],
    )
    expect(t.creada_por).toBe(uno)
    expect(t.importante).toBe(true)
    const responsables = db
      .prepare('SELECT persona_id FROM tarea_responsables WHERE tarea_id = ? ORDER BY persona_id')
      .all(t.id)
      .map((r) => (r as { persona_id: string }).persona_id)
    expect(responsables.sort()).toEqual([uno, dos].sort())
    expect(eventos().map((e) => e.accion)).toEqual(['creada'])
  })

  it('una persona inexistente no queda como autora', () => {
    const t = crearTarea(db, { persona: 'no-existe' }, { titulo: 'X', importante: false })
    expect(t.creada_por).toBeNull()
  })

  it('si algo falla no queda nada a medias', () => {
    expect(() =>
      crearTarea(db, { persona: uno }, { titulo: 'X', importante: true }, ['persona-inexistente']),
    ).toThrow()
    expect((db.prepare('SELECT count(*) n FROM tareas').get() as { n: number }).n).toBe(0)
    expect(eventos()).toHaveLength(0)
  })
})

describe('actualizarTarea', () => {
  it('ciclo completo con estado anterior, marcas de tiempo e historial', () => {
    const hora = (m: number) => new Date(Date.UTC(2026, 10, 6, 15, m)).toISOString()
    const t = crearTarea(
      db,
      { persona: uno, ahora: hora(0) },
      { titulo: 'Vinilo', importante: true },
    )

    actualizarTarea(db, { persona: dos, pista: 'movida_cuadrante', ahora: hora(1) }, t.id, {
      importante: false,
      urgencia_manual: 2,
    })
    actualizarTarea(db, { persona: dos, ahora: hora(2) }, t.id, { estado: 'en_proceso' })
    const terminada = actualizarTarea(db, { persona: dos, ahora: hora(3) }, t.id, {
      estado: 'terminada',
    })
    expect(terminada.estado_anterior).toBe('en_proceso')
    expect(terminada.terminada_at).toBe(hora(3))

    const entregada = actualizarTarea(db, { persona: uno, ahora: hora(4) }, t.id, {
      estado: 'entregada',
    })
    expect(entregada.entregada_at).toBe(hora(4))
    expect(entregada.terminada_at).toBe(hora(3))

    const devuelta = actualizarTarea(
      db,
      { persona: uno, pista: 'devuelta', ahora: hora(5) },
      t.id,
      {
        estado: entregada.estado_anterior!,
      },
    )
    expect(devuelta.estado).toBe('terminada')
    expect(devuelta.entregada_at).toBeNull()
    expect(devuelta.terminada_at).toBe(hora(3))

    // Guardar sin cambios no ensucia el historial.
    actualizarTarea(db, { persona: uno, ahora: hora(6) }, t.id, { titulo: 'Vinilo' })

    const eliminada = actualizarTarea(db, { persona: dos, ahora: hora(7) }, t.id, {
      eliminada_at: hora(7),
    })
    expect(eliminada.eliminada_por).toBe(dos)
    const restaurada = actualizarTarea(db, { persona: uno, ahora: hora(8) }, t.id, {
      eliminada_at: null,
    })
    expect(restaurada.eliminada_por).toBeNull()

    expect(eventos().map((e) => [e.accion, e.persona_id])).toEqual([
      ['creada', uno],
      ['movida_cuadrante', dos],
      ['estado', dos],
      ['estado', dos],
      ['estado', uno],
      ['devuelta', uno],
      ['eliminada', dos],
      ['restaurada', uno],
    ])
    const movida = JSON.parse(eventos()[1]!.cambios)
    expect(movida.importante).toEqual({ antes: true, despues: false })
    expect(movida.urgencia_manual).toEqual({ antes: null, despues: 2 })
  })

  it('volver de terminada a en proceso borra terminada_at', () => {
    const t = crearTarea(db, { persona: uno }, { titulo: 'X', importante: true })
    actualizarTarea(db, { persona: uno }, t.id, { estado: 'terminada' })
    const vuelta = actualizarTarea(db, { persona: uno, pista: 'devuelta' }, t.id, {
      estado: 'pendiente',
    })
    expect(vuelta.terminada_at).toBeNull()
    expect(vuelta.estado_anterior).toBe('terminada')
  })

  it('no permite cambiar autoría ni fecha de creación', () => {
    const t = crearTarea(db, { persona: uno }, { titulo: 'X', importante: true })
    const cambiada = actualizarTarea(db, { persona: dos }, t.id, {
      titulo: 'Y',
      ...({ creada_por: dos, created_at: '2000-01-01T00:00:00.000Z' } as object),
    })
    expect(cambiada.creada_por).toBe(uno)
    expect(cambiada.created_at).toBe(t.created_at)
    expect(cambiada.actualizada_por).toBe(dos)
  })
})
