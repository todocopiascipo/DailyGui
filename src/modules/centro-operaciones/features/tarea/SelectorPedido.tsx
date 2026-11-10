import { useMatriz } from '../matriz/datos'
import { Campo } from './controles'

/**
 * "Pedido relacionado" de una tarea interna: una orden de trabajo ya cargada
 * (así no se vuelven a cargar cliente, teléfono ni saldo).
 */
export function SelectorPedido({
  valor,
  onCambiar,
  actual,
}: {
  valor: string
  onCambiar: (id: string) => void
  /** El pedido ya enlazado, aunque ya no esté en la matriz (por ej., entregado). */
  actual?: { id: string; titulo: string } | null
}) {
  const pedidos = (useMatriz().data?.tareas ?? [])
    .filter((t) => t.tipo === 'pedido' && !t.provisoria)
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))
  const falta = actual && !pedidos.some((p) => p.id === actual.id)
  return (
    <Campo etiqueta="Pedido relacionado">
      {({ id }) => (
        <select
          id={id}
          className="co-entrada co-entrada--select"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
        >
          <option value="">Ninguno</option>
          {falta && <option value={actual.id}>{actual.titulo}</option>}
          {pedidos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titulo}
              {p.cliente ? ` · ${p.cliente.nombre}` : ''}
            </option>
          ))}
        </select>
      )}
    </Campo>
  )
}
