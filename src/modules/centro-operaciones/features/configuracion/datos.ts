import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pedir } from '../../lib/api'
import type { CategoriaConfig, PersonaConfig } from './tipos'

/** Guarda un valor de configuración y actualiza la matriz (que la incluye). */
export function useGuardarConfiguracion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clave, valor }: { clave: string; valor: unknown }) =>
      pedir(`/configuracion/${clave}`, { method: 'PUT', body: JSON.stringify({ valor }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matriz'] }),
  })
}

const json = (method: string, cuerpo: unknown): RequestInit => ({
  method,
  body: JSON.stringify(cuerpo),
})

/** Después de tocar personas o categorías: formularios, matriz y listas al día. */
function useRecargarCatalogos() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['catalogos'] }),
      qc.invalidateQueries({ queryKey: ['personas'] }),
      qc.invalidateQueries({ queryKey: ['categorias'] }),
      qc.invalidateQueries({ queryKey: ['matriz'] }),
    ])
}

export function usePersonasConfig() {
  return useQuery({ queryKey: ['personas'], queryFn: () => pedir<PersonaConfig[]>('/personas') })
}

export function useCategoriasConfig() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => pedir<CategoriaConfig[]>('/categorias'),
  })
}

export function useEditarPersona() {
  const recargar = useRecargarCatalogos()
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Record<string, unknown> }) =>
      pedir<PersonaConfig[]>(`/personas/${encodeURIComponent(id)}`, json('PATCH', cambios)),
    onSuccess: recargar,
  })
}

export function useOrdenarPersonas() {
  const recargar = useRecargarCatalogos()
  return useMutation({
    mutationFn: (ids: string[]) =>
      pedir<PersonaConfig[]>('/personas/orden', json('PUT', { personas: ids })),
    onSuccess: recargar,
  })
}

export function useCrearCategoria() {
  const recargar = useRecargarCatalogos()
  return useMutation({
    mutationFn: (datos: { nombre: string; tipo_aplica: CategoriaConfig['tipo_aplica'] }) =>
      pedir<CategoriaConfig>('/categorias', json('POST', datos)),
    onSuccess: recargar,
  })
}

export function useEditarCategoria() {
  const recargar = useRecargarCatalogos()
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Record<string, unknown> }) =>
      pedir<CategoriaConfig[]>(`/categorias/${encodeURIComponent(id)}`, json('PATCH', cambios)),
    onSuccess: recargar,
  })
}

export function useOrdenarCategorias() {
  const recargar = useRecargarCatalogos()
  return useMutation({
    mutationFn: (ids: string[]) =>
      pedir<CategoriaConfig[]>('/categorias/orden', json('PUT', { categorias: ids })),
    onSuccess: recargar,
  })
}

/** Lista con un elemento movido un lugar arriba (-1) o abajo (+1). */
export function mover<T>(lista: T[], i: number, paso: -1 | 1): T[] {
  const j = i + paso
  if (j < 0 || j >= lista.length) return lista
  const copia = [...lista]
  ;[copia[i], copia[j]] = [copia[j]!, copia[i]!]
  return copia
}
