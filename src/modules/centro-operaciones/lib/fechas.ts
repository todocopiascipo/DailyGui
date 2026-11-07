/**
 * Fecha y hora "de pared" del local (Buenos Aires) ↔ instante ISO.
 * Los formularios trabajan con fecha (aaaa-mm-dd) y hora (HH:mm) separadas.
 */
import { addDays } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { ZONA_HORARIA } from './tiempo'

export interface FechaHora {
  fecha: string // aaaa-mm-dd o ''
  hora: string // HH:mm o ''
}

export const SIN_FECHA: FechaHora = { fecha: '', hora: '' }

/** Instante ISO → fecha y hora en el local. */
export function aFechaHora(iso: string | null): FechaHora {
  if (!iso) return SIN_FECHA
  const d = new Date(iso)
  return {
    fecha: formatInTimeZone(d, ZONA_HORARIA, 'yyyy-MM-dd'),
    hora: formatInTimeZone(d, ZONA_HORARIA, 'HH:mm'),
  }
}

/** Fecha y hora del local → instante ISO. Sin fecha, null; sin hora, inválido. */
export function aIso(f: FechaHora): string | null {
  if (!f.fecha) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha) || !/^\d{2}:\d{2}$/.test(f.hora)) return null
  const d = fromZonedTime(`${f.fecha}T${f.hora}:00`, ZONA_HORARIA)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Próxima hora en punto desde ahora (hora del local). */
function proximaHoraEnPunto(ahora: Date): Date {
  const d = new Date(ahora.getTime() + 60 * 60_000)
  d.setUTCMinutes(0, 0, 0)
  return d
}

export type Atajo = 'hoy' | 'manana' | 'mas1' | 'mas2' | 'mas4'

export const ATAJOS: { id: Atajo; texto: string }[] = [
  { id: 'hoy', texto: 'Hoy' },
  { id: 'manana', texto: 'Mañana' },
  { id: 'mas1', texto: '+1 h' },
  { id: 'mas2', texto: '+2 h' },
  { id: 'mas4', texto: '+4 h' },
]

/**
 * Aplica un atajo de entrega. "Hoy" y "Mañana" cambian el día y conservan la
 * hora elegida (si no hay, proponen la próxima hora en punto). "+N h" fija la
 * hora a partir de ahora, redondeada a los 15 minutos siguientes.
 */
export function aplicarAtajo(atajo: Atajo, actual: FechaHora, ahora: Date): FechaHora {
  if (atajo === 'hoy' || atajo === 'manana') {
    const dia = atajo === 'hoy' ? ahora : addDays(ahora, 1)
    return {
      fecha: formatInTimeZone(dia, ZONA_HORARIA, 'yyyy-MM-dd'),
      hora: actual.hora || formatInTimeZone(proximaHoraEnPunto(ahora), ZONA_HORARIA, 'HH:mm'),
    }
  }
  const horas = atajo === 'mas1' ? 1 : atajo === 'mas2' ? 2 : 4
  const cuarto = 15 * 60_000
  const destino = new Date(Math.ceil((ahora.getTime() + horas * 3_600_000) / cuarto) * cuarto)
  return aFechaHora(destino.toISOString())
}
