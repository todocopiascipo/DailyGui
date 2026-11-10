import { expect, test, type Page } from '@playwright/test'
import { identificarse, limpiar, unico } from './utiles'

// Fase 5: arrastrar y soltar, tacho, papelera; OT; responsables y atajos.
const cuadrante = (page: Page, id: string) => page.locator(`[data-cuadrante="${id}"]`)
const globo = (page: Page, titulo: string) =>
  page.getByTestId('co-globo').filter({ hasText: titulo })

async function crearPorApi(page: Page, tarea: Record<string, unknown>) {
  const r = await page.request.post('/api/tareas', { data: { tarea } })
  expect(r.status()).toBe(201)
}

async function centro(page: Page, selector: string) {
  const caja = (await page.locator(selector).first().boundingBox())!
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 }
}

/**
 * Arrastre con mouse, en pasos (como una persona). Las otras pruebas corren a
 * la vez y agregan tareas: si entre medir y apretar los globos se reacomodaron
 * y se levantó otro, se suelta con Esc y se vuelve a intentar.
 */
async function arrastrar(
  page: Page,
  titulo: string,
  hasta: () => Promise<{ x: number; y: number }>,
) {
  for (let intento = 0; intento < 5; intento++) {
    const desde = await centro(page, `[data-testid="co-globo"]:has-text("${titulo}")`)
    await page.mouse.move(desde.x, desde.y)
    await page.mouse.down()
    await page.mouse.move(desde.x + 20, desde.y + 10, { steps: 4 })
    const levantado = (await page.locator('.co-fantasma').textContent()) ?? ''
    if (!levantado.includes(titulo)) {
      await page.keyboard.press('Escape')
      await page.mouse.up()
      continue
    }
    const destino = await hasta()
    await page.mouse.move(destino.x, destino.y, { steps: 12 })
    await page.mouse.up()
    return
  }
  throw new Error(`No se pudo levantar "${titulo}"`)
}

test.afterEach(({ request }) => limpiar(request))

test.beforeEach(async ({ page }) => {
  await identificarse(page)
  await page.goto('/')
  await expect(page.getByTestId('co-matriz')).toBeVisible()
})

test('mover a otro cuadrante cambia importancia y urgencia, y queda en el historial', async ({
  page,
}) => {
  const titulo = unico('Mover')
  await crearPorApi(page, { titulo, importante: false })
  await expect(cuadrante(page, 'eliminar').getByText(titulo)).toBeVisible()

  await arrastrar(page, titulo, () => centro(page, '[data-cuadrante="hacer"]'))
  await expect(cuadrante(page, 'hacer').getByText(titulo)).toBeVisible()

  // Queda guardado (no es solo visual) y registrado.
  await page.reload()
  await expect(cuadrante(page, 'hacer').getByText(titulo)).toBeVisible()
  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  const panel = page.getByRole('dialog', { name: titulo })
  await expect(panel.getByText('Movió la tarea de cuadrante')).toBeVisible()
  await expect(panel.getByText('Urgencia: 3 (manual)')).toBeVisible()
})

test('soltar en el mismo cuadrante no cambia nada; un toque sigue abriendo el detalle', async ({
  page,
}) => {
  const titulo = unico('Quieta')
  await crearPorApi(page, { titulo, importante: true })
  await arrastrar(page, titulo, () => centro(page, '[data-cuadrante="planificar"]'))
  await expect(cuadrante(page, 'planificar').getByText(titulo)).toBeVisible()
  // Soltar no abre el detalle...
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // ...pero tocarlo sí.
  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  await expect(page.getByRole('dialog', { name: titulo })).toBeVisible()
})

