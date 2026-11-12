/**
 * Proyectos internos (especificación 7.9, decisión 11): vista propia, aparte
 * de la matriz. Lista con estado, responsable, fecha objetivo y avance; dentro
 * de cada proyecto, sus tareas (crear, abrir, terminar, reordenar y elegir si
 * aparecen en la matriz) y su historial. Se carga diferido.
 */
import { formatInTimeZone } from 'date-fns-tz'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  LayoutGrid,
  Plus,
  Trash2,
} from 'lucide-react'
import { useId, useState } from 'react'
import { aFechaHora, aIso } from '../../lib/fechas'
import { textoEntrega, ZONA_HORARIA } from '../../lib/tiempo'
import { useConectado } from '../../lib/tiempoReal'
import { useAcciones } from '../matriz/accionesTarea'
import type { TareaMatriz } from '../matriz/tipos'
import { AvisoSinConexion } from '../tarea/AvisoSinConexion'
import { Confirmacion } from '../tarea/Confirmacion'
import { Campo } from '../tarea/controles'
import { useCatalogos } from '../tarea/datos'
import { Dialogo } from '../tarea/Dialogo'
import { describirEvento, momentoEvento, NOMBRES_ESTADO } from '../tarea/historial'
import { SelectorCategoria } from '../tarea/SelectorCategoria'
import {
  useBorrarProyecto,
  useCrearProyecto,
  useEditarProyecto,
  useMostrarEnMatriz,
  useOrdenarTareas,
  useProyecto,
  useProyectos,
  type CamposProyecto,
} from './datos'
import { NOMBRE_ESTADO_PROYECTO, type ProyectoResumen } from './tipos'

interface Props {
  ahora: Date
  /** Abrir el detalle de una tarea (el mismo de la matriz). */
  onAbrirTarea: (id: string) => void
  /** Crear una tarea interna dentro del proyecto (el formulario del "+"). */
  onCrearTarea: (proyectoId: string) => void
  onCerrar: () => void
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Error del servidor')

/** Fecha sola (aaaa-mm-dd) del local ↔ instante ISO (a las 00:00 del local). */
const fechaDe = (iso: string | null) => aFechaHora(iso).fecha
const isoDe = (fecha: string) => (fecha ? aIso({ fecha, hora: '00:00' }) : null)
const fechaCorta = (iso: string) => formatInTimeZone(new Date(iso), ZONA_HORARIA, 'dd/MM/yyyy')

export default function Proyectos({ ahora, onAbrirTarea, onCrearTarea, onCerrar }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null)
  return abierto ? (
    <DetalleProyecto
      key={abierto}
      id={abierto}
      ahora={ahora}
      onVolver={() => setAbierto(null)}
      onAbrirTarea={onAbrirTarea}
      onCrearTarea={onCrearTarea}
      onCerrar={onCerrar}
    />
  ) : (
    <ListaProyectos onAbrir={setAbierto} onCerrar={onCerrar} />
  )
}

