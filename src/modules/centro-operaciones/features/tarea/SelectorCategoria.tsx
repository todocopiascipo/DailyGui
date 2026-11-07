import type { Enums } from '../../lib/database.types'
import { Campo } from './controles'
import type { Categoria } from './tipos'

/** Categorías que aplican al tipo de tarea (más la elegida, aunque no aplique). */
export function SelectorCategoria({
  categorias,
  tipo,
  valor,
  onCambiar,
}: {
  categorias: Categoria[]
  tipo: Enums<'tipo_tarea'>
  valor: string
  onCambiar: (v: string) => void
}) {
  const visibles = categorias.filter(
    (c) => c.tipo_aplica === tipo || c.tipo_aplica === 'ambos' || c.id === valor,
  )
  return (
    <Campo etiqueta="Categoría">
      {({ id }) => (
        <select
          id={id}
          className="co-entrada co-entrada--select"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
        >
          <option value="">Sin categoría</option>
          {visibles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      )}
    </Campo>
  )
}