test('tacho: aparece al arrastrar, pide confirmación y la papelera permite restaurar', async ({
  page,
}) => {
  const titulo = unico('Tacho')
  await crearPorApi(page, { titulo, importante: true })
  await expect(page.locator('[data-papelera]')).toHaveCount(0)

  // Cancelar: la tarea sigue.
  await arrastrar(page, titulo, async () => {
    await expect(page.locator('[data-papelera]')).toBeVisible()
    return centro(page, '[data-papelera]')
  })
  const confirmar = page.getByRole('dialog', { name: '¿Eliminar esta tarea?' })
  await expect(
    confirmar.getByText('Podrás recuperarla desde Configuración › Papelera durante 30 días.'),
  ).toBeVisible()
  await confirmar.getByRole('button', { name: 'Cancelar' }).click()
  await expect(globo(page, titulo)).toBeVisible()

  // Eliminar.
  await arrastrar(page, titulo, () => centro(page, '[data-papelera]'))
  await confirmar.getByRole('button', { name: 'Eliminar' }).click()
  await expect(globo(page, titulo)).toHaveCount(0)

  // Configuración › Papelera › Restaurar.
  await page.getByRole('button', { name: 'Configuración' }).click()
  const config = page.getByRole('dialog', { name: 'Configuración' })
  await config.getByRole('button', { name: `Restaurar ${titulo}` }).click()
  await expect(config.getByRole('button', { name: `Restaurar ${titulo}` })).toHaveCount(0)
  await config.getByRole('button', { name: 'Cerrar' }).click()
  await expect(globo(page, titulo)).toBeVisible()
})

test('eliminar desde el detalle y borrar definitivamente desde la papelera', async ({ page }) => {
  const titulo = unico('Definitiva')
  await crearPorApi(page, { titulo, importante: false })
  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  await page.getByRole('dialog', { name: titulo }).getByRole('button', { name: 'Eliminar' }).click()
  await page
    .getByRole('dialog', { name: '¿Eliminar esta tarea?' })
    .getByRole('button', { name: 'Eliminar' })
    .click()
  await expect(globo(page, titulo)).toHaveCount(0)

  await page.getByRole('button', { name: 'Configuración' }).click()
  const config = page.getByRole('dialog', { name: 'Configuración' })
  await config.getByRole('button', { name: `Borrar definitivamente ${titulo}` }).click()
  await page
    .getByRole('dialog', { name: '¿Borrar definitivamente?' })
    .getByRole('button', { name: 'Borrar' })
    .click()
  await expect(config.getByText(titulo)).toHaveCount(0)
})

test('táctil: mantener presionado levanta el globo; deslizar rápido no', async ({ page }) => {
  const titulo = unico('Tactil')
  await crearPorApi(page, { titulo, importante: false })
  const { x, y } = await centro(page, `[data-testid="co-globo"]:has-text("${titulo}")`)
  const destino = await centro(page, '[data-cuadrante="planificar"]')

  /** Gestos táctiles con eventos de puntero (como los manda el iPad). */
  const gesto = (espera: number, mover: { x: number; y: number }) =>
    page.evaluate(
      async ({ titulo, x, y, espera, mover }) => {
        const el = [...document.querySelectorAll<HTMLElement>('[data-testid="co-globo"]')].find(
          (g) => g.textContent?.includes(titulo),
        )!
        const ev = (tipo: string, px: number, py: number) =>
          new PointerEvent(tipo, {
            pointerId: 7,
            pointerType: 'touch',
            clientX: px,
            clientY: py,
            bubbles: true,
          })
        el.dispatchEvent(ev('pointerdown', x, y))
        await new Promise((ok) => setTimeout(ok, espera))
        for (let i = 1; i <= 10; i++) {
          const px = x + ((mover.x - x) * i) / 10
          const py = y + ((mover.y - y) * i) / 10
          window.dispatchEvent(ev('pointermove', px, py))
          await new Promise((ok) => setTimeout(ok, 16))
        }
        window.dispatchEvent(ev('pointerup', mover.x, mover.y))
      },
      { titulo, x, y, espera, mover },
    )

  // Desliza enseguida: es un desplazamiento, no se mueve.
  await gesto(50, destino)
  await expect(cuadrante(page, 'eliminar').getByText(titulo)).toBeVisible()

  // Mantiene presionado y después arrastra: se mueve.
  await gesto(450, destino)
  await expect(cuadrante(page, 'planificar').getByText(titulo)).toBeVisible()
})

