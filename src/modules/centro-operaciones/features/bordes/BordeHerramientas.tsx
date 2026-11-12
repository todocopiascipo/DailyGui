/**
 * Herramientas ocultas en el borde izquierdo (especificación 7.10): en reposo
 * no se ven. Con el mouse aparecen al acercarse al borde; en táctil, con la
 * pestaña casi transparente del borde o deslizando desde el borde. Nunca
 * dependen del hover. (El "+" y la OT siguen también abajo, como antes.)
 */
import { Menu, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface Herramienta {
  id: string
  texto: string
  icono: LucideIcon
  atajo?: string
  hacer: () => void
}

const BORDE_PX = 24

export function BordeHerramientas({
  herramientas,
  bloqueado,
}: {
  herramientas: Herramienta[]
  /** Mientras se arrastra un globo o hay una ventana abierta, no aparece. */
  bloqueado: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const porHover = useRef(false)
  const menu = useRef<HTMLElement>(null)
  const visible = abierto && !bloqueado

  // Deslizar desde el borde izquierdo (táctil).
  useEffect(() => {
    let inicio: { x: number; y: number } | null = null
    const empezar = (e: TouchEvent) => {
      const t = e.touches[0]
      inicio = t && t.clientX < BORDE_PX ? { x: t.clientX, y: t.clientY } : null
    }
    const mover = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!inicio || !t) return
      if (t.clientX - inicio.x > 40 && Math.abs(t.clientY - inicio.y) < 60) {
        porHover.current = false
        setAbierto(true)
        inicio = null
      }
    }
    window.addEventListener('touchstart', empezar, { passive: true })
    window.addEventListener('touchmove', mover, { passive: true })
    return () => {
      window.removeEventListener('touchstart', empezar)
      window.removeEventListener('touchmove', mover)
    }
  }, [])

  // Esc o tocar afuera lo cierran.
  useEffect(() => {
    if (!visible) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    const alTocar = (e: PointerEvent) => {
      const t = e.target as Node
      if (menu.current?.contains(t)) return
      if ((t as HTMLElement).closest?.('.co-pestana-herramientas')) return
      setAbierto(false)
    }
    window.addEventListener('keydown', alTeclear)
    window.addEventListener('pointerdown', alTocar)
    return () => {
      window.removeEventListener('keydown', alTeclear)
      window.removeEventListener('pointerdown', alTocar)
    }
  }, [visible])

  return (
    <>
      <div
        className="co-borde-izquierdo"
        aria-hidden
        onMouseEnter={() => {
          if (bloqueado) return
          porHover.current = true
          setAbierto(true)
        }}
      />
      <button
        type="button"
        className="co-pestana-herramientas"
        aria-label="Herramientas"
        aria-expanded={visible}
        aria-controls="co-herramientas"
        onClick={() => {
          porHover.current = false
          setAbierto((a) => !a)
        }}
      >
        <Menu size={18} aria-hidden strokeWidth={2} />
      </button>
      <nav
        id="co-herramientas"
        ref={menu}
        className="co-herramientas"
        data-abierto={visible || undefined}
        aria-label="Herramientas"
        aria-hidden={!visible}
        onMouseLeave={() => {
          if (porHover.current) setAbierto(false)
        }}
      >
        <ul>
          {herramientas.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="co-herramienta"
                tabIndex={visible ? 0 : -1}
                title={h.atajo ? `${h.texto} (${h.atajo})` : h.texto}
                onClick={() => {
                  setAbierto(false)
                  h.hacer()
                }}
              >
                <h.icono size={20} aria-hidden strokeWidth={1.75} />
                <span>{h.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
