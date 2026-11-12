// Service worker de la app instalable (PWA). Guarda solo los archivos de la
// app (nunca datos: esos vienen siempre de Supabase o del servidor del local).
// - Páginas: primero la red (para tener siempre la última versión); sin red,
//   la última guardada.
// - Archivos con nombre versionado (assets/…): de lo guardado, y si no, la red.
const CACHE = 'co-app-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  const url = new URL(pedido.url)
  if (pedido.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.includes('/api/')) return

  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((r) => {
          const copia = r.clone()
          caches.open(CACHE).then((c) => c.put(pedido, copia))
          return r
        })
        .catch(() => caches.match(pedido).then((r) => r ?? Response.error())),
    )
    return
  }

  if (url.pathname.includes('/assets/') || url.pathname.includes('/iconos/')) {
    evento.respondWith(
      caches.match(pedido).then(
        (guardado) =>
          guardado ??
          fetch(pedido).then((r) => {
            if (r.ok) {
              const copia = r.clone()
              caches.open(CACHE).then((c) => c.put(pedido, copia))
            }
            return r
          }),
      ),
    )
  }
})
