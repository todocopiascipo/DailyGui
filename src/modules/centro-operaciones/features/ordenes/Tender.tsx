/**
 * Espacio "Órdenes de trabajo" (Fase 13, pedido del usuario): las OT abiertas
 * colgadas como comandas de restaurante, con una versión resumida de la OT de
 * papel. Tocar una la abre completa. Al marcarla Entregada deja de estar colgada.
 */
import { formatInTimeZone } from 'date-fns-tz'
import { Check } from 'lucide-react'
import { textoEntrega, ZONA_HORARIA } from '../../lib/tiempo'
import type { TareaMatriz } from '../matriz/tipos'
import { usePedidos } from '../tarea/datos'

const pesos = (n: number) => `$ ${n.toLocaleString('es-AR')}`

export function Tender({ ahora, onAbrir }: { ahora: Date; onAbrir: (id: string) => void }) {
  const pedidos = usePedidos()
  const lista = pedidos.data ?? []
  return (
    <section className="co-tender" aria-label="Órdenes de trabajo" data-testid="co-tender">
      <div className="co-tender__cuerda" aria-hidden />
      {pedidos.isPending && <p className="co-texto-suave co-tender__vacio">Cargando…</p>}
      {pedidos.isError && (
        <p className="co-aviso co-tender__vacio" role="alert">
          No se pudieron cargar las órdenes de trabajo: {pedidos.error.message}
        </p>
      )}
      {pedidos.data && lista.length === 0 && (
        <p className="co-mensaje-vacio co-tender__vacio">
          No hay órdenes de trabajo colgadas. Se cargan con el botón OT (o la tecla O).
        </p>
      )}
      <ol className="co-tender__comandas">
        {lista.map((ot, i) => (
          <li
            key={ot.id}
            style={{ '--co-giro': `${i % 2 ? 0.8 : -0.8}deg` } as React.CSSProperties}
          >
            <Comanda ot={ot} ahora={ahora} onAbrir={onAbrir} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function Comanda({
  ot,
  ahora,
  onAbrir,
}: {
  ot: TareaMatriz
  ahora: Date
  onAbrir: (id: string) => void
}) {
  const entrega = ot.fecha_entrega ? new Date(ot.fecha_entrega) : null
  const vencida = entrega !== null && entrega < ahora && ot.estado !== 'terminada'
  const avance = ot.tareas_ot ?? { total: 0, hechas: 0 }
  return (
    <button
      type="button"
      className="co-comanda"
      data-estado={ot.estado}
      data-vencida={vencida || undefined}
      onClick={() => onAbrir(ot.id)}
      aria-label={`Abrir la orden de trabajo ${ot.titulo}`}
    >
      <span className="co-comanda__broche" aria-hidden />
      <span className="co-comanda__encabezado">
        <span>Orden de trabajo</span>
        {ot.estado === 'terminada' && (
          <span className="co-comanda__sello">
            <Check size={12} aria-hidden strokeWidth={3} /> Terminada
          </span>
        )}
      </span>
      <strong className="co-comanda__titulo">{ot.titulo}</strong>
      {ot.cliente && (
        <span className="co-comanda__dato">
          <span className="co-comanda__etiqueta">Nombre</span> {ot.cliente.nombre}
        </span>
      )}
      <span className="co-comanda__dato">
        <span className="co-comanda__etiqueta">Entrega</span>{' '}
        {entrega
          ? vencida
            ? textoEntrega(entrega, ahora)
            : formatInTimeZone(entrega, ZONA_HORARIA, 'dd/MM HH:mm')
          : 'Sin fecha'}
      </span>
      {ot.saldo > 0 && (
        <span className="co-comanda__dato">
          <span className="co-comanda__etiqueta">Debe</span> {pesos(ot.saldo)}
        </span>
      )}
      <span className="co-comanda__pie">
        {avance.total === 0 ? 'Sin tareas' : `${avance.hechas}/${avance.total} tareas hechas`}
        {ot.responsables.length > 0 && ` · ${ot.responsables.map((r) => r.nombre).join(', ')}`}
      </span>
    </button>
  )
}
