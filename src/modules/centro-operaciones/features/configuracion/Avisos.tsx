import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { pedir } from '../../lib/api'
import { armarMensaje, PLANTILLA_POR_DEFECTO } from '../../lib/mensaje'
import { useConectado } from '../../lib/tiempoReal'
import { useMatriz } from '../matriz/datos'

/** Guarda un valor de configuración y actualiza la matriz (que la incluye). */
function useGuardarConfiguracion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clave, valor }: { clave: string; valor: unknown }) =>
      pedir(`/configuracion/${clave}`, { method: 'PUT', body: JSON.stringify({ valor }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matriz'] }),
  })
}

/**
 * Terminar y avisar (especificación 6.4 y 6.7): confeti al terminar y
 * plantilla de "Copiar mensaje".
 */
export function SeccionAvisos() {
  const config = useMatriz().data?.config
  const conectado = useConectado()
  const guardar = useGuardarConfiguracion()
  const idPlantilla = useId()
  const guardada = config?.plantilla ?? PLANTILLA_POR_DEFECTO
  const [plantilla, setPlantilla] = useState<string | null>(null)
  const [confetiLocal, setConfetiLocal] = useState<boolean | null>(null)
  const confetiGuardado = config?.confeti ?? true
  // Cuando lo guardado coincide con lo elegido, manda lo guardado.
  if (confetiLocal !== null && confetiLocal === confetiGuardado && !guardar.isPending) {
    setConfetiLocal(null)
  }
  const confeti = confetiLocal ?? confetiGuardado
  const texto = plantilla ?? guardada
  const cambiada = plantilla !== null && plantilla.trim() !== guardada

  const ejemplo = armarMensaje(texto, {
    nombre: 'Nombre Apellido',
    trabajo: 'Trabajo',
    saldo: 1500,
  })

  return (
    <section className="co-seccion co-seccion--primera" aria-labelledby="co-titulo-avisos">
      <h3 id="co-titulo-avisos" className="co-subtitulo">
        Terminar y avisar
      </h3>

      <label className="co-interruptor">
        <input
          type="checkbox"
          role="switch"
          checked={confeti}
          disabled={!conectado}
          onChange={(e) => {
            const valor = e.target.checked
            // Cambia al instante; si el servidor rechaza, vuelve a lo guardado.
            setConfetiLocal(valor)
            guardar.mutate(
              { clave: 'confeti_activado', valor },
              { onError: () => setConfetiLocal(null) },
            )
          }}
        />
        <span>Confeti al terminar una tarea</span>
      </label>

      <div className="co-campo">
        <label className="co-campo__etiqueta" htmlFor={idPlantilla}>
          Mensaje para copiar
        </label>
        <textarea
          id={idPlantilla}
          className="co-entrada co-entrada--texto"
          rows={3}
          maxLength={500}
          aria-describedby={`${idPlantilla}-ayuda`}
          value={texto}
          onChange={(e) => setPlantilla(e.target.value)}
        />
        <p id={`${idPlantilla}-ayuda`} className="co-texto-suave">
          Se reemplazan {'{nombre}'}, {'{trabajo}'} y {'{saldo}'}. Ejemplo: “{ejemplo}”
        </p>
        <div className="co-fila">
          <button
            type="button"
            className="co-boton"
            disabled={!cambiada || texto.trim() === '' || !conectado || guardar.isPending}
            onClick={() =>
              guardar.mutate(
                { clave: 'plantilla_mensaje', valor: texto.trim() },
                { onSuccess: () => setPlantilla(null) },
              )
            }
          >
            Guardar mensaje
          </button>
          {texto.trim() !== PLANTILLA_POR_DEFECTO && (
            <button
              type="button"
              className="co-boton-sutil"
              onClick={() => setPlantilla(PLANTILLA_POR_DEFECTO)}
            >
              Volver al mensaje original
            </button>
          )}
        </div>
      </div>
      {guardar.isError && (
        <p className="co-aviso" role="alert">
          No se pudo guardar: {guardar.error.message}
        </p>
      )}
    </section>
  )
}
