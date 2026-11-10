/**
 * Arrastrar y soltar globos (especificación 6.3, 6.5 y 7.2), sin dependencias.
 * - Mouse: se levanta al mover más de unos píxeles con el botón apretado.
 * - Táctil (iPad): se levanta al mantener presionado; si el dedo se mueve
 *   antes, es un desplazamiento normal y no se arrastra.
 * El globo levantado ("fantasma") sigue al puntero con un leve retraso.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Cuadrante } from '../../lib/urgencia'
import { ContextoArrastre, type Arrastre, type Destino, type Levantado } from './arrastreContexto'

const ESPERA_TACTIL_MS = 350
const UMBRAL_MOUSE_PX = 6
const TOLERANCIA_TACTIL_PX = 10

function destinoEn(x: number, y: number): Destino | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof HTMLElement)) continue
    if (el.closest('[data-papelera]')) return { tipo: 'papelera' }
    const c = el.closest<HTMLElement>('[data-cuadrante]')
    if (c?.dataset.cuadrante) return { tipo: 'cuadrante', id: c.dataset.cuadrante as Cuadrante }
  }
  return null
}

const reducirMovimiento = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ProveedorArrastre({
  onSoltar,
  children,
}: {
  onSoltar: (id: string, destino: Destino) => void
  children: ReactNode
}) {
  const [estado, setEstado] = useState<Arrastre>({ levantado: null, sobre: null })
  /** Posición a la que tiende el fantasma (esquina superior izquierda). */
  const objetivo = useRef({ x: 0, y: 0 })
  const alSoltar = useRef(onSoltar)
  useEffect(() => {
    alSoltar.current = onSoltar
  }, [onSoltar])

  const presionar = useCallback((e: React.PointerEvent<HTMLElement>, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const elemento = e.currentTarget
    const tactil = e.pointerType !== 'mouse'
    const inicio = { x: e.clientX, y: e.clientY }
    const caja = elemento.getBoundingClientRect()
    const agarre = { x: e.clientX - caja.left, y: e.clientY - caja.top }
    let levantado = false
    let sobre: Destino | null = null

    const mover = (x: number, y: number) => {
      objetivo.current = { x: x - agarre.x, y: y - agarre.y }
      const d = destinoEn(x, y)
      if (JSON.stringify(d) !== JSON.stringify(sobre)) {
        sobre = d
        setEstado((s) => ({ ...s, sobre: d }))
      }
    }

    const levantar = () => {
      levantado = true
      objetivo.current = { x: caja.left, y: caja.top }
      setEstado({
        levantado: {
          id,
          html: elemento.innerHTML,
          clases: elemento.className,
          ancho: caja.width,
          alto: caja.height,
        },
        sobre: null,
      })
      // Un toque de vibración al levantar (donde exista).
      if (tactil) navigator.vibrate?.(12)
    }

    const espera = tactil ? setTimeout(levantar, ESPERA_TACTIL_MS) : undefined

    // Ya levantado, el dedo arrastra la tarjeta y no la página.
    const bloquearDesplazamiento = (ev: TouchEvent) => {
      if (levantado) ev.preventDefault()
    }

    const alMover = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      if (!levantado) {
        const distancia = Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y)
        if (tactil && distancia > TOLERANCIA_TACTIL_PX) terminar()
        else if (!tactil && distancia > UMBRAL_MOUSE_PX) levantar()
        if (!levantado) return
      }
      mover(ev.clientX, ev.clientY)
    }

    const alSoltarPuntero = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      const fueArrastre = levantado
      const destino = levantado ? destinoEn(ev.clientX, ev.clientY) : null
      terminar()
      if (!fueArrastre) return
      // El "click" que sigue al soltar no debe abrir el detalle.
      const anular = (c: MouseEvent) => {
        c.stopPropagation()
        c.preventDefault()
      }
      window.addEventListener('click', anular, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', anular, { capture: true }), 0)
      if (destino) alSoltar.current(id, destino)
    }

    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && levantado) terminar()
    }

    function terminar() {
      clearTimeout(espera)
      window.removeEventListener('pointermove', alMover)
      window.removeEventListener('pointerup', alSoltarPuntero)
      window.removeEventListener('pointercancel', terminar)
      window.removeEventListener('touchmove', bloquearDesplazamiento)
      window.removeEventListener('keydown', alTeclear)
      levantado = false
      setEstado({ levantado: null, sobre: null })
    }

    window.addEventListener('pointermove', alMover)
    window.addEventListener('pointerup', alSoltarPuntero)
    window.addEventListener('pointercancel', terminar)
    window.addEventListener('touchmove', bloquearDesplazamiento, { passive: false })
    window.addEventListener('keydown', alTeclear)
  }, [])

  return (
    <ContextoArrastre.Provider value={{ ...estado, presionar }}>
      {children}
      {estado.levantado && (
        <Fantasma
          levantado={estado.levantado}
          objetivo={objetivo}
          sobrePapelera={estado.sobre?.tipo === 'papelera'}
        />
      )}
    </ContextoArrastre.Provider>
  )
}

/** Copia del globo que sigue al puntero con un retraso suave (resorte). */
function Fantasma({
  levantado,
  objetivo,
  sobrePapelera,
}: {
  levantado: Levantado
  sobrePapelera: boolean
  objetivo: React.RefObject<{ x: number; y: number } | null>
}) {
  const nodo = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const suave = !reducirMovimiento()
    const pos = { x: objetivo.current?.x ?? 0, y: objetivo.current?.y ?? 0 }
    let cuadro = 0
    const paso = () => {
      const o = objetivo.current ?? pos
      // Se acerca un 35 % por cuadro: sigue al dedo con un leve retraso.
      const f = suave ? 0.35 : 1
      pos.x += (o.x - pos.x) * f
      pos.y += (o.y - pos.y) * f
      if (nodo.current) nodo.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
      cuadro = requestAnimationFrame(paso)
    }
    paso()
    return () => cancelAnimationFrame(cuadro)
  }, [objetivo])

  return (
    <div
      ref={nodo}
      className={`co-fantasma${sobrePapelera ? ' co-fantasma--papelera' : ''}`}
      style={{ width: levantado.ancho, height: levantado.alto }}
      aria-hidden
    >
      <div
        className={`${levantado.clases} co-globo--levantado`}
        // Copia del globo original, ya dibujado por React (sin datos externos).
        dangerouslySetInnerHTML={{ __html: levantado.html }}
      />
    </div>
  )
}
