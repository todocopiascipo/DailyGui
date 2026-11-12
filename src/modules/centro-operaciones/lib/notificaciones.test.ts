import type { TareaMatriz } from '../features/matriz/tipos'
import { avisosActuales } from './notificaciones'

const ana = { id: 'ana', nombre: 'Ana', iniciales: 'A' }
const beto = { id: 'beto', nombre: 'Beto', iniciales: 'B' }
// Jueves 12/11/2026, 10:00 en Buenos Aires.
const ahora = new Date('2026-11-12T13:00:00Z')

const tarea = (c: Partial<TareaMatriz>): TareaMatriz => ({
  id: 't',
  tipo: 'pedido',
  titulo: 'Folletos',
  importante: true,
  urgencia_manual: null,
  estado: 'pendiente',
  estado_anterior: null,
  motivo_espera: null,
  motivo_espera_detalle: null,
  fecha_entrega: null,
  terminada_at: null,
  entregada_at: null,
  saldo: 0,
  cliente: null,
  responsables: [],
  subtareas: { total: 0, hechas: 0 },
  ...c,
})

describe('notificaciones', () => {
  it('asignada, se entrega hoy y vencida, solo de la persona activa', () => {
    const tareas = [
      tarea({ id: 'a', responsables: [ana], fecha_entrega: '2026-11-12T20:00:00Z' }),
      tarea({ id: 'b', responsables: [ana], fecha_entrega: '2026-11-12T12:00:00Z' }),
      tarea({ id: 'c', responsables: [beto], fecha_entrega: '2026-11-12T12:00:00Z' }),
      tarea({ id: 'd', responsables: [ana], fecha_entrega: '2026-11-14T12:00:00Z' }),
    ]
    const avisos = avisosActuales(tareas, ana, ahora).map((a) => `${a.titulo}|${a.tareaId}`)
    expect(avisos).toEqual([
      'Tarea asignada|a',
      'Se entrega hoy|a',
      'Tarea asignada|b',
      'Tarea vencida|b',
      'Tarea asignada|d',
    ])
  })

  it('sin persona elegida: vencidas y del día de todos, sin "asignada"', () => {
    const tareas = [
      tarea({ id: 'a', responsables: [ana], fecha_entrega: '2026-11-12T20:00:00Z' }),
      tarea({ id: 'c', responsables: [beto], fecha_entrega: '2026-11-12T12:00:00Z' }),
    ]
    expect(avisosActuales(tareas, null, ahora).map((a) => a.titulo)).toEqual([
      'Se entrega hoy',
      'Tarea vencida',
    ])
  })

  it('lo terminado o provisorio no avisa; mañana tampoco es "hoy"', () => {
    const tareas = [
      tarea({ id: 'a', estado: 'terminada', fecha_entrega: '2026-11-12T12:00:00Z' }),
      tarea({ id: 'b', provisoria: true, fecha_entrega: '2026-11-12T12:00:00Z' }),
      tarea({ id: 'c', fecha_entrega: '2026-11-13T04:00:00Z' }), // 01:00 del viernes
    ]
    expect(avisosActuales(tareas, null, ahora)).toEqual([])
  })

  it('cambiar la fecha genera un aviso nuevo (otra clave)', () => {
    const antes = avisosActuales([tarea({ fecha_entrega: '2026-11-12T12:00:00Z' })], null, ahora)
    const despues = avisosActuales([tarea({ fecha_entrega: '2026-11-12T12:30:00Z' })], null, ahora)
    expect(antes[0]!.clave).not.toBe(despues[0]!.clave)
  })
})
