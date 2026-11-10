import { FileText, Plus, Settings, Trash2, WifiOff } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCambiosEnCurso, useEliminarTarea, useMoverTarea } from '../features/matriz/acciones'
import { ProveedorArrastre } from '../features/matriz/Arrastre'
import { useArrastre, type Destino } from '../features/matriz/arrastreContexto'
import { useMatriz } from '../features/matriz/datos'
import { Matriz } from '../features/matriz/Matriz'
import { useAhora } from '../features/matriz/useAhora'
import { Confirmacion } from '../features/tarea/Confirmacion'
import {
  CreacionRapida,
  type AltaPedida,
  type EstadoCreacion,
} from '../features/tarea/CreacionRapida'
import { useCrearTarea, useTareasProvisorias } from '../features/tarea/datos'
import { DetalleTarea } from '../features/tarea/DetalleTarea'
import { OrdenDeTrabajo } from '../features/tarea/OrdenDeTrabajo'
import { ContextoConexion, useTiempoReal, type EstadoConexion } from '../lib/tiempoReal'
import { movimiento } from '../lib/urgencia'

// Configuración se usa poco: se carga recién cuando se abre.
const Configuracion = lazy(() => import('../features/configuracion/Configuracion'))

/** No interceptar atajos mientras se escribe. */
function escribiendo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false
  return destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName)
}

/** Formulario de alta abierto; tras un rechazo, con lo cargado y el motivo. */
interface Creacion {
  formulario: 'rapida' | 'ot'
  inicial?: EstadoCreacion
  error?: string
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Error del servidor')

export function PantallaPrincipal() {
  const ahora = useAhora()
  const matriz = useMatriz()
  const conexion = useTiempoReal()
  const crear = useCrearTarea()
  const mover = useMoverTarea()
  const eliminar = useEliminarTarea()
  const provisorias = useTareasProvisorias()
  const aplicarEnCurso = useCambiosEnCurso()
  const [creando, setCreando] = useState<Creacion | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [aEliminar, setAEliminar] = useState<string | null>(null)
  const [configurando, setConfigurando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const hayVentana = creando !== null || abierta !== null || aEliminar !== null || configurando

  // Avisos breves (por ej., si el servidor rechaza un movimiento).
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 6000)
    return () => clearTimeout(t)
  }, [aviso])

  // Alta en segundo plano: la tarea ya se ve en la matriz (optimista).
  // Si el servidor la rechaza, el mismo formulario vuelve con lo cargado.
  const guardarNueva = (alta: AltaPedida, estado: EstadoCreacion) => {
    setCreando(null)
    crear.mutateAsync(alta).catch((e: unknown) =>
      setCreando({
        formulario: estado.formulario ?? 'rapida',
        inicial: estado,
        error: mensaje(e),
      }),
    )
  }

  const tareas = useMemo(() => {
    const reales = matriz.data?.tareas ?? []
    const nuevas = provisorias.filter((p) => !reales.some((t) => t.id === p.id))
    return aplicarEnCurso(nuevas.length > 0 ? [...reales, ...nuevas] : reales)
  }, [matriz.data, provisorias, aplicarEnCurso])

  // Lo necesario para soltar, siempre al día (la función de soltar se crea una vez).
  const actual = useRef({ tareas, matriz: matriz.data, ahora, conectado: true })
  useEffect(() => {
    actual.current = { tareas, matriz: matriz.data, ahora, conectado: conexion !== 'sin_conexion' }
  })

  const soltar = useCallback(
    (id: string, destino: Destino) => {
      const { tareas, matriz, ahora, conectado } = actual.current
      if (!conectado) {
        setAviso('Sin conexión: no se puede mover ni eliminar hasta que vuelva.')
        return
      }
      if (destino.tipo === 'papelera') {
        setAEliminar(id)
        return
      }
      const tarea = tareas.find((t) => t.id === id)
      if (!tarea || !matriz) return
      const cambio = movimiento(tarea, destino.id, matriz.config.umbrales, ahora)
      if (!cambio) return
      mover
        .mutateAsync({ id, ...cambio })
        .catch((e: unknown) => setAviso(`No se pudo mover "${tarea.titulo}": ${mensaje(e)}`))
    },
    [mover],
  )

  const confirmarEliminar = () => {
    const id = aEliminar
    if (!id) return
    const titulo = tareas.find((t) => t.id === id)?.titulo ?? 'la tarea'
    setAEliminar(null)
    if (abierta === id) setAbierta(null)
    eliminar
      .mutateAsync(id)
      .catch((e: unknown) => setAviso(`No se pudo eliminar "${titulo}": ${mensaje(e)}`))
  }

  // Atajos: N = tarea rápida, O = orden de trabajo (especificación 7.5).
  useEffect(() => {
    if (hayVentana) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || escribiendo(e.target)) return
      const tecla = e.key.toLowerCase()
      if (tecla !== 'n' && tecla !== 'o') return
      e.preventDefault()
      setCreando({ formulario: tecla === 'o' ? 'ot' : 'rapida' })
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

  const propsFormulario = {
    ahora,
    inicial: creando?.inicial,
    error: creando?.error,
    onGuardar: guardarNueva,
    onCerrar: () => setCreando(null),
  }

  return (
    <ContextoConexion.Provider value={conexion}>
      <ProveedorArrastre onSoltar={soltar}>
        <Matriz tareas={tareas} config={matriz.data.config} ahora={ahora} onAbrir={setAbierta} />
        <Controles
          onCrear={() => setCreando({ formulario: 'rapida' })}
          onCrearOT={() => setCreando({ formulario: 'ot' })}
          onConfigurar={() => setConfigurando(true)}
        />
      </ProveedorArrastre>
      <IndicadorConexion estado={conexion} />
      {aviso && (
        <p className="co-aviso-flotante" role="alert">
          {aviso}
        </p>
      )}

      {creando?.formulario === 'rapida' && <CreacionRapida {...propsFormulario} />}
      {creando?.formulario === 'ot' && <OrdenDeTrabajo {...propsFormulario} />}
      {abierta && (
        <DetalleTarea
          id={abierta}
          ahora={ahora}
          umbrales={matriz.data.config.umbrales}
          onCerrar={() => setAbierta(null)}
          onEliminar={setAEliminar}
        />
      )}
      {aEliminar && (
        <Confirmacion
          titulo="¿Eliminar esta tarea?"
          texto="Podrás recuperarla desde Configuración › Papelera durante 30 días."
          confirmar="Eliminar"
          peligro
          onCancelar={() => setAEliminar(null)}
          onConfirmar={confirmarEliminar}
        />
      )}
      {configurando && (
        <Suspense fallback={null}>
          <Configuracion ahora={ahora} onCerrar={() => setConfigurando(false)} />
        </Suspense>
      )}
    </ContextoConexion.Provider>
  )
}

