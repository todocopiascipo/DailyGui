import { createContext, useContext } from 'react'
import type { Cuadrante } from '../../lib/urgencia'

export type Destino = { tipo: 'cuadrante'; id: Cuadrante } | { tipo: 'papelera' }

/** Lo que se dibuja del globo levantado. */
export interface Levantado {
  id: string
  /** Copia visual del globo. */
  html: string
  clases: string
  ancho: number
  alto: number
}

export interface Arrastre {
  levantado: Levantado | null
  sobre: Destino | null
}

export interface Contexto extends Arrastre {
  presionar: (e: React.PointerEvent<HTMLElement>, id: string) => void
}

export const ContextoArrastre = createContext<Contexto | null>(null)

/** Para el globo: null si no se puede arrastrar (por ej., en la demo). */
export function useArrastre() {
  return useContext(ContextoArrastre)
}
