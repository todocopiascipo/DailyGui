import { fechaLarga, formatoHora } from '../../lib/tiempo'

export function Reloj({ ahora }: { ahora: Date }) {
  return (
    <div className="co-reloj" aria-label="Hora actual">
      <time dateTime={ahora.toISOString()} className="co-reloj__hora">
        {formatoHora(ahora)}
      </time>
      <span className="co-reloj__fecha">{fechaLarga(ahora)}</span>
    </div>
  )
}
