import { useLayoutEffect, useState, type RefObject } from 'react'

/** Ancho y alto disponibles de un elemento, actualizados al cambiar de tamaño. */
export function useMedida(ref: RefObject<HTMLElement | null>, activo = true) {
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !activo) return
    const medir = () => setMedida({ ancho: el.clientWidth, alto: el.clientHeight })
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [ref, activo])

  return medida
}

/** true en pantallas angostas (celular): la matriz pasa a lista agrupada. */
export function useEsAngosto(): boolean {
  const consulta = '(max-width: 639px)'
  const [angosto, setAngosto] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(consulta).matches,
  )
  useLayoutEffect(() => {
    const mql = window.matchMedia?.(consulta)
    if (!mql) return
    const cambio = () => setAngosto(mql.matches)
    cambio()
    mql.addEventListener('change', cambio)
    return () => mql.removeEventListener('change', cambio)
  }, [])
  return angosto
}
