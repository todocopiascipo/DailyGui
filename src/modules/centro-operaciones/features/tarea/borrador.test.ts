import {
  borradorDe,
  borradorVacio,
  cuerpoEdicion,
  cuerpoNuevaTarea,
  leerImporte,
  validar,
  type Borrador,
} from './borrador'
import type { DetalleTarea } from './tipos'

const lleno = (cambios: Partial<Borrador>): Borrador => ({
  ...borradorVacio(),
  titulo: 'Vinilo',
  importante: true,
  ...cambios,
})

const detalle: DetalleTarea = {
  tarea: {
    id: 't1',
    tipo: 'pedido',
    titulo: 'Vinilo',
    descripcion: null,
    categoria_id: null,
    proyecto_id: null,
    pedido_id: null,
    cliente_id: 'c1',
    sena: 1500,
    saldo: 0,
    sena_medio: null,
    saldo_medio: null,
    importante: true,
    urgencia_manual: null,
    estado: 'pendiente',
    estado_anterior: null,
    motivo_espera: null,
    motivo_espera_detalle: null,
    fecha_inicio: null,
    fecha_entrega: '2026-11-06T21:00:00.000Z',
    terminada_at: null,
    entregada_at: null,
    mostrar_en_matriz: true,
    orden_proyecto: 0,
    eliminada_at: null,
    eliminada_por: null,
    creada_por: null,
    actualizada_por: null,
    created_at: '2026-11-06T12:00:00.000Z',
    updated_at: '2026-11-06T12:00:00.000Z',
  },
  responsables: [{ id: 'p1', nombre: 'Uno', iniciales: 'U' }],
  subtareas: [],
  cliente: { id: 'c1', nombre_apellido: 'Cliente', telefono: '2990000000' },
  creada_por: null,
  eventos: [],
}

describe('importes', () => {
  it('acepta los formatos habituales', () => {
    expect(leerImporte('')).toBe(0)
    expect(leerImporte('1500')).toBe(1500)
    expect(leerImporte('1.500')).toBe(1500)
    expect(leerImporte('1.500,50')).toBe(1500.5)
    expect(leerImporte('$ 2500,5')).toBe(2500.5)
    expect(leerImporte('1500.5')).toBe(1500.5)
    expect(leerImporte('abc')).toBeNull()
    expect(leerImporte('-3')).toBeNull()
  })
})

describe('validar', () => {
  it('pide título e importancia', () => {
    expect(validar(borradorVacio())).toEqual({
      titulo: 'Escribí un título',
      importante: 'Elegí si es importante',
    })
    expect(validar(lleno({}))).toEqual({})
  })

  it('detecta fechas incompletas, motivo faltante y cliente sin nombre', () => {
    const e = validar(
      lleno({
        entrega: { fecha: '2026-11-06', hora: '' },
        estado: 'en_espera',
        cliente: { id: null, nombre_apellido: '', telefono: '2990000000' },
        saldo: 'x',
      }),
    )
    expect(e).toEqual({
      entrega: 'Falta la hora',
      motivo: 'Elegí el motivo de la espera',
      cliente: 'Falta el nombre y apellido',
      saldo: 'Importe inválido',
    })
  })
})

describe('cuerpo para la API', () => {
  it('nueva tarea: convierte fechas e importes y omite lo vacío', () => {
    const c = cuerpoNuevaTarea(
      lleno({
        entrega: { fecha: '2026-11-06', hora: '18:00' },
        sena: '1.000',
        responsables: ['p1'],
      }),
      [
        { titulo: 'Cortar', responsable_id: null },
        { titulo: '  ', responsable_id: null },
      ],
    )
    expect(c.tarea).toMatchObject({
      titulo: 'Vinilo',
      importante: true,
      fecha_entrega: '2026-11-06T21:00:00.000Z',
      sena: 1000,
      saldo: 0,
    })
    expect(c.subtareas).toEqual([{ titulo: 'Cortar', responsable_id: null }])
    expect('cliente' in c).toBe(false)
  })

  it('las tareas internas no llevan cliente ni importes', () => {
    const c = cuerpoNuevaTarea(
      lleno({
        tipo: 'interna',
        sena: '500',
        cliente: { id: null, nombre_apellido: 'X', telefono: '' },
      }),
      [],
    )
    expect(c.tarea.sena).toBe(0)
    expect('cliente' in c).toBe(false)
  })

  it('edición: sin cambios es null', () => {
    expect(cuerpoEdicion(borradorDe(detalle), detalle)).toBeNull()
  })

  it('edición: manda solo lo que cambió', () => {
    const b = { ...borradorDe(detalle), urgencia_manual: 4, responsables: ['p1', 'p2'] }
    expect(cuerpoEdicion(b, detalle)).toEqual({
      cambios: { urgencia_manual: 4 },
      responsables: ['p1', 'p2'],
    })
  })

  it('edición: el estado viaja con su motivo', () => {
    const b = {
      ...borradorDe(detalle),
      estado: 'en_espera' as const,
      motivo_espera: 'pago' as const,
    }
    expect(cuerpoEdicion(b, detalle)).toEqual({
      cambios: { estado: 'en_espera', motivo_espera: 'pago', motivo_espera_detalle: null },
    })
  })

  it('edición: borrar los datos del cliente lo quita', () => {
    const b = { ...borradorDe(detalle), cliente: { id: 'c1', nombre_apellido: '', telefono: '' } }
    expect(cuerpoEdicion(b, detalle)).toEqual({ cliente: null })
  })
})
