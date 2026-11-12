/**
 * Acceso por link secreto (app publicada): el link trae la clave del local en
 * el "#" (https://…/DailyGui/#acceso=CLAVE). Se abre una vez por dispositivo:
 * la clave queda guardada y se saca de la barra de direcciones. Después viaja
 * en cada pedido a Supabase (encabezado x-co-acceso).
 *
 * El "#" no se manda a ningún servidor (ni a GitHub): solo lo lee la app.
 */
const CLAVE = 'co-acceso'

let enMemoria: string | null = null

function guardar(valor: string) {
  enMemoria = valor
  try {
    window.localStorage.setItem(CLAVE, valor)
  } catch {
    // Sin almacenamiento: vale mientras la pantalla esté abierta.
  }
}

/** Lee la clave del link (si vino) y la recuerda; devuelve la clave vigente. */
export function claveDeAcceso(): string | null {
  if (enMemoria) return enMemoria
  if (typeof window === 'undefined') return null
  const enLink = new URLSearchParams(window.location.hash.slice(1)).get('acceso')
  if (enLink) {
    guardar(enLink)
    // Que la clave no quede a la vista (ni en el historial al compartir la pantalla).
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    return enLink
  }
  try {
    enMemoria = window.localStorage.getItem(CLAVE)
  } catch {
    enMemoria = null
  }
  return enMemoria
}
