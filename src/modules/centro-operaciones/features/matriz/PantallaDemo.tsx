import { PLANTILLA_POR_DEFECTO } from '../../lib/mensaje'
import { useMemo } from 'react'
import { DISPOSICION_POR_DEFECTO, UMBRALES_POR_DEFECTO } from '../../lib/urgencia'
import { tareasDemo } from './demo'
import { Matriz } from './Matriz'
import { useAhora } from './useAhora'

/** Solo en desarrollo (`?demo`): matriz con datos de demostración. */
export default function PantallaDemo() {
  const ahora = useAhora()
  // Los datos se arman una vez; el paso del tiempo los hace avanzar de nivel.
  const tareas = useMemo(() => tareasDemo(), [])
  return (
    <>
      <Matriz
        tareas={tareas}
        config={{
          umbrales: UMBRALES_POR_DEFECTO,
          disposicion: DISPOSICION_POR_DEFECTO,
          confeti: false,
          plantilla: PLANTILLA_POR_DEFECTO,
          papeleraDias: 30,
        }}
        ahora={ahora}
      />
      <span className="co-marca-demo co-etiqueta">Demo</span>
    </>
  )
}
