import { expect, test, type Page } from '@playwright/test'
import { identificarse, limpiar, unico } from './utiles'

// Fase 6: terminar, entregar, devolver, hechas hoy, copiar mensaje.
const cuadrante = (page: Page, id: string) => page.locator(`[data-cuadrante="${id}"]`)
const globo = (page: Page, titulo: string) =>
  page.getByTestId('co-globo').filter({ hasText: titulo })

async function crearPorApi(page: Page, cuerpo: Record<string, unknown>) {
  const r = await page.request.post('/api/tareas', { data: cuerpo })
  expect(r.status()).toBe(201)
  return ((await r.json()) as { tarea: { id: string } }).tarea.id
}

async function menu(page: Page, titulo: string, opcion: string) {
  await globo(page, titulo).hover()
  await page.getByRole('button', { name: `Opciones de ${titulo}` }).click()
  // Abrir el menú no corre la matriz (el panel escondido no debe desplazarla).
  expect(await page.evaluate(() => document.querySelector('.co-app')!.scrollLeft)).toBe(0)
  await page.getByRole('menu').getByRole('menuitem', { name: opcion }).click()
}

async function abrirHechas(page: Page) {
  await page.getByRole('button', { name: /^Hechas hoy/ }).click()
  return page.getByRole('complementary', { name: 'Hechas hoy' })
}

test.afterEach(({ request }) => limpiar(request))

test.beforeEach(async ({ page }) => {
  await identificarse(page)
  await page.goto('/')
  await expect(page.getByTestId('co-matriz')).toBeVisible()
})

