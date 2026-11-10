import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { PantallaPrincipal } from './PantallaPrincipal'

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
