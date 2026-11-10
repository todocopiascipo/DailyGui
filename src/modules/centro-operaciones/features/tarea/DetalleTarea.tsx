import { Trash2 } from 'lucide-react'
import { formatInTimeZone } from 'date-fns-tz'
import { useEffect, useId, useRef, useState } from 'react'
import { aIso } from '../../lib/fechas'
import { ZONA_HORARIA } from '../../lib/tiempo'
import { urgenciaEstimada, type Umbrales } from '../../lib/urgencia'
import type { PersonaBreve } from '../matriz/tipos'
import { borradorDe, cuerpoEdicion, validar, type Borrador, type Errores } from './borrador'
import {
  Campo,
  CampoFechaHora,
  CampoPago,
  CamposCliente,
  ElegirResponsables,
  Segmentado,
  SiNo,
  SliderUrgencia,
} from './controles'
import { useConectado } from '../../lib/tiempoReal'
import { AvisoSinConexion } from './AvisoSinConexion'
import { useCatalogos, useDetalle, useEditarTarea } from './datos'
import { Dialogo } from './Dialogo'
import { describirEvento, momentoEvento, NOMBRES_ESTADO, NOMBRES_MOTIVO } from './historial'
import { SelectorCategoria } from './SelectorCategoria'
import { Subtareas } from './Subtareas'
import type { DetalleTarea as Detalle } from './tipos'

interface Props {
  id: string
  ahora: Date
  umbrales: Umbrales
  onCerrar: () => void
  /** Pide eliminar (con confirmación): la manda a la papelera. */
  onEliminar?: (id: string) => void
}

/** Detalle de la tarea (especificación 7.4): consultar y modificar todo. */
export function DetalleTarea({ id, ahora, umbrales, onCerrar, onEliminar }: Props) {
  const detalle = useDetalle(id)
  if (!detalle.data) {
    return (
      <Dialogo titulo="Tarea" variante="lateral" sinGuardar={false} onCerrar={onCerrar}>
        {detalle.isError ? (
          <p className="co-aviso" role="alert">
            No se pudo abrir la tarea: {detalle.error.message}
          </p>
        ) : (
          <p className="co-texto-suave">Cargando…</p>
        )}
      </Dialogo>
    )
  }
  return (
    <Editor
      detalle={detalle.data}
      ahora={ahora}
      umbrales={umbrales}
      onCerrar={onCerrar}
      onEliminar={onEliminar}
    />
  )
}

const ESTADOS_EDITABLES = ['pendiente', 'en_proceso', 'en_espera'] as const

