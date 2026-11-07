import { aFechaHora, aIso, aplicarAtajo, SIN_FECHA } from './fechas'

// 14:20 en Buenos Aires (UTC−3).
const ahora = new Date('2026-11-06T14:20:00-03:00')

describe('fechas del local', () => {
  it('convierte ida y vuelta en hora de Buenos Aires', () => {
    expect(aFechaHora('2026-11-06T21:00:00.000Z')).toEqual({ fecha: '2026-11-06', hora: '18:00' })
    expect(aIso({ fecha: '2026-11-06', hora: '18:00' })).toBe('2026-11-06T21:00:00.000Z')
    // Cerca de la medianoche, el día es el del local, no el de UTC.
    expect(aFechaHora('2026-11-07T02:30:00.000Z')).toEqual({ fecha: '2026-11-06', hora: '23:30' })
  })

  it('sin fecha es null; incompleta también', () => {
    expect(aFechaHora(null)).toEqual(SIN_FECHA)
    expect(aIso(SIN_FECHA)).toBeNull()
    expect(aIso({ fecha: '2026-11-06', hora: '' })).toBeNull()
  })

  it('atajos Hoy y Mañana conservan la hora elegida', () => {
    const elegida = { fecha: '2026-11-20', hora: '10:30' }
    expect(aplicarAtajo('hoy', elegida, ahora)).toEqual({ fecha: '2026-11-06', hora: '10:30' })
    expect(aplicarAtajo('manana', elegida, ahora)).toEqual({ fecha: '2026-11-07', hora: '10:30' })
  })

  it('sin hora, Hoy propone la próxima hora en punto', () => {
    expect(aplicarAtajo('hoy', SIN_FECHA, ahora)).toEqual({ fecha: '2026-11-06', hora: '15:00' })
  })

  it('+N h redondea a los 15 minutos siguientes', () => {
    expect(aplicarAtajo('mas1', SIN_FECHA, ahora)).toEqual({ fecha: '2026-11-06', hora: '15:30' })
    expect(aplicarAtajo('mas4', SIN_FECHA, ahora)).toEqual({ fecha: '2026-11-06', hora: '18:30' })
    const tarde = new Date('2026-11-06T22:50:00-03:00')
    expect(aplicarAtajo('mas2', SIN_FECHA, tarde)).toEqual({ fecha: '2026-11-07', hora: '01:00' })
  })
})
