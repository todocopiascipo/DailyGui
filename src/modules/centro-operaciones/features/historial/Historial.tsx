/**
 * Historial global (especificación 7.11): quién hizo qué y cuándo, con filtros
 * por persona, tarea, fechas y texto. Paginado ("Ver más"). Se carga diferido.
 */
import { useInfiniteQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import { pedir } from '../../lib/api'
import { aIso } from '../../lib/fechas'
import type { EventoHistorial, PaginaHistorial } from '../configuracion/tipos'
import { Campo } from '../tarea/controles'
import { useCatalogos } from '../tarea/datos'
import { Dialogo } from '../tarea/Dialogo'
import { describirEvento, momentoEvento } from '../tarea/historial'
import type { EventoDetalle } from '../tarea/tipos'

interface Filtros {
  persona: string
  tarea: { id: string; titulo: string } | null
  desde: string // aaaa-mm-dd
  hasta: string // aaaa-mm-dd (incluido)
  texto: string
}

const SIN_FILTROS: Filtros = { persona: '', tarea: null, desde: '', hasta: '', texto: '' }

/** Filtros → parámetros de la consulta (las fechas, en días del local). */
function parametrosHistorial(f: Filtros, antes?: string | null): string {
  const q = new URLSearchParams()
  if (f.persona) q.set('persona', f.persona)
  if (f.tarea) q.set('tarea', f.tarea.id)
  const desde = f.desde ? aIso({ fecha: f.desde, hora: '00:00' }) : null
  if (desde) q.set('desde', desde)
  const hasta = f.hasta ? aIso({ fecha: f.hasta, hora: '00:00' }) : null
  // "Hasta" incluye todo ese día.
  if (hasta) q.set('hasta', new Date(Date.parse(hasta) + 86_400_000).toISOString())
  if (f.texto.trim()) q.set('texto', f.texto.trim())
  if (antes) q.set('antes', antes)
  const s = q.toString()
  return s ? `?${s}` : ''
}

function useHistorial(f: Filtros) {
  return useInfiniteQuery({
    queryKey: ['historial', f],
    queryFn: ({ pageParam }) =>
      pedir<PaginaHistorial>(`/historial${parametrosHistorial(f, pageParam)}`),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.siguiente,
  })
}

export default function Historial({
  ahora,
  onAbrirTarea,
  onCerrar,
}: {
  ahora: Date
  onAbrirTarea: (id: string) => void
  onCerrar: () => void
}) {
  const catalogos = useCatalogos()
  const [f, setF] = useState<Filtros>(SIN_FILTROS)
  // El texto se aplica al dejar de escribir (no en cada tecla).
  const [texto, setTexto] = useState('')
  const consulta = useHistorial(f)
  const eventos = consulta.data?.pages.flatMap((p) => p.eventos) ?? []
  const cambiar = (c: Partial<Filtros>) => setF((x) => ({ ...x, ...c }))
  const hayFiltros = JSON.stringify(f) !== JSON.stringify(SIN_FILTROS)

  return (
    <Dialogo titulo="Historial" variante="amplia" sinGuardar={false} onCerrar={onCerrar}>
      <form
        className="co-filtros"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          cambiar({ texto })
        }}
      >
        <Campo etiqueta="Buscar">
          {({ id }) => (
            <input
              id={id}
              type="search"
              className="co-entrada"
              placeholder="Título, cliente, persona…"
              maxLength={100}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={() => cambiar({ texto })}
            />
          )}
        </Campo>
        <Campo etiqueta="Persona">
          {({ id }) => (
            <select
              id={id}
              className="co-entrada co-entrada--select"
              value={f.persona}
              onChange={(e) => cambiar({ persona: e.target.value })}
            >
              <option value="">Todas</option>
              {(catalogos.data?.personas ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Desde">
          {({ id }) => (
            <input
              id={id}
              type="date"
              className="co-entrada"
              value={f.desde}
              onChange={(e) => cambiar({ desde: e.target.value })}
            />
          )}
        </Campo>
        <Campo etiqueta="Hasta">
          {({ id }) => (
            <input
              id={id}
              type="date"
              className="co-entrada"
              value={f.hasta}
              onChange={(e) => cambiar({ hasta: e.target.value })}
            />
          )}
        </Campo>
      </form>
      <div className="co-fila co-fila--entre">
        {f.tarea ? (
          <button
            type="button"
            className="co-chip-filtro"
            onClick={() => cambiar({ tarea: null })}
            aria-label={`Quitar el filtro de la tarea ${f.tarea.titulo}`}
          >
            Tarea: {f.tarea.titulo} <X size={14} aria-hidden />
          </button>
        ) : (
          <span className="co-texto-suave">Tocá el nombre de una tarea para ver solo lo suyo.</span>
        )}
        {hayFiltros && (
          <button
            type="button"
            className="co-boton-sutil"
            onClick={() => {
              setF(SIN_FILTROS)
              setTexto('')
            }}
          >
            Quitar filtros
          </button>
        )}
      </div>

      {consulta.isPending && <p className="co-texto-suave">Cargando…</p>}
      {consulta.isError && (
        <p className="co-aviso" role="alert">
          No se pudo cargar el historial: {consulta.error.message}
        </p>
      )}
      {consulta.data && eventos.length === 0 && (
        <p className="co-mensaje-vacio">No hay movimientos con estos filtros.</p>
      )}
      {eventos.length > 0 && (
        <ol className="co-historial co-historial--global">
          {eventos.map((e) => (
            <FilaEvento
              key={e.id}
              evento={e}
              ahora={ahora}
              onFiltrarTarea={(tarea) => cambiar({ tarea })}
              onAbrirTarea={onAbrirTarea}
            />
          ))}
        </ol>
      )}
      {consulta.hasNextPage && (
        <button
          type="button"
          className="co-boton-sutil co-alinear-inicio"
          disabled={consulta.isFetchingNextPage}
          onClick={() => void consulta.fetchNextPage()}
        >
          {consulta.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
        </button>
      )}
    </Dialogo>
  )
}

/** Título de la tarea del evento (aunque ya no exista: queda en el registro). */
function tituloDe(e: EventoHistorial): string | null {
  if (e.tarea_titulo) return e.tarea_titulo
  const c = e.cambios
  if (typeof c.titulo === 'string') return c.titulo
  const despues = c.despues as { titulo?: unknown } | undefined
  return typeof despues?.titulo === 'string' ? despues.titulo : null
}

function FilaEvento({
  evento: e,
  ahora,
  onFiltrarTarea,
  onAbrirTarea,
}: {
  evento: EventoHistorial
  ahora: Date
  onFiltrarTarea: (t: { id: string; titulo: string }) => void
  onAbrirTarea: (id: string) => void
}) {
  const titulo = tituloDe(e)
  const proyecto =
    e.proyecto_nombre ?? (typeof e.cambios.nombre === 'string' ? e.cambios.nombre : null)
  return (
    <li>
      <span className="co-historial__cuando">{momentoEvento(e.created_at, ahora)}</span>
      <span className="co-historial__que">
        <span>
          <strong>{e.persona ?? 'Sin persona elegida'}</strong> ·{' '}
          {describirEvento(e as unknown as EventoDetalle)}
        </span>
        {titulo && e.tarea_id ? (
          <span className="co-fila">
            <button
              type="button"
              className="co-enlace"
              onClick={() => onFiltrarTarea({ id: e.tarea_id!, titulo })}
            >
              {titulo}
            </button>
            <button
              type="button"
              className="co-enlace co-texto-suave"
              onClick={() => onAbrirTarea(e.tarea_id!)}
            >
              Abrir
            </button>
          </span>
        ) : titulo ? (
          <span className="co-texto-suave">{titulo}</span>
        ) : null}
        {proyecto && e.accion.startsWith('proyecto_') && (
          <span className="co-texto-suave">Proyecto {proyecto}</span>
        )}
      </span>
    </li>
  )
}
