/**
 * Notificaciones del navegador con la app abierta (especificación 8): tarea
 * asignada a la persona activa, tarea que entra en su día de entrega y tarea
 * vencida. Se activan por dispositivo, con un botón (nunca al abrir).
 * En el iPad solo andan con la app instalada en la pantalla de inicio.
 */
import { useEffect, useRef } from 'react'
import type { PersonaBreve, TareaMatriz } from '../features/matriz/tipos'
import { diaLocal, esMismoDia, formatoHora } from './tiempo'

export interface Aviso {
  clave: string
  titulo: string
  cuerpo: string
  tareaId: string
}

const EN_CURSO = ['pendiente', 'en_proceso', 'en_espera']

/**
 * Lo que habría que avisar ahora. Con persona elegida, solo sus tareas; sin
 * persona (por ej., el monitor), las de todos, salvo "asignada".
 * Devuelve todos los avisos que corresponden; quien llama descarta los ya vistos.
 */
export function avisosActuales(
  tareas: TareaMatriz[],
  persona: PersonaBreve | null,
  ahora: Date,
): Aviso[] {
  const avisos: Aviso[] = []
  for (const t of tareas) {
    if (t.provisoria || !EN_CURSO.includes(t.estado)) continue
    const mia = persona ? t.responsables.some((r) => r.id === persona.id) : false
    if (persona && !mia) continue
    if (persona && mia) {
      avisos.push({
        clave: `asignada:${t.id}:${persona.id}`,
        titulo: 'Tarea asignada',
        cuerpo: t.titulo,
        tareaId: t.id,
      })
    }
    if (!t.fecha_entrega) continue
    const entrega = new Date(t.fecha_entrega)
    if (entrega <= ahora) {
      avisos.push({
        clave: `vencida:${t.id}:${t.fecha_entrega}`,
        titulo: 'Tarea vencida',
        cuerpo: t.titulo,
        tareaId: t.id,
      })
    } else if (esMismoDia(entrega, ahora)) {
      avisos.push({
        clave: `hoy:${t.id}:${diaLocal(entrega)}`,
        titulo: 'Se entrega hoy',
        cuerpo: `${t.titulo} · ${formatoHora(entrega)}`,
        tareaId: t.id,
      })
    }
  }
  return avisos
}

export type EstadoNotificaciones = 'no-soportadas' | 'pedir' | 'bloqueadas' | 'permitidas'

export function estadoNotificaciones(): EstadoNotificaciones {
  if (typeof window === 'undefined' || !('Notification' in window) || !window.isSecureContext) {
    return 'no-soportadas'
  }
  if (Notification.permission === 'granted') return 'permitidas'
  if (Notification.permission === 'denied') return 'bloqueadas'
  return 'pedir'
}

/**
 * Muestra los avisos nuevos. Lo que ya correspondía al abrir la app (o al
 * elegir otra persona) no se avisa: solo lo que aparece después.
 */
export function useNotificaciones({
  activas,
  tareas,
  persona,
  ahora,
  onAbrir,
}: {
  activas: boolean
  tareas: TareaMatriz[] | undefined
  persona: PersonaBreve | null
  ahora: Date
  onAbrir: (id: string) => void
}) {
  const vistos = useRef<Set<string> | null>(null)
  const quien = useRef<string | null>(null)
  const abrir = useRef(onAbrir)
  useEffect(() => {
    abrir.current = onAbrir
  })

  useEffect(() => {
    if (!activas || !tareas || estadoNotificaciones() !== 'permitidas') {
      vistos.current = null
      return
    }
    const actuales = avisosActuales(tareas, persona, ahora)
    // Primera vez (o cambió la persona): se toma nota sin avisar.
    if (!vistos.current || quien.current !== (persona?.id ?? null)) {
      vistos.current = new Set(actuales.map((a) => a.clave))
      quien.current = persona?.id ?? null
      return
    }
    for (const a of actuales) {
      if (vistos.current.has(a.clave)) continue
      vistos.current.add(a.clave)
      try {
        const n = new Notification(a.titulo, { body: a.cuerpo, tag: a.clave })
        n.onclick = () => {
          window.focus()
          abrir.current(a.tareaId)
          n.close()
        }
      } catch {
        // Algunos navegadores solo permiten notificar desde un service worker.
      }
    }
  }, [activas, tareas, persona, ahora])
}
