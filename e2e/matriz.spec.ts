import { expect, test, type Page } from '@playwright/test'

// La matriz con datos de demostración (solo existe en desarrollo, `?demo`).
const cuadrante = (page: Page, id: string) => page.locator(`[data-cuadrante="${id}"]`)
const globo = (page: Page, titulo: string) =>
  page.getByTestId('co-globo').filter({ hasText: titulo })

test.describe('matriz', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?demo')
    await expect(page.getByTestId('co-matriz')).toBeVisible()
  })

  test('cada tarea queda en su cuadrante', async ({ page }) => {
    await expect(cuadrante(page, 'hacer').getByText('Vinilo vidriera')).toBeVisible()
    await expect(cuadrante(page, 'planificar').getByText('Ordenar depósito de papel')).toBeVisible()
    await expect(cuadrante(page, 'delegar').getByText('Fotocopias B/N 200 juegos')).toBeVisible()
    await expect(cuadrante(page, 'eliminar').getByText('Pedido de resmas')).toBeVisible()
  })

  test('disposición: urgente a la derecha, importante arriba', async ({ page }) => {
    const caja = async (id: string) => (await cuadrante(page, id).boundingBox())!
    const [hacer, planificar, delegar, eliminar] = await Promise.all(
      ['hacer', 'planificar', 'delegar', 'eliminar'].map(caja),
    )
    expect(hacer.x).toBeGreaterThan(planificar.x)
    expect(delegar.x).toBeGreaterThan(eliminar.x)
    expect(hacer.y).toBeLessThan(delegar.y)
    expect(planificar.y).toBeLessThan(eliminar.y)
  })

  test('aspectos de vencida, terminada y en espera', async ({ page }) => {
    await expect(globo(page, 'Vinilo vidriera')).toHaveAttribute('data-aspecto', 'vencida')
    await expect(globo(page, 'Vinilo vidriera')).toContainText('Vencida hace')
    await expect(globo(page, 'Tarjetas personales')).toHaveAttribute('data-aspecto', 'terminada')
    await expect(globo(page, 'Stickers troquelados')).toHaveAttribute('data-aspecto', 'en_espera')
  })

  test('ordena por urgencia dentro del cuadrante', async ({ page }) => {
    const titulos = await cuadrante(page, 'hacer')
      .getByRole('heading', { level: 3 })
      .allTextContents()
    expect(titulos[0]).toBe('Vinilo vidriera')
  })

  test('ampliar un cuadrante y volver con Esc', async ({ page }) => {
    await cuadrante(page, 'hacer').getByRole('button', { name: /^Urgente e importante/ }).click()
    await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Volver' })).toHaveCount(0)
  })

  test('con muchas tareas achica los globos y muestra "+N"', async ({ page }) => {
    await page.goto('/?demo=muchas')
    const mas = page.getByRole('button', { name: /tareas más en Urgente e importante/ })
    await expect(mas).toBeVisible()
    await mas.click()
    await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible()
  })

  test('sin scroll horizontal', async ({ page }) => {
    const extra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(extra).toBe(0)
  })
})

test('en celular se ve como lista agrupada', async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const page = await contexto.newPage()
  await page.goto('/?demo')
  await expect(page.locator('.co-matriz-lista')).toBeVisible()
  const hacer = (await cuadrante(page, 'hacer').boundingBox())!
  const planificar = (await cuadrante(page, 'planificar').boundingBox())!
  // Sin superponerse: planificar empieza debajo de donde termina hacer.
  expect(planificar.y).toBeGreaterThanOrEqual(hacer.y + hacer.height)
  await contexto.close()
})

test('sin sesión pide ingresar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ingresar' })).toBeVisible()
})
