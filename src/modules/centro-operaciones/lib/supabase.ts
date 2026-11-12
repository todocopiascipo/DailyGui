/**
 * Cliente de Supabase para la app publicada (GitHub Pages). Solo se usa si la
 * app se construyó con VITE_CO_BACKEND=supabase; en desarrollo, la app habla
 * con el servidor local (server/).
 *
 * La clave es la "publicable" de Supabase: está hecha para ir en el navegador.
 * Los datos los protege la base (cada función controla el acceso).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { claveDeAcceso } from './acceso'

export const usaSupabase = import.meta.env.VITE_CO_BACKEND === 'supabase'

let cliente: SupabaseClient | null = null
let personaActual: string | null = null

/** Persona activa: viaja como encabezado para quedar como autora en el historial. */
export function personaParaSupabase(id: string | null) {
  personaActual = id
}

export function supabase(): SupabaseClient {
  if (cliente) return cliente
  const url = import.meta.env.VITE_SUPABASE_URL
  const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !clave) throw new Error('Falta la configuración de Supabase')
  cliente = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (entrada, init = {}) => {
        const headers = new Headers(init.headers)
        if (personaActual) headers.set('x-persona-id', personaActual)
        const clave = claveDeAcceso()
        if (clave) headers.set('x-co-acceso', clave)
        return fetch(entrada, { ...init, headers })
      },
    },
  })
  return cliente
}
