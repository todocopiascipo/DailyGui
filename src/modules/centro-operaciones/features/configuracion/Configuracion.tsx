/**
 * Configuración (especificación 7.12): personas, categorías, urgencia y
 * cuadrantes, confeti y mensaje para copiar, Papelera (6.5: restaurar o borrar
 * definitivamente, y cuántos días quedan) y Exportar respaldo. Se carga
 * diferido: no pesa en la pantalla principal.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { pedir } from '../../lib/api'
import { tiempoTranscurrido, ZONA_HORARIA } from '../../lib/tiempo'
import { useConectado } from '../../lib/tiempoReal'
import { AvisoSinConexion } from '../tarea/AvisoSinConexion'
import { Confirmacion } from '../tarea/Confirmacion'
import { Dialogo } from '../tarea/Dialogo'
import { SeccionAvisos } from './Avisos'
import {
  DiasPapelera,
  SeccionCategorias,
  SeccionPersonas,
  SeccionRespaldo,
  SeccionUrgencia,
} from './Secciones'

interface TareaPapelera {
  id: string
  titulo: string
  tipo: string
  eliminada_at: string
  eliminada_por: string | null
  se_borra_el: string
}

function usePapelera() {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: ['papelera'],
    queryFn: () => pedir<TareaPapelera[]>('/papelera'),
  })
  const recargar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['papelera'] }),
      qc.invalidateQueries({ queryKey: ['matriz'] }),
    ])
  const restaurar = useMutation({
    mutationFn: (id: string) =>
      pedir(`/tareas/${encodeURIComponent(id)}/restaurar`, { method: 'POST' }),
    onSuccess: recargar,
  })
  const borrar = useMutation({
    mutationFn: (id: string) => pedir(`/tareas/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: recargar,
  })
  return { lista, restaurar, borrar }
}

export default function Configuracion({ ahora, onCerrar }: { ahora: Date; onCerrar: () => void }) {
  const { lista, restaurar, borrar } = usePapelera()
  const conectado = useConectado()
  const [aBorrar, setABorrar] = useState<TareaPapelera | null>(null)
  const error = restaurar.error ?? borrar.error

  return (
    <>
      <Dialogo titulo="Configuración" variante="amplia" sinGuardar={false} onCerrar={onCerrar}>
        <AvisoSinConexion />
        <SeccionPersonas />
        <SeccionCategorias />
        <SeccionUrgencia />
        <SeccionAvisos />
        <section className="co-seccion" aria-labelledby="co-titulo-papelera">
          <h3 id="co-titulo-papelera" className="co-subtitulo">
            Papelera
          </h3>
          <p className="co-texto-suave">
            Las tareas eliminadas quedan acá y se borran solas pasado el plazo.
          </p>
          <DiasPapelera />
          {error && (
            <p className="co-aviso" role="alert">
              No se pudo completar: {error.message}
            </p>
          )}
          {lista.isPending && <p className="co-texto-suave">Cargando…</p>}
          {lista.data?.length === 0 && <p>La papelera está vacía.</p>}
          <ul className="co-papelera-lista">
            {lista.data?.map((t) => (
              <li key={t.id} className="co-papelera-lista__item">
                <div className="co-papelera-lista__texto">
                  <strong>{t.titulo}</strong>
                  <span className="co-texto-suave">
                    Eliminada {tiempoTranscurrido(new Date(t.eliminada_at), ahora)}
                    {t.eliminada_por ? ` por ${t.eliminada_por}` : ''} · se borra el{' '}
                    {formatInTimeZone(new Date(t.se_borra_el), ZONA_HORARIA, 'dd/MM')}
                  </span>
                </div>
                <div className="co-fila">
                  <button
                    type="button"
                    className="co-boton-sutil"
                    disabled={!conectado || restaurar.isPending}
                    onClick={() => restaurar.mutate(t.id)}
                    aria-label={`Restaurar ${t.titulo}`}
                  >
                    <RotateCcw size={14} aria-hidden /> Restaurar
                  </button>
                  <button
                    type="button"
                    className="co-boton-icono"
                    disabled={!conectado || borrar.isPending}
                    onClick={() => setABorrar(t)}
                    aria-label={`Borrar definitivamente ${t.titulo}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <SeccionRespaldo />
      </Dialogo>
      {aBorrar && (
        <Confirmacion
          titulo="¿Borrar definitivamente?"
          texto={`"${aBorrar.titulo}" se borra para siempre. No se puede deshacer.`}
          confirmar="Borrar"
          peligro
          onCancelar={() => setABorrar(null)}
          onConfirmar={() => {
            borrar.mutate(aBorrar.id)
            setABorrar(null)
          }}
        />
      )}
    </>
  )
}
