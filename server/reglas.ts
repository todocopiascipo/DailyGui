/**
 * Reglas automáticas de las tareas e historial (especificación 5 y 6.4).
 * Funciones puras: el servicio las aplica dentro de una transacción.
 * Equivalen a los triggers de supabase/migrations, para migrar sin sorpresas.
 */
import type { Database } from '../src/modules/centro-operaciones/lib/database.types.ts'

export type Tarea = Database['public']['Tables']['tareas']['Row']

export type AccionEvento = Database['public']['Tables']['eventos']['Row']['accion']

/** Pista opcional que manda la interfaz para distinguir acciones en el historial. */
export type Pista = 'movida_cuadrante' | 'devuelta'

export interface Evento {
  accion: AccionEvento
  tarea_id: string | null
  proyecto_id: string | null
  persona_id: string | null
  cambios: Record<string, unknown>
}

/** Campos que no se muestran como "cambios" en el historial (son automáticos). */
const IGNORAR_EN_HISTORIAL = [
  'id',
  'created_at',
  'updated_at',
  'creada_por',
  'actualizada_por',
  'estado_anterior',
  'eliminada_por',
  'terminada_at',
  'entregada_at',
] as const

/**
 * Completa los campos automáticos antes de guardar:
 * autoría, estado_anterior (para "Devolver"), terminada_at y entregada_at.
 */
export function reglasAlGuardar(
  anterior: Tarea | null,
  nueva: Tarea,
  persona: string | null,
  ahora: string,
): Tarea {
  const t = { ...nueva }
  if (!anterior) {
    t.created_at = ahora
    t.creada_por = persona ?? t.creada_por
    t.actualizada_por = t.creada_por
    t.estado_anterior = null
    t.eliminada_at = null
    t.eliminada_por = null
  } else {
    t.id = anterior.id
    t.created_at = anterior.created_at
    t.creada_por = anterior.creada_por
    if (persona) t.actualizada_por = persona
    if (t.estado !== anterior.estado) t.estado_anterior = anterior.estado
    if (t.eliminada_at && !anterior.eliminada_at) {
      t.eliminada_por = persona ?? t.actualizada_por
    } else if (!t.eliminada_at) {
      t.eliminada_por = null
    }
  }

  const terminadaAntes = anterior && ['terminada', 'entregada'].includes(anterior.estado)
  t.terminada_at =
    t.estado === 'terminada' || t.estado === 'entregada'
      ? terminadaAntes
        ? (anterior.terminada_at ?? ahora)
        : ahora
      : null
  t.entregada_at =
    t.estado === 'entregada'
      ? anterior?.estado === 'entregada'
        ? (anterior.entregada_at ?? ahora)
        : ahora
      : null
  return t
}

/** { campo: { antes, despues } } solo con lo que cambió. */
export function diferencias(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  ignorar: readonly string[],
): Record<string, { antes: unknown; despues: unknown }> {
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {}
  for (const clave of Object.keys(despues)) {
    if (ignorar.includes(clave)) continue
    if (JSON.stringify(antes[clave]) !== JSON.stringify(despues[clave])) {
      cambios[clave] = { antes: antes[clave] ?? null, despues: despues[clave] ?? null }
    }
  }
  return cambios
}

function sinCampos(t: Tarea, campos: readonly string[]) {
  return Object.fromEntries(Object.entries(t).filter(([k]) => !campos.includes(k)))
}

/**
 * Evento de historial para un cambio en una tarea.
 * `anterior` null = alta; `nueva` null = borrado definitivo. Devuelve null si nada cambió.
 */
export function eventoDeTarea(
  anterior: Tarea | null,
  nueva: Tarea | null,
  persona: string | null,
  pista?: Pista,
): Evento | null {
  if (!anterior && nueva) {
    return {
      accion: 'creada',
      tarea_id: nueva.id,
      proyecto_id: nueva.proyecto_id,
      persona_id: nueva.creada_por,
      cambios: { despues: sinCampos(nueva, IGNORAR_EN_HISTORIAL) },
    }
  }
  if (anterior && !nueva) {
    return {
      accion: 'borrada_definitiva',
      tarea_id: null,
      proyecto_id: anterior.proyecto_id,
      persona_id: persona,
      cambios: { tarea_id: anterior.id, titulo: anterior.titulo },
    }
  }
  if (!anterior || !nueva) return null

  const cambios = diferencias(anterior, nueva, IGNORAR_EN_HISTORIAL)
  if (Object.keys(cambios).length === 0) return null

  const cambioEstado = nueva.estado !== anterior.estado
  const accion: AccionEvento =
    !anterior.eliminada_at && nueva.eliminada_at
      ? 'eliminada'
      : anterior.eliminada_at && !nueva.eliminada_at
        ? 'restaurada'
        : cambioEstado && pista === 'devuelta'
          ? 'devuelta'
          : cambioEstado
            ? 'estado'
            : pista === 'movida_cuadrante'
              ? 'movida_cuadrante'
              : 'editada'

  return {
    accion,
    tarea_id: nueva.id,
    proyecto_id: nueva.proyecto_id,
    persona_id: persona ?? nueva.actualizada_por,
    cambios: { ...cambios, titulo: nueva.titulo },
  }
}
