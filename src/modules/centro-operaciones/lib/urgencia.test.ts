import {
  aspectoDe,
  compararParaCuadrante,
  cuadranteDeNiveles,
  DISPOSICION_POR_DEFECTO,
  movimiento,
} from './urgencia'

// Jueves 12/11/2026, 10:00 en Buenos Aires.
const ahora = new Date('2026-11-12T13:00:00Z')

describe('cuadrante por niveles (0-10)', () => {
  it('de 0 a 5 es "no"; de 6 a 10, "sí"', () => {
    expect(cuadranteDeNiveles(6, 6)).toBe('hacer')
    expect(cuadranteDeNiveles(10, 5)).toBe('planificar')
    expect(cuadranteDeNiveles(5, 10)).toBe('delegar')
    expect(cuadranteDeNiveles(0, 0)).toBe('eliminar')
  })

  it('orden pedido: importante y urgente arriba a la izquierda', () => {
    expect(DISPOSICION_POR_DEFECTO).toEqual({
      arriba_izquierda: 'hacer',
      arriba_derecha: 'planificar',
      abajo_izquierda: 'delegar',
      abajo_derecha: 'eliminar',
    })
  })
})

describe('orden dentro del cuadrante', () => {
  const t = (importancia: number, urgencia: number, entrega: string | null = null) => ({
    importancia,
    urgencia,
    entrega: entrega ? new Date(entrega) : null,
  })

  it('mayor suma primero; si empatan, la entrega más cercana (sin fecha al final)', () => {
    const lista = [
      { n: 'a', o: t(6, 6) },
      { n: 'b', o: t(10, 9) },
      { n: 'c', o: t(7, 5, '2026-11-13T12:00:00Z') },
      { n: 'd', o: t(8, 4, '2026-11-12T20:00:00Z') },
    ]
    lista.sort((x, y) => compararParaCuadrante(x.o, y.o))
    expect(lista.map((x) => x.n)).toEqual(['b', 'd', 'c', 'a'])
  })
})

describe('mover de cuadrante', () => {
  it('ajusta cada nivel lo mínimo para quedar del lado correcto', () => {
    expect(movimiento({ nivel_importancia: 3, nivel_urgencia: 2 }, 'hacer')).toEqual({
      nivel_importancia: 6,
      nivel_urgencia: 6,
    })
    expect(movimiento({ nivel_importancia: 9, nivel_urgencia: 8 }, 'eliminar')).toEqual({
      nivel_importancia: 5,
      nivel_urgencia: 5,
    })
    // Solo cambia lo que hace falta.
    expect(movimiento({ nivel_importancia: 9, nivel_urgencia: 2 }, 'hacer')).toEqual({
      nivel_importancia: 9,
      nivel_urgencia: 6,
    })
  })

  it('si ya está en ese cuadrante, no cambia nada', () => {
    expect(movimiento({ nivel_importancia: 7, nivel_urgencia: 7 }, 'hacer')).toBeNull()
  })
})

describe('aspecto', () => {
  const base = { estado: 'pendiente' as const, entrega: null, ahora }
  it('por urgencia, sin fecha', () => {
    expect(aspectoDe({ ...base, urgencia: 3 })).toBe('neutro')
    expect(aspectoDe({ ...base, urgencia: 6 })).toBe('media')
    expect(aspectoDe({ ...base, urgencia: 8 })).toBe('alta')
    expect(aspectoDe({ ...base, urgencia: 10 })).toBe('muy_alta')
  })

  it('la fecha sigue marcando "hoy" y "vencida" (sin mover de cuadrante)', () => {
    expect(aspectoDe({ ...base, urgencia: 0, entrega: new Date('2026-11-12T20:00:00Z') })).toBe(
      'dia_entrega',
    )
    expect(aspectoDe({ ...base, urgencia: 0, entrega: new Date('2026-11-12T12:00:00Z') })).toBe(
      'vencida',
    )
    expect(
      aspectoDe({
        ...base,
        estado: 'terminada',
        urgencia: 0,
        entrega: new Date('2026-11-12T12:00:00Z'),
      }),
    ).toBe('terminada')
  })
})
