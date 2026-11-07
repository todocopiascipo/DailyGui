import { expect, test } from '@playwright/test'

test('la pantalla carga con el fondo y la tipografía de marca', async ({ page }) => {
  await page.goto('/')
  const raiz = page.getByTestId('co-raiz')
  await expect(raiz).toBeVisible()

  const estilos = await raiz.evaluate((el) => {
    const s = getComputedStyle(el)
    return { fuente: s.fontFamily, fondo: s.backgroundImage, color: s.color }
  })
  expect(estilos.fuente).toContain('Plus Jakarta Sans')
  expect(estilos.fondo).toContain('linear-gradient')
  expect(estilos.color).toBe('rgb(255, 255, 255)')

  // La fuente se sirve localmente y termina de cargar.
  const cargada = await page.evaluate(async () => {
    await document.fonts.ready
    return document.fonts.check('400 16px "Plus Jakarta Sans"')
  })
  expect(cargada).toBe(true)

  // Sin scroll horizontal.
  const anchoExtra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(anchoExtra).toBe(0)
})
