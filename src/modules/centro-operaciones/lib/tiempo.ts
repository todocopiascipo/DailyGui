import { addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'

export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires'

/** Fecha calendario (aaaa-mm-dd) en la zona horaria del local. */
export function diaLocal(fecha: Date): string {
  return formatInTimeZone(fecha, ZONA_HORARIA, 'yyyy-MM-dd')
}

export function esMismoDia(a: Date, b: Date): boolean {
  return diaLocal(a) === diaLocal(b)
}

export function formatoHora(fecha: Date): string {
  return formatInTimeZone(fecha, ZONA_HORARIA, 'HH:mm')
}

/** "hace 40 min", "hace 3 h", "hace 2 días". */
export function tiempoTranscurrido(desde: Date, ahora: Date): string {
  const minutos = Math.max(0, Math.floor((ahora.getTime() - desde.getTime()) / 60_000))
  if (minutos < 1) return 'hace instantes'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

/**
 * Texto de la entrega para el globo:
 * "Entrega 14:00" (hoy) · "Mañana 10:00" · "Jue 10:00" (esta semana) ·
 * "12/11 10:00" (más adelante) · "Vencida hace 40 min".
 */
export function textoEntrega(entrega: Date, ahora: Date): string {
  if (entrega.getTime() < ahora.getTime()) {
    return `Vencida ${tiempoTranscurrido(entrega, ahora)}`
  }
  const hora = formatoHora(entrega)
  if (esMismoDia(entrega, ahora)) return `Entrega ${hora}`
  if (esMismoDia(entrega, addDays(ahora, 1))) return `Mañana ${hora}`
  const dias = (entrega.getTime() - ahora.getTime()) / 86_400_000
  if (dias < 6) {
    const dia = formatInTimeZone(entrega, ZONA_HORARIA, 'EEE', { locale: es }).replace('.', '')
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${hora}`
  }
  return `${formatInTimeZone(entrega, ZONA_HORARIA, 'dd/MM')} ${hora}`
}

/** Fecha larga para el reloj: "viernes 7 de noviembre". */
export function fechaLarga(fecha: Date): string {
  return formatInTimeZone(fecha, ZONA_HORARIA, "EEEE d 'de' MMMM", { locale: es })
}
