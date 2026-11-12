import { expect, test } from '@playwright/test'
import { identificarse, limpiar, unico } from './utiles'

// Fase 10: modo pantalla y notificaciones con la app abierta.
test.afterEach(({ request }) => limpiar(request))

test('modo pantalla: se activa con ?modo=pantalla y se apaga desde Configuración', async ({
  page,
}) => {
  await page.goto('/?modo=pantalla')
  const contenido = page.locator('.co-contenido')
  await expect(contenido).toHaveAttribute('data-modo-pantalla', 'true')
  // Queda elegido en este dispositivo.
  await page.goto('/')
  await expect(contenido).toHaveAttribute('data-modo-pantalla', 'true')

  await page.getByRole('button', { name: 'Configuración' }).first().click()
  const config = page.getByRole('dialog', { name: 'Configuración' })
  await config.getByRole('checkbox', { name: /Modo pantalla/ }).uncheck()
  await expect(contenido).not.toHaveAttribute('data-modo-pantalla')
})

test('notificación cuando le asignan una tarea a la persona activa', async ({ page }) => {
  const persona = await identificarse(page)
  // Notificaciones permitidas y activadas en este dispositivo; se anotan en vez de mostrarse.
  await page.addInitScript(() => {
    const avisos: { titulo: string; cuerpo: string }[] = []
    ;(window as unknown as { avisos: typeof avisos }).avisos = avisos
    class NotificacionFalsa {
      static permission = 'granted'
      static requestPermission = () => Promise.resolve('granted')
      onclick: (() => void) | null = null
      constructor(titulo: string, opciones?: { body?: string }) {
        avisos.push({ titulo, cuerpo: opciones?.body ?? '' })
      }
      close() {}
    }
    Object.defineProperty(window, 'Notification', { value: NotificacionFalsa })
    window.localStorage.setItem('co-notificaciones', 'si')
  })
  await page.goto('/')
  await expect(page.getByTestId('co-raiz')).toBeVisible()
  // Lo que ya estaba al abrir no avisa.
  await page.waitForTimeout(500)
  const titulo = unico('Para vos')
  const r = await page.request.post('/api/tareas', {
    data: { tarea: { titulo, importante: true }, responsables: [persona] },
  })
  expect(r.status()).toBe(201)
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { avisos: unknown[] }).avisos))
    .toContainEqual({ titulo: 'Tarea asignada', cuerpo: titulo })
})
