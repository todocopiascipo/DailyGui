/**
 * Tareas encadenadas (Fase 14), desde el detalle de una tarea de una OT: a qué
 * tareas espera (con ✕ para quitar el enlace) y una lista para agregar otra de
 * la misma OT, sin necesidad de arrastrar.
 */
import { X } from 'lucide-react'
import { useConectado } from '../../lib/tiempoReal'
import { Campo } from './controles'
import { useEnlaceTareas, usePedidoTareas } from './datos'
import type { DetalleTarea } from './tipos'

export function EsperaA({ detalle }: { detalle: DetalleTarea }) {
  const t = detalle.tarea
  const conectado = useConectado()
  const { enlazar, desenlazar } = useEnlaceTareas()
  const delPedido = usePedidoTareas(t.pedido_id)
  const deps = detalle.depende_de ?? []
  const opciones = (delPedido.data ?? []).filter(
    (x) => x.id !== t.id && !deps.some((d) => d.id === x.id),
  )
  const error = enlazar.error ?? desenlazar.error
  return (
    <div className="co-grupo" aria-label="Espera a">
      <span className="co-campo__etiqueta">Espera a</span>
      {deps.length === 0 ? (
        <p className="co-texto-suave">No espera a ninguna tarea: se puede hacer ya.</p>
      ) : (
        <ul className="co-fichas">
          {deps.map((d) => (
            <li key={d.id}>
              <span className="co-ficha" data-hecha={d.hecha || undefined}>
                {d.titulo}
                {d.hecha ? ' (hecha)' : ''}
                <button
                  type="button"
                  className="co-ficha__quitar"
                  aria-label={`Dejar de esperar a ${d.titulo}`}
                  disabled={!conectado || desenlazar.isPending}
                  onClick={() => desenlazar.mutate({ id: t.id, dependeDe: d.id })}
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {opciones.length > 0 && (
        <Campo etiqueta="Agregar: espera a…">
          {({ id }) => (
            <select
              id={id}
              className="co-entrada co-entrada--select"
              value=""
              disabled={!conectado || enlazar.isPending}
              onChange={(e) => {
                if (e.target.value) enlazar.mutate({ id: t.id, dependeDe: e.target.value })
              }}
            >
              <option value="">Elegí una tarea de la misma orden</option>
              {opciones.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.titulo}
                </option>
              ))}
            </select>
          )}
        </Campo>
      )}
      {error && (
        <p className="co-aviso" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
