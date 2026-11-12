/**
 * Preferencias de este dispositivo (se guardan en el navegador, no en la base):
 * modo pantalla y notificaciones. Las pantallas se enteran al instante.
 */
import { useSyncExternalStore } from 'react'

export type Preferencia = 'modo-pantalla' | 'notificaciones'

const clave = (p: Preferencia) => `co-${p}`
const memoria = new Map<string, string>()
const oyentes = new Set<() => void>()

function leer(p: Preferencia): boolean {
  try {
    return window.localStorage.getItem(clave(p)) === 'si'
  } catch {
    return memoria.get(clave(p)) === 'si'
  }
}

export function guardarPreferencia(p: Preferencia, valor: boolean) {
  try {
    window.localStorage.setItem(clave(p), valor ? 'si' : 'no')
  } catch {
    memoria.set(clave(p), valor ? 'si' : 'no')
  }
  oyentes.forEach((o) => o())
}

function suscribir(o: () => void) {
  oyentes.add(o)
  window.addEventListener('storage', o)
  return () => {
    oyentes.delete(o)
    window.removeEventListener('storage', o)
  }
}

export function usePreferencia(p: Preferencia): boolean {
  return useSyncExternalStore(
    suscribir,
    () => leer(p),
    () => false,
  )
}

/**
 * `?modo=pantalla` (o `?modo=normal`) en la dirección lo deja elegido en este
 * dispositivo. Se llama una vez al arrancar.
 */
export function leerModoDeLaDireccion() {
  const modo = new URLSearchParams(window.location.search).get('modo')
  if (modo === 'pantalla') guardarPreferencia('modo-pantalla', true)
  if (modo === 'normal') guardarPreferencia('modo-pantalla', false)
}
