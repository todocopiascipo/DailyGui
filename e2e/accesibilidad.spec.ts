import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { identificarse, limpiar, unico } from './utiles'

// Fase 11: revisión automática de accesibilidad (axe) de las pantallas
// principales. Solo cuentan los problemas serios o críticos.
test.afterEach(({ request }) => limpiar(request))

async function revisar(page: Page, dentro?: string) {
  // Medir con las ventanas ya aparecidas (durante la animación los colores se mezclan).
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((x) => x.effect?.getTiming().iterations !== Infinity)
        .map((x) => x.finished.catch(() => {})),
    ),
  )
  let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  if (dentro) axe = axe.include(dentro)
  const { violations } = await axe.analyze()
  const graves = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id}: ${v.help} → ${v.nodes
          .map((n) => `${n.target.join(' ')} (${(n.failureSummary ?? '').replace(/\s+/g, ' ')})`)
          .join(' | ')}`,
    )
  expect(graves).toEqual([])
}

test('matriz, alta, detalle y vistas sin problemas graves de accesibilidad', async ({ page }) => {
  await identificarse(page)
  const titulo = unico('Accesible')
  await page.request.post('/api/tareas', {
    data: {
      tarea: {
        titulo,
        importante: true,
        fecha_entrega: new Date(Date.now() + 3600e3).toISOString(),
      },
    },
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: `Abrir ${titulo}` })).toBeVisible()
  await revisar(page)

  await page.keyboard.press('n')
  await revisar(page, '[role="dialog"]')
  await page.keyboard.press('Escape')

  await page.keyboard.press('o')
  await revisar(page, '[role="dialog"]')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  // El panel lateral entra deslizándose y aclarándose: medir ya quieto.
  await page.waitForTimeout(1500)
  await revisar(page, '[role="dialog"]')
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()

  for (const vista of ['Proyectos', 'Configuración']) {
    await page.getByRole('button', { name: vista }).first().click()
    await expect(page.getByRole('dialog', { name: vista })).toBeVisible()
    await revisar(page, '[role="dialog"]')
    await page.getByRole('dialog', { name: vista }).getByRole('button', { name: 'Cerrar' }).click()
  }

  await page.getByRole('button', { name: 'Herramientas' }).click()
  await page
    .getByRole('navigation', { name: 'Herramientas' })
    .getByRole('button', { name: 'Historial' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Historial' })).toBeVisible()
  await revisar(page, '[role="dialog"]')
})
