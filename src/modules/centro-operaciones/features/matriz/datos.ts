import { useQuery } from '@tanstack/react-query'
import type { Json } from '../../lib/database.types'
import { obtenerSupabase } from '../../lib/supabase'
import {
  DISPOSICION_POR_DEFECTO,
  UMBRALES_POR_DEFECTO,
  type Cuadrante,
  type Disposicion,
  type Umbrales,
} from '../../lib/urgencia'
import type { ConfigMatriz, PersonaBreve, TareaMatriz } from './tipos'

const ESTADOS_EN_MATRIZ = ['pendiente', 'en_proceso', 'en_espera', 'terminada'] as const

export async function cargarTareasMatriz(): Promise<TareaMatriz[]> {
  const { data, error } = await obtenerSupabase()
    .from('tareas')
    .select(
      `id, tipo, titulo, importante, urgencia_manual, estado, motivo_espera,
       motivo_espera_detalle, fecha_entrega,
       tarea_responsables ( personas ( id, nombre, iniciales, orden ) ),
       subtareas ( hecha )`,
    )
    .is('eliminada_at', null)
    .eq('mostrar_en_matriz', true)
    .in('estado', [...ESTADOS_EN_MATRIZ])
  if (error) throw error

  return (
    data
      // Las tareas internas terminadas pasan directo a "Hechas hoy".
      .filter((t) => !(t.tipo === 'interna' && t.estado === 'terminada'))
      .map((t) => {
        const responsables = t.tarea_responsables
          .map((r) => r.personas)
          .filter((p): p is PersonaBreve & { orden: number } => p !== null)
          .sort((a, b) => a.orden - b.orden)
          .map(({ id, nombre, iniciales }) => ({ id, nombre, iniciales }))
        return {
          id: t.id,
          tipo: t.tipo,
          titulo: t.titulo,
          importante: t.importante,
          urgencia_manual: t.urgencia_manual,
          estado: t.estado,
          motivo_espera: t.motivo_espera,
          motivo_espera_detalle: t.motivo_espera_detalle,
          fecha_entrega: t.fecha_entrega,
          responsables,
          subtareas: {
            total: t.subtareas.length,
            hechas: t.subtareas.filter((s) => s.hecha).length,
          },
        }
      })
  )
}

const CUADRANTES: Cuadrante[] = ['hacer', 'planificar', 'delegar', 'eliminar']

function esObjeto(v: Json | undefined): v is { [k: string]: Json | undefined } {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Lee la configuración con tolerancia: si algo es inválido, usa el valor por defecto. */
export function leerConfigMatriz(filas: { clave: string; valor: Json }[]): ConfigMatriz {
  const valor = (clave: string) => filas.find((f) => f.clave === clave)?.valor

  const u = valor('umbrales_urgencia')
  const umbrales: Umbrales = { ...UMBRALES_POR_DEFECTO }
  if (esObjeto(u)) {
    for (const k of Object.keys(umbrales) as (keyof Umbrales)[]) {
      const n = u[k]
      if (typeof n === 'number' && n > 0) umbrales[k] = n
    }
  }

  const d = valor('disposicion_cuadrantes')
  let disposicion: Disposicion = DISPOSICION_POR_DEFECTO
  if (esObjeto(d)) {
    const candidata = {
      arriba_izquierda: d.arriba_izquierda,
      arriba_derecha: d.arriba_derecha,
      abajo_izquierda: d.abajo_izquierda,
      abajo_derecha: d.abajo_derecha,
    }
    const valores = Object.values(candidata)
    const valida =
      valores.every((v) => CUADRANTES.includes(v as Cuadrante)) && new Set(valores).size === 4
    if (valida) disposicion = candidata as Disposicion
  }

  return { umbrales, disposicion }
}

/** `null` si la cuenta no ve ninguna configuración (no está habilitada). */
export async function cargarConfigMatriz(): Promise<ConfigMatriz | null> {
  const { data, error } = await obtenerSupabase()
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['umbrales_urgencia', 'disposicion_cuadrantes'])
  if (error) throw error
  if (data.length === 0) return null
  return leerConfigMatriz(data)
}

export function useTareasMatriz(habilitado: boolean) {
  return useQuery({
    queryKey: ['matriz', 'tareas'],
    queryFn: cargarTareasMatriz,
    enabled: habilitado,
  })
}

export function useConfigMatriz(habilitado: boolean) {
  return useQuery({
    queryKey: ['matriz', 'config'],
    queryFn: cargarConfigMatriz,
    enabled: habilitado,
  })
}
