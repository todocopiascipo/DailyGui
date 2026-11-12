import { ChevronDown, Plus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { aIso } from '../../lib/fechas'
import { nuevoId } from '../../lib/ids'
import { useConectado } from '../../lib/tiempoReal'
import { esUrgente, urgenciaEstimada } from '../../lib/urgencia'
import { useMatriz } from '../matriz/datos'
import type { TareaMatriz } from '../matriz/tipos'
import { AvisoSinConexion } from './AvisoSinConexion'
import {
  borradorVacio,
  conUrgenciaElegida,
  cuerpoNuevaTarea,
  tareaProvisoria,
  validar,
  type Borrador,
  type Errores,
  type SubtareaNueva,
} from './borrador'
import { Campo, CampoFechaHora, ElegirResponsables, ElegirUrgente, SiNo } from './controles'
import { useCatalogos } from './datos'
import { Dialogo } from './Dialogo'
import { SelectorCategoria } from './SelectorCategoria'
import { SelectorPedido } from './SelectorPedido'
import { SelectorProyecto } from './SelectorProyecto'

/** Lo cargado en el formulario (para reabrirlo si el servidor rechaza el alta). */
export interface EstadoCreacion {
  b: Borrador
  subtareas: SubtareaNueva[]
  /** De qué formulario vino (para reabrir el mismo). Por defecto, la creación rápida. */
  formulario?: 'rapida' | 'ot'
}

export interface AltaPedida {
  cuerpo: ReturnType<typeof cuerpoNuevaTarea>
  provisoria: TareaMatriz
}

interface Props {
  ahora: Date
  onCerrar: () => void
  /** Guarda en segundo plano; el formulario se cierra enseguida. */
  onGuardar: (alta: AltaPedida, estado: EstadoCreacion) => void
  /** Al reabrir después de un rechazo: lo que se había cargado y el motivo. */
  inicial?: EstadoCreacion
  error?: string
  /** Creada desde un proyecto: ya viene con ese proyecto elegido. */
  proyectoId?: string
}

/** Tarea nueva desde "+": siempre interna (los pedidos se cargan con la OT). */
const tareaVacia = (proyectoId = ''): Borrador => ({
  ...borradorVacio(),
  tipo: 'interna',
  proyecto_id: proyectoId,
})

/**
 * Tarea interna ("+", especificación 7.5): lo esencial en un paso (título,
 * responsables, entrega, importante y urgente), su categoría y, si es para
 * un pedido, la orden de trabajo ya cargada. El resto, en "Más datos".
 */
export function CreacionRapida({ ahora, onCerrar, onGuardar, inicial, error, proyectoId }: Props) {
  const idForm = useId()
  const catalogos = useCatalogos()
  const umbrales = useMatriz().data?.config.umbrales
  const conectado = useConectado()
  const [vacia] = useState(() => tareaVacia(proyectoId))
  const [b, setB] = useState<Borrador>(() => inicial?.b ?? vacia)
  const [subtareas, setSubtareas] = useState<SubtareaNueva[]>(() => inicial?.subtareas ?? [])
  const [mas, setMas] = useState(
    () => (inicial?.subtareas.length ?? 0) > 0 || Boolean(inicial?.b.proyecto_id || proyectoId),
  )
  const [errores, setErrores] = useState<Errores>({})

  const cambiar = <K extends keyof Borrador>(k: K, v: Borrador[K]) => {
    setB((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const personas = catalogos.data?.personas ?? []
  const sinGuardar = JSON.stringify(b) !== JSON.stringify(vacia) || subtareas.length > 0
  const entregaIso = aIso(b.entrega)
  const urgenteSegunFecha = esUrgente(
    urgenciaEstimada(entregaIso ? new Date(entregaIso) : null, ahora, umbrales),
  )

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!conectado) return
    const err = validar(b)
    setErrores(err)
    if (Object.keys(err).length > 0) {
      // Si el error está en "Más datos", desplegarlo.
      if (err.inicio) setMas(true)
      return
    }
    const listo = conUrgenciaElegida(b, ahora, umbrales)
    const id = nuevoId()
    onGuardar(
      {
        cuerpo: cuerpoNuevaTarea(listo, subtareas, id),
        provisoria: tareaProvisoria(id, listo, subtareas, personas),
      },
      { b, subtareas },
    )
  }

  return (
    <Dialogo
      titulo="Nueva tarea"
      variante="centro"
      sinGuardar={sinGuardar}
      onCerrar={onCerrar}
      pie={
        <>
          {error && conectado && (
            <p className="co-aviso" role="alert">
              No se pudo guardar: {error}
            </p>
          )}
          <button type="submit" form={idForm} className="co-boton" disabled={!conectado}>
            Crear tarea
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
              data-autofocus
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

        <div className="co-fila co-fila--campos">
          <SiNo
            valor={b.importante}
            onCambiar={(v) => cambiar('importante', v)}
            error={errores.importante}
          />
          <ElegirUrgente
            valor={b.urgente}
            onCambiar={(v) => cambiar('urgente', v)}
            urgenteSegunFecha={urgenteSegunFecha}
          />
        </div>

        <div className="co-fila co-fila--campos">
          <SelectorCategoria
            categorias={catalogos.data?.categorias ?? []}
            tipo="interna"
            valor={b.categoria_id}
            onCambiar={(v) => cambiar('categoria_id', v)}
          />
          <SelectorPedido valor={b.pedido_id} onCambiar={(v) => cambiar('pedido_id', v)} />
        </div>

        <button
          type="button"
          className="co-desplegar"
          aria-expanded={mas}
          onClick={() => setMas((m) => !m)}
        >
          <ChevronDown size={16} aria-hidden className="co-desplegar__icono" />
          Más datos
        </button>

        {mas && (
          <div className="co-formulario co-formulario--anidado">
            <SelectorProyecto valor={b.proyecto_id} onCambiar={(v) => cambiar('proyecto_id', v)} />

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

            <CampoFechaHora
              etiqueta="Hora de inicio"
              valor={b.inicio}
              onCambiar={(v) => cambiar('inicio', v)}
              ahora={ahora}
              error={errores.inicio}
            />

            <Campo etiqueta="Subtareas" como="fieldset">
              {() => (
                <div className="co-grupo">
                  {subtareas.map((s, i) => (
                    <div key={i} className="co-fila">
                      <input
                        className="co-entrada"
                        aria-label={`Subtarea ${i + 1}`}
                        placeholder="Qué hay que hacer"
                        maxLength={200}
                        value={s.titulo}
                        onChange={(e) =>
                          setSubtareas((l) =>
                            l.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)),
                          )
                        }
                      />
                      <select
                        className="co-entrada co-entrada--select"
                        aria-label={`Responsable de la subtarea ${i + 1}`}
                        value={s.responsable_id ?? ''}
                        onChange={(e) =>
                          setSubtareas((l) =>
                            l.map((x, j) =>
                              j === i ? { ...x, responsable_id: e.target.value || null } : x,
                            ),
                          )
                        }
                      >
                        <option value="">Sin asignar</option>
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="co-boton-icono"
                        aria-label={`Quitar subtarea ${i + 1}`}
                        onClick={() => setSubtareas((l) => l.filter((_, j) => j !== i))}
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="co-boton-sutil co-alinear-inicio"
                    onClick={() =>
                      setSubtareas((l) => [...l, { titulo: '', responsable_id: null }])
                    }
                  >
                    <Plus size={14} aria-hidden /> Agregar subtarea
                  </button>
                </div>
              )}
            </Campo>
          </div>
        )}
      </form>
    </Dialogo>
  )
}