function ListaProyectos({
  onAbrir,
  onCerrar,
}: {
  onAbrir: (id: string) => void
  onCerrar: () => void
}) {
  const proyectos = useProyectos()
  const crear = useCrearProyecto()
  const conectado = useConectado()
  const idForm = useId()
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const lista = proyectos.data ?? []
  const abiertos = lista.filter((p) => p.estado === 'activo' || p.estado === 'en_pausa')
  const cerrados = lista.filter((p) => p.estado === 'terminado' || p.estado === 'cancelado')

  const nuevo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!conectado) return
    if (nombre.trim() === '') return setError('Escribí el nombre del proyecto')
    setError(null)
    crear
      .mutateAsync({ nombre: nombre.trim() })
      .then((d) => {
        setNombre('')
        onAbrir(d.proyecto.id)
      })
      .catch((e: unknown) => setError(mensaje(e)))
  }

  return (
    <Dialogo titulo="Proyectos" variante="amplia" sinGuardar={false} onCerrar={onCerrar}>
      <AvisoSinConexion />
      <form id={idForm} className="co-proyecto-nuevo" onSubmit={nuevo} noValidate>
        <input
          className="co-entrada"
          aria-label="Nombre del proyecto nuevo"
          placeholder="Nombre del proyecto nuevo"
          maxLength={120}
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setError(null)
          }}
        />
        <button type="submit" className="co-boton" disabled={!conectado || crear.isPending}>
          <Plus size={16} aria-hidden /> Crear proyecto
        </button>
      </form>
      {error && (
        <p className="co-aviso" role="alert">
          {error}
        </p>
      )}

      {proyectos.isPending && <p className="co-texto-suave">Cargando…</p>}
      {proyectos.isError && (
        <p className="co-aviso" role="alert">
          No se pudieron cargar los proyectos: {proyectos.error.message}
        </p>
      )}
      {proyectos.data && lista.length === 0 && (
        <p className="co-mensaje-vacio">
          Todavía no hay proyectos. Un proyecto junta tareas internas de mediano plazo (por ejemplo,
          una mejora del local).
        </p>
      )}

      {abiertos.length > 0 && (
        <ul className="co-proyectos" aria-label="Proyectos en curso">
          {abiertos.map((p) => (
            <FilaProyecto key={p.id} proyecto={p} onAbrir={onAbrir} />
          ))}
        </ul>
      )}
      {cerrados.length > 0 && (
        <details className="co-seccion">
          <summary className="co-campo__etiqueta">
            Terminados y cancelados ({cerrados.length})
          </summary>
          <ul className="co-proyectos" aria-label="Proyectos terminados y cancelados">
            {cerrados.map((p) => (
              <FilaProyecto key={p.id} proyecto={p} onAbrir={onAbrir} />
            ))}
          </ul>
        </details>
      )}
    </Dialogo>
  )
}

function Avance({ progreso }: { progreso: ProyectoResumen['progreso'] }) {
  const { total, hechas } = progreso
  const porcentaje = total === 0 ? 0 : Math.round((hechas / total) * 100)
  return (
    <span className="co-avance">
      <span
        className="co-avance__barra"
        role="progressbar"
        aria-label="Avance"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={hechas}
      >
        <span style={{ width: `${porcentaje}%` }} />
      </span>
      <span className="co-texto-suave">
        {total === 0 ? 'Sin tareas' : `${hechas}/${total} tareas`}
      </span>
    </span>
  )
}

function FilaProyecto({
  proyecto: p,
  onAbrir,
}: {
  proyecto: ProyectoResumen
  onAbrir: (id: string) => void
}) {
  return (
    <li>
      <button type="button" className="co-proyecto" onClick={() => onAbrir(p.id)}>
        <span className="co-proyecto__cabecera">
          <strong>{p.nombre}</strong>
          <span className="co-chip-estado" data-estado={p.estado}>
            {NOMBRE_ESTADO_PROYECTO[p.estado]}
          </span>
        </span>
        <span className="co-proyecto__datos co-texto-suave">
          <span>{p.responsable ? p.responsable.nombre : 'Sin responsable'}</span>
          {p.fecha_objetivo && <span>Objetivo: {fechaCorta(p.fecha_objetivo)}</span>}
        </span>
        <Avance progreso={p.progreso} />
        <ChevronRight size={18} aria-hidden className="co-proyecto__flecha" />
      </button>
    </li>
  )
}

interface BorradorProyecto {
  nombre: string
  descripcion: string
  estado: ProyectoResumen['estado']
  responsable_id: string
  categoria_id: string
  inicio: string
  objetivo: string
}

const borradorDe = (p: ProyectoResumen): BorradorProyecto => ({
  nombre: p.nombre,
  descripcion: p.descripcion ?? '',
  estado: p.estado,
  responsable_id: p.responsable?.id ?? '',
  categoria_id: p.categoria_id ?? '',
  inicio: fechaDe(p.fecha_inicio),
  objetivo: fechaDe(p.fecha_objetivo),
})

