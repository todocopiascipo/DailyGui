import { expect, test, type Page } from '@playwright/test'
import { identificarse, limpiar, unico } from './utiles'

// Fase 14: tareas encadenadas dentro de una orden de trabajo.
async function crear(page: Page, cuerpo: Record<string, unknown>) {
  const r = await page.request.post('/api/tareas', { data: cuerpo })
  expect(r.status()).toBe(201)
  return ((await r.json()) as { tarea: { id: string } }).tarea.id
}

const creadas: string[] = []
test.afterEach(async ({ request }) => {
  await limpiar(request)
  for (const id of creadas.splice(0)) {
    await request.post(`/api/tareas/${id}/eliminar`)
    await request.delete(`/api/tareas/${id}`)
  }
})

test('encadenar manteniendo una tarea encima de otra; en la matriz "espera a"', async ({
  page,
}) => {
  const ot = unico('OT Flujo')
  const medir = unico('Medir')
  const imprimir = unico('Imprimir')
  await identificarse(page)
  const idOt = await crear(page, { tarea: { titulo: ot }, cliente: { nombre_apellido: 'C' } })
  creadas.push(idOt)
  await crear(page, { tarea: { titulo: medir, nivel_importancia: 8, pedido_id: idOt } })
  await crear(page, { tarea: { titulo: imprimir, nivel_importancia: 8, pedido_id: idOt } })
  await page.goto('/')
  await page.getByRole('tab', { name: 'Órdenes de trabajo' }).click()
  await page.getByRole('button', { name: `Abrir la orden de trabajo ${ot}` }).click()
  const ventana = page.getByRole('dialog', { name: ot })
  const primera = ventana.getByRole('region', { name: /^1\.º orden/ })
  await expect(primera.getByText(medir)).toBeVisible()
  await expect(primera.getByText(imprimir)).toBeVisible()

  // Arrastrar "Imprimir" y mantenerla encima de "Medir": se carga la barra y quedan unidas.
  const desde = (await ventana.locator('[data-tarea-flujo]', { hasText: imprimir }).boundingBox())!
  const hasta = (await ventana.locator('[data-tarea-flujo]', { hasText: medir }).boundingBox())!
  await page.mouse.move(desde.x + 30, desde.y + desde.height / 2)
  await page.mouse.down()
  await page.mouse.move(desde.x + 60, desde.y + desde.height / 2, { steps: 4 })
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 10 })
  await expect(ventana.getByText(`"${imprimir}" va a esperar a esta`)).toBeVisible()
  await page.waitForTimeout(2_300)
  await page.mouse.up()

  const segunda = ventana.getByRole('region', { name: '2.º orden' })
  await expect(segunda.getByText(imprimir)).toBeVisible()
  await expect(segunda).toContainText(`Espera a: ${medir}`)

  // Soltar antes de que se llene no enlaza.
  const otra = unico('Cortar')
  await crear(page, { tarea: { titulo: otra, nivel_importancia: 8, pedido_id: idOt } })
  const caja = (await ventana.locator('[data-tarea-flujo]', { hasText: otra }).boundingBox())!
  await page.mouse.move(caja.x + 30, caja.y + caja.height / 2)
  await page.mouse.down()
  await page.mouse.move(caja.x + 60, caja.y + caja.height / 2, { steps: 4 })
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 10 })
  await page.waitForTimeout(500)
  await page.mouse.up()
  await page.waitForTimeout(2_000)
  await expect(primera.getByText(otra)).toBeVisible()

  // En la matriz: "Espera a" y atenuada.
  await ventana.getByRole('button', { name: 'Cerrar' }).click()
  await page.getByRole('tab', { name: 'Tareas' }).click()
  const globo = page.getByTestId('co-globo').filter({ hasText: imprimir })
  await expect(globo).toContainText(`Espera a: ${medir}`)
  await expect(globo).toHaveAttribute('data-espera', 'true')

  // Desde el detalle se quita el enlace.
  await page.getByRole('button', { name: `Abrir ${imprimir}` }).click()
  const detalle = page.getByRole('dialog', { name: imprimir })
  await detalle.getByRole('button', { name: `Dejar de esperar a ${medir}` }).click()
  await expect(detalle.getByText('No espera a ninguna tarea: se puede hacer ya.')).toBeVisible()
  await expect(detalle.getByText('Ya no espera a ninguna tarea')).toBeVisible()
  // Y se vuelve a agregar desde la lista, sin arrastrar.
  await detalle.getByLabel('Agregar: espera a…').selectOption({ label: medir })
  await expect(detalle.getByRole('button', { name: `Dejar de esperar a ${medir}` })).toBeVisible()
})
