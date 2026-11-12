import { CheckCheck, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatoHora } from '../../lib/tiempo'
import { useConectado } from '../../lib/tiempoReal'
import type { HechasHoy } from '../matriz/acciones'
import type { EjecutarAccion } from '../matriz/accionesTarea'
import { useArrastre } from '../matriz/arrastreContexto'
import type { TareaMatriz } from '../matriz/tipos'

/** Distancia al borde derecho que cuenta como "desde el borde". */
const BORDE_PX = 24

/**
 * Panel lateral "Hechas hoy" (especificación 7.8): oculto; en la PC aparece
 * al acercar el mouse al borde derecho; en el iPad, deslizando desde el borde
 * o con la pestaña casi transparente. Cada ítem se puede devolver (botón o
 * arrastrándolo de vuelta a la matriz).
 */
export function PanelHechas({
  hechas,
  ejecutar,
  onAbrir,
  abrirSenal = 0,
}: {
  hechas: HechasHoy | undefined
  ejecutar: EjecutarAccion
  onAbrir: (id: string) => void
  /** Cambia cada vez que otra parte pide abrirlo (el menú del borde). */
  abrirSenal?: number
}) {
  const [abierto, setAbierto] = useState(false)
  const [senalVista, setSenalVista] = useState(abrirSenal)
  if (abrirSenal !== senalVista) {
    setSenalVista(abrirSenal)
    setAbierto(true)
  }
  /** Abierto con el mouse: se cierra solo al alejarse. */
  const porHover = useRef(false)
  const arrastre = useArrastre()
  const terminadas = hechas?.terminadas ?? []
  const entregadas = hechas?.entregadas ?? []
  const total = terminadas.length + entregadas.length

  // Al levantar un ítem para devolverlo, el panel se aparta y deja ver la matriz.
  const levantadoId = arrastre?.levantado?.id
  const [ocultoPorArrastre, setOcultoPorArrastre] = useState<string | null>(null)
  if (
    abierto &&
    levantadoId &&
    levantadoId !== ocultoPorArrastre &&
    [...terminadas, ...entregadas].some((t) => t.id === levantadoId)
  ) {
    setOcultoPorArrastre(levantadoId)
    setAbierto(false)
  }

  // Deslizar desde el borde derecho (táctil).
  useEffect(() => {
    let inicio: { x: number; y: number } | null = null
    const empezar = (e: TouchEvent) => {
      const t = e.touches[0]
      inicio = t && t.clientX > window.innerWidth - BORDE_PX ? { x: t.clientX, y: t.clientY } : null
    }
    const mover = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!inicio || !t) return
      if (inicio.x - t.clientX > 40 && Math.abs(t.clientY - inicio.y) < 60) {
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

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierto])

  return (
    <>
      {/* Zona invisible del borde: el mouse lo abre (sin depender de esto en táctil). */}
      <div
        className="co-borde-derecho"
        aria-hidden
        onMouseEnter={() => {
          if (arrastre?.levantado) return
          porHover.current = true
          setAbierto(true)
        }}
      />
      <button
        type="button"
        className="co-pestana-hechas"
        aria-label={`Hechas hoy${total ? ` (${total})` : ''}`}
        aria-expanded={abierto}
        aria-controls="co-panel-hechas"
        onClick={() => {
          porHover.current = false
          setAbierto((a) => !a)
        }}
      >
        <CheckCheck size={18} aria-hidden strokeWidth={2} />
        {total > 0 && <span className="co-pestana-hechas__cuenta">{total}</span>}
      </button>
      <aside
        id="co-panel-hechas"
        className="co-panel-hechas"
        data-abierto={abierto || undefined}
        aria-label="Hechas hoy"
        onMouseLeave={() => {
          if (porHover.current) setAbierto(false)
        }}
      >
        <header className="co-panel-hechas__cabecera">
          <h2 className="co-subtitulo">Hechas hoy</h2>
          <button
            type="button"
            className="co-boton-icono"
            aria-label="Cerrar Hechas hoy"
            onClick={() => setAbierto(false)}
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <Lista
          titulo="Terminadas hoy"
          vacia="Todavía no se terminó nada hoy."
          tareas={terminadas}
          hora={(t) => t.terminada_at}
          ejecutar={ejecutar}
          onAbrir={onAbrir}
        />
        <Lista
          titulo="Entregados del día"
          vacia="Todavía no se entregó nada hoy."
          tareas={entregadas}
          hora={(t) => t.entregada_at}
          ejecutar={ejecutar}
          onAbrir={onAbrir}
        />
        <p className="co-texto-suave">
          Para devolver una tarea, también podés arrastrarla a la matriz.
        </p>
      </aside>
    </>
  )
}

function Lista({
  titulo,
  vacia,
  tareas,
  hora,
  ejecutar,
  onAbrir,
}: {
  titulo: string
  vacia: string
  tareas: TareaMatriz[]
  hora: (t: TareaMatriz) => string | null
  ejecutar: EjecutarAccion
  onAbrir: (id: string) => void
}) {
  const arrastre = useArrastre()
  const conectado = useConectado()
  return (
    <section className="co-seccion" aria-label={titulo}>
      <h3 className="co-campo__etiqueta">
        {titulo} · {tareas.length}
      </h3>
      {tareas.length === 0 && <p className="co-texto-suave">{vacia}</p>}
      <ul className="co-hechas">
        {tareas.map((t) => {
          const h = hora(t)
          return (
            <li
              key={t.id}
              className="co-hechas__item"
              data-arrastrando={arrastre?.levantado?.id === t.id || undefined}
              onPointerDown={arrastre ? (e) => arrastre.presionar(e, t.id, 'panel') : undefined}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button type="button" className="co-hechas__titulo" onClick={() => onAbrir(t.id)}>
                <strong>{t.titulo}</strong>
                <span className="co-texto-suave">
                  {h ? formatoHora(new Date(h)) : ''}
                  {t.responsables.length > 0 &&
                    ` · ${t.responsables.map((p) => p.nombre).join(', ')}`}
                </span>
              </button>
              <button
                type="button"
                className="co-boton-sutil"
                disabled={!conectado}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => ejecutar('devolver', t)}
                aria-label={`Devolver ${t.titulo}`}
              >
                <RotateCcw size={14} aria-hidden /> Devolver
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
