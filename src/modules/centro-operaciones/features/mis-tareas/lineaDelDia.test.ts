import { ahoraYSigue, lineaDelDia } from './lineaDelDia'
import type { TareaMia } from './tipos'

const ahora = new Date('2026-11-06T10:20:00-03:00')

const tarea = (titulo: string, datos: Partial<TareaMia> = {}): TareaMia => ({
  id: titulo,
  tipo: 'pedido',
  titulo,
  importante: true,
  urgencia_manual: null,
  estado: 'pendiente',
  estado_anterior: null,
  motivo_espera: null,
  motivo_espera_detalle: null,
  fecha_entrega: null,
  fecha_inicio: null,
  terminada_at: null,
  entregada_at: null,
  saldo: 0,
  cliente: null,
  responsables: [],
  subtareas: { total: 0, hechas: 0 },
  pasos: [],
  ...datos,
})

describe('línea del día', () => {
  it('sin nada para hoy no hay línea', () => {
    expect(lineaDelDia([tarea('Sin fecha')], ahora)).toBeNull()
    expect(
      lineaDelDia([tarea('Mañana', { fecha_entrega: '2026-11-07T10:00:00-03:00' })], ahora),
    ).toBeNull()
  })

  it('de la hora en punto anterior a la siguiente, con la marca de ahora', () => {
    const l = lineaDelDia(
      [
        tarea('Corta', {
          fecha_inicio: '2026-11-06T11:00:00-03:00',
          fecha_entrega: '2026-11-06T13:00:00-03:00',
        }),
        tarea('Solo entrega', { fecha_entrega: '2026-11-06T12:30:00-03:00' }),
      ],
      ahora,
    )!
    expect(l.desde.toISOString()).toBe('2026-11-06T13:00:00.000Z') // 10:00 local
    expect(l.hasta.toISOString()).toBe('2026-11-06T17:00:00.000Z') // 14:00 local
    expect(l.ahora).toBeCloseTo((20 / 240) * 100)
    expect(l.horas).toHaveLength(5)
    // Ordenadas por entrega; sin inicio, solo la marca.
    expect(
      l.filas.map((f) => [f.tarea.titulo, Math.round(f.izquierda), Math.round(f.ancho)]),
    ).toEqual([
      ['Solo entrega', 63, 0],
      ['Corta', 25, 50],
    ])
  })

  it('lo vencido aparece marcado; lo terminado no', () => {
    const l = lineaDelDia(
      [
        tarea('Vencida', { fecha_entrega: '2026-11-06T09:00:00-03:00' }),
        tarea('Hecha', { estado: 'terminada', fecha_entrega: '2026-11-06T12:00:00-03:00' }),
      ],
      ahora,
    )!
    expect(l.filas.map((f) => [f.tarea.titulo, f.vencida])).toEqual([['Vencida', true]])
  })
})

describe('ahora y sigue', () => {
  it('lo en curso con la entrega más cercana primero; lo sin fecha al final', () => {
    const r = ahoraYSigue([
      tarea('Sin fecha'),
      tarea('Tarde', { fecha_entrega: '2026-11-06T18:00:00-03:00' }),
      tarea('Hecha', { estado: 'terminada', fecha_entrega: '2026-11-06T08:00:00-03:00' }),
      tarea('Pronto', { fecha_entrega: '2026-11-06T11:00:00-03:00' }),
    ])
    expect([r.ahora?.titulo, r.sigue?.titulo]).toEqual(['Pronto', 'Tarde'])
  })
})
