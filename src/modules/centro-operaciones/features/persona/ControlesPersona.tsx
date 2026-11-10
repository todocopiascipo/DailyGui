import { Eye, EyeOff, ListTodo, UserRound } from 'lucide-react'
import type { PersonaBreve } from '../matriz/tipos'

/**
 * Abajo a la izquierda, discreto: "¿Quién soy?" (o el nombre de la persona
 * activa), resaltar sus tareas (un toque lo apaga) y "Mis tareas".
 */
export function ControlesPersona({
  persona,
  resaltar,
  onElegir,
  onResaltar,
  onMisTareas,
}: {
  persona: PersonaBreve | null
  resaltar: boolean
  onElegir: () => void
  onResaltar: () => void
  onMisTareas: () => void
}) {
  return (
    <div className="co-persona-activa">
      <button
        type="button"
        className="co-persona-activa__nombre"
        onClick={onElegir}
        aria-label={persona ? `Sos ${persona.nombre}. Cambiar` : '¿Quién soy?'}
      >
        {persona ? (
          <span className="co-persona__iniciales" aria-hidden>
            {persona.iniciales ?? persona.nombre.slice(0, 1)}
          </span>
        ) : (
          <UserRound size={18} aria-hidden strokeWidth={2} />
        )}
        <span>{persona ? persona.nombre : '¿Quién soy?'}</span>
      </button>
      {persona && (
        <>
          <button
            type="button"
            className="co-boton-redondo"
            aria-pressed={resaltar}
            aria-label="Resaltar mis tareas"
            title={resaltar ? 'Dejar de resaltar mis tareas' : 'Resaltar mis tareas'}
            onClick={onResaltar}
          >
            {resaltar ? <Eye size={18} aria-hidden /> : <EyeOff size={18} aria-hidden />}
          </button>
          <button
            type="button"
            className="co-boton-redondo co-boton-redondo--texto"
            onClick={onMisTareas}
          >
            <ListTodo size={18} aria-hidden /> Mis tareas
          </button>
        </>
      )}
    </div>
  )
}
