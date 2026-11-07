import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { PersonaBreve } from '../matriz/tipos'
import { useSubtareas } from './datos'
import type { SubtareaDetalle } from './tipos'

/**
 * Checklist de subtareas del detalle. Cada cambio se guarda al momento
 * (con su propio registro en el historial).
 */
export function Subtareas({
  tareaId,
  subtareas,
  personas,
}: {
  tareaId: string
  subtareas: SubtareaDetalle[]
  personas: PersonaBreve[]
}) {
  const op = useSubtareas(tareaId)
  const [titulo, setTitulo] = useState('')
  const [responsable, setResponsable] = useState('')

  const agregar = () => {
    if (titulo.trim() === '' || op.isPending) return
    op.mutate(
      { tipo: 'crear', titulo, responsable_id: responsable || null },
      {
        onSuccess: () => {
          setTitulo('')
          setResponsable('')
        },
      },
    )
  }

  const hechas = subtareas.filter((s) => s.hecha).length

  return (
    <section className="co-seccion" aria-label="Subtareas">
      <h3 className="co-campo__etiqueta">
        Subtareas{subtareas.length > 0 ? ` · ${hechas}/${subtareas.length}` : ''}
      </h3>
      <ul className="co-subtareas">
        {subtareas.map((s) => (
          <li key={s.id} className="co-fila" data-hecha={s.hecha}>
            <CasillaHecha
              titulo={s.titulo}
              hecha={s.hecha}
              onCambiar={(hecha, revertir) =>
                op.mutate({ tipo: 'editar', id: s.id, cambios: { hecha } }, { onError: revertir })
              }
            />
            <TituloSubtarea
              valor={s.titulo}
              onGuardar={(v) => op.mutate({ tipo: 'editar', id: s.id, cambios: { titulo: v } })}
            />
            <select
              className="co-entrada co-entrada--select co-entrada--chica"
              aria-label={`Responsable de ${s.titulo}`}
              value={s.responsable_id ?? ''}
              onChange={(e) =>
                op.mutate({
                  tipo: 'editar',
                  id: s.id,
                  cambios: { responsable_id: e.target.value || null },
                })
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
              aria-label={`Quitar ${s.titulo}`}
              onClick={() => op.mutate({ tipo: 'borrar', id: s.id })}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="co-fila">
        <input
          className="co-entrada co-entrada--chica"
          aria-label="Nueva subtarea"
          placeholder="Nueva subtarea"
          maxLength={200}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              agregar()
            }
          }}
        />
        <select
          className="co-entrada co-entrada--select co-entrada--chica"
          aria-label="Responsable de la nueva subtarea"
          value={responsable}
          onChange={(e) => setResponsable(e.target.value)}
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
          className="co-boton-sutil"
          onClick={agregar}
          disabled={titulo.trim() === '' || op.isPending}
        >
          <Plus size={14} aria-hidden /> Agregar
        </button>
      </div>
      {op.isError && (
        <p className="co-aviso" role="alert">
          No se pudo guardar la subtarea: {op.error.message}
        </p>
      )}
    </section>
  )
}

/** Casilla que cambia al instante; si el servidor rechaza, vuelve atrás. */
function CasillaHecha({
  titulo,
  hecha,
  onCambiar,
}: {
  titulo: string
  hecha: boolean
  onCambiar: (hecha: boolean, revertir: () => void) => void
}) {
  const [local, setLocal] = useState(hecha)
  const [previo, setPrevio] = useState(hecha)
  if (hecha !== previo) {
    setPrevio(hecha)
    setLocal(hecha)
  }
  return (
    <input
      type="checkbox"
      className="co-casilla"
      aria-label={`${titulo}: hecha`}
      checked={local}
      onChange={(e) => {
        const valor = e.target.checked
        setLocal(valor)
        onCambiar(valor, () => setLocal(!valor))
      }}
    />
  )
}

/** Título editable en el lugar: se guarda al salir del campo o con Enter. */
function TituloSubtarea({ valor, onGuardar }: { valor: string; onGuardar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor)
  const [previo, setPrevio] = useState(valor)
  if (valor !== previo) {
    setPrevio(valor)
    setTexto(valor)
  }
  const guardar = () => {
    const t = texto.trim()
    if (t === '') setTexto(valor)
    else if (t !== valor) onGuardar(t)
  }
  return (
    <input
      className="co-entrada co-entrada--chica co-subtareas__titulo"
      aria-label="Título de la subtarea"
      maxLength={200}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
