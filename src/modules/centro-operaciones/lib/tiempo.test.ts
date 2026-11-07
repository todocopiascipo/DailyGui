import { fechaLarga, textoEntrega, tiempoTranscurrido } from './tiempo'

const ahora = new Date('2026-11-06T14:00:00-03:00') // viernes
const minutos = (m: number) => new Date(ahora.getTime() + m * 60_000)

describe('tiempoTranscurrido', () => {
  it('minutos, horas y días', () => {
    expect(tiempoTranscurrido(minutos(-0.5), ahora)).toBe('hace instantes')
    expect(tiempoTranscurrido(minutos(-40), ahora)).toBe('hace 40 min')
    expect(tiempoTranscurrido(minutos(-180), ahora)).toBe('hace 3 h')
    expect(tiempoTranscurrido(minutos(-60 * 24), ahora)).toBe('hace 1 día')
    expect(tiempoTranscurrido(minutos(-60 * 50), ahora)).toBe('hace 2 días')
  })
})

describe('textoEntrega', () => {
  it('vencida', () => {
    expect(textoEntrega(minutos(-40), ahora)).toBe('Vencida hace 40 min')
  })
  it('hoy', () => {
    expect(textoEntrega(new Date('2026-11-06T18:30:00-03:00'), ahora)).toBe('Entrega 18:30')
  })
  it('mañana', () => {
    expect(textoEntrega(new Date('2026-11-07T10:00:00-03:00'), ahora)).toBe('Mañana 10:00')
  })
  it('esta semana con el día abreviado', () => {
    expect(textoEntrega(new Date('2026-11-10T09:15:00-03:00'), ahora)).toBe('Mar 09:15')
  })
  it('más adelante con la fecha', () => {
    expect(textoEntrega(new Date('2026-11-20T11:00:00-03:00'), ahora)).toBe('20/11 11:00')
  })
})

describe('fechaLarga', () => {
  it('en español', () => {
    expect(fechaLarga(ahora)).toBe('viernes 6 de noviembre')
  })
})
