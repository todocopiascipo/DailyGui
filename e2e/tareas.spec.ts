import { expect, test, type Page } from '@playwright/test'
import { identificarse, limpiar, unico } from './utiles'

// Crear y editar contra el servidor de pruebas (base en memoria compartida por
// los dos proyectos): cada prueba usa nombres únicos.
const cuadrante = (page: Page, id: string) => page.locator(`[data-cuadrante="${id}"]`)
const globo = (page: Page, titulo: string) =>
  page.getByTestId('co-globo').filter({ hasText: titulo })

async function crearPorApi(page: Page, tarea: Record<string, unknown>) {
  const r = await page.request.post('/api/tareas', { data: { tarea } })
  expect(r.status()).toBe(201)
}

test.afterEach(({ request }) => limpiar(request))

test.beforeEach(async ({ page }) => {
  await identificarse(page)
  await page.goto('/')
  await expect(page.getByTestId('co-matriz')).toBeVisible()
})

test('crear una tarea con la tecla N en menos de 15 segundos', async ({ page }) => {
  const titulo = unico('Vinilo')
  const persona = unico('Persona')
  const inicio = Date.now()

  await page.keyboard.press('n')
  const dialogo = page.getByRole('dialog', { name: 'Nueva tarea' })
  await expect(dialogo.getByLabel('Título')).toBeFocused()
  await page.keyboard.type(titulo)
  await dialogo.getByRole('button', { name: 'Persona', exact: true }).click()
  await dialogo.getByLabel('Nombre de la persona').fill(persona)
  await page.keyboard.press('Enter')
  await expect(dialogo.getByRole('button', { name: persona })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await dialogo.getByRole('button', { name: 'Hoy' }).click()
  await dialogo
    .getByRole('radiogroup', { name: 'Importante' })
    .getByRole('radio', { name: 'Sí' })
    .click()
  await dialogo.getByRole('button', { name: 'Crear tarea' }).click()

  await expect(dialogo).toHaveCount(0)
  // Entrega hoy + importante → urgente e importante.
  await expect(cuadrante(page, 'hacer').getByText(titulo)).toBeVisible()
  await expect(globo(page, titulo)).toContainText(persona)
  expect(Date.now() - inicio).toBeLessThan(15_000)
})

test('el formulario avisa lo que falta', async ({ page }) => {
  await page.getByRole('button', { name: 'Crear tarea' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Nueva tarea' })
  await dialogo.getByRole('button', { name: 'Crear tarea' }).click()
  await expect(dialogo.getByText('Escribí un título')).toBeVisible()
  await expect(dialogo.getByText('Elegí si es importante')).toBeVisible()
  // Sin cambios, Esc cierra directo.
  await dialogo.getByLabel('Título').fill('')
  await page.keyboard.press('Escape')
  await expect(dialogo).toHaveCount(0)
})

test('editar en el detalle: importancia, urgencia, cliente y seña', async ({ page }) => {
  const titulo = unico('Folletos')
  await crearPorApi(page, { titulo, importante: false })
  await page.reload()
  await expect(cuadrante(page, 'eliminar').getByText(titulo)).toBeVisible()

  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  const panel = page.getByRole('dialog', { name: titulo })
  await expect(panel.getByText('Urgencia estimada: 1')).toBeVisible()
  await panel.getByRole('radio', { name: 'Sí' }).click()
  await panel.getByRole('slider').fill('4')
  await panel.getByLabel('Cliente (nombre y apellido)').fill('Cliente de prueba')
  await panel.getByLabel('Teléfono').fill('2990000000')
  await panel.getByLabel('Seña', { exact: true }).fill('1.500')
  await panel.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(panel.getByText('Cambios guardados')).toBeVisible()
  await expect(panel.getByText(/Editó/).first()).toBeVisible()
  await panel.getByRole('button', { name: 'Cerrar' }).click()

  // Importante + urgencia manual 4 → urgente e importante.
  await expect(cuadrante(page, 'hacer').getByText(titulo)).toBeVisible()
  await expect(globo(page, titulo)).toHaveAttribute('data-aspecto', 'alta')

  // Lo guardado se ve al volver a abrir.
  await page.reload()
  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  await expect(panel.getByLabel('Cliente (nombre y apellido)')).toHaveValue('Cliente de prueba')
  await expect(panel.getByLabel('Seña', { exact: true })).toHaveValue('1500')
  await expect(panel.getByText('Urgencia: 4 (manual)')).toBeVisible()
})

test('subtareas: agregar y marcar hecha', async ({ page }) => {
  const titulo = unico('Libro')
  await crearPorApi(page, { titulo, importante: true })
  await page.reload()
  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  const panel = page.getByRole('dialog', { name: titulo })
  await panel.getByLabel('Nueva subtarea', { exact: true }).fill('Cortar tapas')
  await page.keyboard.press('Enter')
  await panel.getByRole('checkbox', { name: 'Cortar tapas: hecha' }).check()
  await expect(panel.getByText('Subtareas · 1/1')).toBeVisible()
  await expect(panel.getByText(/Marcó como hecha “Cortar tapas”/)).toBeVisible()
  // Sin cambios pendientes en el formulario, cerrar no pide confirmación.
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(globo(page, titulo).getByLabel('1 de 1 pasos hechos')).toBeVisible()
})

test('tarea interna relacionada con una OT: se ve el pedido y se abre desde el detalle', async ({
  page,
}) => {
  const pedido = unico('OT Vinilo')
  const titulo = unico('Comprar vinilo')
  const r = await page.request.post('/api/tareas', {
    data: {
      tarea: { titulo: pedido, importante: true, saldo: 4000 },
      cliente: { nombre_apellido: 'Cliente OT' },
    },
  })
  expect(r.status()).toBe(201)
  await page.reload()
  await expect(page.getByTestId('co-globo').filter({ hasText: pedido })).toBeVisible()

  await page.getByRole('button', { name: 'Crear tarea' }).click()
  const alta = page.getByRole('dialog', { name: 'Nueva tarea' })
  // El "+" es para tareas internas: sin datos de cliente.
  await expect(alta.getByLabel('Cliente (nombre y apellido)')).toHaveCount(0)
  await alta.getByLabel('Título').fill(titulo)
  await alta.getByLabel('Pedido relacionado').selectOption({ label: `${pedido} · Cliente OT` })
  await alta
    .getByRole('radiogroup', { name: 'Importante' })
    .getByRole('radio', { name: 'No' })
    .click()
  // Urgente "Sí": va a la columna de urgentes aunque no tenga fecha.
  await alta.getByRole('radiogroup', { name: 'Urgente' }).getByRole('radio', { name: 'Sí' }).click()
  await alta.getByRole('button', { name: 'Crear tarea' }).click()

  const globo = page.getByTestId('co-globo').filter({ hasText: titulo })
  await expect(page.locator('[data-cuadrante="delegar"]').getByText(titulo)).toBeVisible()
  await expect(globo).toContainText(pedido)

  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  const detalle = page.getByRole('dialog', { name: titulo })
  await detalle.getByRole('button', { name: `Abrir el pedido "${pedido}"` }).click()
  await expect(page.getByRole('dialog', { name: pedido })).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: pedido }).getByLabel('Saldo (lo que deben)', { exact: true }),
  ).toHaveValue('4000')
})

test('OT: las fechas de inicio y límite van al final', async ({ page }) => {
  await page.getByRole('button', { name: 'Crear orden de trabajo' }).click()
  const ot = page.getByRole('dialog', { name: 'Orden de trabajo' })
  const y = async (etiqueta: string) =>
    (await ot.getByLabel(etiqueta, { exact: true }).boundingBox())!.y
  expect(await y('Detalle')).toBeLessThan(await y('Nombre'))
  expect(await y('Nombre')).toBeLessThan(await y('Fecha inicio: día'))
  expect(await y('Fecha inicio: día')).toBeLessThan(await y('Fecha límite: día'))
  // El detalle es lo primero: arranca con el foco ahí.
  await expect(ot.getByLabel('Detalle')).toBeFocused()
  await expect(ot.getByRole('radiogroup', { name: 'Urgente' })).toBeVisible()
})
