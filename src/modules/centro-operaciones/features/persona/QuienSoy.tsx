import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, LogOut, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { pedir } from '../../lib/api'
import { useConectado } from '../../lib/tiempoReal'
import type { PersonaBreve } from '../matriz/tipos'
import { useCrearPersona } from '../tarea/datos'
import { Dialogo } from '../tarea/Dialogo'
import { normalizar } from '../tarea/utilidades'

interface Props {
  personas: PersonaBreve[]
  actual: PersonaBreve | null
  /** Por qué se pide (por ej., antes de crear una tarea). */
  motivo?: string
  onElegir: (p: PersonaBreve | null) => void
  onCerrar: () => void
}

/**
 * "¿Quién soy?" (especificación 7.6): elegirse sin contraseña; si la persona
 * configuró un PIN, se pide. También permite sumarse al equipo y poner,
 * cambiar o quitar el propio PIN.
 */
export function QuienSoy({ personas, actual, motivo, onElegir, onCerrar }: Props) {
  const [conPin, setConPin] = useState<PersonaBreve | null>(null)
  const [gestionandoPin, setGestionandoPin] = useState(false)

  return (
    <Dialogo titulo="¿Quién soy?" variante="centro" sinGuardar={false} onCerrar={onCerrar}>
      {motivo && <p className="co-aviso-suave">{motivo}</p>}
      {conPin ? (
        <PedirPin
          persona={conPin}
          onVolver={() => setConPin(null)}
          onCorrecto={() => onElegir(conPin)}
        />
      ) : gestionandoPin && actual ? (
        <GestionPin persona={actual} onListo={() => setGestionandoPin(false)} />
      ) : (
        <>
          {personas.length === 0 && (
            <p className="co-texto-suave">Todavía no hay personas cargadas. Agregate abajo.</p>
          )}
          <ul className="co-personas" aria-label="Personas del equipo">
            {personas.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="co-persona"
                  aria-pressed={actual?.id === p.id}
                  onClick={() => (p.tiene_pin ? setConPin(p) : onElegir(p))}
                >
                  <span className="co-persona__iniciales" aria-hidden>
                    {p.iniciales ?? p.nombre.slice(0, 1)}
                  </span>
                  <span>{p.nombre}</span>
                  {p.tiene_pin && <KeyRound size={14} aria-label="Con PIN" strokeWidth={2} />}
                </button>
              </li>
            ))}
          </ul>
          <AgregarPersona personas={personas} onAgregada={onElegir} />
          {actual && (
            <div className="co-fila co-fila--envolver">
              <button
                type="button"
                className="co-boton-sutil"
                onClick={() => setGestionandoPin(true)}
              >
                <KeyRound size={14} aria-hidden />
                {actual.tiene_pin ? 'Cambiar o quitar mi PIN' : 'Poner un PIN'}
              </button>
              <button type="button" className="co-boton-sutil" onClick={() => onElegir(null)}>
                <LogOut size={14} aria-hidden /> Dejar de ser {actual.nombre}
              </button>
            </div>
          )}
        </>
      )}
    </Dialogo>
  )
}

function CampoPin({
  etiqueta,
  valor,
  onCambiar,
  autoFocus = false,
}: {
  etiqueta: string
  valor: string
  onCambiar: (v: string) => void
  autoFocus?: boolean
}) {
  const id = useId()
  return (
    <div className="co-campo">
      <label className="co-campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        data-autofocus={autoFocus || undefined}
        className="co-entrada co-entrada--pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={valor}
        onChange={(e) => onCambiar(e.target.value.replace(/\D/g, ''))}
      />
    </div>
  )
}

