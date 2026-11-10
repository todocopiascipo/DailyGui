/**
 * "Mis tareas" (especificación 7.7): lo de la persona activa, descompuesto en
 * pasos con su responsable, ordenado por la hora de entrega; checklist de
 * pasos y línea de tiempo del día. Se carga diferido.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { pedir } from '../../lib/api'
import { formatoHora, textoEntrega } from '../../lib/tiempo'
import { useConectado } from '../../lib/tiempoReal'
import { useAcciones } from '../matriz/accionesTarea'
import type { PersonaBreve } from '../matriz/tipos'
import { Dialogo } from '../tarea/Dialogo'
import { ahoraYSigue, lineaDelDia } from './lineaDelDia'
import type { Paso, TareaMia } from './tipos'

function useMisTareas(personaId: string) {
  return useQuery({
    queryKey: ['mis-tareas', personaId],
    queryFn: () => pedir<TareaMia[]>(`/personas/${encodeURIComponent(personaId)}/tareas`),
  })
}

function useMarcarPaso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, hecha }: { id: string; hecha: boolean }) =>
      pedir(`/subtareas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ hecha }),
      }),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['mis-tareas'] }),
        qc.invalidateQueries({ queryKey: ['matriz'] }),
        qc.invalidateQueries({ queryKey: ['tarea'] }),
      ]),
  })
}

export default function MisTareas({
  persona,
  ahora,
  onAbrir,
  onCerrar,
}: {
  persona: PersonaBreve
  ahora: Date
  onAbrir: (id: string) => void
  onCerrar: () => void
}) {
  const consulta = useMisTareas(persona.id)
  const tareas = consulta.data ?? []
  const { ahora: primero, sigue } = ahoraYSigue(tareas)
  const linea = lineaDelDia(tareas, ahora)

  return (
    <Dialogo
      titulo={`Mis tareas · ${persona.nombre}`}
      variante="amplia"
      sinGuardar={false}
      onCerrar={onCerrar}
    >
      {consulta.isPending && <p className="co-texto-suave">Cargando…</p>}
      {consulta.isError && (
        <p className="co-aviso" role="alert">
          No se pudieron cargar tus tareas: {consulta.error.message}
        </p>
      )}
      {consulta.data && tareas.length === 0 && (
        <p className="co-mensaje-vacio">No tenés tareas asignadas en curso.</p>
      )}

      {primero && (
        <section className="co-ahora" aria-label="Qué hacer ahora">
          <div>
            <span className="co-campo__etiqueta">Ahora</span>
            <p className="co-subtitulo">{primero.titulo}</p>
            {primero.fecha_entrega && (
              <p className="co-texto-suave">
                {textoEntrega(new Date(primero.fecha_entrega), ahora)}
              </p>
            )}
          </div>
          {sigue && (
            <div>
              <span className="co-campo__etiqueta">Sigue</span>
              <p>{sigue.titulo}</p>
              {sigue.fecha_entrega && (
                <p className="co-texto-suave">
                  {textoEntrega(new Date(sigue.fecha_entrega), ahora)}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {linea && (
        <section className="co-seccion" aria-labelledby="co-titulo-linea">
          <h3 id="co-titulo-linea" className="co-campo__etiqueta">
            Línea del día
          </h3>
          <div className="co-linea" role="list">
            <div className="co-linea__eje" aria-hidden>
              {linea.horas.map((h, i) => (
                <span
                  key={h.toISOString()}
                  style={{ left: `${(i / (linea.horas.length - 1)) * 100}%` }}
                >
                  {formatoHora(h)}
                </span>
              ))}
            </div>
            <div className="co-linea__ahora" style={{ left: `${linea.ahora}%` }} aria-hidden>
              <span>Ahora</span>
            </div>
            {linea.filas.map((f) => (
              <div key={f.tarea.id} className="co-linea__fila" role="listitem">
                <span
                  className={`co-linea__barra${f.ancho === 0 ? ' co-linea__barra--marca' : ''}${f.vencida ? ' co-linea__barra--vencida' : ''}`}
                  style={{ left: `${f.izquierda}%`, width: f.ancho ? `${f.ancho}%` : undefined }}
                />
                <span
                  className={`co-linea__texto${f.izquierda + f.ancho > 60 ? ' co-linea__texto--antes' : ''}`}
                  // Cerca del final, el texto va antes de la marca (si no, no entra).
                  style={
                    f.izquierda + f.ancho > 60
                      ? { right: `${100 - f.izquierda}%` }
                      : { left: `${f.izquierda + f.ancho}%` }
                  }
                >
                  {f.tarea.titulo} ·{' '}
                  {f.vencida
                    ? textoEntrega(new Date(f.tarea.fecha_entrega!), ahora)
                    : formatoHora(new Date(f.tarea.fecha_entrega!))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {tareas.length > 0 && (
        <section className="co-seccion" aria-labelledby="co-titulo-pasos">
          <h3 id="co-titulo-pasos" className="co-campo__etiqueta">
            Paso a paso
          </h3>
          <ol className="co-mis-tareas">
            {tareas.map((t) => (
              <TarjetaMia key={t.id} tarea={t} persona={persona} ahora={ahora} onAbrir={onAbrir} />
            ))}
          </ol>
        </section>
      )}
    </Dialogo>
  )
}

function TarjetaMia({
  tarea,
  persona,
  ahora,
  onAbrir,
}: {
  tarea: TareaMia
  persona: PersonaBreve
  ahora: Date
  onAbrir: (id: string) => void
}) {
  const ejecutar = useAcciones()
  const conectado = useConectado()
  const terminada = tarea.estado === 'terminada'
  const hechos = tarea.pasos.filter((p) => p.hecha).length
  return (
    <li className="co-mi-tarea" data-terminada={terminada || undefined}>
      <div className="co-mi-tarea__cabecera">
        <button type="button" className="co-mi-tarea__titulo" onClick={() => onAbrir(tarea.id)}>
          <strong>{tarea.titulo}</strong>
          <span className="co-texto-suave">
            {terminada
              ? 'Terminada'
              : tarea.fecha_entrega
                ? textoEntrega(new Date(tarea.fecha_entrega), ahora)
                : 'Sin fecha de entrega'}
            {tarea.pasos.length > 0 && ` · ${hechos}/${tarea.pasos.length} pasos`}
          </span>
        </button>
        {/* Sin pasos (o con todos hechos), lo que sigue es terminarla. */}
        {ejecutar && !terminada && hechos === tarea.pasos.length && (
          <button
            type="button"
            className="co-boton-sutil"
            disabled={!conectado}
            onClick={() => ejecutar('terminar', tarea)}
          >
            <Check size={14} aria-hidden /> Terminar
          </button>
        )}
      </div>
      {tarea.pasos.length > 0 && (
        <ul className="co-pasos">
          {tarea.pasos.map((p) => (
            <PasoItem key={p.id} paso={p} mio={p.responsable?.id === persona.id} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Paso con casilla: cambia al instante; si el servidor rechaza, vuelve atrás. */
function PasoItem({ paso, mio }: { paso: Paso; mio: boolean }) {
  const marcar = useMarcarPaso()
  const conectado = useConectado()
  const [local, setLocal] = useState<boolean | null>(null)
  const [previo, setPrevio] = useState(paso.hecha)
  if (paso.hecha !== previo) {
    setPrevio(paso.hecha)
    setLocal(null)
  }
  const hecha = local ?? paso.hecha
  return (
    <li className="co-paso" data-mio={mio || undefined} data-hecha={hecha || undefined}>
      <label className="co-paso__etiqueta">
        <input
          type="checkbox"
          className="co-casilla"
          checked={hecha}
          disabled={!conectado}
          onChange={(e) => {
            const valor = e.target.checked
            setLocal(valor)
            marcar.mutate({ id: paso.id, hecha: valor }, { onError: () => setLocal(null) })
          }}
        />
        <span className="co-paso__titulo">{paso.titulo}</span>
      </label>
      <span className="co-paso__quien">
        {mio ? 'Vos' : (paso.responsable?.nombre ?? 'Sin asignar')}
      </span>
    </li>
  )
}
