import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { obtenerSupabase } from '../../lib/supabase'

/** Sesión de la cuenta del local. `undefined` mientras se averigua. */
export function useSesion(): Session | null | undefined {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    const supabase = obtenerSupabase()
    let activo = true
    supabase.auth.getSession().then(({ data }) => {
      if (activo) setSesion(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva))
    return () => {
      activo = false
      data.subscription.unsubscribe()
    }
  }, [])

  return sesion
}