function Editor({
  detalle,
  ahora,
  umbrales,
  onCerrar,
  onEliminar,
}: {
  detalle: Detalle
  ahora: Date
  umbrales: Umbrales
  onCerrar: () => void
  onEliminar?: (id: string) => void
}) {
  const idForm = useId()
  const catalogos = useCatalogos()
  const editar = useEditarTarea(detalle.tarea.id)
  const conectado = useConectado()
  const [b, setB] = useState<Borrador>(() => borradorDe(detalle))
  const [errores, setErrores] = useState<Errores>({})
  const [guardado, setGuardado] = useState(false)
  const base = useRef(detalle)

  // Si el detalle cambia (subtareas, otra pantalla), actualizar lo que no se tocó.
  useEffect(() => {
    if (base.current === detalle) return
    const anterior = base.current
    base.current = detalle
    setB((actual) => {
      const intacto = JSON.stringify(actual) === JSON.stringify(borradorDe(anterior))
      if (intacto) return borradorDe(detalle)
      // Con cambios a medias: sumar los responsables que llegaron (por ej., de una subtarea).
      const nuevos = detalle.responsables
        .map((p) => p.id)
        .filter((p) => !anterior.responsables.some((a) => a.id === p))
      return { ...actual, responsables: [...new Set([...actual.responsables, ...nuevos])] }
    })
  }, [detalle])

  const cambiar = <K extends keyof Borrador>(k: K, v: Borrador[K]) => {
    setB((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k]: undefined }))
    setGuardado(false)
  }

  const cuerpo = cuerpoEdicion(b, detalle)
  const personas = personasConAsignadas(catalogos.data?.personas ?? [], detalle.responsables)

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cuerpo || editar.isPending || !conectado) return
    const err = validar(b)
    setErrores(err)
    if (Object.keys(err).length > 0) return
    editar.mutate(cuerpo, {
      onSuccess: (d) => {
        // El formulario pasa a reflejar lo guardado (por ej., el cliente ya vinculado).
        base.current = d
        setB(borradorDe(d))
        setGuardado(true)
      },
    })
  }

  const entregaIso = aIso(b.entrega)
  const estimada = urgenciaEstimada(entregaIso ? new Date(entregaIso) : null, ahora, umbrales)
  const t = detalle.tarea
  const estadoEditable = (ESTADOS_EDITABLES as readonly string[]).includes(b.estado)

  return (
    <Dialogo
      titulo={t.titulo}
      tituloOculto
      variante="lateral"
      sinGuardar={cuerpo !== null}
      onCerrar={onCerrar}
      pie={
        <>
          {onEliminar && (
            <button
              type="button"
              className="co-boton-sutil co-boton-sutil--peligro co-pie-izquierda"
              disabled={!conectado}
              onClick={() => onEliminar(detalle.tarea.id)}
            >
              <Trash2 size={14} aria-hidden /> Eliminar
            </button>
          )}
          {editar.isError && (
            <p className="co-aviso" role="alert">
              No se pudo guardar: {editar.error.message}
            </p>
          )}
          {guardado && !cuerpo && (
            <p className="co-texto-suave" role="status">
              Cambios guardados
            </p>
          )}
          <button
            type="submit"
            form={idForm}
            className="co-boton"
            disabled={!cuerpo || editar.isPending || !conectado}
          >
            {editar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <AvisoSinConexion />
      <form id={idForm} className="co-formulario" onSubmit={guardar} noValidate>
        <Campo etiqueta="Título" error={errores.titulo}>
          {({ id, descripcion }) => (
            <input
              id={id}
              className="co-entrada co-entrada--grande"
              autoComplete="off"
              maxLength={200}
              aria-describedby={descripcion}
              aria-invalid={Boolean(errores.titulo)}
              value={b.titulo}
              onChange={(e) => cambiar('titulo', e.target.value)}
            />
          )}
        </Campo>

        <Campo etiqueta="Tipo" como="fieldset">
          {() => (
            <Segmentado
              etiqueta="Tipo"
              valor={b.tipo}
              onCambiar={(v) => cambiar('tipo', v)}
              opciones={[
                { valor: 'pedido', texto: 'Pedido' },
                { valor: 'interna', texto: 'Tarea interna' },
              ]}
            />
          )}
        </Campo>

        <ElegirResponsables
          personas={personas}
          elegidas={b.responsables}
          onCambiar={(v) => cambiar('responsables', v)}
        />

        <CampoFechaHora
          etiqueta="Entrega"
          valor={b.entrega}
          onCambiar={(v) => cambiar('entrega', v)}
          ahora={ahora}
          error={errores.entrega}
        />

        <CampoFechaHora
          etiqueta="Hora de inicio"
          valor={b.inicio}
          onCambiar={(v) => cambiar('inicio', v)}
          ahora={ahora}
          error={errores.inicio}
        />

        <SiNo
          valor={b.importante}
          onCambiar={(v) => cambiar('importante', v)}
          error={errores.importante}
        />

        <SliderUrgencia
          manual={b.urgencia_manual}
          estimada={estimada}
          onCambiar={(v) => cambiar('urgencia_manual', v)}
        />

        {estadoEditable ? (
          <>
            <Campo etiqueta="Estado" como="fieldset">
              {() => (
                <Segmentado
                  etiqueta="Estado"
                  valor={b.estado}
                  onCambiar={(v) => {
                    cambiar('estado', v)
                    if (v !== 'en_espera') cambiar('motivo_espera', null)
                  }}
                  opciones={ESTADOS_EDITABLES.map((e) => ({ valor: e, texto: NOMBRES_ESTADO[e]! }))}
                />
              )}
            </Campo>
            {b.estado === 'en_espera' && (
              <div className="co-fila co-fila--campos">
                <Campo etiqueta="Motivo de la espera" error={errores.motivo}>
                  {({ id, descripcion }) => (
                    <select
                      id={id}
                      className="co-entrada co-entrada--select"
                      aria-describedby={descripcion}
                      value={b.motivo_espera ?? ''}
                      onChange={(e) =>
                        cambiar(
                          'motivo_espera',
                          (e.target.value || null) as Borrador['motivo_espera'],
                        )
                      }
                    >
                      <option value="">Elegí un motivo</option>
                      {Object.entries(NOMBRES_MOTIVO).map(([valor, texto]) => (
                        <option key={valor} value={valor}>
                          {texto}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                {b.motivo_espera === 'otro' && (
                  <Campo etiqueta="Detalle">
                    {({ id }) => (
                      <input
                        id={id}
                        className="co-entrada"
                        maxLength={200}
                        value={b.motivo_espera_detalle}
                        onChange={(e) => cambiar('motivo_espera_detalle', e.target.value)}
                      />
                    )}
                  </Campo>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="co-dato">
            <span className="co-campo__etiqueta">Estado</span>
            {NOMBRES_ESTADO[b.estado]}
          </p>
        )}

        {b.tipo === 'pedido' && (
          <>
            <CamposCliente
              valor={b.cliente}
              onCambiar={(v) => cambiar('cliente', v)}
              error={errores.cliente}
            />
            <div className="co-fila co-fila--campos">
              <CampoPago
                etiqueta="Seña"
                valor={b.sena}
                medio={b.sena_medio}
                onCambiar={(v) => cambiar('sena', v)}
                onCambiarMedio={(m) => cambiar('sena_medio', m)}
                error={errores.sena}
              />
              <CampoPago
                etiqueta="Saldo (lo que deben)"
                valor={b.saldo}
                medio={b.saldo_medio}
                onCambiar={(v) => cambiar('saldo', v)}
                onCambiarMedio={(m) => cambiar('saldo_medio', m)}
                error={errores.saldo}
              />
            </div>
          </>
        )}

        <SelectorCategoria
          categorias={catalogos.data?.categorias ?? []}
          tipo={b.tipo}
          valor={b.categoria_id}
          onCambiar={(v) => cambiar('categoria_id', v)}
        />

        <Campo etiqueta="Descripción">
          {({ id }) => (
            <textarea
              id={id}
              className="co-entrada co-entrada--texto"
              rows={3}
              maxLength={2000}
              value={b.descripcion}
              onChange={(e) => cambiar('descripcion', e.target.value)}
            />
          )}
        </Campo>
      </form>

      <Subtareas tareaId={t.id} subtareas={detalle.subtareas} personas={personas} />

      <p className="co-texto-suave">
        Creada el{' '}
        {formatInTimeZone(new Date(t.created_at), ZONA_HORARIA, "dd/MM/yyyy 'a las' HH:mm")}
        {detalle.creada_por ? ` por ${detalle.creada_por.nombre}` : ''}
      </p>

      <section className="co-seccion" aria-label="Historial de la tarea">
        <h3 className="co-campo__etiqueta">Historial</h3>
        <ol className="co-historial">
          {detalle.eventos.map((e) => (
            <li key={e.id}>
              <span className="co-historial__cuando">{momentoEvento(e.created_at, ahora)}</span>
              <span>
                <strong>{e.persona ?? 'Sin persona elegida'}</strong> · {describirEvento(e)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </Dialogo>
  )
}

/** Las personas activas, más las asignadas aunque ya no estén activas. */
function personasConAsignadas(activas: PersonaBreve[], asignadas: PersonaBreve[]) {
  const faltan = asignadas.filter((a) => !activas.some((p) => p.id === a.id))
  return [...activas, ...faltan]
}
