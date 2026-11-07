import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useMatriz } from '../features/matriz/datos'
import { Matriz } from '../features/matriz/Matriz'
import { useAhora } from '../features/matriz/useAhora'
import { CreacionRapida } from '../features/tarea/CreacionRapida'
import { DetalleTarea } from '../features/tarea/DetalleTarea'

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

/** No interceptar atajos mientras se escribe. */
function escribiendo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false
  return destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName)
}

function PantallaPrincipal() {
  const ahora = useAhora()
  const matriz = useMatriz()
  const [creando, setCreando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const hayVentana = creando || abierta !== null

  // Tecla N: creación rápida (especificación 7.5).
  useEffect(() => {
    if (hayVentana) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      if (escribiendo(e.target)) return
      e.preventDefault()
      setCreando(true)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [hayVentana])

  if (matriz.isPending) return null
  if (matriz.isError) {
    return (
      <p role="alert" className="co-mensaje-central">
        No se pudo conectar con el servidor del local. Revisá que esté encendido.
      </p>
    )
  }
  return (
    <>
      <Matriz
        tareas={matriz.data.tareas}
        config={matriz.data.config}
        ahora={ahora}
        onAbrir={setAbierta}
      />
      <button
        type="button"
        className="co-boton-crear"
        aria-label="Crear tarea"
        title="Crear tarea (N)"
        onClick={() => setCreando(true)}
      >
        <Plus size={22} aria-hidden strokeWidth={2} />
      </button>
      {creando && <CreacionRapida ahora={ahora} onCerrar={() => setCreando(false)} />}
      {abierta && (
        <DetalleTarea
          id={abierta}
          ahora={ahora}
          umbrales={matriz.data.config.umbrales}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </>
  )
}
