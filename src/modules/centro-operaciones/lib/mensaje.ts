/**
 * "Copiar mensaje" (especificación 6.7): aviso listo para pegar en WhatsApp.
 * La plantilla es editable en Configuración, con {nombre}, {trabajo} y {saldo}.
 */

/** Plantilla mínima y neutra propuesta por la especificación (decisión abierta 8). */
export const PLANTILLA_POR_DEFECTO =
  'Hola {nombre}, tu trabajo "{trabajo}" ya está listo para retirar. Saldo pendiente: {saldo}.'

export function formatoPesos(n: number): string {
  return `$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

export function armarMensaje(
  plantilla: string,
  datos: { nombre: string | null; trabajo: string; saldo: number },
): string {
  const texto = plantilla
    .replaceAll('{nombre}', datos.nombre?.trim() ?? '')
    .replaceAll('{trabajo}', datos.trabajo.trim())
    .replaceAll('{saldo}', formatoPesos(datos.saldo))
  // Sin nombre no queda "Hola , …": se ordenan los espacios.
  return texto
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * Copia al portapapeles. Desde el iPad por la red del local (http, sin
 * HTTPS) no existe `navigator.clipboard`: se usa el método clásico, que
 * funciona mientras sea en respuesta a un toque.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    // Se intenta con el método clásico.
  }
  const area = document.createElement('textarea')
  area.value = texto
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  area.setSelectionRange(0, texto.length)
  let ok: boolean
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}
