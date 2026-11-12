import { Campo } from './controles'
import { useCatalogos } from './datos'

/** Proyecto interno al que pertenece una tarea interna (especificación 7.9). */
export function SelectorProyecto({
  valor,
  onCambiar,
  actual,
}: {
  valor: string
  onCambiar: (id: string) => void
  /** El proyecto ya elegido, aunque esté terminado o cancelado. */
  actual?: { id: string; nombre: string } | null
}) {
  const proyectos = useCatalogos().data?.proyectos ?? []
  const falta = actual && !proyectos.some((p) => p.id === actual.id)
  return (
    <Campo etiqueta="Proyecto">
      {({ id }) => (
        <select
          id={id}
          className="co-entrada co-entrada--select"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
        >
          <option value="">Ninguno</option>
          {falta && <option value={actual.id}>{actual.nombre}</option>}
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      )}
    </Campo>
  )
}
