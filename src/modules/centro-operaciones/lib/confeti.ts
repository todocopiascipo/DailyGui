/**
 * Confeti azul y blanco, breve, al terminar una tarea (especificación 6.4 y
 * 9.5). Sin dependencias: un lienzo encima de todo que se quita solo.
 * No se lanza si la persona pidió reducir el movimiento.
 */
const COLORES = ['#ffffff', '#174e97', '#4f8fd9', '#2c2a69', '#dbe8fb']
const DURACION_MS = 1600

interface Particula {
  x: number
  y: number
  vx: number
  vy: number
  giro: number
  vgiro: number
  ancho: number
  alto: number
  color: string
}

export function lanzarConfeti(origen: { x: number; y: number }, contenedor: HTMLElement) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const lienzo = document.createElement('canvas')
  const escala = window.devicePixelRatio || 1
  lienzo.className = 'co-confeti'
  lienzo.width = window.innerWidth * escala
  lienzo.height = window.innerHeight * escala
  lienzo.setAttribute('aria-hidden', 'true')
  contenedor.appendChild(lienzo)
  const ctx = lienzo.getContext('2d')
  if (!ctx) {
    lienzo.remove()
    return
  }
  ctx.scale(escala, escala)

  const particulas: Particula[] = Array.from({ length: 90 }, () => {
    const angulo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
    const fuerza = 6 + Math.random() * 7
    return {
      x: origen.x,
      y: origen.y,
      vx: Math.cos(angulo) * fuerza,
      vy: Math.sin(angulo) * fuerza,
      giro: Math.random() * Math.PI,
      vgiro: (Math.random() - 0.5) * 0.4,
      ancho: 6 + Math.random() * 5,
      alto: 3 + Math.random() * 4,
      color: COLORES[Math.floor(Math.random() * COLORES.length)]!,
    }
  })

  const inicio = performance.now()
  const cuadro = (t: number) => {
    const pasado = t - inicio
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    // Se desvanece en el último tercio.
    ctx.globalAlpha = Math.min(1, Math.max(0, (DURACION_MS - pasado) / (DURACION_MS / 3)))
    for (const p of particulas) {
      p.vy += 0.28
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.giro += p.vgiro
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.giro)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto)
      ctx.restore()
    }
    if (pasado < DURACION_MS) requestAnimationFrame(cuadro)
    else lienzo.remove()
  }
  requestAnimationFrame(cuadro)
}