/**
 * Botones de abajo: "+" (tarea rápida) y "OT" (orden de trabajo), casi
 * transparentes; Configuración, más discreta, en la esquina. Mientras se
 * arrastra un globo, en su lugar aparece el tacho (especificación 6.5).
 */
function Controles({
  onCrear,
  onCrearOT,
  onConfigurar,
}: {
  onCrear: () => void
  onCrearOT: () => void
  onConfigurar: () => void
}) {
  const arrastre = useArrastre()
  if (arrastre?.levantado) {
    const activo = arrastre.sobre?.tipo === 'papelera'
    return (
      <div className="co-papelera" data-papelera data-activa={activo || undefined}>
        <Trash2 size={22} aria-hidden strokeWidth={1.75} />
        <span>{activo ? 'Soltá para eliminar' : 'Eliminar'}</span>
      </div>
    )
  }
  return (
    <>
      <div className="co-crear">
        <button
          type="button"
          className="co-boton-crear"
          aria-label="Crear tarea"
          title="Crear tarea (N)"
          onClick={onCrear}
        >
          <Plus size={22} aria-hidden strokeWidth={2} />
        </button>
        <button
          type="button"
          className="co-boton-crear co-boton-crear--ot"
          aria-label="Crear orden de trabajo"
          title="Orden de trabajo (O)"
          onClick={onCrearOT}
        >
          <FileText size={16} aria-hidden strokeWidth={2} />
          OT
        </button>
      </div>
      <button
        type="button"
        className="co-boton-configurar"
        aria-label="Configuración"
        title="Configuración"
        onClick={onConfigurar}
      >
        <Settings size={18} aria-hidden strokeWidth={1.75} />
      </button>
    </>
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
