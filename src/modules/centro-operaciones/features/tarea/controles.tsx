import { Plus, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { ATAJOS, aplicarAtajo, SIN_FECHA, type FechaHora } from '../../lib/fechas'
import type { PersonaBreve } from '../matriz/tipos'
import type { BorradorCliente, MedioPago } from './borrador'
import { useConectado } from '../../lib/tiempoReal'
import { useCrearPersona } from './datos'
import type { Cliente } from './tipos'
import { MEDIOS_PAGO, normalizar, useClientesPorTelefono } from './utilidades'

/** Etiqueta + control + error, con la accesibilidad resuelta. */
export function Campo({
  etiqueta,
  error,
  children,
  como = 'div',
}: {
  etiqueta: string
  error?: string
  children: (ids: { id: string; descripcion?: string }) => ReactNode
  como?: 'div' | 'fieldset'
}) {
  const id = useId()
  const idError = `${id}-error`
  const ids = { id, descripcion: error ? idError : undefined }
  const contenido = (
    <>
      {como === 'fieldset' ? (
        <legend className="co-campo__etiqueta">{etiqueta}</legend>
      ) : (
        <label className="co-campo__etiqueta" htmlFor={id}>
          {etiqueta}
        </label>
      )}
      {children(ids)}
      {error && (
        <p id={idError} className="co-campo__error" role="alert">
          {error}
        </p>
      )}
    </>
  )
  return como === 'fieldset' ? (
    <fieldset className="co-campo" aria-describedby={ids.descripcion}>
      {contenido}
    </fieldset>
  ) : (
    <div className="co-campo">{contenido}</div>
  )
}

/** Grupo de botones excluyentes (tipo cápsula). */
export function Segmentado<T extends string | boolean>({
  opciones,
  valor,
  onCambiar,
  etiqueta,
}: {
  opciones: { valor: T; texto: string }[]
  valor: T | null
  onCambiar: (v: T) => void
  etiqueta: string
}) {
  return (
    <div className="co-segmentado" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          className="co-segmentado__opcion"
          onClick={() => onCambiar(o.valor)}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

export function SiNo({
  valor,
  onCambiar,
  error,
}: {
  valor: boolean | null
  onCambiar: (v: boolean) => void
  error?: string
}) {
  return (
    <Campo etiqueta="Importante" error={error} como="fieldset">
      {() => (
        <Segmentado
          etiqueta="Importante"
          valor={valor}
          onCambiar={onCambiar}
          opciones={[
            { valor: true, texto: 'Sí' },
            { valor: false, texto: 'No' },
          ]}
        />
      )}
    </Campo>
  )
}

/**
 * Responsables: fichas de acceso rápido (las usadas más recientemente
 * primero). "+ Persona" busca entre las existentes y, si no está, la agrega.
 */
export function ElegirResponsables({
  personas,
  elegidas,
  onCambiar,
}: {
  personas: PersonaBreve[]
  elegidas: string[]
  onCambiar: (ids: string[]) => void
}) {
  const [agregando, setAgregando] = useState(false)
  const [nombre, setNombre] = useState('')
  const crear = useCrearPersona()
  const conectado = useConectado()

  const alternar = (id: string) =>
    onCambiar(elegidas.includes(id) ? elegidas.filter((e) => e !== id) : [...elegidas, id])

  const buscado = normalizar(nombre)
  const exacta = buscado ? personas.find((p) => normalizar(p.nombre) === buscado) : undefined
  // Mientras se escribe, se ven solo las que coinciden (y las ya elegidas).
  const visibles = buscado
    ? personas.filter((p) => normalizar(p.nombre).includes(buscado) || elegidas.includes(p.id))
    : personas

  const cerrarBusqueda = () => {
    setNombre('')
    setAgregando(false)
  }

  const agregar = () => {
    if (buscado === '') return
    // Si ya existe, se elige en lugar de crearla de nuevo.
    if (exacta) {
      if (!elegidas.includes(exacta.id)) onCambiar([...elegidas, exacta.id])
      cerrarBusqueda()
      return
    }
    if (!conectado) return
    crear.mutate(nombre, {
      onSuccess: (p) => {
        onCambiar([...elegidas, p.id])
        cerrarBusqueda()
      },
    })
  }

  return (
    <Campo etiqueta="Responsables" como="fieldset">
      {() => (
        <div className="co-fichas">
          {personas.length === 0 && !agregando && (
            <p className="co-texto-suave">Todavía no hay personas cargadas.</p>
          )}
          {visibles.map((p) => (
            <button
              key={p.id}
              type="button"
              className="co-ficha"
              aria-pressed={elegidas.includes(p.id)}
              onClick={() => alternar(p.id)}
            >
              {p.nombre}
            </button>
          ))}
          {agregando ? (
            <span className="co-ficha-nueva">
              <input
                autoFocus
                className="co-entrada co-entrada--chica"
                aria-label="Nombre de la persona"
                placeholder="Buscar o agregar"
                maxLength={60}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    agregar()
                  }
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    cerrarBusqueda()
                  }
                }}
              />
              <button
                type="button"
                className="co-boton-sutil"
                onClick={agregar}
                disabled={buscado === '' || crear.isPending || (!exacta && !conectado)}
              >
                {exacta ? `Elegir ${exacta.nombre}` : 'Agregar'}
              </button>
              <button
                type="button"
                className="co-boton-icono"
                aria-label="Cancelar"
                onClick={cerrarBusqueda}
              >
                <X size={16} aria-hidden />
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="co-ficha co-ficha--agregar"
              onClick={() => setAgregando(true)}
            >
              <Plus size={14} aria-hidden strokeWidth={2.25} />
              Persona
            </button>
          )}
          {crear.isError && (
            <p className="co-campo__error" role="alert">
              {crear.error.message}
            </p>
          )}
        </div>
      )}
    </Campo>
  )
}

