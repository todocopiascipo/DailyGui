import { columnasDeFlujo, esperaA } from './flujo'

const t = (id: string, ...deps: string[]) => ({
  id,
  depende_de: deps.map((d) => ({ id: d, titulo: d.toUpperCase(), hecha: false })),
})

describe('columnas del diagrama de flujo', () => {
  it('1.ª columna sin dependencias; después, una más que la más avanzada', () => {
    const c = columnasDeFlujo([
      t('medir'),
      t('disenar'),
      t('imprimir', 'medir', 'disenar'),
      t('cortar', 'imprimir'),
      t('colocar', 'cortar', 'medir'),
    ])
    expect(Object.fromEntries(c)).toEqual({
      medir: 1,
      disenar: 1,
      imprimir: 2,
      cortar: 3,
      colocar: 4,
    })
  })

  it('ignora dependencias que no están en la lista y no se cuelga con un círculo', () => {
    const c = columnasDeFlujo([t('a', 'fuera'), t('b', 'c'), t('c', 'b')])
    expect(c.get('a')).toBe(1)
    expect(c.get('b')).toBeGreaterThan(0)
    expect(c.get('c')).toBeGreaterThan(0)
  })
})

describe('espera a', () => {
  it('solo las que faltan terminar', () => {
    expect(
      esperaA({
        depende_de: [
          { id: '1', titulo: 'Medir', hecha: true },
          { id: '2', titulo: 'Imprimir', hecha: false },
        ],
      }),
    ).toEqual(['Imprimir'])
    expect(esperaA({})).toEqual([])
  })
})
