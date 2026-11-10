import {
  aspectoDe,
  compararParaCuadrante,
  cuadranteDe,
  esUrgente,
  movimiento,
  urgenciaElegida,
  UMBRALES_POR_DEFECTO,
  urgenciaEfectiva,
  urgenciaEstimada,
  type Nivel,
} from './urgencia'

// Buenos Aires es UTC-3 todo el año. "Ahora": viernes 6/11/2026 a las 14:00.
const ahora = new Date('2026-11-06T14:00:00-03:00')
const en = (horas: number) => new Date(ahora.getTime() + horas * 3_600_000)

describe('urgenciaEstimada', () => {
  it('sin fecha es 1', () => {
    expect(urgenciaEstimada(null, ahora)).toBe(1)
  })
  it('vencida es 5', () => {
    expect(urgenciaEstimada(en(-0.5), ahora)).toBe(5)
    expect(urgenciaEstimada(en(-48), ahora)).toBe(5)
  })
  it('vence en 2 h o menos es 5', () => {
    expect(urgenciaEstimada(en(2), ahora)).toBe(5)
    expect(urgenciaEstimada(en(1), ahora)).toBe(5)
  })
  it('vence hoy (más de 2 h) es 4', () => {
    expect(urgenciaEstimada(new Date('2026-11-06T20:00:00-03:00'), ahora)).toBe(4)
    expect(urgenciaEstimada(new Date('2026-11-06T23:59:00-03:00'), ahora)).toBe(4)
  })
  it('mañana dentro de 24 h es 3', () => {
    expect(urgenciaEstimada(new Date('2026-11-07T00:30:00-03:00'), ahora)).toBe(3)
    expect(urgenciaEstimada(en(24), ahora)).toBe(3)
  })
  it('dentro de 72 h es 2', () => {
    expect(urgenciaEstimada(en(25), ahora)).toBe(2)
    expect(urgenciaEstimada(en(72), ahora)).toBe(2)
  })
  it('más de 72 h es 1', () => {
    expect(urgenciaEstimada(en(73), ahora)).toBe(1)
  })
  it('usa el día calendario de Buenos Aires, no el de UTC', () => {
    // 22:00 en BA ya es el día siguiente en UTC: sigue siendo "hoy".
    const tarde = new Date('2026-11-06T18:00:00-03:00')
    expect(urgenciaEstimada(new Date('2026-11-06T22:30:00-03:00'), tarde)).toBe(4)
  })
  it('respeta umbrales configurados', () => {
    const umbrales = { nivel_5_horas: 4, nivel_3_horas: 48, nivel_2_horas: 96 }
    expect(urgenciaEstimada(en(3), ahora, umbrales)).toBe(5)
    expect(urgenciaEstimada(en(40), ahora, umbrales)).toBe(3)
    expect(urgenciaEstimada(en(90), ahora, umbrales)).toBe(2)
  })
})

describe('urgenciaEfectiva', () => {
  it('manda la manual', () => {
    expect(urgenciaEfectiva(2, 5)).toBe(2)
    expect(urgenciaEfectiva(5, 1)).toBe(5)
  })
  it('sin manual usa la estimada', () => {
    expect(urgenciaEfectiva(null, 4)).toBe(4)
  })
})

describe('cuadrantes', () => {
  it('urgente desde 3', () => {
    expect(esUrgente(2)).toBe(false)
    expect(esUrgente(3)).toBe(true)
  })
  it('combina importancia y urgencia', () => {
    expect(cuadranteDe(true, true)).toBe('hacer')
    expect(cuadranteDe(true, false)).toBe('planificar')
    expect(cuadranteDe(false, true)).toBe('delegar')
    expect(cuadranteDe(false, false)).toBe('eliminar')
  })
})

