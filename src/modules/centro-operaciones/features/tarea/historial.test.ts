import { describirEvento, momentoEvento } from './historial'
import type { EventoDetalle } from './tipos'

const evento = (accion: string, cambios: Record<string, unknown> = {}): EventoDetalle => ({
  id: 'e',
  accion,
  persona: 'Uno',
  cambios,
  created_at: '2026-11-06T17:05:00.000Z',
})

describe('historial', () => {
  it('describe cada acción en palabras', () => {
    expect(describirEvento(evento('creada'))).toBe('Creó la tarea')
    expect(
      describirEvento(evento('estado', { estado: { antes: 'pendiente', despues: 'en_proceso' } })),
    ).toBe('Cambió el estado: Pendiente → En proceso')
    expect(
      describirEvento(
        evento('reasignada', { responsables: { antes: [], despues: ['Uno', 'Dos'] } }),
      ),
    ).toBe('Responsables: nadie → Uno, Dos')
    expect(
      describirEvento(
        evento('editada', {
          fecha_entrega: { antes: null, despues: 'x' },
          sena: { antes: 0, despues: 1 },
          titulo: 'Vinilo',
        }),
      ),
    ).toBe('Editó entrega, seña')
    expect(describirEvento(evento('subtarea_hecha', { subtarea: 'Cortar' }))).toBe(
      'Marcó como hecha “Cortar”',
    )
    expect(
      describirEvento(
        evento('subtarea_editada', {
          responsable: { antes: null, despues: 'Dos' },
          nombre: 'Cortar',
        }),
      ),
    ).toBe('Asignó “Cortar” a Dos')
  })

  it('muestra solo la hora si es de hoy', () => {
    const hoy = new Date('2026-11-06T20:00:00-03:00')
    expect(momentoEvento('2026-11-06T17:05:00.000Z', hoy)).toBe('14:05')
    expect(momentoEvento('2026-11-05T17:05:00.000Z', hoy)).toBe('05/11 14:05')
  })
})
