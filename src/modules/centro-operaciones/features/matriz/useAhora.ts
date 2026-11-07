import { useEffect, useState } from 'react'

/**
 * Hora actual que se actualiza al empezar cada minuto. Con esto se recalculan
 * urgencias, efectos de vencimiento y el reloj, sin escribir en la base.
 */
export function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    let intervalo: ReturnType<typeof setInterval> | undefined
    const hastaElMinuto = 60_000 - (Date.now() % 60_000)
    const espera = setTimeout(() => {
      setAhora(new Date())
      intervalo = setInterval(() => setAhora(new Date()), 60_000)
    }, hastaElMinuto)
    // Al volver de suspensión, actualizar enseguida.
    const alVolver = () => {
      if (document.visibilityState === 'visible') setAhora(new Date())
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearTimeout(espera)
      if (intervalo) clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])

  return ahora
}
