import {
  CheckCheck,
  FileText,
  FolderOpen,
  History,
  ListTodo,
  Plus,
  Settings,
  Trash2,
  UserRound,
  WifiOff,
} from 'lucide-react'
import { BordeHerramientas, type Herramienta } from '../features/bordes/BordeHerramientas'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanelHechas } from '../features/hechas/PanelHechas'
import {
  useCambiarEstado,
  useCambiosEnCurso,
  useEliminarTarea,
  useHechasHoy,
  useMoverTarea,
} from '../features/matriz/acciones'
import { ContextoAcciones, type AccionTarea, type RefTarea } from '../features/matriz/accionesTarea'
import { ProveedorArrastre } from '../features/matriz/Arrastre'
import { useArrastre, type Destino, type Origen } from '../features/matriz/arrastreContexto'
import { useMatriz } from '../features/matriz/datos'
import { Matriz } from '../features/matriz/Matriz'
import { useAhora } from '../features/matriz/useAhora'
import { Confirmacion } from '../features/tarea/Confirmacion'
import {
  CreacionRapida,
  type AltaPedida,
  type EstadoCreacion,
} from '../features/tarea/CreacionRapida'
import { ControlesPersona } from '../features/persona/ControlesPersona'
import { ContextoPersona, usePersonaActiva } from '../features/persona/persona'
import { QuienSoy } from '../features/persona/QuienSoy'
import { useCatalogos, useCrearTarea, useTareasProvisorias } from '../features/tarea/datos'
import { DetalleTarea } from '../features/tarea/DetalleTarea'
import { OrdenDeTrabajo } from '../features/tarea/OrdenDeTrabajo'
import { ErrorApi } from '../lib/api'
import { lanzarConfeti } from '../lib/confeti'
import { armarMensaje, copiarTexto } from '../lib/mensaje'
import { usaSupabase } from '../lib/supabase'
import { ContextoConexion, useTiempoReal, type EstadoConexion } from '../lib/tiempoReal'
import { movimiento } from '../lib/urgencia'
import { useModoPantalla } from '../lib/modoPantalla'
import { useNotificaciones } from '../lib/notificaciones'
import { leerModoDeLaDireccion, usePreferencia } from '../lib/preferencias'
import { SinAcceso } from './SinAcceso'

// Configuración se usa poco: se carga recién cuando se abre.
const Configuracion = lazy(() => import('../features/configuracion/Configuracion'))
const MisTareas = lazy(() => import('../features/mis-tareas/MisTareas'))
const Proyectos = lazy(() => import('../features/proyectos/Proyectos'))
const Historial = lazy(() => import('../features/historial/Historial'))

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
  /** Tarea nueva dentro de un proyecto. */
  proyectoId?: string
}

/** Aviso breve abajo; puede traer una acción ("Copiar mensaje"). */
interface Aviso {
  tipo: 'ok' | 'error'
  texto: string
  accion?: { texto: string; hacer: () => void }
}

/** Acciones que piden confirmación (especificación 6.4 y 6.5). */
interface PorConfirmar {
  accion: 'terminar' | 'entregar' | 'eliminar'
  tarea: RefTarea
}

const CONFIRMACIONES = {
  terminar: { titulo: '¿Terminar esta tarea?', texto: undefined, confirmar: 'Terminar' },
  entregar: {
    titulo: '¿Marcar como entregada?',
    texto: 'Sale de la matriz y pasa a "Entregados del día".',
    confirmar: 'Entregada',
  },
  eliminar: {
    titulo: '¿Eliminar esta tarea?',
    texto: 'Podrás recuperarla desde Configuración › Papelera durante 30 días.',
    confirmar: 'Eliminar',
  },
} as const

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Error del servidor')

