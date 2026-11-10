import { armarMensaje, formatoPesos, PLANTILLA_POR_DEFECTO } from './mensaje'

describe('mensaje para copiar', () => {
  it('reemplaza nombre, trabajo y saldo', () => {
    expect(
      armarMensaje(PLANTILLA_POR_DEFECTO, { nombre: 'Ana', trabajo: 'Vinilo', saldo: 3500.5 }),
    ).toBe('Hola Ana, tu trabajo "Vinilo" ya está listo para retirar. Saldo pendiente: $ 3.500,5.')
  })

  it('sin nombre no deja espacios sueltos', () => {
    expect(armarMensaje(PLANTILLA_POR_DEFECTO, { nombre: null, trabajo: 'Vinilo', saldo: 0 })).toBe(
      'Hola, tu trabajo "Vinilo" ya está listo para retirar. Saldo pendiente: $ 0.',
    )
  })

  it('pesos con separador de miles', () => {
    expect(formatoPesos(1234567)).toBe('$ 1.234.567')
  })
})
