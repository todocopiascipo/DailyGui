import { useEffect, useMemo, useState } from 'react'
import type { Cuadrante as IdCuadrante, Disposicion } from '../../lib/urgencia'
import { agruparPorCuadrante } from './agrupar'
import { Cuadrante, type Vista } from './Cuadrante'
import { Reloj } from './Reloj'
import type { ConfigMatriz, TareaMatriz } from './tipos'
import { useEsAngosto } from './useMedida'

type Posicion = keyof Disposicion
const POSICIONES: Posicion[] = [
  'arriba_izquierda',
  'arriba_derecha',
  'abajo_izquierda',
  'abajo_derecha',
]

/** Con muchos globos se desactiva el desenfoque (modo liviano, especificación 9.3). */
const LIMITE_LIVIANO = 40

interface Props {
  tareas: TareaMatriz[]
  config: ConfigMatriz
  ahora: Date
  onAbrir?: (id: string) => void
}

export function Matriz({ tareas, config, ahora, onAbrir }: Props) {
  const angosto = useEsAngosto()
  const [ampliado, setAmpliado] = useState<IdCuadrante | null>(null)
  const grupos = useMemo(() => agruparPorCuadrante(tareas, config, ahora), [tareas, config, ahora])

  useEffect(() => {
    if (!ampliado) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAmpliado(null)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [ampliado])

  const posicionAmpliada = ampliado
    ? POSICIONES.find((p) => config.disposicion[p] === ampliado)
    : undefined
  const columnas = !posicionAmpliada
    ? '1fr 1fr'
    : posicionAmpliada.endsWith('izquierda')
      ? '5fr 1fr'
      : '1fr 5fr'
  const filas = !posicionAmpliada
    ? '1fr 1fr'
    : posicionAmpliada.startsWith('arriba')
      ? '5fr 1fr'
      : '1fr 5fr'

  const liviano = tareas.length > LIMITE_LIVIANO

  if (angosto) {
    // Celular: lista agrupada por cuadrante, en orden de prioridad.
    const orden: IdCuadrante[] = ['hacer', 'planificar', 'delegar', 'eliminar']
    return (
      <div className={`co-matriz-lista ${liviano ? 'co-liviano' : ''}`}>
        <Reloj ahora={ahora} />
        {orden.map((id) => (
          <Cuadrante
            key={id}
            id={id}
            items={grupos[id]}
            ahora={ahora}
            vista="lista"
            onAmpliar={() => {}}
            onVolver={() => {}}
            onAbrir={onAbrir}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`co-matriz ${liviano ? 'co-liviano' : ''}`}
      style={{ gridTemplateColumns: columnas, gridTemplateRows: filas }}
      data-testid="co-matriz"
    >
      {POSICIONES.map((posicion) => {
        const id = config.disposicion[posicion]
        const vista: Vista = !ampliado ? 'general' : ampliado === id ? 'ampliado' : 'miniatura'
        const [fila, columna] = posicion.split('_') as ['arriba' | 'abajo', 'izquierda' | 'derecha']
        return (
          <Cuadrante
            key={id}
            id={id}
            items={grupos[id]}
            ahora={ahora}
            vista={vista}
            className={`co-cuadrante--${fila} co-cuadrante--${columna}`}
            style={{
              gridRow: fila === 'arriba' ? 1 : 2,
              gridColumn: columna === 'izquierda' ? 1 : 2,
            }}
            onAmpliar={() => setAmpliado(id)}
            onVolver={() => setAmpliado(null)}
            onAbrir={onAbrir}
          />
        )
      })}
      <Reloj ahora={ahora} />
    </div>
  )
}
