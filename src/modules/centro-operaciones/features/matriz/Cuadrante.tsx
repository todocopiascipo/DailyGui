import { X } from 'lucide-react'
import { useRef } from 'react'
import { NOMBRES_CUADRANTE, type Aspecto, type Cuadrante as IdCuadrante } from '../../lib/urgencia'
import { repartir } from './densidad'
import { useArrastre } from './arrastreContexto'
import { Globo } from './Globo'
import type { TareaMatriz } from './tipos'
import { useMedida } from './useMedida'

export interface ItemMatriz {
  tarea: TareaMatriz
  aspecto: Aspecto
}

export type Vista = 'general' | 'ampliado' | 'miniatura' | 'lista'

interface Props {
  id: IdCuadrante
  items: ItemMatriz[]
  ahora: Date
  vista: Vista
  className?: string
  style?: React.CSSProperties
  onAmpliar: () => void
  onVolver: () => void
  onAbrir?: (id: string) => void
}

export function Cuadrante({
  id,
  items,
  ahora,
  vista,
  className = '',
  style,
  onAmpliar,
  onVolver,
  onAbrir,
}: Props) {
  const cuerpo = useRef<HTMLDivElement>(null)
  const midiendo = vista === 'general' || vista === 'ampliado'
  const { ancho, alto } = useMedida(cuerpo, midiendo)
  const nombre = NOMBRES_CUADRANTE[id]
  const arrastre = useArrastre()
  // Mientras se arrastra un globo, se marca el cuadrante donde caería.
  const resaltado = arrastre?.sobre?.tipo === 'cuadrante' && arrastre.sobre.id === id

  const reparto =
    vista === 'lista' ? null : midiendo && ancho > 0 ? repartir(items.length, ancho, alto) : null
  // Ampliado: se muestran todas (con desplazamiento si hiciera falta). Lista: todas, en columna.
  const todas = vista === 'lista' || vista === 'ampliado'
  const visibles = todas ? items : reparto ? items.slice(0, reparto.visibles) : []
  const ocultos = todas ? 0 : (reparto?.ocultos ?? 0)
  const densidad = reparto?.nivel.densidad ?? 'normal'

  if (vista === 'miniatura') {
    return (
      <section
        className={`co-cuadrante co-cuadrante--miniatura ${className}`}
        style={style}
        aria-label={nombre}
        data-cuadrante={id}
        data-resaltado={resaltado || undefined}
      >
        <button type="button" className="co-cuadrante__mini" onClick={onVolver}>
          <span className="co-etiqueta">{nombre}</span>
          <span className="co-cuadrante__cuenta">{items.length}</span>
        </button>
      </section>
    )
  }

  return (
    <section
      className={`co-cuadrante co-cuadrante--${vista} ${className}`}
      style={style}
      aria-label={nombre}
      data-cuadrante={id}
      data-resaltado={resaltado || undefined}
    >
      <header className="co-cuadrante__cabecera">
        {vista === 'general' ? (
          <button type="button" className="co-cuadrante__nombre" onClick={onAmpliar}>
            <span className="co-etiqueta">{nombre}</span>
            <span className="co-cuadrante__cuenta">{items.length}</span>
          </button>
        ) : (
          <h2 className="co-cuadrante__nombre">
            <span className="co-etiqueta">{nombre}</span>
            <span className="co-cuadrante__cuenta">{items.length}</span>
          </h2>
        )}
        {vista === 'ampliado' && (
          <button type="button" className="co-boton-sutil" onClick={onVolver}>
            <X size={14} aria-hidden strokeWidth={2} />
            Volver
          </button>
        )}
      </header>
      <div
        ref={cuerpo}
        className="co-cuadrante__cuerpo"
        style={
          reparto
            ? ({
                '--co-columnas': reparto.columnas,
                '--co-alto-globo': `${reparto.nivel.alto}px`,
                '--co-separacion': `${reparto.nivel.separacion}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className={vista === 'lista' ? 'co-lista' : 'co-grilla'}>
          {visibles.map(({ tarea, aspecto }) => (
            <Globo
              key={tarea.id}
              tarea={tarea}
              aspecto={aspecto}
              ahora={ahora}
              densidad={densidad}
              onAbrir={onAbrir}
            />
          ))}
          {ocultos > 0 && (
            <button
              type="button"
              className="co-globo co-globo--mas"
              onClick={onAmpliar}
              aria-label={`Ver ${ocultos} tareas más en ${nombre}`}
            >
              +{ocultos}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