export function PantallaPrincipal() {
  const ahora = useAhora()
  const matriz = useMatriz()
  const hechas = useHechasHoy(ahora)
  const conexion = useTiempoReal()
  const crear = useCrearTarea()
  const mover = useMoverTarea()
  const eliminar = useEliminarTarea()
  const cambiarEstado = useCambiarEstado()
  const provisorias = useTareasProvisorias()
  const aplicarEnCurso = useCambiosEnCurso()
  const [creando, setCreando] = useState<Creacion | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [porConfirmar, setPorConfirmar] = useState<PorConfirmar | null>(null)
  const [configurando, setConfigurando] = useState(false)
  const [viendoMisTareas, setViendoMisTareas] = useState(false)
  const [viendoProyectos, setViendoProyectos] = useState(false)
  const [viendoHistorial, setViendoHistorial] = useState(false)
  const [senalHechas, setSenalHechas] = useState(0)
  const catalogos = useCatalogos()
  const quien = usePersonaActiva(catalogos.data?.personas)
  /** "¿Quién soy?" abierto; si vino de una acción, se sigue con ella al elegir. */
  const [eligiendo, setEligiendo] = useState<{ motivo?: string; despues?: () => void } | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  // ?modo=pantalla deja el modo pantalla elegido en este dispositivo.
  useState(leerModoDeLaDireccion)
  const modoPantalla = usePreferencia('modo-pantalla')
  const notificaciones = usePreferencia('notificaciones')
  // Modo pantalla: si nadie toca nada por un rato, vuelve a la vista general.
  const { cursorOculto } = useModoPantalla(modoPantalla, () => {
    setCreando(null)
    setAbierta(null)
    setPorConfirmar(null)
    setConfigurando(false)
    setViendoMisTareas(false)
    setViendoProyectos(false)
    setViendoHistorial(false)
    setEligiendo(null)
  })
  useNotificaciones({
    activas: notificaciones,
    tareas: matriz.data?.tareas,
    persona: quien.persona,
    ahora,
    onAbrir: setAbierta,
  })
  const hayVentana =
    creando !== null ||
    abierta !== null ||
    porConfirmar !== null ||
    configurando ||
    eligiendo !== null ||
    viendoMisTareas ||
    viendoProyectos ||
    viendoHistorial

  /**
   * Crear, terminar, entregar y eliminar quedan a nombre de alguien
   * (especificación 7.6): sin persona elegida, primero se pregunta quién es.
   */
  const conPersona = (motivo: string, accion: () => void) => {
    if (quien.identificado) accion()
    else setEligiendo({ motivo, despues: accion })
  }
  const abrirAlta = (formulario: Creacion['formulario'], proyectoId?: string) =>
    conPersona('Para crear una tarea, elegí quién sos.', () =>
      setCreando({ formulario, proyectoId }),
    )

  // Los avisos se van solos.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), aviso.accion ? 9000 : 6000)
    return () => clearTimeout(t)
  }, [aviso])

  // Alta en segundo plano: la tarea ya se ve en la matriz (optimista).
  // Si el servidor la rechaza, el mismo formulario vuelve con lo cargado.
  const guardarNueva = (alta: AltaPedida, estado: EstadoCreacion) => {
    setCreando(null)
    crear.mutateAsync(alta).catch((e: unknown) =>
      setCreando({
        formulario: estado.formulario ?? 'rapida',
        proyectoId: estado.b.proyecto_id || undefined,
        inicial: estado,
        error: mensaje(e),
      }),
    )
  }

  const tareas = useMemo(() => {
    const reales = matriz.data?.tareas ?? []
    const nuevas = provisorias.filter(
      (p) => p.mostrar_en_matriz !== false && !reales.some((t) => t.id === p.id),
    )
    return aplicarEnCurso(nuevas.length > 0 ? [...reales, ...nuevas] : reales)
  }, [matriz.data, provisorias, aplicarEnCurso])

  const conectado = conexion !== 'sin_conexion'
  const sinConexion = () =>
    setAviso({ tipo: 'error', texto: 'Sin conexión: no se puede guardar hasta que vuelva.' })

  /** "Copiar mensaje" y "Copiar teléfono" (especificación 6.7). */
  const copiar = async (t: RefTarea, que: 'mensaje' | 'telefono') => {
    const texto =
      que === 'telefono'
        ? (t.cliente?.telefono ?? '')
        : armarMensaje(matriz.data?.config.plantilla ?? '', {
            nombre: t.cliente?.nombre ?? null,
            trabajo: t.titulo,
            saldo: t.saldo,
          })
    const ok = await copiarTexto(texto)
    setAviso(
      ok
        ? { tipo: 'ok', texto: que === 'telefono' ? 'Teléfono copiado' : 'Mensaje copiado' }
        : { tipo: 'error', texto: 'No se pudo copiar. Probá de nuevo.' },
    )
  }

  const devolver = (t: RefTarea) => {
    if (!conectado) return sinConexion()
    cambiarEstado
      .mutateAsync({ id: t.id, cambio: 'devolver', tipo: t.tipo })
      .then(() => setAviso({ tipo: 'ok', texto: `"${t.titulo}" volvió a su estado anterior` }))
      .catch((e: unknown) =>
        setAviso({ tipo: 'error', texto: `No se pudo devolver "${t.titulo}": ${mensaje(e)}` }),
      )
  }

  const ejecutar = (accion: AccionTarea, t: RefTarea) => {
    if (accion === 'abrir') return setAbierta(t.id)
    if (accion === 'copiar-mensaje') return void copiar(t, 'mensaje')
    if (accion === 'copiar-telefono') return void copiar(t, 'telefono')
    if (accion === 'devolver') return devolver(t)
    if (!conectado) return sinConexion()
    conPersona('Para esto, elegí quién sos.', () => setPorConfirmar({ accion, tarea: t }))
  }

  const confirmar = () => {
    if (!porConfirmar) return
    const { accion, tarea: t } = porConfirmar
    setPorConfirmar(null)
    if (accion === 'eliminar') {
      if (abierta === t.id) setAbierta(null)
      eliminar
        .mutateAsync(t.id)
        .catch((e: unknown) =>
          setAviso({ tipo: 'error', texto: `No se pudo eliminar "${t.titulo}": ${mensaje(e)}` }),
        )
      return
    }
    if (accion === 'terminar' && matriz.data?.config.confeti && raiz.current) {
      // Confeti azul y blanco desde la tarjeta (o desde el centro).
      const globo = raiz.current.querySelector(`[data-tarea-id="${CSS.escape(t.id)}"]`)
      const caja = globo?.getBoundingClientRect()
      lanzarConfeti(
        caja
          ? { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        raiz.current,
      )
    }
    if (accion === 'entregar' && abierta === t.id) setAbierta(null)
    cambiarEstado
      .mutateAsync({ id: t.id, cambio: accion, tipo: t.tipo })
      .then(() => {
        if (accion === 'entregar') {
          setAviso({ tipo: 'ok', texto: `"${t.titulo}" pasó a Entregados del día` })
        } else if (t.tipo === 'pedido') {
          // Al terminar un pedido, el mensaje para avisar al cliente queda a mano.
          setAviso({
            tipo: 'ok',
            texto: `"${t.titulo}" terminada`,
            accion: { texto: 'Copiar mensaje', hacer: () => void copiar(t, 'mensaje') },
          })
        } else {
          setAviso({ tipo: 'ok', texto: `"${t.titulo}" pasó a Hechas hoy` })
        }
      })
      .catch((e: unknown) =>
        setAviso({ tipo: 'error', texto: `No se pudo guardar "${t.titulo}": ${mensaje(e)}` }),
      )
  }

  const ejecutarRef = useRef(ejecutar)
  const abrirAltaRef = useRef(abrirAlta)
  useEffect(() => {
    ejecutarRef.current = ejecutar
    abrirAltaRef.current = abrirAlta
  })

  // Lo necesario para soltar, siempre al día (la función de soltar se crea una vez).
  const actual = useRef({
    tareas,
    hechas: hechas.data,
    matriz: matriz.data,
    ahora,
    conectado,
    devolver,
    pedirEliminar: (t: RefTarea) => ejecutarRef.current('eliminar', t),
  })
  useEffect(() => {
    actual.current = { ...actual.current, tareas, hechas: hechas.data, matriz: matriz.data }
    actual.current.ahora = ahora
    actual.current.conectado = conectado
    actual.current.devolver = devolver
  })

  const soltar = useCallback(
    (id: string, destino: Destino, origen: Origen) => {
      const { tareas, hechas, matriz, ahora, conectado, devolver, pedirEliminar } = actual.current
      if (!conectado) {
        setAviso({ tipo: 'error', texto: 'Sin conexión: no se puede guardar hasta que vuelva.' })
        return
      }
      const delPanel = [...(hechas?.terminadas ?? []), ...(hechas?.entregadas ?? [])].find(
        (t) => t.id === id,
      )
      const tarea = origen === 'panel' ? delPanel : tareas.find((t) => t.id === id)
      if (!tarea) return
      if (destino.tipo === 'papelera') return pedirEliminar(tarea)
      // Del panel "Hechas hoy" a la matriz: vuelve a su estado anterior.
      if (origen === 'panel') return devolver(tarea)
      if (!matriz) return
      const cambio = movimiento(tarea, destino.id, matriz.config.umbrales, ahora)
      if (!cambio) return
      mover
        .mutateAsync({ id, ...cambio })
        .catch((e: unknown) =>
          setAviso({ tipo: 'error', texto: `No se pudo mover "${tarea.titulo}": ${mensaje(e)}` }),
        )
    },
    [mover],
  )

  // Atajos: N = tarea rápida, O = orden de trabajo (especificación 7.5).
  useEffect(() => {
    if (hayVentana) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || escribiendo(e.target)) return
      const tecla = e.key.toLowerCase()
      if (tecla !== 'n' && tecla !== 'o') return
      e.preventDefault()
      abrirAltaRef.current(tecla === 'o' ? 'ot' : 'rapida')
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [hayVentana])

  if (matriz.isPending) return null
  // Sin datos para mostrar: el servidor nunca respondió. (Si ya hay datos y se
  // corta, la matriz sigue a la vista con el indicador "Sin conexión".)
  if (!matriz.data) {
    if (matriz.error instanceof ErrorApi && matriz.error.estado === 403) return <SinAcceso />
    return (
      <p role="alert" className="co-mensaje-central">
        {usaSupabase
          ? 'No se pudo conectar. Revisá la conexión a internet.'
          : 'No se pudo conectar con el servidor del local. Revisá que esté encendido.'}
      </p>
    )
  }

  const propsFormulario = {
    ahora,
    inicial: creando?.inicial,
    error: creando?.error,
    onGuardar: guardarNueva,
    onCerrar: () => setCreando(null),
    proyectoId: creando?.proyectoId,
  }
  // Menú del borde (especificación 7.10): todo a mano, en un solo lugar.
  const herramientas: Herramienta[] = [
    {
      id: 'crear',
      texto: 'Crear tarea',
      icono: Plus,
      atajo: 'N',
      hacer: () => abrirAlta('rapida'),
    },
    {
      id: 'ot',
      texto: 'Orden de trabajo',
      icono: FileText,
      atajo: 'O',
      hacer: () => abrirAlta('ot'),
    },
    { id: 'quien', texto: '¿Quién soy?', icono: UserRound, hacer: () => setEligiendo({}) },
    ...(quien.persona
      ? [
          {
            id: 'mis',
            texto: 'Mis tareas',
            icono: ListTodo,
            hacer: () => setViendoMisTareas(true),
          },
        ]
      : []),
    {
      id: 'proyectos',
      texto: 'Proyectos',
      icono: FolderOpen,
      hacer: () => setViendoProyectos(true),
    },
    {
      id: 'hechas',
      texto: 'Hechas hoy',
      icono: CheckCheck,
      hacer: () => setSenalHechas((n) => n + 1),
    },
    { id: 'historial', texto: 'Historial', icono: History, hacer: () => setViendoHistorial(true) },
    {
      id: 'configuracion',
      texto: 'Configuración',
      icono: Settings,
      hacer: () => setConfigurando(true),
    },
  ]
  const confirmacion = porConfirmar
    ? porConfirmar.accion === 'eliminar'
      ? {
          ...CONFIRMACIONES.eliminar,
          texto: `Podrás recuperarla desde Configuración › Papelera durante ${matriz.data.config.papeleraDias} días.`,
        }
      : CONFIRMACIONES[porConfirmar.accion]
    : null

  return (
    <ContextoConexion.Provider value={conexion}>
      <ContextoPersona.Provider value={{ persona: quien.persona, resaltar: quien.resaltar }}>
        <ContextoAcciones.Provider value={ejecutar}>
          <div
            ref={raiz}
            className="co-contenido"
            data-modo-pantalla={modoPantalla || undefined}
            data-cursor-oculto={cursorOculto || undefined}
          >
            <ProveedorArrastre onSoltar={soltar}>
              <Matriz
                tareas={tareas}
                config={matriz.data.config}
                ahora={ahora}
                onAbrir={setAbierta}
              />
              <Controles
                onCrear={() => abrirAlta('rapida')}
                onCrearOT={() => abrirAlta('ot')}
                onConfigurar={() => setConfigurando(true)}
              />
              <PanelHechas
                hechas={hechas.data}
                ejecutar={ejecutar}
                onAbrir={setAbierta}
                abrirSenal={senalHechas}
              />
              <BordeHerramientas herramientas={herramientas} bloqueado={hayVentana} />
            </ProveedorArrastre>
            <ControlesPersona
              persona={quien.persona}
              resaltar={quien.resaltar}
              onElegir={() => setEligiendo({})}
              onResaltar={() => quien.setResaltar(!quien.resaltar)}
              onMisTareas={() => setViendoMisTareas(true)}
              onProyectos={() => setViendoProyectos(true)}
            />
            <IndicadorConexion estado={conexion} />
            {aviso && (
              <div
                className={`co-aviso-flotante co-aviso-flotante--${aviso.tipo}`}
                role={aviso.tipo === 'error' ? 'alert' : 'status'}
              >
                <span>{aviso.texto}</span>
                {aviso.accion && (
                  <button
                    type="button"
                    className="co-boton-sutil"
                    onClick={() => {
                      aviso.accion?.hacer()
                    }}
                  >
                    {aviso.accion.texto}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Vistas grandes primero: lo que se abre desde ellas (detalle, alta,
              ¿Quién soy?) queda por encima. */}
          {viendoMisTareas && quien.persona && (
            <Suspense fallback={null}>
              <MisTareas
                persona={quien.persona}
                ahora={ahora}
                onAbrir={setAbierta}
                onCerrar={() => setViendoMisTareas(false)}
              />
            </Suspense>
          )}
          {viendoProyectos && (
            <Suspense fallback={null}>
              <Proyectos
                ahora={ahora}
                onAbrirTarea={setAbierta}
                onCrearTarea={(id) => abrirAlta('rapida', id)}
                onCerrar={() => setViendoProyectos(false)}
              />
            </Suspense>
          )}
          {creando?.formulario === 'rapida' && <CreacionRapida {...propsFormulario} />}
          {creando?.formulario === 'ot' && <OrdenDeTrabajo {...propsFormulario} />}
          {abierta && (
            <DetalleTarea
              key={abierta}
              id={abierta}
              ahora={ahora}
              umbrales={matriz.data.config.umbrales}
              onCerrar={() => setAbierta(null)}
              onAccion={ejecutar}
              onAbrirOtra={setAbierta}
            />
          )}
          {porConfirmar && confirmacion && (
            <Confirmacion
              titulo={confirmacion.titulo}
              texto={confirmacion.texto}
              confirmar={confirmacion.confirmar}
              peligro={porConfirmar.accion === 'eliminar'}
              onCancelar={() => setPorConfirmar(null)}
              onConfirmar={confirmar}
            />
          )}
          {eligiendo && (
            <QuienSoy
              personas={catalogos.data?.personas ?? []}
              actual={quien.persona}
              motivo={eligiendo.motivo}
              onCerrar={() => setEligiendo(null)}
              onElegir={(p) => {
                quien.elegir(p)
                const despues = eligiendo.despues
                setEligiendo(null)
                if (p && despues) despues()
              }}
            />
          )}
          {viendoHistorial && (
            <Suspense fallback={null}>
              <Historial
                ahora={ahora}
                onAbrirTarea={setAbierta}
                onCerrar={() => setViendoHistorial(false)}
              />
            </Suspense>
          )}
          {configurando && (
            <Suspense fallback={null}>
              <Configuracion ahora={ahora} onCerrar={() => setConfigurando(false)} />
            </Suspense>
          )}
        </ContextoAcciones.Provider>
      </ContextoPersona.Provider>
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
