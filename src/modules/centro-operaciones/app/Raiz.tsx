import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { CuentaNoHabilitada, Ingreso } from '../features/acceso/Ingreso'
import { useSesion } from '../features/acceso/useSesion'
import { useConfigMatriz, useTareasMatriz } from '../features/matriz/datos'
import { esModoDemo, tareasDemo } from '../features/matriz/demo'
import { Matriz } from '../features/matriz/Matriz'
import { useAhora } from '../features/matriz/useAhora'
import { DISPOSICION_POR_DEFECTO, UMBRALES_POR_DEFECTO } from '../lib/urgencia'

/**
 * Contenedor raíz del módulo. Todo el estilo del módulo vive debajo de `.co-app`
 * para no afectar a otras herramientas de la suite.
 */
export function Raiz() {
  const [clienteConsultas] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 30_000 } } }),
  )
  return (
    <div className="co-app co-fondo" data-testid="co-raiz">
      <QueryClientProvider client={clienteConsultas}>
        {esModoDemo() ? <PantallaDemo /> : <PantallaConSesion />}
      </QueryClientProvider>
    </div>
  )
}

function PantallaConSesion() {
  const sesion = useSesion()
  if (sesion === undefined) return null
  if (sesion === null) return <Ingreso />
  return <PantallaPrincipal />
}

function PantallaPrincipal() {
  const ahora = useAhora()
  const config = useConfigMatriz(true)
  const tareas = useTareasMatriz(true)

  if (config.isPending || tareas.isPending) return null
  if (config.isError || tareas.isError) {
    return (
      <p role="alert" className="co-mensaje-central">
        No se pudieron cargar los datos. Se vuelve a intentar al recuperar la conexión.
      </p>
    )
  }
  if (config.data === null) return <CuentaNoHabilitada />
  return <Matriz tareas={tareas.data} config={config.data} ahora={ahora} />
}

/** Solo en desarrollo (`?demo`): matriz con datos de demostración. */
function PantallaDemo() {
  const ahora = useAhora()
  // Los datos se arman una vez; el paso del tiempo los hace avanzar de nivel.
  const tareas = useMemo(() => tareasDemo(), [])
  return (
    <>
      <Matriz
        tareas={tareas}
        config={{ umbrales: UMBRALES_POR_DEFECTO, disposicion: DISPOSICION_POR_DEFECTO }}
        ahora={ahora}
      />
      <span className="co-marca-demo co-etiqueta">Demo</span>
    </>
  )
}
