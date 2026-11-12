import { expect, test } from '@playwright/test'
import { identificarse, limpiar, unico } from './utiles'

// Fase 9: menú del borde, historial global, configuración completa y respaldo.
test.afterEach(({ request }) => limpiar(request))

test('el menú del borde abre el historial, que filtra por tarea', async ({ page }) => {
  const titulo = unico('Folletos historial')
  await identificarse(page)
  const r = await page.request.post('/api/tareas', {
    data: { tarea: { titulo, importante: true } },
  })
  expect(r.status()).toBe(201)
  await page.goto('/')

  // En reposo no se ve; la pestaña del borde lo abre (sin depender del hover).
  const menu = page.getByRole('navigation', { name: 'Herramientas' })
  await expect(menu).toBeHidden()
  await page.getByRole('button', { name: 'Herramientas' }).click()
  await menu.getByRole('button', { name: 'Historial' }).click()

  const historial = page.getByRole('dialog', { name: 'Historial' })
  await historial.getByLabel('Buscar').fill(titulo)
  await historial.getByLabel('Buscar').press('Enter')
  const fila = historial.getByRole('listitem').filter({ hasText: 'Creó la tarea' })
  await expect(fila).toHaveCount(1)
  await fila.getByRole('button', { name: titulo }).click()
  await expect(
    historial.getByRole('button', { name: `Quitar el filtro de la tarea ${titulo}` }),
  ).toBeVisible()
  await expect(fila).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(historial).toHaveCount(0)
})

test('configuración: categoría nueva, desactivarla y exportar respaldo', async ({ page }) => {
  const categoria = unico('Sublimación')
  await page.goto('/')
  await page.getByRole('button', { name: 'Configuración' }).first().click()
  const config = page.getByRole('dialog', { name: 'Configuración' })

  await config.getByLabel('Nombre de la categoría nueva').fill(categoria)
  await config.getByRole('button', { name: 'Agregar categoría' }).click()
  const nombre = config.getByLabel(`Nombre de la categoría ${categoria}`)
  await expect(nombre).toHaveValue(categoria)
  const fila = config
    .getByRole('listitem')
    .filter({ has: page.getByLabel(`Nombre de la categoría ${categoria}`) })
  await fila.getByLabel('Activa').click()
  await expect(fila.getByLabel('Activa')).not.toBeChecked()
  const catalogos = (await (await page.request.get('/api/catalogos')).json()) as {
    categorias: { nombre: string }[]
  }
  expect(catalogos.categorias.some((c) => c.nombre === categoria)).toBe(false)

  const descarga = page.waitForEvent('download')
  await config.getByRole('button', { name: 'Exportar respaldo' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toMatch(/^todocopias-respaldo-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(config.getByText('Respaldo descargado.')).toBeVisible()
})
