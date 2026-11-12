/**
 * Modo pantalla (especificación 7.13): pizarra que nadie toca. Mantiene la
 * pantalla encendida (Wake Lock), esconde el cursor si no se mueve y, si nadie
 * toca nada por un rato, vuelve sola a la vista general.
 */
import { useEffect, useRef, useState } from 'react'

export const CURSOR_MS = 3_000
export const VOLVER_MS = 120_000

interface WakeLock {
  release: () => Promise<void>
}

export function useModoPantalla(activo: boolean, onVolverAGeneral: () => void) {
  const [cursorOculto, setCursorOculto] = useState(false)
  const volver = useRef(onVolverAGeneral)
  useEffect(() => {
    volver.current = onVolverAGeneral
  })

  // Pantalla siempre encendida (se vuelve a pedir al volver a la pestaña).
  useEffect(() => {
    if (!activo) return
    const nav = navigator as Navigator & {
      wakeLock?: { request: (tipo: 'screen') => Promise<WakeLock> }
    }
    if (!nav.wakeLock) return
    let bloqueo: WakeLock | null = null
    let vivo = true
    const pedir = () => {
      if (document.visibilityState !== 'visible') return
      nav.wakeLock
        ?.request('screen')
        .then((b) => {
          if (vivo) bloqueo = b
          else void b.release()
        })
        .catch(() => {})
    }
    pedir()
    document.addEventListener('visibilitychange', pedir)
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', pedir)
      void bloqueo?.release().catch(() => {})
    }
  }, [activo])

  // Cursor oculto y vuelta a la vista general por inactividad.
  useEffect(() => {
    if (!activo) return
    let cursor = 0
    let vuelta = 0
    const programar = () => {
      window.clearTimeout(cursor)
      window.clearTimeout(vuelta)
      cursor = window.setTimeout(() => setCursorOculto(true), CURSOR_MS)
      vuelta = window.setTimeout(() => volver.current(), VOLVER_MS)
    }
    const actividad = () => {
      setCursorOculto(false)
      programar()
    }
    const eventos = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    eventos.forEach((e) => window.addEventListener(e, actividad, { passive: true }))
    programar()
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, actividad))
      window.clearTimeout(cursor)
      window.clearTimeout(vuelta)
    }
  }, [activo])

  return { cursorOculto: activo && cursorOculto }
}
