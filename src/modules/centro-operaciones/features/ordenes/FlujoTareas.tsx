/**
 * Las tareas de una orden de trabajo como diagrama de flujo (Fase 14, pedido
 * del usuario). Columnas por orden: en la 1.ª las que se pueden hacer ya; en
 * las siguientes, las que esperan a otra. Flechas de la tarea previa a la que
 * la espera.
 *
 * Encadenar: se arrastra una tarea y se la mantiene encima de otra; se carga
 * una barra de unos segundos y, al completarse, la arrastrada pasa a esperar a
 * la otra. Soltar antes, o salir de encima, cancela. (También se puede hacer
 * desde el detalle de la tarea, sin arrastrar.)
 */
import { Check, Link2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { columnasDeFlujo, esperaA } from '../../lib/flujo'
import type { TareaMatriz } from '../matriz/tipos'
import { NOMBRES_ESTADO } from '../tarea/historial'

/** Lo que hay que mantener una tarea encima de otra para enlazarlas. */
export const ESPERA_ENLACE_MS = 2_000
const UMBRAL_ARRASTRE_PX = 8

interface Arrastre {
  id: string
  x: number
  y: number
  /** Tarea que tiene debajo (candidata a enlazar). */
  sobre: string | null
}

export function FlujoTareas({
  tareas,
  conectado,
  onAbrir,
  onEnlazar,
}: {
  tareas: TareaMatriz[]
  conectado: boolean
  onAbrir: (id: string) => void
  /** `id` pasa a esperar a `dependeDe`. */
  onEnlazar: (id: string, dependeDe: string) => void
}) {
  const columnas = columnasDeFlujo(tareas)
  const total = Math.max(1, ...columnas.values())
  const contenedor = useRef<HTMLDivElement>(null)
  const lienzo = useRef<SVGSVGElement>(null)
  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  const inicio = useRef<{ id: string; x: number; y: number } | null>(null)
  const movido = useRef(false)
  const reloj = useRef(0)
  const sobreActual = useRef<string | null>(null)

  // Flechas: de la derecha de la tarea previa a la izquierda de la que la espera.
  useLayoutEffect(() => {
    const caja = contenedor.current
    const svg = lienzo.current
    if (!caja || !svg) return
    const dibujar = () => {
      const base = caja.getBoundingClientRect()
      const rect = (id: string) =>
        caja.querySelector<HTMLElement>(`[data-tarea-flujo="${id}"]`)?.getBoundingClientRect()
      svg.setAttribute('width', String(caja.scrollWidth))
      svg.setAttribute('height', String(caja.scrollHeight))
      const trazos: string[] = []
      for (const t of tareas) {
        const destino = rect(t.id)
        if (!destino) continue
        for (const d of t.depende_de ?? []) {
          const origen = rect(d.id)
          if (!origen) continue
          const x1 = origen.right - base.left + caja.scrollLeft
          const y1 = origen.top + origen.height / 2 - base.top + caja.scrollTop
          const x2 = destino.left - base.left + caja.scrollLeft - 6
          const y2 = destino.top + destino.height / 2 - base.top + caja.scrollTop
          const medio = (x1 + x2) / 2
          trazos.push(
            `<path d="M${x1},${y1} C${medio},${y1} ${medio},${y2} ${x2},${y2}" data-hecha="${d.hecha}" marker-end="url(#co-flecha)" />`,
          )
        }
      }
      svg.querySelector('g')!.innerHTML = trazos.join('')
    }
    dibujar()
    const observador = new ResizeObserver(dibujar)
    observador.observe(caja)
    return () => observador.disconnect()
  }, [tareas])

  const cancelarCarga = () => window.clearTimeout(reloj.current)

  const alApretar = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (!conectado || e.button !== 0) return
    inicio.current = { id, x: e.clientX, y: e.clientY }
    movido.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const alMover = (e: React.PointerEvent<HTMLButtonElement>) => {
    const i = inicio.current
    if (!i) return
    if (!movido.current && Math.hypot(e.clientX - i.x, e.clientY - i.y) < UMBRAL_ARRASTRE_PX) return
    movido.current = true
    const debajo = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-tarea-flujo]')
    const sobre = debajo && debajo.dataset.tareaFlujo !== i.id ? debajo.dataset.tareaFlujo! : null
    // Cambió la tarea de abajo: arranca (o se corta) la carga del enlace.
    if (sobre !== sobreActual.current) {
      sobreActual.current = sobre
      cancelarCarga()
      if (sobre) {
        reloj.current = window.setTimeout(() => {
          onEnlazar(i.id, sobre)
          inicio.current = null
          sobreActual.current = null
          setArrastre(null)
        }, ESPERA_ENLACE_MS)
      }
    }
    setArrastre({ id: i.id, x: e.clientX, y: e.clientY, sobre })
  }

  const alSoltar = () => {
    cancelarCarga()
    inicio.current = null
    sobreActual.current = null
    setArrastre(null)
  }

  const levantada = arrastre ? tareas.find((t) => t.id === arrastre.id) : null
  const destino = arrastre?.sobre ? tareas.find((t) => t.id === arrastre.sobre) : null

  return (
    <div
      className="co-flujo"
      ref={contenedor}
      // Se puede desplazar con el teclado (con muchas columnas no entra a lo ancho).
      tabIndex={0}
      role="group"
      aria-label="Diagrama de tareas de la orden"
    >
      <svg className="co-flujo__flechas" ref={lienzo} aria-hidden>
        <defs>
          <marker
            id="co-flecha"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" />
          </marker>
        </defs>
        <g />
      </svg>
      <div
        className="co-flujo__columnas"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(160px, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <section key={n} className="co-flujo__columna" aria-label={nombreColumna(n)}>
            <h4 className="co-flujo__titulo">{nombreColumna(n)}</h4>
            {tareas
              .filter((t) => columnas.get(t.id) === n)
              .map((t) => {
                const faltan = esperaA(t)
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="co-flujo__tarea"
                    data-tarea-flujo={t.id}
                    data-estado={t.estado}
                    data-levantada={arrastre?.id === t.id || undefined}
                    data-cargando={arrastre?.sobre === t.id || undefined}
                    style={{ '--co-espera-enlace': `${ESPERA_ENLACE_MS}ms` } as React.CSSProperties}
                    onPointerDown={(e) => alApretar(e, t.id)}
                    onPointerMove={alMover}
                    onPointerUp={alSoltar}
                    onPointerCancel={alSoltar}
                    onClick={() => {
                      if (!movido.current) onAbrir(t.id)
                    }}
                  >
                    <strong>{t.titulo}</strong>
                    <span className="co-texto-suave">
                      {t.estado === 'terminada' && <Check size={12} aria-hidden strokeWidth={3} />}{' '}
                      {NOMBRES_ESTADO[t.estado]}
                      {t.responsables.length > 0 &&
                        ` · ${t.responsables.map((r) => r.nombre).join(', ')}`}
                    </span>
                    {faltan.length > 0 && t.estado !== 'terminada' && (
                      <span className="co-flujo__espera">Espera a: {faltan.join(', ')}</span>
                    )}
                    {arrastre?.sobre === t.id && (
                      <span className="co-flujo__carga" role="status">
                        <span className="co-flujo__barra" />
                        <span>
                          <Link2 size={12} aria-hidden /> "{levantada?.titulo}" va a esperar a esta
                        </span>
                      </span>
                    )}
                  </button>
                )
              })}
          </section>
        ))}
      </div>
      {arrastre && levantada && (
        <div
          className="co-flujo__fantasma"
          style={{ left: arrastre.x, top: arrastre.y }}
          aria-hidden
        >
          {levantada.titulo}
          {destino ? ` → espera a "${destino.titulo}"` : ''}
        </div>
      )}
    </div>
  )
}

function nombreColumna(n: number): string {
  return n === 1 ? '1.º orden · se pueden hacer ya' : `${n}.º orden`
}