/** Solo lo que cambió, como lo espera la API. */
function cambiosDe(b: BorradorProyecto, p: ProyectoResumen): CamposProyecto {
  const antes = borradorDe(p)
  const c: CamposProyecto = {}
  if (b.nombre.trim() !== antes.nombre) c.nombre = b.nombre.trim()
  if (b.descripcion.trim() !== antes.descripcion) c.descripcion = b.descripcion.trim() || null
  if (b.estado !== antes.estado) c.estado = b.estado
  if (b.responsable_id !== antes.responsable_id) c.responsable_id = b.responsable_id || null
  if (b.categoria_id !== antes.categoria_id) c.categoria_id = b.categoria_id || null
  if (b.inicio !== antes.inicio) c.fecha_inicio = isoDe(b.inicio)
  if (b.objetivo !== antes.objetivo) c.fecha_objetivo = isoDe(b.objetivo)
  return c
}

function DetalleProyecto({
  id,
  ahora,
  onVolver,
  onAbrirTarea,
  onCrearTarea,
  onCerrar,
}: {
  id: string
  ahora: Date
  onVolver: () => void
  onAbrirTarea: (id: string) => void
  onCrearTarea: (proyectoId: string) => void
  onCerrar: () => void
}) {
  const consulta = useProyecto(id)
  const d = consulta.data
  return (
    <Dialogo
      titulo={d ? d.proyecto.nombre : 'Proyecto'}
      variante="amplia"
      sinGuardar={false}
      onCerrar={onCerrar}
    >
      <button type="button" className="co-boton-sutil co-alinear-inicio" onClick={onVolver}>
        <ArrowLeft size={14} aria-hidden /> Todos los proyectos
      </button>
      <AvisoSinConexion />
      {consulta.isPending && <p className="co-texto-suave">Cargando…</p>}
      {consulta.isError && (
        <p className="co-aviso" role="alert">
          No se pudo cargar el proyecto: {consulta.error.message}
        </p>
      )}
      {d && (
        <>
          <FormularioProyecto
            key={JSON.stringify(borradorDe(d.proyecto))}
            proyecto={d.proyecto}
            onBorrado={onVolver}
            sinTareas={d.tareas.length === 0}
          />
          <TareasProyecto
            proyectoId={id}
            tareas={d.tareas}
            ahora={ahora}
            onAbrir={onAbrirTarea}
            onCrear={() => onCrearTarea(id)}
          />
          <details className="co-seccion">
            <summary className="co-campo__etiqueta">Historial</summary>
            <ol className="co-historial">
              {d.eventos.map((e) => {
                const titulo =
                  typeof e.cambios.titulo === 'string'
                    ? e.cambios.titulo
                    : typeof (e.cambios.despues as { titulo?: unknown } | undefined)?.titulo ===
                        'string'
                      ? String((e.cambios.despues as { titulo: string }).titulo)
                      : null
                return (
                  <li key={e.id}>
                    <span className="co-historial__cuando">
                      {momentoEvento(e.created_at, ahora)}
                    </span>
                    <span>
                      <strong>{e.persona ?? 'Sin persona elegida'}</strong> · {describirEvento(e)}
                      {titulo && !e.accion.startsWith('proyecto_') ? ` · “${titulo}”` : ''}
                    </span>
                  </li>
                )
              })}
            </ol>
          </details>
        </>
      )}
    </Dialogo>
  )
}

