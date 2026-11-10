import { WifiOff } from 'lucide-react'
import { useConectado } from '../../lib/tiempoReal'

/** Aviso amable dentro de los formularios mientras no hay conexión. */
export function AvisoSinConexion() {
  if (useConectado()) return null
  return (
    <p className="co-aviso-suave" role="status">
      <WifiOff size={16} aria-hidden />
      Sin conexión con el servidor del local. Lo que cargues queda acá y se podrá guardar cuando
      vuelva la conexión.
    </p>
  )
}
