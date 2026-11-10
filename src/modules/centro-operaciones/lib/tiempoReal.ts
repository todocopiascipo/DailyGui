/**
 * Tiempo real y estado de la conexión con el servidor del local
 * (especificación 8). Escucha el canal /api/cambios y, ante cada aviso, vuelve
 * a pedir lo que la pantalla muestra. Al reconectar o volver de suspensión,
 * trae todo de nuevo para no perder cambios ocurridos durante el corte.
 */
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState } from 'react'

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
  recursos: ('tareas' | 'personas')[]
  tarea_id?: string | null
}

function aplicarAviso(qc: QueryClient, aviso: Aviso) {
  if (aviso.recursos.includes('tareas')) {
    void qc.invalidateQueries({ queryKey: ['matriz'] })
    void qc.invalidateQueries({
      queryKey: aviso.tarea_id ? ['tarea', aviso.tarea_id] : ['tarea'],
    })
  }
  if (aviso.recursos.includes('personas')) {
    void qc.invalidateQueries({ queryKey: ['catalogos'] })
  }
}

/** Abre el canal y mantiene el estado de la conexión. */
export function useTiempoReal(): EstadoConexion {
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