function FormularioProyecto({
  proyecto,
  sinTareas,
  onBorrado,
}: {
  proyecto: ProyectoResumen
  sinTareas: boolean
  onBorrado: () => void
}) {
  const idForm = useId()
  const catalogos = useCatalogos()
  const editar = useEditarProyecto(proyecto.id)
  const borrar = useBorrarProyecto()
  const conectado = useConectado()
  const [b, setB] = useState(() => borradorDe(proyecto))
  const [error, setError] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const cambios = cambiosDe(b, proyecto)
  const hayCambios = Object.keys(cambios).length > 0
  const cambiar = <K extends keyof BorradorProyecto>(k: K, v: BorradorProyecto[K]) => {
    setB((x) => ({ ...x, [k]: v }))
    setError(null)
  }

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!conectado || !hayCambios) return
    if (b.nombre.trim() === '') return setError('Escribí el nombre del proyecto')
    if (b.inicio && b.objetivo && b.objetivo < b.inicio) {
      return setError('La fecha objetivo no puede ser anterior al inicio')
    }
    editar.mutateAsync(cambios).catch((e: unknown) => setError(mensaje(e)))
  }

  return (
    <form id={idForm} className="co-formulario co-seccion" onSubmit={guardar} noValidate>
      <div className="co-fila co-fila--campos">
        <Campo etiqueta="Nombre">
          {({ id }) => (
            <input
              id={id}
              className="co-entrada"
              maxLength={120}
              value={b.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
            />
          )}
        </Campo>
        <Campo etiqueta="Estado">
          {({ id }) => (
            <select
              id={id}
              className="co-entrada co-entrada--select"
              value={b.estado}
              onChange={(e) => cambiar('estado', e.target.value as BorradorProyecto['estado'])}
            >
              {Object.entries(NOMBRE_ESTADO_PROYECTO).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>
      <div className="co-fila co-fila--campos">
        <Campo etiqueta="Responsable">
          {({ id }) => (
            <select
              id={id}
              className="co-entrada co-entrada--select"
              value={b.responsable_id}
              onChange={(e) => cambiar('responsable_id', e.target.value)}
            >
              <option value="">Sin responsable</option>
              {proyecto.responsable &&
                !catalogos.data?.personas.some((p) => p.id === proyecto.responsable?.id) && (
                  <option value={proyecto.responsable.id}>{proyecto.responsable.nombre}</option>
                )}
              {(catalogos.data?.personas ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <SelectorCategoria
          categorias={catalogos.data?.categorias ?? []}
          tipo="interna"
          valor={b.categoria_id}
          onCambiar={(v) => cambiar('categoria_id', v)}
        />
      </div>
      <div className="co-fila co-fila--campos">
        <Campo etiqueta="Inicio">
          {({ id }) => (
            <input
              id={id}
              type="date"
              className="co-entrada"
              value={b.inicio}
              onChange={(e) => cambiar('inicio', e.target.value)}
            />
          )}
        </Campo>
        <Campo etiqueta="Fecha objetivo">
          {({ id }) => (
            <input
              id={id}
              type="date"
              className="co-entrada"
              value={b.objetivo}
              onChange={(e) => cambiar('objetivo', e.target.value)}
            />
          )}
        </Campo>
      </div>
      <Campo etiqueta="Descripción">
        {({ id }) => (
          <textarea
            id={id}
            className="co-entrada co-entrada--texto"
            rows={2}
            maxLength={2000}
            value={b.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
          />
        )}
      </Campo>
      {error && (
        <p className="co-aviso" role="alert">
          {error}
        </p>
      )}
      <div className="co-fila">
        <button
          type="submit"
          className="co-boton"
          disabled={!conectado || !hayCambios || editar.isPending}
        >
          Guardar cambios
        </button>
        {sinTareas && (
          <button
            type="button"
            className="co-boton-sutil co-boton-sutil--peligro"
            disabled={!conectado}
            onClick={() => setConfirmando(true)}
          >
            <Trash2 size={14} aria-hidden /> Borrar proyecto
          </button>
        )}
      </div>
      {confirmando && (
        <Confirmacion
          titulo="¿Borrar este proyecto?"
          texto="No tiene tareas. Se borra para siempre."
          confirmar="Borrar"
          peligro
          onCancelar={() => setConfirmando(false)}
          onConfirmar={() => {
            setConfirmando(false)
            borrar
              .mutateAsync(proyecto.id)
              .then(onBorrado)
              .catch((e: unknown) => setError(mensaje(e)))
          }}
        />
      )}
    </form>
  )
}

const EN_CURSO = ['pendiente', 'en_proceso', 'en_espera']

function TareasProyecto({
  proyectoId,
  tareas,
  ahora,
  onAbrir,
  onCrear,
}: {
  proyectoId: string
  tareas: TareaMatriz[]
  ahora: Date
  onAbrir: (id: string) => void
  onCrear: () => void
}) {
  const ordenar = useOrdenarTareas(proyectoId)
  const conectado = useConectado()
  const pendientes = tareas.filter((t) => EN_CURSO.includes(t.estado))
  const hechas = tareas.filter((t) => !EN_CURSO.includes(t.estado))

  /** Sube o baja una tarea pendiente; las hechas quedan al final. */
  const mover = (i: number, paso: -1 | 1) => {
    const ids = pendientes.map((t) => t.id)
    const j = i + paso
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    ordenar.mutate([...ids, ...hechas.map((t) => t.id)])
  }

  return (
    <section className="co-seccion" aria-labelledby="co-titulo-tareas-proyecto">
      <div className="co-fila co-fila--entre">
        <h3 id="co-titulo-tareas-proyecto" className="co-campo__etiqueta">
          Tareas
        </h3>
        <button type="button" className="co-boton-sutil" disabled={!conectado} onClick={onCrear}>
          <Plus size={14} aria-hidden /> Nueva tarea
        </button>
      </div>
      {tareas.length === 0 && (
        <p className="co-texto-suave">Este proyecto todavía no tiene tareas.</p>
      )}
      {pendientes.length > 0 && (
        <ol className="co-tareas-proyecto">
          {pendientes.map((t, i) => (
            <FilaTarea
              key={t.id}
              tarea={t}
              ahora={ahora}
              onAbrir={onAbrir}
              onSubir={i > 0 ? () => mover(i, -1) : undefined}
              onBajar={i < pendientes.length - 1 ? () => mover(i, 1) : undefined}
            />
          ))}
        </ol>
      )}
      {hechas.length > 0 && (
        <ol className="co-tareas-proyecto" aria-label="Tareas hechas">
          {hechas.map((t) => (
            <FilaTarea key={t.id} tarea={t} ahora={ahora} onAbrir={onAbrir} />
          ))}
        </ol>
      )}
    </section>
  )
}

function FilaTarea({
  tarea: t,
  ahora,
  onAbrir,
  onSubir,
  onBajar,
}: {
  tarea: TareaMatriz
  ahora: Date
  onAbrir: (id: string) => void
  onSubir?: () => void
  onBajar?: () => void
}) {
  const ejecutar = useAcciones()
  const mostrar = useMostrarEnMatriz()
  const conectado = useConectado()
  const enCurso = EN_CURSO.includes(t.estado)
  const enMatriz = mostrar.isPending
    ? (mostrar.variables?.mostrar ?? false)
    : (t.mostrar_en_matriz ?? true)
  return (
    <li className="co-tarea-proyecto" data-hecha={!enCurso || undefined}>
      <button type="button" className="co-tarea-proyecto__titulo" onClick={() => onAbrir(t.id)}>
        <strong>{t.titulo}</strong>
        <span className="co-texto-suave">
          {NOMBRES_ESTADO[t.estado]}
          {enCurso && t.fecha_entrega && ` · ${textoEntrega(new Date(t.fecha_entrega), ahora)}`}
          {t.responsables.length > 0 && ` · ${t.responsables.map((p) => p.nombre).join(', ')}`}
        </span>
      </button>
      {enCurso && (
        <div className="co-tarea-proyecto__acciones">
          <button
            type="button"
            className="co-boton-icono"
            aria-pressed={enMatriz}
            aria-label={`Mostrar "${t.titulo}" en la matriz`}
            title={enMatriz ? 'Está en la matriz (tocá para sacarla)' : 'No está en la matriz'}
            disabled={!conectado}
            onClick={() => mostrar.mutate({ id: t.id, mostrar: !enMatriz })}
          >
            <LayoutGrid size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="co-boton-icono"
            aria-label={`Subir "${t.titulo}"`}
            disabled={!onSubir || !conectado}
            onClick={onSubir}
          >
            <ArrowUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="co-boton-icono"
            aria-label={`Bajar "${t.titulo}"`}
            disabled={!onBajar || !conectado}
            onClick={onBajar}
          >
            <ArrowDown size={16} aria-hidden />
          </button>
          {ejecutar && (
            <button
              type="button"
              className="co-boton-sutil"
              disabled={!conectado}
              onClick={() => ejecutar('terminar', t)}
            >
              <Check size={14} aria-hidden /> Terminar
            </button>
          )}
        </div>
      )}
    </li>
  )
}
