import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Plus, WifiOff } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useMatriz } from '../features/matriz/datos'
import { Matriz } from '../features/matriz/Matriz'
import { useAhora } from '../features/matriz/useAhora'
import {
  CreacionRapida,
  type AltaPedida,
  type EstadoCreacion,
} from '../features/tarea/CreacionRapida'
import { useCrearTarea, useTareasProvisorias } from '../features/tarea/datos'
import { DetalleTarea } from '../features/tarea/DetalleTarea'
import { ContextoConexion, useTiempoReal, type EstadoConexion } from '../lib/tiempoReal'

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

/** Formulario de creación abierto; tras un rechazo, con lo cargado y el motivo. */
interface Creacion {
  inicial?: EstadoCreacion
  error?: string
}

function PantallaPrincipal() {
  const ahora = useAhora()
  const matriz = useMatriz()
  const conexion = useTiempoReal()
  const crear = useCrearTarea()
  const provisorias = useTareasProvisorias()
  const [creando, setCreando] = useState<Creacion | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const hayVentana = creando !== null || abierta !== null

  // Se guarda en segundo plano: la tarea ya se ve en la matriz (optimista).
  // Si el servidor la rechaza, el formulario vuelve a abrirse con lo cargado.
  const guardarNueva = (alta: AltaPedida, estado: EstadoCreacion) => {
    setCreando(null)
    crear.mutateAsync(alta).catch((e: unknown) =>
      setCreando({
        inicial: estado,
        error: e instanceof Error ? e.message : 'Error del servidor',
      }),
    )
  }

  const tareas = useMemo(() => {
    const reales = matriz.data?.tareas ?? []
    const nuevas = provisorias.filter((p) => !reales.some((t) => t.id === p.id))
    return nuevas.length > 0 ? [...reales, ...nuevas] : reales
  }, [matriz.data, provisorias])

  // Tecla N: creación rápida (especificación 7.5).
  useEffect(() => {
    if (hayVentana) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      if (escribiendo(e.target)) return
      e.preventDefault()
      setCreando({})
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [hayVentana])

  if (matriz.isPending) return null
  // Sin datos para mostrar: el servidor nunca respondió. (Si ya hay datos y se
  // corta, la matriz sigue a la vista con el indicador "Sin conexión".)
  if (!matriz.data) {
    return (
      <p role="alert" className="co-mensaje-central">
        No se pudo conectar con el servidor del local. Revisá que esté encendido.
      </p>
    )
  }
  return (
    <ContextoConexion.Provider value={conexion}>
      <Matriz tareas={tareas} config={matriz.data.config} ahora={ahora} onAbrir={setAbierta} />
      <IndicadorConexion estado={conexion} />
      <button
        type="button"
        className="co-boton-crear"
        aria-label="Crear tarea"
        title="Crear tarea (N)"
        onClick={() => setCreando({})}
      >
        <Plus size={22} aria-hidden strokeWidth={2} />
      </button>
      {creando && (
        <CreacionRapida
          ahora={ahora}
          inicial={creando.inicial}
          error={creando.error}
          onGuardar={guardarNueva}
          onCerrar={() => setCreando(null)}
        />
      )}
      {abierta && (
        <DetalleTarea
          id={abierta}
          ahora={ahora}
          umbrales={matriz.data.config.umbrales}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </ContextoConexion.Provider>
  )
}

/** Indicador discreto, solo cuando hay un corte (especificación 8). */
function IndicadorConexion({ estado }: { estado: EstadoConexion }) {
  if (estado !== 'sin_conexion') return null
  return (
    <p className="co-sin-conexion" role="status">
      <WifiOff size={14} aria-hidden strokeWidth={2} />
      Sin conexión · reconectando
    </p>
  )
}
