import { expect, test, type Page } from '@playwright/test'
import { identificarse, limpiar, unico } from './utiles'

// Fase 13: espacio "Órdenes de trabajo" (comandas colgadas) y OT abierta.
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

test('OT colgada: se abre completa, se le agregan tareas y sale al entregarla', async ({
  page,
}) => {
  const titulo = unico('OT Vidriera')
  const tarea = unico('Medir vidriera')
  const nueva = unico('Colocar vinilo')
  await identificarse(page)
  const ot = await crear(page, {
    tarea: { titulo, saldo: 7500 },
    cliente: { nombre_apellido: 'Ana Comanda', telefono: '2990001234' },
  })
  creadas.push(ot)
  creadas.push(await crear(page, { tarea: { titulo: tarea, nivel_importancia: 7, pedido_id: ot } }))
  await page.goto('/')

  // La OT no está en la matriz: está en "Órdenes de trabajo".
  await expect(page.getByTestId('co-matriz')).toBeVisible()
  await expect(
    page.getByTestId('co-matriz').getByRole('heading', { level: 3, name: titulo, exact: true }),
  ).toHaveCount(0)
  await page.getByRole('tab', { name: 'Órdenes de trabajo' }).click()
  const comanda = page.getByRole('button', { name: `Abrir la orden de trabajo ${titulo}` })
  await expect(comanda).toContainText('Ana Comanda')
  await expect(comanda).toContainText('0/1 tareas hechas')
  await comanda.click()

  // A la izquierda la OT completa; a la derecha sus tareas.
  const ventana = page.getByRole('dialog', { name: titulo })
  const ficha = ventana.getByRole('article', { name: 'Orden de trabajo completa' })
  await expect(ficha).toContainText('Ana Comanda')
  await expect(ficha).toContainText('2990001234')
  await expect(ventana.getByRole('button', { name: new RegExp(tarea) })).toBeVisible()

  // Nueva tarea: el formulario ya viene con esta OT como pedido relacionado.
  await ventana.getByRole('button', { name: 'Nueva tarea' }).click()
  const alta = page.getByRole('dialog', { name: 'Nueva tarea' })
  await expect(alta.getByLabel('Pedido relacionado')).toHaveValue(ot)
  await alta.getByLabel('Título').fill(nueva)
  await alta.getByRole('button', { name: 'Crear tarea' }).click()
  await expect(ventana.getByRole('button', { name: new RegExp(nueva) })).toBeVisible()

  // Tocar una tarea abre su detalle (por encima de la OT).
  await ventana.getByRole('button', { name: new RegExp(tarea) }).click()
  await expect(page.getByRole('dialog', { name: tarea })).toBeVisible()
  await page.getByRole('dialog', { name: tarea }).getByRole('button', { name: 'Cerrar' }).click()

  // Terminar y entregar: deja de estar colgada.
  const acciones = ventana.getByRole('group', { name: 'Acciones de la orden' })
  await acciones.getByRole('button', { name: 'Terminar' }).click()
  await page
    .getByRole('dialog', { name: '¿Terminar esta tarea?' })
    .getByRole('button', { name: 'Terminar' })
    .click()
  await acciones.getByRole('button', { name: 'Entregada' }).click()
  await page
    .getByRole('dialog', { name: '¿Marcar como entregada?' })
    .getByRole('button', { name: 'Entregada' })
    .click()
  await expect(ventana).toHaveCount(0)
  await expect(comanda).toHaveCount(0)
})
