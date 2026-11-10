import { expect, test, type Page } from '@playwright/test'
import { limpiar, unico } from './utiles'

// Tiempo real y conexión (especificación 8 y Fase 4).
const cuadrante = (page: Page, id: string) => page.locator(`[data-cuadrante="${id}"]`)
const globo = (page: Page, titulo: string) =>
  page.getByTestId('co-globo').filter({ hasText: titulo })

async function abrir(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('co-matriz')).toBeVisible()
}

test.afterEach(({ request }) => limpiar(request))

test('dos navegadores se sincronizan en menos de 1 segundo', async ({ browser }) => {
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()])
  const [pa, pb] = await Promise.all([a.newPage(), b.newPage()])
  await Promise.all([abrir(pa), abrir(pb)])

  // Alta en A → aparece en B.
  const titulo = unico('Sincro')
  await pa.keyboard.press('n')
  await pa.getByLabel('Título').fill(titulo)
  await pa.getByRole('radio', { name: 'Sí' }).click()
  await pa.getByRole('dialog').getByRole('button', { name: 'Crear tarea' }).click()
  await expect(globo(pb, titulo)).toBeVisible({ timeout: 1_000 })

  // Edición en B → se mueve de cuadrante en A.
  await expect(cuadrante(pa, 'planificar').getByText(titulo)).toBeVisible()
  await pb.getByRole('button', { name: `Abrir ${titulo}` }).click()
  await pb.getByRole('slider').fill('5')
  await pb.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(cuadrante(pa, 'hacer').getByText(titulo)).toBeVisible({ timeout: 1_000 })

  await Promise.all([a.close(), b.close()])
})

test('corte de red: avisa, bloquea guardar y al volver trae lo que cambió', async ({
  page,
  context,
  request,
}) => {
  await abrir(page)
  await context.setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()

  // Se puede cargar, pero no guardar.
  await page.keyboard.press('n')
  const dialogo = page.getByRole('dialog', { name: 'Nueva tarea' })
  await dialogo.getByLabel('Título').fill('No se guarda')
  await expect(dialogo.getByText(/Lo que cargues queda acá/)).toBeVisible()
  await expect(dialogo.getByRole('button', { name: 'Crear tarea' })).toBeDisabled()

  // Mientras tanto, otra pantalla carga una tarea.
  const titulo = unico('Durante el corte')
  const r = await request.post('/api/tareas', { data: { tarea: { titulo, importante: true } } })
  expect(r.status()).toBe(201)

  await context.setOffline(false)
  await expect(page.getByText('Sin conexión · reconectando')).toHaveCount(0)
  await expect(dialogo.getByRole('button', { name: 'Crear tarea' })).toBeEnabled()
  await dialogo.getByRole('button', { name: 'Cerrar' }).click()
  await dialogo.getByRole('button', { name: 'Descartar' }).click()
  await expect(globo(page, titulo)).toBeVisible()
})

test('alta optimista: se ve al instante y, si el servidor la rechaza, vuelve atrás', async ({
  page,
}) => {
  await abrir(page)
  // El servidor tarda y rechaza el alta.
  await page.route('**/api/tareas', async (ruta) => {
    if (ruta.request().method() !== 'POST') return ruta.fallback()
    await new Promise((ok) => setTimeout(ok, 800))
    await ruta.fulfill({ status: 400, json: { error: 'Datos inválidos' } })
  })

  const titulo = unico('Optimista')
  await page.keyboard.press('n')
  await page.getByLabel('Título').fill(titulo)
  await page.getByRole('radio', { name: 'No' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Crear tarea' }).click()

  // Al instante: la tarea en su cuadrante, marcada como "guardando".
  await expect(cuadrante(page, 'eliminar').getByText(titulo)).toBeVisible({ timeout: 300 })
  await expect(globo(page, titulo)).toHaveAttribute('aria-busy', 'true')

  // Rechazo: desaparece y el formulario vuelve con lo cargado.
  const dialogo = page.getByRole('dialog', { name: 'Nueva tarea' })
  await expect(dialogo.getByRole('alert')).toHaveText('No se pudo guardar: Datos inválidos')
  await expect(dialogo.getByLabel('Título')).toHaveValue(titulo)
  await expect(globo(page, titulo)).toHaveCount(0)
})
