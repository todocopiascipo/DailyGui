/**
 * Tareas encadenadas (Fase 14): en qué columna va cada tarea del diagrama de
 * una orden de trabajo. 1.ª columna = no espera a nadie (se puede hacer ya);
 * si espera a otras, va una columna después de la más avanzada de ellas.
 * Funciones puras, con pruebas.
 */
import type { TareaMatriz } from '../features/matriz/tipos'

export function columnasDeFlujo(
  tareas: Pick<TareaMatriz, 'id' | 'depende_de'>[],
): Map<string, number> {
  const porId = new Map(tareas.map((t) => [t.id, t]))
  const columna = new Map<string, number>()
  const visitando = new Set<string>()
  const calcular = (id: string): number => {
    const ya = columna.get(id)
    if (ya !== undefined) return ya
    // Defensa ante un círculo (el servidor no los permite): corta en 1.
    if (visitando.has(id)) return 1
    visitando.add(id)
    const previas = (porId.get(id)?.depende_de ?? []).filter((d) => porId.has(d.id))
    const c = previas.length === 0 ? 1 : 1 + Math.max(...previas.map((d) => calcular(d.id)))
    visitando.delete(id)
    columna.set(id, c)
    return c
  }
  for (const t of tareas) calcular(t.id)
  return columna
}

/** Las tareas a las que todavía espera (sin terminar). */
export function esperaA(t: Pick<TareaMatriz, 'depende_de'>): string[] {
  return (t.depende_de ?? []).filter((d) => !d.hecha).map((d) => d.titulo)
}
