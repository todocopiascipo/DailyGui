/**
 * Línea de tiempo del día para "Mis tareas" (especificación 7.7): una vista
 * simple tipo Gantt de la jornada. Funciones puras, con pruebas.
 */
import { esMismoDia } from '../../lib/tiempo'
import type { TareaMia } from './tipos'

const HORA = 3_600_000

export interface FilaLinea {
  tarea: TareaMia
  /** Posición y ancho en % del rango. Ancho 0 = solo la marca de entrega. */
  izquierda: number
  ancho: number
  vencida: boolean
}

export interface LineaDelDia {
  desde: Date
  hasta: Date
  /** Dónde va la marca de "ahora", en %. */
  ahora: number
  /** Horas en punto para las referencias del eje. */
  horas: Date[]
  filas: FilaLinea[]
}

const enCurso = (t: TareaMia) =>
  t.estado === 'pendiente' || t.estado === 'en_proceso' || t.estado === 'en_espera'

/**
 * Lo de hoy (y lo vencido) que sigue en curso, de la hora de inicio a la de
 * entrega. El rango va de la hora en punto anterior a lo primero hasta la
 * siguiente a lo último, e incluye siempre el momento actual.
 */
export function lineaDelDia(tareas: TareaMia[], ahora: Date): LineaDelDia | null {
  const delDia = tareas.filter((t) => {
    if (!enCurso(t) || !t.fecha_entrega) return false
    const fin = new Date(t.fecha_entrega)
    return fin < ahora || esMismoDia(fin, ahora)
  })
  if (delDia.length === 0) return null

  const tramos = delDia.map((t) => {
    const fin = new Date(t.fecha_entrega!)
    const ini = t.fecha_inicio ? new Date(t.fecha_inicio) : null
    const inicio = ini && ini < fin && esMismoDia(ini, fin) ? ini : null
    return { tarea: t, inicio, fin, vencida: fin < ahora }
  })

  // Lo vencido de días anteriores se dibuja pegado al comienzo.
  const deHoy = tramos.filter((x) => esMismoDia(x.fin, ahora))
  const instantes = [
    ahora.getTime(),
    ...deHoy.flatMap((x) => [x.fin.getTime(), x.inicio?.getTime() ?? x.fin.getTime()]),
  ]
  let desde = Math.floor(Math.min(...instantes) / HORA) * HORA
  let hasta = Math.ceil(Math.max(...instantes) / HORA) * HORA
  if (hasta - desde < 2 * HORA) hasta = desde + 2 * HORA
  if (hasta === Math.max(...instantes)) hasta += HORA
  if (desde === Math.min(...instantes) && desde === ahora.getTime()) desde -= HORA
  const rango = hasta - desde
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - desde) / rango) * 100))

  const horas: Date[] = []
  for (let h = desde; h <= hasta; h += HORA) horas.push(new Date(h))

  return {
    desde: new Date(desde),
    hasta: new Date(hasta),
    ahora: pct(ahora.getTime()),
    horas,
    filas: tramos
      .sort((a, b) => a.fin.getTime() - b.fin.getTime())
      .map((x) => {
        const izquierda = pct(x.inicio?.getTime() ?? x.fin.getTime())
        return {
          tarea: x.tarea,
          izquierda,
          ancho: x.inicio ? pct(x.fin.getTime()) - izquierda : 0,
          vencida: x.vencida,
        }
      }),
  }
}

/** "Ahora" y "Sigue": lo en curso con la entrega más cercana (sin fecha, al final). */
export function ahoraYSigue(tareas: TareaMia[]): {
  ahora: TareaMia | null
  sigue: TareaMia | null
} {
  const pendientes = tareas
    .filter(enCurso)
    .sort(
      (a, b) =>
        (a.fecha_entrega ? Date.parse(a.fecha_entrega) : Infinity) -
        (b.fecha_entrega ? Date.parse(b.fecha_entrega) : Infinity),
    )
  return { ahora: pendientes[0] ?? null, sigue: pendientes[1] ?? null }
}