test('ciclo completo de un pedido: terminar, entregar y devolver', async ({ page }) => {
  const titulo = unico('Ciclo')
  await crearPorApi(page, {
    tarea: { titulo, importante: true, saldo: 2500 },
    cliente: { nombre_apellido: 'Cliente Ciclo' },
  })

  // Terminar (menú de tres puntitos) con confirmación: queda azul, en su lugar.
  await menu(page, titulo, 'Terminar')
  const confirmar = page.getByRole('dialog', { name: '¿Terminar esta tarea?' })
  await confirmar.getByRole('button', { name: 'Terminar' }).click()
  await expect(globo(page, titulo)).toHaveAttribute('data-aspecto', 'terminada')
  await expect(globo(page, titulo)).toContainText('Terminada')
  await expect(page.getByRole('status').filter({ hasText: 'terminada' })).toBeVisible()

  // "Terminar" pasa a ser "Entregada": sale de la matriz.
  await globo(page, titulo).getByRole('button', { name: 'Entregada' }).click()
  await page
    .getByRole('dialog', { name: '¿Marcar como entregada?' })
    .getByRole('button', { name: 'Entregada' })
    .click()
  await expect(globo(page, titulo)).toHaveCount(0)

  // Está en "Entregados del día"; se devuelve y vuelve a la matriz (terminada).
  const panel = await abrirHechas(page)
  const entregados = panel.getByRole('region', { name: 'Entregados del día' })
  await expect(entregados.getByText(titulo)).toBeVisible()
  await entregados.getByRole('button', { name: `Devolver ${titulo}` }).click()
  await expect(entregados.getByText(titulo)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(globo(page, titulo)).toHaveAttribute('data-aspecto', 'terminada')

  // Todo quedó en el historial.
  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  const detalle = page.getByRole('dialog', { name: titulo })
  await expect(detalle.getByText('Devolvió la tarea al estado anterior')).toBeVisible()
  await expect(detalle.getByText('Cambió el estado: Terminada → Entregada')).toBeVisible()
  await expect(detalle.getByText('Cambió el estado: Pendiente → Terminada')).toBeVisible()

  // Desde el detalle: devolver a pendiente.
  await detalle.getByRole('button', { name: 'Devolver al estado anterior' }).click()
  await expect(detalle.getByRole('button', { name: 'Terminar' })).toBeVisible()
})

test('tarea interna: al terminarla pasa directo a "Terminadas hoy"', async ({ page }) => {
  const titulo = unico('Interna')
  await crearPorApi(page, { tarea: { titulo, importante: false, tipo: 'interna' } })
  await globo(page, titulo).hover()
  await page.getByRole('button', { name: `Opciones de ${titulo}` }).click()
  // Las internas no tienen "Entregada" ni mensaje para el cliente.
  await expect(page.getByRole('menuitem', { name: 'Copiar mensaje' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Terminar' }).click()
  await page
    .getByRole('dialog', { name: '¿Terminar esta tarea?' })
    .getByRole('button', { name: 'Terminar' })
    .click()
  await expect(globo(page, titulo)).toHaveCount(0)

  const panel = await abrirHechas(page)
  await expect(
    panel.getByRole('region', { name: 'Terminadas hoy' }).getByText(titulo),
  ).toBeVisible()
})

test('arrastrar del panel "Hechas hoy" a la matriz la devuelve', async ({ page }) => {
  const titulo = unico('Devolver')
  const id = await crearPorApi(page, { tarea: { titulo, importante: false, tipo: 'interna' } })
  await page.request.post(`/api/tareas/${id}/terminar`)
  await expect(globo(page, titulo)).toHaveCount(0)

  const panel = await abrirHechas(page)
  const item = panel.locator('li').filter({ hasText: titulo })
  await item.scrollIntoViewIfNeeded()
  const desde = (await item.boundingBox())!
  const destino = (await cuadrante(page, 'eliminar').boundingBox())!
  await page.mouse.move(desde.x + 30, desde.y + desde.height / 2)
  await page.mouse.down()
  await page.mouse.move(desde.x + 10, desde.y + desde.height / 2 + 20, { steps: 4 })
  await page.mouse.move(destino.x + destino.width / 2, destino.y + destino.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
  await expect(cuadrante(page, 'eliminar').getByText(titulo)).toBeVisible()
})

test('copiar mensaje y teléfono; confeti y su configuración', async ({ page, context }) => {
  // La configuración es de todo el local: se prueba en un solo proyecto, y al
  // final (aunque algo falle) se deja como estaba.
  test.skip(test.info().project.name !== 'chromium', 'Configuración compartida')
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const portapapeles = () => page.evaluate(() => navigator.clipboard.readText())
    const titulo = unico('Mensaje')
    const otra = unico('Confeti')
    await crearPorApi(page, {
      tarea: { titulo, importante: true, saldo: 3500 },
      cliente: { nombre_apellido: 'Ana Cliente', telefono: '2994445566' },
    })
    await crearPorApi(page, { tarea: { titulo: otra, importante: true } })

    await menu(page, titulo, 'Copiar mensaje')
    await expect(page.getByRole('status').filter({ hasText: 'Mensaje copiado' })).toBeVisible()
    expect(await portapapeles()).toBe(
      `Hola Ana Cliente, tu trabajo "${titulo}" ya está listo para retirar. Saldo pendiente: $ 3.500.`,
    )
    await menu(page, titulo, 'Copiar teléfono')
    expect(await portapapeles()).toBe('2994445566')

    // Al terminar: confeti azul y blanco, que se va solo.
    await menu(page, otra, 'Terminar')
    await page
      .getByRole('dialog', { name: '¿Terminar esta tarea?' })
      .getByRole('button', { name: 'Terminar' })
      .click()
    await expect(page.locator('.co-confeti')).toHaveCount(1)
    await expect(page.locator('.co-confeti')).toHaveCount(0, { timeout: 4000 })

    // Configuración: otra plantilla y sin confeti.
    await page.getByRole('button', { name: 'Configuración' }).click()
    const config = page.getByRole('dialog', { name: 'Configuración' })
    await config.getByLabel('Mensaje para copiar').fill('Listo {trabajo}, debe {saldo}')
    await config.getByRole('button', { name: 'Guardar mensaje' }).click()
    await expect(config.getByRole('button', { name: 'Guardar mensaje' })).toBeDisabled()
    await config.getByRole('switch', { name: 'Confeti al terminar una tarea' }).uncheck()
    await config.getByRole('button', { name: 'Cerrar' }).click()

    await menu(page, titulo, 'Copiar mensaje')
    await expect.poll(portapapeles).toBe(`Listo ${titulo}, debe $ 3.500`)

    await menu(page, titulo, 'Terminar')
    await page
      .getByRole('dialog', { name: '¿Terminar esta tarea?' })
      .getByRole('button', { name: 'Terminar' })
      .click()
    await expect(globo(page, titulo)).toHaveAttribute('data-aspecto', 'terminada')
    await expect(page.locator('.co-confeti')).toHaveCount(0)
  } finally {
    await page.request.put('/api/configuracion/confeti_activado', { data: { valor: true } })
    await page.request.put('/api/configuracion/plantilla_mensaje', {
      data: {
        valor:
          'Hola {nombre}, tu trabajo "{trabajo}" ya está listo para retirar. Saldo pendiente: {saldo}.',
      },
    })
  }
})
