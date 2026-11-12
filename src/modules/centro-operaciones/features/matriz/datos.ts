import { useQuery } from '@tanstack/react-query'
import { pedir } from '../../lib/api'
import { PLANTILLA_POR_DEFECTO } from '../../lib/mensaje'
import {
  DISPOSICION_POR_DEFECTO,
  UMBRALES_POR_DEFECTO,
  type Cuadrante,
  type Disposicion,
  type Umbrales,
} from '../../lib/urgencia'
import type { ConfigMatriz, TareaMatriz } from './tipos'

const CUADRANTES: Cuadrante[] = ['hacer', 'planificar', 'delegar', 'eliminar']

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Lee la configuración con tolerancia: si algo es inválido, usa el valor por defecto. */
export function leerConfigMatriz(filas: { clave: string; valor: unknown }[]): ConfigMatriz {
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

  const confeti = valor('confeti_activado')
  const plantilla = valor('plantilla_mensaje')
  const dias = valor('papelera_dias')
  return {
    papeleraDias: typeof dias === 'number' && Number.isInteger(dias) && dias > 0 ? dias : 30,
    umbrales,
    disposicion,
    confeti: typeof confeti === 'boolean' ? confeti : true,
    plantilla:
      typeof plantilla === 'string' && plantilla.trim() !== '' ? plantilla : PLANTILLA_POR_DEFECTO,
  }
}

export interface DatosMatriz {
  tareas: TareaMatriz[]
  config: ConfigMatriz
}

export async function cargarMatriz(): Promise<DatosMatriz> {
  const r = await pedir<{
    tareas: TareaMatriz[]
    configuracion: { clave: string; valor: unknown }[]
  }>('/matriz')
  return { tareas: r.tareas, config: leerConfigMatriz(r.configuracion) }
}

export function useMatriz() {
  return useQuery({ queryKey: ['matriz'], queryFn: cargarMatriz })
}