test('orden de trabajo: con la forma de la OT de papel', async ({ page }) => {
  const detalle = unico('Vinilo vidriera')
  await page.getByRole('button', { name: 'Crear orden de trabajo' }).click()
  const ot = page.getByRole('dialog', { name: 'Orden de trabajo' })
  await expect(ot.locator('.co-ot__titulo')).toHaveText('Orden de trabajo')
  // La fecha de inicio arranca en hoy.
  await expect(ot.getByLabel('Fecha inicio: día')).not.toHaveValue('')
  await ot.getByLabel('Fecha límite: día').fill('2030-01-15')
  await ot.getByLabel('Fecha límite: hora').fill('12:00')
  await ot.getByLabel('Detalle').fill(`${detalle}\nCorte y colocación`)
  await ot.getByLabel('Seña', { exact: true }).fill('5.000')
  await ot
    .getByRole('group', { name: 'Medio de pago: Seña' })
    .getByRole('button', { name: 'Efectivo' })
    .click()
  await ot.getByLabel('Debe', { exact: true }).fill('7500')
  await expect(ot.getByText('Total (seña + debe): $ 12.500')).toBeVisible()
  await ot.getByLabel('Celular').fill('2991234567')
  await ot.getByLabel('Nombre', { exact: true }).fill('Cliente OT')
  await ot
    .getByRole('radiogroup', { name: 'Importante' })
    .getByRole('radio', { name: 'Sí' })
    .click()
  await ot.getByRole('button', { name: 'Crear OT' }).click()

  // La primera línea del detalle es el título.
  await expect(cuadrante(page, 'planificar').getByText(detalle)).toBeVisible()
  await page.getByRole('button', { name: `Abrir ${detalle}` }).click()
  const panel = page.getByRole('dialog', { name: detalle })
  await expect(panel.getByLabel('Descripción')).toHaveValue(`${detalle}\nCorte y colocación`)
  await expect(panel.getByLabel('Seña', { exact: true })).toHaveValue('5000')
  await expect(
    panel
      .getByRole('group', { name: 'Medio de pago: Seña' })
      .getByRole('button', { name: 'Efectivo' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByLabel('Teléfono')).toHaveValue('2991234567')
})

test('responsables: buscar elige a la persona existente en vez de duplicarla', async ({ page }) => {
  const nombre = unico('Responsable')
  await page.request.post('/api/personas', { data: { nombre } })
  await page.keyboard.press('n')
  const dialogo = page.getByRole('dialog', { name: 'Nueva tarea' })
  await dialogo.getByRole('button', { name: 'Persona', exact: true }).click()
  await dialogo.getByLabel('Nombre de la persona').fill(nombre.toUpperCase())
  await expect(dialogo.getByRole('button', { name: `Elegir ${nombre}` })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(dialogo.getByRole('button', { name: nombre, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const catalogos = await (await page.request.get('/api/catalogos')).json()
  expect(catalogos.personas.filter((p: { nombre: string }) => p.nombre === nombre)).toHaveLength(1)
})

test('todas las fechas tienen los atajos Hoy, Mañana, +1 h, +2 h y +4 h', async ({ page }) => {
  await page.keyboard.press('n')
  const dialogo = page.getByRole('dialog', { name: 'Nueva tarea' })
  await dialogo.getByRole('button', { name: 'Más datos' }).click()
  for (const campo of ['entrega', 'hora de inicio']) {
    const atajos = dialogo.getByRole('group', { name: `Atajos de ${campo}` })
    for (const a of ['Hoy', 'Mañana', '+1 h', '+2 h', '+4 h']) {
      await expect(atajos.getByRole('button', { name: a, exact: true })).toBeVisible()
    }
  }
  await dialogo
    .getByRole('group', { name: 'Atajos de hora de inicio' })
    .getByRole('button', { name: 'Hoy' })
    .click()
  await expect(dialogo.getByLabel('Hora de inicio: día')).not.toHaveValue('')
})