function PedirPin({
  persona,
  onVolver,
  onCorrecto,
}: {
  persona: PersonaBreve
  onVolver: () => void
  onCorrecto: () => void
}) {
  const [pin, setPin] = useState('')
  const verificar = useMutation({
    mutationFn: () =>
      pedir(`/personas/${encodeURIComponent(persona.id)}/verificar`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      }),
    onSuccess: onCorrecto,
    onError: () => setPin(''),
  })
  return (
    <form
      className="co-formulario"
      onSubmit={(e) => {
        e.preventDefault()
        if (pin.length >= 4) verificar.mutate()
      }}
    >
      <p>
        Hola, <strong>{persona.nombre}</strong>. Ingresá tu PIN.
      </p>
      <CampoPin etiqueta="PIN" valor={pin} onCambiar={setPin} autoFocus />
      {verificar.isError && (
        <p className="co-campo__error" role="alert">
          {verificar.error.message}
        </p>
      )}
      <div className="co-fila">
        <button type="button" className="co-boton-sutil" onClick={onVolver}>
          Volver
        </button>
        <button type="submit" className="co-boton" disabled={pin.length < 4 || verificar.isPending}>
          Entrar
        </button>
      </div>
    </form>
  )
}

function GestionPin({ persona, onListo }: { persona: PersonaBreve; onListo: () => void }) {
  const qc = useQueryClient()
  const conectado = useConectado()
  const [actualPin, setActualPin] = useState('')
  const [nuevo, setNuevo] = useState('')
  const guardar = useMutation({
    mutationFn: (pinNuevo: string | null) =>
      pedir(`/personas/${encodeURIComponent(persona.id)}/pin`, {
        method: 'PUT',
        body: JSON.stringify({ pin_actual: actualPin || null, pin_nuevo: pinNuevo }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['catalogos'] })
      onListo()
    },
  })
  return (
    <form
      className="co-formulario"
      onSubmit={(e) => {
        e.preventDefault()
        if (nuevo.length >= 4) guardar.mutate(nuevo)
      }}
    >
      <p className="co-texto-suave">
        El PIN es opcional: se pide al elegirte en "¿Quién soy?". Se guarda cifrado; nadie puede
        verlo.
      </p>
      {persona.tiene_pin && (
        <CampoPin etiqueta="PIN actual" valor={actualPin} onCambiar={setActualPin} autoFocus />
      )}
      <CampoPin
        etiqueta="PIN nuevo (de 4 a 8 números)"
        valor={nuevo}
        onCambiar={setNuevo}
        autoFocus={!persona.tiene_pin}
      />
      {guardar.isError && (
        <p className="co-campo__error" role="alert">
          {guardar.error.message}
        </p>
      )}
      <div className="co-fila co-fila--envolver">
        <button type="button" className="co-boton-sutil" onClick={onListo}>
          Volver
        </button>
        {persona.tiene_pin && (
          <button
            type="button"
            className="co-boton-sutil co-boton-sutil--peligro"
            disabled={!conectado || guardar.isPending}
            onClick={() => guardar.mutate(null)}
          >
            Quitar PIN
          </button>
        )}
        <button
          type="submit"
          className="co-boton"
          disabled={nuevo.length < 4 || !conectado || guardar.isPending}
        >
          Guardar PIN
        </button>
      </div>
    </form>
  )
}

function AgregarPersona({
  personas,
  onAgregada,
}: {
  personas: PersonaBreve[]
  onAgregada: (p: PersonaBreve) => void
}) {
  const [nombre, setNombre] = useState('')
  const crear = useCrearPersona()
  const conectado = useConectado()
  const existente = personas.find((p) => normalizar(p.nombre) === normalizar(nombre))
  return (
    <form
      className="co-fila"
      onSubmit={(e) => {
        e.preventDefault()
        if (!nombre.trim() || existente) return
        crear.mutate(nombre, { onSuccess: (p) => onAgregada(p) })
      }}
    >
      <input
        className="co-entrada co-entrada--chica"
        aria-label="Nombre de una persona nueva"
        placeholder="¿No estás? Escribí tu nombre"
        maxLength={60}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <button
        type="submit"
        className="co-boton-sutil"
        disabled={!nombre.trim() || Boolean(existente) || !conectado || crear.isPending}
      >
        <Plus size={14} aria-hidden /> Agregarme
      </button>
      {existente && <span className="co-texto-suave">Ya está: elegí "{existente.nombre}".</span>}
      {crear.isError && (
        <span className="co-campo__error" role="alert">
          {crear.error.message}
        </span>
      )}
    </form>
  )
}
