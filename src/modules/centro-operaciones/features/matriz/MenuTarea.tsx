import { MoreHorizontal } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  accionesDisponibles,
  NOMBRES_ACCION,
  type EjecutarAccion,
  type RefTarea,
} from './accionesTarea'

/**
 * Menú de tres puntitos del globo (especificación 7.2). El botón aparece al
 * pasar el mouse o con el foco; en pantallas táctiles queda siempre a la vista,
 * tenue. El menú se dibuja aparte (no lo recorta ni lo afecta el globo).
 */
export function MenuTarea({ tarea, ejecutar }: { tarea: RefTarea; ejecutar: EjecutarAccion }) {
  /** El botón que abrió el menú (null = cerrado). */
  const [ancla, setAncla] = useState<HTMLButtonElement | null>(null)

  return (
    <>
      <button
        type="button"
        className="co-globo__puntos"
        aria-label={`Opciones de ${tarea.titulo}`}
        aria-haspopup="menu"
        aria-expanded={ancla !== null}
        // No levanta el globo para arrastrar.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          const boton = e.currentTarget
          setAncla((a) => (a ? null : boton))
        }}
      >
        <MoreHorizontal size={18} aria-hidden strokeWidth={2.25} />
      </button>
      {ancla && (
        <MenuFlotante
          ancla={ancla}
          tarea={tarea}
          onElegir={(accion) => {
            setAncla(null)
            ejecutar(accion, tarea)
          }}
          onCerrar={(volverAlBoton) => {
            setAncla(null)
            if (volverAlBoton) ancla.focus()
          }}
        />
      )}
    </>
  )
}

function MenuFlotante({
  ancla,
  tarea,
  onElegir,
  onCerrar,
}: {
  ancla: HTMLElement
  tarea: RefTarea
  onElegir: (accion: ReturnType<typeof accionesDisponibles>[number]) => void
  onCerrar: (volverAlBoton: boolean) => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const acciones = accionesDisponibles(tarea)

  // Debajo del botón, alineado a su derecha; si no entra, arriba / a la izquierda.
  useLayoutEffect(() => {
    const a = ancla.getBoundingClientRect()
    const m = menu.current?.getBoundingClientRect()
    const ancho = m?.width ?? 220
    const alto = m?.height ?? 280
    const top = a.bottom + alto + 8 > window.innerHeight ? a.top - alto - 4 : a.bottom + 4
    const left = Math.max(8, Math.min(a.right - ancho, window.innerWidth - ancho - 8))
    setPos({ top: Math.max(8, top), left })
  }, [ancla])

  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })

  // Al abrir: foco en la primera opción; tocar afuera cierra.
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
    const afuera = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !ancla.contains(e.target as Node)) {
        cerrar.current(false)
      }
    }
    document.addEventListener('pointerdown', afuera)
    return () => document.removeEventListener('pointerdown', afuera)
  }, [ancla])

  const alTeclear = (e: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCerrar(true)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const paso = e.key === 'ArrowDown' ? 1 : -1
      items[(i + paso + items.length) % items.length]?.focus()
    } else if (e.key === 'Tab') {
      onCerrar(false)
    }
  }

  const raiz = ancla.closest('.co-app') ?? document.body
  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={`Opciones de ${tarea.titulo}`}
      className="co-menu"
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      onKeyDown={alTeclear}
    >
      {acciones.map((accion) => (
        <button
          key={accion}
          type="button"
          role="menuitem"
          className={`co-menu__item${accion === 'eliminar' ? ' co-menu__item--peligro' : ''}`}
          onClick={() => onElegir(accion)}
        >
          {NOMBRES_ACCION[accion]}
        </button>
      ))}
    </div>,
    raiz,
  )
}
