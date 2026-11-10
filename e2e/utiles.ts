import { test, type APIRequestContext, type Page } from '@playwright/test'

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
  // Lo terminado y lo entregado (que ya no está en la matriz) también.
  const hechas = (await (await request.get('/api/hechas?desde=1970-01-01T00:00:00Z')).json()) as {
    terminadas: { id: string; titulo: string }[]
    entregadas: { id: string; titulo: string }[]
  }
  const propias = [...tareas, ...hechas.terminadas, ...hechas.entregadas].filter((t) =>
    t.titulo.includes(s),
  )
  for (const t of new Map(propias.map((t) => [t.id, t])).values()) {
    await request.post(`/api/tareas/${t.id}/eliminar`)
    await request.delete(`/api/tareas/${t.id}`)
  }
  for (const t of papelera.filter((t) => t.titulo.includes(s))) {
    await request.delete(`/api/tareas/${t.id}`)
  }
}

const PERSONA_DE_PRUEBA = 'Equipo de pruebas'

/**
 * Deja elegida una persona en este navegador ("¿Quién soy?"), como si ya se
 * hubiera identificado, y sin resaltar (para no atenuar globos ajenos).
 * Llamar antes de `page.goto`.
 */
export async function identificarse(page: Page): Promise<string> {
  const r = await page.request.post('/api/personas', { data: { nombre: PERSONA_DE_PRUEBA } })
  const id = r.ok()
    ? ((await r.json()) as { id: string }).id
    : (
        (await (await page.request.get('/api/catalogos')).json()) as {
          personas: { id: string; nombre: string }[]
        }
      ).personas.find((p) => p.nombre === PERSONA_DE_PRUEBA)!.id
  await page.addInitScript((id) => {
    window.localStorage.setItem('co-persona-activa', id)
    window.localStorage.setItem('co-resaltar-mias', 'no')
  }, id)
  return id
}
