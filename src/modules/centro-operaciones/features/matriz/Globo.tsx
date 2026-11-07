import { Check, FolderKanban, ListChecks, Pause, Skull } from 'lucide-react'
import type { Enums } from '../../lib/database.types'
import { textoEntrega } from '../../lib/tiempo'
import type { Aspecto } from '../../lib/urgencia'
import type { TareaMatriz } from './tipos'

export type Densidad = 'normal' | 'compacto' | 'mini'

const MOTIVOS: Record<Enums<'motivo_espera'>, string> = {
  archivo_cliente: 'Archivo del cliente',
  material: 'Material',
  pago: 'Pago',
  proveedor: 'Proveedor',
  otro: 'Otro',
}

function textoResponsables(tarea: TareaMatriz, densidad: Densidad): string {
  const r = tarea.responsables
  if (r.length === 0) return 'Sin asignar'
  const max = densidad === 'normal' ? 3 : 2
  // En el tamaño más chico se usan las iniciales para no cortar nombres.
  const nombres = r
    .slice(0, max)
    .map((p) => (densidad === 'mini' && p.iniciales ? p.iniciales : p.nombre))
  return nombres.join(' · ') + (r.length > max ? ` +${r.length - max}` : '')
}

function lineaEstado(tarea: TareaMatriz, aspecto: Aspecto, ahora: Date): string | null {
  if (aspecto === 'terminada') return 'Terminada'
  const entrega = tarea.fecha_entrega ? new Date(tarea.fecha_entrega) : null
  const textoFecha = entrega ? textoEntrega(entrega, ahora) : null
  if (tarea.estado === 'en_espera' && tarea.motivo_espera) {
    const motivo =
      tarea.motivo_espera === 'otro' && tarea.motivo_espera_detalle
        ? tarea.motivo_espera_detalle
        : MOTIVOS[tarea.motivo_espera]
    // Si además está vencida, eso es lo más importante.
    return aspecto === 'vencida' ? textoFecha : `En espera · ${motivo}`
  }
  return textoFecha
}

interface Props {
  tarea: TareaMatriz
  aspecto: Aspecto
  ahora: Date
  densidad: Densidad
  /** Tocar el globo abre el detalle. */
  onAbrir?: (id: string) => void
}

export function Globo({ tarea, aspecto, ahora, densidad, onAbrir }: Props) {
  const linea = lineaEstado(tarea, aspecto, ahora)
  const { total, hechas } = tarea.subtareas
  const tamIcono = densidad === 'mini' ? 12 : 14

  return (
    <article
      className={`co-globo co-globo--${aspecto} co-globo--${densidad}`}
      data-aspecto={aspecto}
      data-testid="co-globo"
      title={tarea.titulo}
    >
      <div className="co-globo__cabecera">
        <h3 className="co-globo__titulo">{tarea.titulo}</h3>
        {aspecto === 'dia_entrega' && (
          <span className="co-globo__alerta" aria-label="Se entrega hoy">
            !
          </span>
        )}
        {aspecto === 'vencida' && (
          <Skull size={tamIcono + 2} aria-label="Vencida" strokeWidth={1.75} />
        )}
        {aspecto === 'terminada' && <Check size={tamIcono + 2} aria-hidden strokeWidth={2} />}
        {tarea.estado === 'en_espera' && aspecto !== 'vencida' && (
          <Pause size={tamIcono} aria-label="En espera" strokeWidth={2} />
        )}
      </div>
      <p className="co-globo__meta">
        {tarea.tipo === 'interna' && (
          <FolderKanban size={tamIcono} aria-label="Tarea interna" strokeWidth={1.75} />
        )}
        <span className="co-globo__recorte">{textoResponsables(tarea, densidad)}</span>
        {total > 0 && (
          <span className="co-globo__progreso" aria-label={`${hechas} de ${total} pasos hechos`}>
            <ListChecks size={tamIcono} aria-hidden strokeWidth={1.75} />
            {hechas}/{total}
          </span>
        )}
      </p>
      {linea && <p className="co-globo__meta co-globo__entrega">{linea}</p>}
      {onAbrir && (
        // Cubre todo el globo: el área táctil es la tarjeta entera.
        <button
          type="button"
          className="co-globo__abrir"
          aria-label={`Abrir ${tarea.titulo}`}
          onClick={() => onAbrir(tarea.id)}
        />
      )}
    </article>
  )
}
