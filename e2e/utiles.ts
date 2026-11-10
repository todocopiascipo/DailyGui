import { test, type APIRequestContext } from '@playwright/test'

/**
 * Las pruebas comparten una base en memoria y corren en paralelo. Cada una usa
 * un sufijo propio en sus títulos y, al terminar, borra lo que creó: así los
 * cuadrantes no se llenan (y no esconden globos detrás de "+N").
 */
export function sufijo(): string {
  const info = test.info()
  // El testId es "<archivo>-<prueba>": la parte final distingue cada prueba.
  return `${info.project.name}-${info.testId.split('-').at(-1)}`
}

export function unico(texto: string): string {
  return `${texto} ${sufijo()}`
}

export async function limpiar(request: APIRequestContext) {
  const s = sufijo()
  const { tareas } = (await (await request.get('/api/matriz')).json()) as {
    tareas: { id: string; titulo: string }[]
  }
  const papelera = (await (await request.get('/api/papelera')).json()) as {
    id: string
    titulo: string
  }[]
  for (const t of tareas.filter((t) => t.titulo.includes(s))) {
    await request.post(`/api/tareas/${t.id}/eliminar`)
    await request.delete(`/api/tareas/${t.id}`)
  }
  for (const t of papelera.filter((t) => t.titulo.includes(s))) {
    await request.delete(`/api/tareas/${t.id}`)
  }
}