describe('aspectoDe', () => {
  const base = { estado: 'pendiente' as const, ahora }
  it('terminada es azul aunque esté vencida', () => {
    expect(aspectoDe({ ...base, estado: 'terminada', entrega: en(-5), efectiva: 5 })).toBe(
      'terminada',
    )
  })
  it('vencida gana a en espera', () => {
    expect(aspectoDe({ ...base, estado: 'en_espera', entrega: en(-1), efectiva: 5 })).toBe(
      'vencida',
    )
  })
  it('en espera', () => {
    expect(aspectoDe({ ...base, estado: 'en_espera', entrega: en(30), efectiva: 2 })).toBe(
      'en_espera',
    )
  })
  it('día de entrega', () => {
    expect(aspectoDe({ ...base, entrega: en(3), efectiva: 4 })).toBe('dia_entrega')
    // aunque la urgencia manual la haya bajado
    expect(aspectoDe({ ...base, entrega: en(3), efectiva: 1 })).toBe('dia_entrega')
  })
  it('por nivel de urgencia', () => {
    expect(aspectoDe({ ...base, entrega: en(100), efectiva: 5 })).toBe('muy_alta')
    expect(aspectoDe({ ...base, entrega: en(100), efectiva: 4 })).toBe('alta')
    expect(aspectoDe({ ...base, entrega: en(20), efectiva: 3 })).toBe('media')
    expect(aspectoDe({ ...base, entrega: en(50), efectiva: 2 })).toBe('neutro')
    expect(aspectoDe({ ...base, entrega: null, efectiva: 1 })).toBe('neutro')
  })
})

describe('compararParaCuadrante', () => {
  it('ordena por urgencia y después por entrega más cercana; sin fecha al final', () => {
    const items: { id: string; efectiva: Nivel; entrega: Date | null }[] = [
      { id: 'a', efectiva: 3, entrega: en(20) },
      { id: 'b', efectiva: 5, entrega: en(1) },
      { id: 'c', efectiva: 3, entrega: en(10) },
      { id: 'd', efectiva: 3, entrega: null },
    ]
    expect(items.sort(compararParaCuadrante).map((i) => i.id)).toEqual(['b', 'c', 'a', 'd'])
  })
})

describe('movimiento entre cuadrantes', () => {
  const ahora = new Date('2026-11-06T10:00:00-03:00')
  const sinFecha = { importante: true, urgencia_manual: null, fecha_entrega: null }

  it('en el mismo cuadrante no cambia nada', () => {
    expect(movimiento(sinFecha, 'planificar', UMBRALES_POR_DEFECTO, ahora)).toBeNull()
  })

  it('a urgente: urgencia al menos 3; a no urgente: como mucho 2', () => {
    expect(movimiento(sinFecha, 'hacer', UMBRALES_POR_DEFECTO, ahora)).toEqual({
      importante: true,
      urgencia_manual: 3,
    })
    // Vence hoy (4): a "no urgente" baja a 2.
    const hoy = {
      importante: true,
      urgencia_manual: null,
      fecha_entrega: '2026-11-06T18:00:00-03:00',
    }
    expect(movimiento(hoy, 'planificar', UMBRALES_POR_DEFECTO, ahora)).toEqual({
      importante: true,
      urgencia_manual: 2,
    })
    // Ya urgente (4) y cambia solo de fila: conserva su urgencia.
    expect(movimiento(hoy, 'delegar', UMBRALES_POR_DEFECTO, ahora)).toEqual({
      importante: false,
      urgencia_manual: 4,
    })
  })

  it('la fila de destino define la importancia', () => {
    expect(movimiento(sinFecha, 'eliminar', UMBRALES_POR_DEFECTO, ahora)).toEqual({
      importante: false,
      urgencia_manual: 1,
    })
  })
})

describe('urgente elegido en el formulario', () => {
  const ahora = new Date('2026-11-06T10:00:00-03:00')
  it('por fecha deja la automática; sí / no la fijan', () => {
    expect(urgenciaElegida(null, null, ahora)).toBeNull()
    expect(urgenciaElegida(true, null, ahora)).toBe(3)
    expect(urgenciaElegida(false, new Date('2026-11-06T11:00:00-03:00'), ahora)).toBe(2)
    expect(urgenciaElegida(true, new Date('2026-11-06T11:00:00-03:00'), ahora)).toBe(5)
  })
})
