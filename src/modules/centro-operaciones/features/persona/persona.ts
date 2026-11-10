/**
 * Persona activa ("¿Quién soy?", especificación 7.6). Se recuerda en este
 * dispositivo hasta que se cambie, y viaja en cada pedido al servidor para
 * quedar como autora en el historial.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { definirPersonaActiva } from '../../lib/api'
import type { PersonaBreve } from '../matriz/tipos'

const CLAVE_PERSONA = 'co-persona-activa'
const CLAVE_RESALTAR = 'co-resaltar-mias'

/** El almacenamiento del navegador puede no estar (modo privado): nunca rompe. */
function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}
function escribir(clave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(clave)
    else window.localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento: vale solo mientras la pantalla esté abierta.
  }
}

export interface PersonaActiva {
  persona: PersonaBreve | null
  /** Resaltar sus tareas y atenuar las demás (un toque lo apaga). */
  resaltar: boolean
}

export const ContextoPersona = createContext<PersonaActiva>({ persona: null, resaltar: false })

export function usePersona() {
  return useContext(ContextoPersona)
}

/**
 * Estado de la persona activa. `personas` son las del equipo (si la recordada
 * ya no está, se olvida).
 */
export function usePersonaActiva(personas: PersonaBreve[] | undefined) {
  const [id, setId] = useState<string | null>(() => leer(CLAVE_PERSONA))
  const [resaltar, setResaltarEstado] = useState(() => leer(CLAVE_RESALTAR) !== 'no')

  const persona = (id && personas?.find((p) => p.id === id)) || null
  // Recordada pero dada de baja: se olvida.
  const vigente = personas === undefined ? id : (persona?.id ?? null)

  useEffect(() => {
    definirPersonaActiva(vigente)
    if (personas !== undefined && id !== vigente) escribir(CLAVE_PERSONA, null)
  }, [vigente, id, personas])

  const elegir = (p: PersonaBreve | null) => {
    setId(p?.id ?? null)
    escribir(CLAVE_PERSONA, p?.id ?? null)
    definirPersonaActiva(p?.id ?? null)
    if (p) {
      // Al elegirse, sus tareas se resaltan.
      setResaltarEstado(true)
      escribir(CLAVE_RESALTAR, null)
    }
  }

  const setResaltar = (v: boolean) => {
    setResaltarEstado(v)
    escribir(CLAVE_RESALTAR, v ? null : 'no')
  }

  return {
    persona,
    /** Hay alguien elegido (aunque la lista del equipo todavía no haya llegado). */
    identificado: vigente !== null,
    resaltar: resaltar && persona !== null,
    elegir,
    setResaltar,
  }
}
