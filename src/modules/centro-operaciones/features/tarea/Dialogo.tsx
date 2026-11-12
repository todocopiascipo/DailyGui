import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Props {
  titulo: string
  /** Oculta el título visualmente (queda para lectores de pantalla). */
  tituloOculto?: boolean
  variante: 'centro' | 'lateral' | 'amplia'
  /** Si hay cambios sin guardar, cerrar pide confirmación. */
  sinGuardar: boolean
  onCerrar: () => void
  children: ReactNode
  pie?: ReactNode
}

/**
 * Ventana modal del módulo: Esc o tocar afuera cierran, el foco queda adentro
 * y vuelve al elemento anterior al cerrar.
 */
export function Dialogo({
  titulo,
  tituloOculto = false,
  variante,
  sinGuardar,
  onCerrar,
  children,
  pie,
}: Props) {
  const caja = useRef<HTMLDivElement>(null)
  const idTitulo = useId()
  const [confirmando, setConfirmando] = useState(false)

  const pedirCierre = () => (sinGuardar ? setConfirmando(true) : onCerrar())

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const inicial =
      caja.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      caja.current?.querySelector<HTMLElement>(ENFOCABLES)
    inicial?.focus()
    return () => anterior?.focus?.()
  }, [])

  // Si el foco se perdió (por ej., se deshabilitó el botón tocado o se recargó
  // una lista), Esc igual cierra la ventana de más arriba.
  const alEscapar = useRef<() => void>(() => {})
  useEffect(() => {
    alEscapar.current = () => (confirmando ? setConfirmando(false) : pedirCierre())
  })
  useEffect(() => {
    const alTeclearAfuera = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const activo = document.activeElement
      if (activo && activo !== document.body) return
      const ventanas = document.querySelectorAll('[role="dialog"]')
      if (ventanas[ventanas.length - 1] !== caja.current) return
      e.preventDefault()
      alEscapar.current()
    }
    window.addEventListener('keydown', alTeclearAfuera)
    return () => window.removeEventListener('keydown', alTeclearAfuera)
  }, [])

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (confirmando) setConfirmando(false)
      else pedirCierre()
      return
    }
    if (e.key !== 'Tab' || !caja.current) return
    // Mantener el foco dentro de la ventana.
    const lista = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
    const primero = lista[0]
    const ultimo = lista[lista.length - 1]
    if (!primero || !ultimo) return
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  return (
    <div
      className={`co-velo co-velo--${variante}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) pedirCierre()
      }}
    >
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={`co-dialogo co-dialogo--${variante}`}
        onKeyDown={alTeclear}
      >
        <header className="co-dialogo__cabecera">
          <h2 id={idTitulo} className={tituloOculto ? 'co-solo-lector' : 'co-dialogo__titulo'}>
            {titulo}
          </h2>
          <button
            type="button"
            className="co-boton-icono co-dialogo__cerrar"
            aria-label="Cerrar"
            onClick={pedirCierre}
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="co-dialogo__cuerpo">{children}</div>
        {confirmando ? (
          <div
            className="co-dialogo__pie co-dialogo__pie--aviso"
            role="alertdialog"
            aria-label="Cambios sin guardar"
          >
            <p>Tenés cambios sin guardar.</p>
            <div className="co-fila">
              <button
                type="button"
                className="co-boton-sutil"
                onClick={() => setConfirmando(false)}
              >
                Seguir editando
              </button>
              <button type="button" className="co-boton co-boton--peligro" onClick={onCerrar}>
                Descartar
              </button>
            </div>
          </div>
        ) : (
          pie && <div className="co-dialogo__pie">{pie}</div>
        )}
      </div>
    </div>
  )
}
