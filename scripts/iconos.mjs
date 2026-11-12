// Genera los PNG del ícono de la app (PWA) a partir de public/iconos/icono.svg.
// Uso: node scripts/iconos.mjs   (necesita Playwright con Chromium instalado)
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const svg = await readFile('public/iconos/icono.svg', 'utf8')
const navegador = await chromium.launch()
const pagina = await navegador.newPage()
for (const [nombre, lado] of [
  ['icono-192.png', 192],
  ['icono-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await pagina.setViewportSize({ width: lado, height: lado })
  await pagina.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg}`,
  )
  await pagina.screenshot({ path: `public/iconos/${nombre}`, omitBackground: false })
}
await navegador.close()
console.log('Íconos generados en public/iconos/')
