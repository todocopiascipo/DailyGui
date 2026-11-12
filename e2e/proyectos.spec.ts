import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { identificarse, limpiar, unico } from './utiles'

// Fase 8: proyectos internos (decisión 11).
const globo = (page: Page, titulo: string) =>
  page.getByTestId('co-globo').filter({ hasText: titulo })

/** Borra los proyectos de esta prueba y sus tareas (que no siempre están en la matriz). */
async function borrarProyectos(request: APIRequestContext, nombre: string) {
  const lista = (await (await request.get('/api/proyectos')).json()) as {
    id: string
    nombre: string
  }[]
  for (const p of lista.filter((x) => x.nombre === nombre)) {
    const d = (await (await request.get(`/api/proyectos/${p.id}`)).json()) as {
      tareas: { id: string }[]
    }
    for (const t of d.tareas) {
      await request.post(`/api/tareas/${t.id}/eliminar`)
      await request.delete(`/api/tareas/${t.id}`)
    }
    await request.delete(`/api/proyectos/${p.id}`)
  }
}

let proyecto = ''
test.afterEach(async ({ request }) => {
  await limpiar(request)
  if (proyecto) await borrarProyectos(request, proyecto)
})

test('crear un proyecto, sumarle una tarea y mostrarla en la matriz', async ({ page }) => {
  proyecto = unico('Vidriera')
  const tarea = unico('Medir la vidriera')
  await identificarse(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Proyectos' }).click()
  const lista = page.getByRole('dialog', { name: 'Proyectos' })
  await lista.getByLabel('Nombre del proyecto nuevo').fill(proyecto)
  await lista.getByRole('button', { name: 'Crear proyecto' }).click()

  // Se abre el proyecto recién creado.
  const vista = page.getByRole('dialog', { name: proyecto })
  await expect(vista.getByText('Este proyecto todavía no tiene tareas.')).toBeVisible()

  // "Nueva tarea" abre el formulario del "+" con el proyecto ya elegido.
  await vista.getByRole('button', { name: 'Nueva tarea' }).click()
  const alta = page.getByRole('dialog', { name: 'Nueva tarea' })
  await expect(alta.getByLabel('Proyecto')).toHaveValue(/.+/)
  await alta.getByLabel('Título').fill(tarea)
  await alta
    .getByRole('radiogroup', { name: 'Importante' })
    .getByRole('radio', { name: 'No' })
    .click()
  await alta.getByRole('button', { name: 'Crear tarea' }).click()

  // Sin fecha de entrega: queda en el proyecto pero no en la matriz.
  await expect(vista.getByRole('button', { name: `${tarea} Pendiente` })).toBeVisible()
  const mostrar = vista.getByRole('button', { name: `Mostrar "${tarea}" en la matriz` })
  await expect(mostrar).toHaveAttribute('aria-pressed', 'false')
  await expect(globo(page, tarea)).toHaveCount(0)

  // El interruptor la pone en la matriz, con el nombre del proyecto.
  await mostrar.click()
  await expect(mostrar).toHaveAttribute('aria-pressed', 'true')
  await vista.getByRole('button', { name: 'Todos los proyectos' }).click()
  await expect(
    page
      .getByRole('dialog', { name: 'Proyectos' })
      .getByRole('button', { name: new RegExp(proyecto) }),
  ).toContainText('0/1 tareas')
  await page
    .getByRole('dialog', { name: 'Proyectos' })
    .getByRole('button', { name: 'Cerrar' })
    .click()
  await expect(globo(page, tarea)).toContainText(proyecto)
})