/** Fecha y hora (del local), siempre con los atajos Hoy, Mañana, +1 h, +2 h y +4 h. */
export function CampoFechaHora({
  etiqueta,
  valor,
  onCambiar,
  ahora,
  error,
}: {
  etiqueta: string
  valor: FechaHora
  onCambiar: (v: FechaHora) => void
  ahora: Date
  error?: string
}) {
  return (
    <Campo etiqueta={etiqueta} error={error} como="fieldset">
      {({ descripcion }) => (
        <div className="co-fecha-hora">
          <div className="co-fila">
            <input
              type="date"
              className="co-entrada"
              aria-label={`${etiqueta}: día`}
              aria-describedby={descripcion}
              value={valor.fecha}
              onChange={(e) => onCambiar({ ...valor, fecha: e.target.value })}
            />
            <input
              type="time"
              className="co-entrada co-entrada--hora"
              aria-label={`${etiqueta}: hora`}
              aria-describedby={descripcion}
              value={valor.hora}
              onChange={(e) => onCambiar({ ...valor, hora: e.target.value })}
            />
            {(valor.fecha || valor.hora) && (
              <button
                type="button"
                className="co-boton-icono"
                aria-label={`Quitar ${etiqueta.toLowerCase()}`}
                onClick={() => onCambiar(SIN_FECHA)}
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
          <div
            className="co-atajos"
            role="group"
            aria-label={`Atajos de ${etiqueta.toLowerCase()}`}
          >
            {ATAJOS.map((a) => (
              <button
                key={a.id}
                type="button"
                className="co-boton-sutil"
                onClick={() => onCambiar(aplicarAtajo(a.id, valor, ahora))}
              >
                {a.texto}
              </button>
            ))}
          </div>
        </div>
      )}
    </Campo>
  )
}

/** "Ya existe: … · Usar este cliente". */
export function SugerenciasCliente({
  encontrados,
  onUsar,
}: {
  encontrados: Cliente[]
  onUsar: (c: BorradorCliente) => void
}) {
  return encontrados.map((c) => (
    <p key={c.id} className="co-sugerencia">
      <span>
        Ya existe: <strong>{c.nombre_apellido}</strong>
      </span>
      <button
        type="button"
        className="co-boton-sutil"
        onClick={() =>
          onUsar({ id: c.id, nombre_apellido: c.nombre_apellido, telefono: c.telefono ?? '' })
        }
      >
        Usar este cliente
      </button>
    </p>
  ))
}

/**
 * Nombre y teléfono del cliente. Si el teléfono ya está cargado, ofrece
 * reutilizar ese cliente (especificación 5, clientes).
 */
export function CamposCliente({
  valor,
  onCambiar,
  error,
}: {
  valor: BorradorCliente
  onCambiar: (c: BorradorCliente) => void
  error?: string
}) {
  const encontrados = useClientesPorTelefono(valor)

  return (
    <div className="co-grupo">
      <div className="co-fila co-fila--campos">
        <Campo etiqueta="Cliente (nombre y apellido)" error={error}>
          {({ id, descripcion }) => (
            <input
              id={id}
              className="co-entrada"
              autoComplete="off"
              maxLength={120}
              aria-describedby={descripcion}
              value={valor.nombre_apellido}
              // Corregir el nombre mantiene el mismo cliente.
              onChange={(e) => onCambiar({ ...valor, nombre_apellido: e.target.value })}
            />
          )}
        </Campo>
        <Campo etiqueta="Teléfono">
          {({ id }) => (
            <input
              id={id}
              className="co-entrada"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              maxLength={30}
              value={valor.telefono}
              // Otro teléfono es otro cliente: se desvincula.
              onChange={(e) => onCambiar({ ...valor, id: null, telefono: e.target.value })}
            />
          )}
        </Campo>
      </div>
      <SugerenciasCliente encontrados={encontrados} onUsar={onCambiar} />
    </div>
  )
}

export function CampoImporte({
  etiqueta,
  valor,
  onCambiar,
  error,
}: {
  etiqueta: string
  valor: string
  onCambiar: (v: string) => void
  error?: string
}) {
  return (
    <Campo etiqueta={etiqueta} error={error}>
      {({ id, descripcion }) => (
        <div className="co-importe">
          <span aria-hidden>$</span>
          <input
            id={id}
            className="co-entrada"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-describedby={descripcion}
            aria-invalid={Boolean(error)}
            value={valor}
            onChange={(e) => onCambiar(e.target.value)}
          />
        </div>
      )}
    </Campo>
  )
}

/**
 * Importe con su medio de pago (como los recuadros de la orden de trabajo de
 * papel: "POSNET · EFECTIVO · TRANSFERENCIA"). Tocar el medio elegido lo quita.
 */
export function CampoPago({
  etiqueta,
  valor,
  medio,
  onCambiar,
  onCambiarMedio,
  error,
}: {
  etiqueta: string
  valor: string
  medio: MedioPago | null
  onCambiar: (v: string) => void
  onCambiarMedio: (m: MedioPago | null) => void
  error?: string
}) {
  return (
    <div className="co-pago">
      <CampoImporte etiqueta={etiqueta} valor={valor} onCambiar={onCambiar} error={error} />
      <div className="co-pago__medios" role="group" aria-label={`Medio de pago: ${etiqueta}`}>
        {MEDIOS_PAGO.map((m) => (
          <button
            key={m.valor}
            type="button"
            className="co-pago__medio"
            aria-pressed={medio === m.valor}
            onClick={() => onCambiarMedio(medio === m.valor ? null : m.valor)}
          >
            {m.texto}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Slider de 5 pasos con la urgencia estimada al lado (especificación 6.1). */
export function SliderUrgencia({
  manual,
  estimada,
  onCambiar,
}: {
  manual: number | null
  estimada: number
  onCambiar: (v: number | null) => void
}) {
  const id = useId()
  const valor = manual ?? estimada
  return (
    <div className="co-campo">
      <div className="co-fila co-fila--entre">
        <label className="co-campo__etiqueta" htmlFor={id}>
          Urgencia: {valor}
          {manual === null ? ' (automática)' : ' (manual)'}
        </label>
        <span className="co-texto-suave">Urgencia estimada: {estimada}</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        className="co-slider"
        data-automatica={manual === null}
        value={valor}
        aria-valuetext={`${valor} de 5${manual === null ? ', automática' : ''}`}
        onChange={(e) => onCambiar(Number(e.target.value))}
      />
      <div className="co-slider__marcas" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      {manual !== null && (
        <button
          type="button"
          className="co-boton-sutil co-alinear-inicio"
          onClick={() => onCambiar(null)}
        >
          Volver a la automática
        </button>
      )}
    </div>
  )
}

/**
 * Urgente: Sí / No / Por fecha (especificación 6.1: la urgencia se estima por
 * la entrega; elegir Sí o No la fija). `urgenteSegunFecha` es cómo quedaría
 * hoy si se deja "Por fecha".
 */
export function ElegirUrgente({
  valor,
  onCambiar,
  urgenteSegunFecha,
}: {
  valor: boolean | null
  onCambiar: (v: boolean | null) => void
  urgenteSegunFecha: boolean
}) {
  const opcion = valor === null ? 'fecha' : valor ? 'si' : 'no'
  return (
    <Campo etiqueta="Urgente" como="fieldset">
      {() => (
        <div className="co-grupo">
          <Segmentado
            etiqueta="Urgente"
            valor={opcion}
            onCambiar={(v) => onCambiar(v === 'fecha' ? null : v === 'si')}
            opciones={[
              { valor: 'si', texto: 'Sí' },
              { valor: 'no', texto: 'No' },
              { valor: 'fecha', texto: 'Por fecha' },
            ]}
          />
          {valor === null && (
            <p className="co-texto-suave">
              Se calcula con la entrega: hoy {urgenteSegunFecha ? 'es urgente' : 'no es urgente'}.
            </p>
          )}
        </div>
      )}
    </Campo>
  )
}
