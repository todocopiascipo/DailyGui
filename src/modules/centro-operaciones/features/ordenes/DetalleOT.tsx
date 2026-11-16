/**
 * Una orden de trabajo abierta (Fase 13): a la izquierda la OT completa, con
 * los datos del formulario; a la derecha sus tareas (tocar una la abre) y
 * "Nueva tarea". Arriba, las acciones de la OT: terminar, entregada, devolver,
 * copiar mensaje y teléfono, editar.
 */
import { formatInTimeZone } from 'date-fns-tz'
import { Copy, Pencil, Plus } from 'lucide-react'
import { textoEntrega, ZONA_HORARIA } from '../../lib/tiempo'
import { useConectado } from '../../lib/tiempoReal'
import {
  accionesDisponibles,
  NOMBRES_ACCION,
  useAcciones,
  type RefTarea,
} from '../matriz/accionesTarea'
import { useDetalle, useEnlaceTareas, usePedidoTareas } from '../tarea/datos'
import { FlujoTareas } from './FlujoTareas'
import { Dialogo } from '../tarea/Dialogo'
import { NOMBRES_ESTADO } from '../tarea/historial'

const MEDIOS: Record<string, string> = {
  posnet: 'Posnet',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
}
const pesos = (n: number) => `$ ${n.toLocaleString('es-AR')}`
const fechaHora = (iso: string | null) =>
  iso ? formatInTimeZone(new Date(iso), ZONA_HORARIA, "dd/MM/yyyy 'a las' HH:mm") : '—'

export function DetalleOT({
  id,
  ahora,
  onCerrar,
  onAbrirTarea,
  onNuevaTarea,
}: {
  id: string
  ahora: Date
  onCerrar: () => void
  onAbrirTarea: (id: string) => void
  onNuevaTarea: (pedidoId: string) => void
}) {
  const detalle = useDetalle(id)
  const tareas = usePedidoTareas(id)
  const ejecutar = useAcciones()
  const conectado = useConectado()
  const enlace = useEnlaceTareas()
  const d = detalle.data
  const t = d?.tarea
  const ref: RefTarea | null = d
    ? {
        id: d.tarea.id,
        tipo: d.tarea.tipo,
        titulo: d.tarea.titulo,
        estado: d.tarea.estado,
        estado_anterior: d.tarea.estado_anterior,
        saldo: d.tarea.saldo,
        cliente: d.cliente
          ? { nombre: d.cliente.nombre_apellido, telefono: d.cliente.telefono }
          : null,
      }
    : null
  const acciones = ref
    ? accionesDisponibles(ref).filter((a) => a !== 'eliminar' && a !== 'abrir')
    : []

  return (
    <Dialogo
      titulo={t ? t.titulo : 'Orden de trabajo'}
      variante="amplia"
      sinGuardar={false}
      onCerrar={onCerrar}
    >
      {detalle.isPending && <p className="co-texto-suave">Cargando…</p>}
      {detalle.isError && (
        <p className="co-aviso" role="alert">
          No se pudo cargar la orden de trabajo: {detalle.error.message}
        </p>
      )}
      {d && t && ref && (
        <>
          <div className="co-fila co-ot-acciones" role="group" aria-label="Acciones de la orden">
            {ejecutar &&
              acciones.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={a === 'terminar' || a === 'entregar' ? 'co-boton' : 'co-boton-sutil'}
                  disabled={!conectado && a !== 'copiar-mensaje' && a !== 'copiar-telefono'}
                  onClick={() => ejecutar(a, ref)}
                >
                  {a === 'copiar-mensaje' && <Copy size={14} aria-hidden />} {NOMBRES_ACCION[a]}
                </button>
              ))}
            {ejecutar && (
              <button
                type="button"
                className="co-boton-sutil"
                onClick={() => ejecutar('abrir', ref)}
              >
                <Pencil size={14} aria-hidden /> Editar
              </button>
            )}
          </div>

          <div className="co-ot-abierta">
            {/* La OT completa, con la forma de la de papel. */}
            <article className="co-ot co-ot--ficha" aria-label="Orden de trabajo completa">
              <p className="co-ot__titulo" aria-hidden>
                Orden de trabajo
              </p>
              <p className="co-texto-suave co-ot__estado">Estado: {NOMBRES_ESTADO[t.estado]}</p>
              <Dato etiqueta="Detalle">
                <span className="co-ot__texto">{t.descripcion || t.titulo}</span>
              </Dato>
              <div className="co-ot__cajas">
                <Dato etiqueta="Seña">
                  {pesos(t.sena)}
                  {t.sena_medio ? ` · ${MEDIOS[t.sena_medio]}` : ''}
                </Dato>
                <Dato etiqueta="Debe">
                  {pesos(t.saldo)}
                  {t.saldo_medio ? ` · ${MEDIOS[t.saldo_medio]}` : ''}
                </Dato>
              </div>
              <Dato etiqueta="Celular">{d.cliente?.telefono ?? '—'}</Dato>
              <Dato etiqueta="Nombre">{d.cliente?.nombre_apellido ?? '—'}</Dato>
              <Dato etiqueta="Fecha inicio">{fechaHora(t.fecha_inicio)}</Dato>
              <Dato etiqueta="Fecha límite">
                {fechaHora(t.fecha_entrega)}
                {t.fecha_entrega &&
                  t.estado !== 'terminada' &&
                  ` · ${textoEntrega(new Date(t.fecha_entrega), ahora)}`}
              </Dato>
              <Dato etiqueta="Responsables">
                {d.responsables.length > 0 ? d.responsables.map((p) => p.nombre).join(', ') : '—'}
              </Dato>
            </article>

            {/* Sus tareas. */}
            <section className="co-ot-tareas" aria-labelledby="co-titulo-tareas-ot">
              <div className="co-fila co-fila--entre">
                <h3 id="co-titulo-tareas-ot" className="co-subtitulo">
                  Tareas
                </h3>
                <button
                  type="button"
                  className="co-boton-sutil"
                  disabled={!conectado}
                  onClick={() => onNuevaTarea(id)}
                >
                  <Plus size={14} aria-hidden /> Nueva tarea
                </button>
              </div>
              {tareas.isPending && <p className="co-texto-suave">Cargando…</p>}
              {tareas.data && tareas.data.length === 0 && (
                <p className="co-texto-suave">Esta orden todavía no tiene tareas.</p>
              )}
              {(tareas.data ?? []).length > 0 && (
                <p className="co-texto-suave">
                  Para encadenar: arrastrá una tarea y mantenela encima de la que tiene que esperar,
                  hasta que se llene la barra.
                </p>
              )}
              {enlace.enlazar.isError && (
                <p className="co-aviso" role="alert">
                  No se pudo encadenar: {enlace.enlazar.error.message}
                </p>
              )}
              <FlujoTareas
                tareas={tareas.data ?? []}
                conectado={conectado}
                onAbrir={onAbrirTarea}
                onEnlazar={(tarea, dependeDe) => enlace.enlazar.mutate({ id: tarea, dependeDe })}
              />
            </section>
          </div>
        </>
      )}
    </Dialogo>
  )
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="co-ot__campo co-ot__campo--linea co-ot__dato">
      <span className="co-ot__etiqueta">{etiqueta}</span>
      <span className="co-ot__valor">{children}</span>
    </div>
  )
}
