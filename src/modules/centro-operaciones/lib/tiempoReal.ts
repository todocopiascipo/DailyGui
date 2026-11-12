/**
 * Tiempo real y estado de la conexión con el servidor del local
 * (especificación 8). Escucha el canal /api/cambios y, ante cada aviso, vuelve
 * a pedir lo que la pantalla muestra. Al reconectar o volver de suspensión,
 * trae todo de nuevo para no perder cambios ocurridos durante el corte.
 */
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, usaSupabase } from './supabase'

export type EstadoConexion = 'conectando' | 'conectado' | 'sin_conexion'

/** Sin latido (el servidor manda uno cada 5 s) durante este tiempo, la conexión se da por caída. */
const LIMITE_SILENCIO_MS = 12_000
const REINTENTO_MS = 3_000

export const ContextoConexion = createContext<EstadoConexion>('conectado')

/** true mientras se pueda guardar (no hay un corte detectado). */
export function useConectado(): boolean {
  return useContext(ContextoConexion) !== 'sin_conexion'
}

interface Aviso {
  recursos: ('tareas' | 'personas' | 'configuracion' | 'proyectos' | 'catalogos')[]
  tarea_id?: string | null
}

function aplicarAviso(qc: QueryClient, aviso: Aviso) {
  if (aviso.recursos.includes('tareas')) {
    void qc.invalidateQueries({ queryKey: ['matriz'] })
    void qc.invalidateQueries({
      queryKey: aviso.tarea_id ? ['tarea', aviso.tarea_id] : ['tarea'],
    })
    void qc.invalidateQueries({ queryKey: ['papelera'] })
    void qc.invalidateQueries({ queryKey: ['hechas'] })
    void qc.invalidateQueries({ queryKey: ['mis-tareas'] })
    // El avance de cada proyecto depende de sus tareas.
    void qc.invalidateQueries({ queryKey: ['proyectos'] })
    void qc.invalidateQueries({ queryKey: ['proyecto'] })
  }
  if (aviso.recursos.includes('proyectos')) {
    void qc.invalidateQueries({ queryKey: ['proyectos'] })
    void qc.invalidateQueries({ queryKey: ['proyecto'] })
    void qc.invalidateQueries({ queryKey: ['catalogos'] })
    void qc.invalidateQueries({ queryKey: ['matriz'] })
  }
  if (aviso.recursos.includes('configuracion')) {
    void qc.invalidateQueries({ queryKey: ['matriz'] })
  }
  if (aviso.recursos.includes('personas') || aviso.recursos.includes('catalogos')) {
    void qc.invalidateQueries({ queryKey: ['catalogos'] })
    void qc.invalidateQueries({ queryKey: ['personas'] })
    void qc.invalidateQueries({ queryKey: ['categorias'] })
    // Los nombres aparecen en los globos.
    void qc.invalidateQueries({ queryKey: ['matriz'] })
  }
  // El historial cambia con casi todo.
  void qc.invalidateQueries({ queryKey: ['historial'] })
}

/**
 * Abre el canal de avisos y mantiene el estado de la conexión: el del
 * servidor local en desarrollo, el de Supabase en la app publicada.
 */
export const useTiempoReal: () => EstadoConexion = usaSupabase
  ? useTiempoRealSupabase
  : useTiempoRealLocal

/** Canal "co-cambios" de Supabase (lo alimentan los triggers de la base). */
function useTiempoRealSupabase(): EstadoConexion {
  const qc = useQueryClient()
  const [estado, setEstado] = useState<EstadoConexion>('conectando')

  useEffect(() => {
    const sb = supabase()
    let huboCorte = false
    let activo = true
    const resincronizar = () => void qc.invalidateQueries()
    const caida = () => {
      if (!activo) return
      huboCorte = true
      setEstado('sin_conexion')
    }

    const canal = sb
      .channel('co-cambios')
      .on('broadcast', { event: 'cambio' }, ({ payload }) => {
        try {
          aplicarAviso(qc, payload as Aviso)
        } catch {
          resincronizar()
        }
      })
      .subscribe((s) => {
        if (!activo) return
        if (s === 'SUBSCRIBED') {
          setEstado('conectado')
          // Lo que pasó mientras no había conexión se trae de nuevo.
          if (huboCorte) resincronizar()
          huboCorte = false
        } else {
          // CHANNEL_ERROR, TIMED_OUT o CLOSED: Supabase reintenta solo.
          caida()
        }
      })

    const alVolverAPantalla = () => {
      if (document.visibilityState === 'visible') resincronizar()
    }
    window.addEventListener('offline', caida)
    window.addEventListener('online', resincronizar)
    document.addEventListener('visibilitychange', alVolverAPantalla)
    return () => {
      activo = false
      void sb.removeChannel(canal)
      window.removeEventListener('offline', caida)
      window.removeEventListener('online', resincronizar)
      document.removeEventListener('visibilitychange', alVolverAPantalla)
    }
  }, [qc])

  return estado
}

/** Canal /api/cambios del servidor local (Server-Sent Events con latido). */
function useTiempoRealLocal(): EstadoConexion {
  const qc = useQueryClient()
  const [estado, setEstado] = useState<EstadoConexion>('conectando')

  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    let fuente: EventSource | null = null
    let reintento: ReturnType<typeof setTimeout> | undefined
    let ultimoMensaje = Date.now()
    let huboCorte = false
    let activo = true

    const resincronizar = () => void qc.invalidateQueries()

    const caida = () => {
      if (!activo) return
      huboCorte = true
      setEstado('sin_conexion')
    }

    const conectar = () => {
      clearTimeout(reintento)
      fuente?.close()
      ultimoMensaje = Date.now()
      const es = new EventSource('/api/cambios')
      fuente = es
      const vivo = () => {
        ultimoMensaje = Date.now()
      }
      es.addEventListener('hola', () => {
        vivo()
        setEstado('conectado')
        // Lo que pasó mientras no había conexión se trae de nuevo.
        if (huboCorte) resincronizar()
        huboCorte = false
      })
      es.addEventListener('latido', vivo)
      es.addEventListener('cambio', (e) => {
        vivo()
        try {
          aplicarAviso(qc, JSON.parse((e as MessageEvent<string>).data) as Aviso)
        } catch {
          resincronizar()
        }
      })
      es.onerror = () => {
        caida()
        // Cerrada del todo (el navegador no reintenta): reintentar a mano.
        if (es.readyState === EventSource.CLOSED) reintento = setTimeout(conectar, REINTENTO_MS)
      }
    }

    // Si el canal queda en silencio (por ej., la PC se durmió), reconectar.
    const vigilancia = setInterval(() => {
      if (Date.now() - ultimoMensaje > LIMITE_SILENCIO_MS) {
        caida()
        conectar()
      }
    }, 2_000)

    const alPerderRed = () => {
      fuente?.close()
      caida()
    }
    const alVolverRed = () => conectar()
    const alVolverAPantalla = () => {
      if (document.visibilityState !== 'visible') return
      if (fuente?.readyState === EventSource.OPEN) resincronizar()
      else conectar()
    }

    conectar()
    window.addEventListener('offline', alPerderRed)
    window.addEventListener('online', alVolverRed)
    document.addEventListener('visibilitychange', alVolverAPantalla)
    return () => {
      activo = false
      clearTimeout(reintento)
      clearInterval(vigilancia)
      fuente?.close()
      window.removeEventListener('offline', alPerderRed)
      window.removeEventListener('online', alVolverRed)
      document.removeEventListener('visibilitychange', alVolverAPantalla)
    }
  }, [qc])

  return estado
}
