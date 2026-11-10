import { accionesDisponibles, type RefTarea } from './accionesTarea'

const base: RefTarea = {
  id: 't',
  tipo: 'pedido',
  titulo: 'Vinilo',
  estado: 'pendiente',
  estado_anterior: null,
  saldo: 0,
  cliente: null,
}

describe('menú de tres puntitos', () => {
  it('pedido en curso: terminar, editar, copiar mensaje, eliminar', () => {
    expect(accionesDisponibles(base)).toEqual(['terminar', 'abrir', 'copiar-mensaje', 'eliminar'])
  })

  it('pedido terminado: entregada y devolver; con teléfono, copiarlo', () => {
    expect(
      accionesDisponibles({
        ...base,
        estado: 'terminada',
        estado_anterior: 'pendiente',
        cliente: { nombre: 'Ana', telefono: '299' },
      }),
    ).toEqual(['entregar', 'abrir', 'devolver', 'copiar-mensaje', 'copiar-telefono', 'eliminar'])
  })

  it('interna: sin entregada ni mensaje', () => {
    expect(accionesDisponibles({ ...base, tipo: 'interna' })).toEqual([
      'terminar',
      'abrir',
      'eliminar',
    ])
  })

  it('devolver solo hacia atrás (no de pendiente a terminada)', () => {
    expect(
      accionesDisponibles({ ...base, estado: 'pendiente', estado_anterior: 'terminada' }),
    ).not.toContain('devolver')
    expect(
      accionesDisponibles({ ...base, estado: 'en_proceso', estado_anterior: 'pendiente' }),
    ).toContain('devolver')
  })
})
