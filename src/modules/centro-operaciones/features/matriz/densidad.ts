import type { Densidad } from './Globo'

interface Nivel {
  densidad: Densidad
  anchoMin: number
  alto: number
  separacion: number
}

/** Tamaños de globo, del más cómodo al más chico (especificación 7.1, densidad). */
export const NIVELES: readonly Nivel[] = [
  { densidad: 'normal', anchoMin: 210, alto: 104, separacion: 12 },
  { densidad: 'compacto', anchoMin: 176, alto: 86, separacion: 10 },
  { densidad: 'mini', anchoMin: 148, alto: 72, separacion: 8 },
]

export interface Reparto {
  nivel: Nivel
  columnas: number
  /** Globos que se muestran. */
  visibles: number
  /** Globos que no entran: se muestran como "+N". */
  ocultos: number
}

/**
 * Elige el tamaño de globo más grande con el que entran todas las tareas.
 * Si ni con el más chico entran, deja un lugar para el globo "+N".
 */
export function repartir(cantidad: number, ancho: number, alto: number): Reparto {
  let ultimo: Reparto | null = null
  for (const nivel of NIVELES) {
    const columnas = Math.max(
      1,
      Math.floor((ancho + nivel.separacion) / (nivel.anchoMin + nivel.separacion)),
    )
    const filas = Math.max(
      0,
      Math.floor((alto + nivel.separacion) / (nivel.alto + nivel.separacion)),
    )
    const capacidad = columnas * filas
    if (cantidad <= capacidad) return { nivel, columnas, visibles: cantidad, ocultos: 0 }
    const visibles = Math.max(0, capacidad - 1)
    ultimo = { nivel, columnas, visibles, ocultos: cantidad - visibles }
  }
  return ultimo!
}
