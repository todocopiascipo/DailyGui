import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { useMatriz } from '../features/matriz/datos'
import { Matriz } from '../features/matriz/Matriz'
import { useAhora } from '../features/matriz/useAhora'

// Datos de demostración: solo existen en desarrollo y no entran en el build final.
const PantallaDemo = import.meta.env.DEV
  ? lazy(() => import('../features/matriz/PantallaDemo'))
  : null
const modoDemo = () =>
  PantallaDemo !== null && new URLSearchParams(window.location.search).has('demo')

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
        {PantallaDemo && modoDemo() ? (
          <Suspense fallback={null}>
            <PantallaDemo />
          </Suspense>
        ) : (
          <PantallaPrincipal />
        )}
      </QueryClientProvider>
    </div>
  )
}

function PantallaPrincipal() {
  const ahora = useAhora()
  const matriz = useMatriz()

  if (matriz.isPending) return null
  if (matriz.isError) {
    return (
      <p role="alert" className="co-mensaje-central">
        No se pudo conectar con el servidor del local. Revisá que esté encendido.
      </p>
    )
  }
  return <Matriz tareas={matriz.data.tareas} config={matriz.data.config} ahora={ahora} />
}
