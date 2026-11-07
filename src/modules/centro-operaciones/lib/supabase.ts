import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type ClienteSupabase = SupabaseClient<Database>

let cliente: ClienteSupabase | null = null
let personaActiva: string | null = null

/** Persona activa ("¿Quién soy?"): viaja en cada pedido para quedar como autora en el historial. */
export function definirPersonaActiva(id: string | null) {
  personaActiva = id
}

export function obtenerSupabase(): ClienteSupabase {
  if (cliente) return cliente
  const url = import.meta.env.VITE_SUPABASE_URL
  const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !clave) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. Copiá .env.example como .env.local.',
    )
  }
  cliente = createClient<Database>(url, clave, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'co-sesion' },
    global: {
      fetch: (entrada, opciones = {}) => {
        const headers = new Headers(opciones.headers)
        if (personaActiva) headers.set('x-persona-id', personaActiva)
        return fetch(entrada, { ...opciones, headers })
      },
    },
  })
  return cliente
}
