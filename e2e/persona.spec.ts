import { expect, test, type Page } from '@playwright/test'
import { limpiar, unico } from './utiles'

// Fase 7: "¿Quién soy?" (PIN opcional), resaltado, "Mis tareas", autoría.
const globo = (page: Page, titulo: string) =>
  page.getByTestId('co-globo').filter({ hasText: titulo })

async function persona(page: Page, nombre: string) {
  const r = await page.request.post('/api/personas', { data: { nombre } })
  expect(r.status()).toBe(201)
  return ((await r.json()) as { id: string }).id
}

test.afterEach(({ request }) => limpiar(request))

test('sin persona elegida, crear pide "¿Quién soy?" y queda como autora', async ({ page }) => {
  const nombre = unico('Ana')
  const titulo = unico('Con autora')
  await persona(page, nombre)
  await page.goto('/')
  await expect(page.getByRole('button', { name: '¿Quién soy?' })).toBeVisible()

  await page.keyboard.press('n')
  const quien = page.getByRole('dialog', { name: '¿Quién soy?' })
  await expect(quien.getByText('Para crear una tarea, elegí quién sos.')).toBeVisible()
  await quien.getByRole('button', { name: nombre }).click()

  // Elegida la persona, sigue con lo que se quería hacer.
  const alta = page.getByRole('dialog', { name: 'Nueva tarea' })
  await alta.getByLabel('Título').fill(titulo)
  await alta
    .getByRole('radiogroup', { name: 'Importante' })
    .getByRole('radio', { name: 'No' })
    .click()
  await alta.getByRole('button', { name: 'Crear tarea' }).click()

  await page.getByRole('button', { name: `Abrir ${titulo}` }).click()
  const detalle = page.getByRole('dialog', { name: titulo })
  await expect(detalle.getByText(`por ${nombre}`)).toBeVisible()
  await expect(detalle.getByRole('listitem').filter({ hasText: 'Creó la tarea' })).toContainText(
    nombre,
  )
  await detalle.getByRole('button', { name: 'Cerrar' }).click()

  // Se recuerda en este dispositivo.
  await page.reload()
  await expect(page.getByRole('button', { name: `Sos ${nombre}. Cambiar` })).toBeVisible()
})

test('PIN opcional: se pone, se pide al elegirse y se puede quitar', async ({ page }) => {
  const nombre = unico('Beto')
  await persona(page, nombre)
  await page.goto('/')
  await page.getByRole('button', { name: '¿Quién soy?' }).click()
  const quien = page.getByRole('dialog', { name: '¿Quién soy?' })
  await quien.getByRole('button', { name: nombre }).click()

  // Poner PIN.
  await page.getByRole('button', { name: `Sos ${nombre}. Cambiar` }).click()
  await quien.getByRole('button', { name: 'Poner un PIN' }).click()
  await quien.getByLabel('PIN nuevo (de 4 a 8 números)').fill('2468')
  await quien.getByRole('button', { name: 'Guardar PIN' }).click()
  await expect(quien.getByRole('button', { name: 'Cambiar o quitar mi PIN' })).toBeVisible()

  // Dejar de ser y volver a elegirse: pide el PIN.
  await quien.getByRole('button', { name: `Dejar de ser ${nombre}` }).click()
  await page.getByRole('button', { name: '¿Quién soy?' }).click()
  await quien.getByRole('button', { name: nombre }).click()
  await quien.getByLabel('PIN').fill('1111')
  await quien.getByRole('button', { name: 'Entrar' }).click()
  await expect(quien.getByRole('alert')).toHaveText('PIN incorrecto')
  await quien.getByLabel('PIN').fill('2468')
  await quien.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('button', { name: `Sos ${nombre}. Cambiar` })).toBeVisible()

  // Quitarlo exige el actual.
  await page.getByRole('button', { name: `Sos ${nombre}. Cambiar` }).click()
  await quien.getByRole('button', { name: 'Cambiar o quitar mi PIN' }).click()
  await quien.getByLabel('PIN actual').fill('2468')
  await quien.getByRole('button', { name: 'Quitar PIN' }).click()
  await expect(quien.getByRole('button', { name: 'Poner un PIN' })).toBeVisible()
})

test('resaltar: las tareas propias se marcan y las demás se atenúan; un toque lo apaga', async ({
  page,
}) => {
  const nombre = unico('Caro')
  const id = await persona(page, nombre)
  const mia = unico('Mía')
  const ajena = unico('Ajena')
  await page.request.post('/api/tareas', {
    data: { tarea: { titulo: mia, importante: true }, responsables: [id] },
  })
  await page.request.post('/api/tareas', { data: { tarea: { titulo: ajena, importante: true } } })
  await page.goto('/')
  await page.getByRole('button', { name: '¿Quién soy?' }).click()
  await page
    .getByRole('dialog', { name: '¿Quién soy?' })
    .getByRole('button', { name: nombre })
    .click()

  await expect(globo(page, mia)).toHaveAttribute('data-propia', 'true')
  await expect(globo(page, ajena)).toHaveAttribute('data-ajena', 'true')
  const boton = page.getByRole('button', { name: 'Resaltar mis tareas' })
  await expect(boton).toHaveAttribute('aria-pressed', 'true')
  await boton.click()
  await expect(globo(page, ajena)).not.toHaveAttribute('data-ajena')
  await expect(boton).toHaveAttribute('aria-pressed', 'false')
})

test('"Mis tareas": paso a paso con checklist, ahora / sigue y línea del día', async ({ page }) => {
  const nombre = unico('Dani')
  const id = await persona(page, nombre)
  const otro = await persona(page, unico('Otro'))
  const en = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()
  const primera = unico('Primera')
  const segunda = unico('Segunda')
  await page.request.post('/api/tareas', {
    data: {
      tarea: { titulo: segunda, importante: true, fecha_entrega: en(30) },
      responsables: [id],
    },
  })
  await page.request.post('/api/tareas', {
    data: {
      tarea: { titulo: primera, importante: true, fecha_entrega: en(0.75), fecha_inicio: en(-0.5) },
      subtareas: [
        { titulo: 'Cortar', responsable_id: id },
        { titulo: 'Imprimir', responsable_id: otro },
      ],
    },
  })
  await page.goto('/')
  await page.getByRole('button', { name: '¿Quién soy?' }).click()
  await page
    .getByRole('dialog', { name: '¿Quién soy?' })
    .getByRole('button', { name: nombre })
    .click()
  await page.getByRole('button', { name: 'Mis tareas', exact: true }).click()

  const mis = page.getByRole('dialog', { name: `Mis tareas · ${nombre}` })
  const ahora = mis.getByRole('region', { name: 'Qué hacer ahora' })
  await expect(ahora).toContainText(primera)
  await expect(ahora).toContainText(segunda)
  // La entrega de hoy está en la línea del día; la de mañana, no.
  const linea = mis.getByRole('list').filter({ has: page.locator('.co-linea__fila') })
  await expect(linea.getByText(primera)).toBeVisible()
  await expect(linea.getByText(segunda)).toHaveCount(0)

  // Paso a paso, en orden de entrega, con quién hace cada paso.
  const pasos = mis.locator('.co-mi-tarea')
  await expect(pasos.first()).toContainText(primera)
  const paso = pasos.first().locator('.co-paso').filter({ hasText: 'Cortar' })
  await expect(paso).toContainText('Vos')
  await expect(pasos.first().locator('.co-paso').filter({ hasText: 'Imprimir' })).toContainText(
    'Otro',
  )
  await paso.getByRole('checkbox').check()
  await expect(pasos.first()).toContainText('1/2 pasos')
})
