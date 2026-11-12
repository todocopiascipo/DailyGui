/**
 * Secciones de Configuración de la Fase 9 (especificación 7.12): personas,
 * categorías, urgencia y cuadrantes, días de la papelera y respaldo.
 */
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Download, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { pedir } from '../../lib/api'
import { diaLocal } from '../../lib/tiempo'
import { useConectado } from '../../lib/tiempoReal'
import {
  NOMBRES_CUADRANTE,
  type Cuadrante,
  type Disposicion,
  type Umbrales,
} from '../../lib/urgencia'
import { useMatriz } from '../matriz/datos'
import { Campo } from '../tarea/controles'
import { useCrearPersona } from '../tarea/datos'
import {
  mover,
  useCategoriasConfig,
  useCrearCategoria,
  useEditarCategoria,
  useEditarPersona,
  useGuardarConfiguracion,
  useOrdenarCategorias,
  useOrdenarPersonas,
  usePersonasConfig,
} from './datos'
import type { CategoriaConfig, PersonaConfig } from './tipos'

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Error del servidor')

function AvisoError({ error }: { error: string | null }) {
  return error ? (
    <p className="co-aviso" role="alert">
      {error}
    </p>
  ) : null
}

/** Texto que se guarda al salir del campo o con Enter (si cambió). */
function TextoEditable({
  valor,
  etiqueta,
  max,
  onGuardar,
}: {
  valor: string
  etiqueta: string
  max: number
  onGuardar: (v: string) => void
}) {
  const [texto, setTexto] = useState(valor)
  const [previo, setPrevio] = useState(valor)
  if (valor !== previo) {
    setPrevio(valor)
    setTexto(valor)
  }
  const conectado = useConectado()
  const guardar = () => {
    const t = texto.trim()
    if (t === '') return setTexto(valor)
    if (t !== valor) onGuardar(t)
  }
  return (
    <input
      className="co-entrada co-entrada--fila"
      aria-label={etiqueta}
      maxLength={max}
      disabled={!conectado}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          guardar()
        }
      }}
    />
  )
}

function BotonesOrden({
  nombre,
  onSubir,
  onBajar,
}: {
  nombre: string
  onSubir?: () => void
  onBajar?: () => void
}) {
  const conectado = useConectado()
  return (
    <>
      <button
        type="button"
        className="co-boton-icono"
        aria-label={`Subir ${nombre}`}
        disabled={!onSubir || !conectado}
        onClick={onSubir}
      >
        <ArrowUp size={16} aria-hidden />
      </button>
      <button
        type="button"
        className="co-boton-icono"
        aria-label={`Bajar ${nombre}`}
        disabled={!onBajar || !conectado}
        onClick={onBajar}
      >
        <ArrowDown size={16} aria-hidden />
      </button>
    </>
  )
}

// ---------------------------------------------------------------------------
// Personas: alta, renombrar, baja/reactivar y orden. El PIN lo pone cada uno
// desde "¿Quién soy?" (para cambiarlo hay que saber el actual).
// ---------------------------------------------------------------------------
export function SeccionPersonas() {
  const personas = usePersonasConfig()
  const editar = useEditarPersona()
  const ordenar = useOrdenarPersonas()
  const crear = useCrearPersona()
  const conectado = useConectado()
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const lista = personas.data ?? []
  const activas = lista.filter((p) => p.activa)
  const bajas = lista.filter((p) => !p.activa)
  const fallo = (e: unknown) => setError(mensaje(e))
  const cambiar = (p: PersonaConfig, cambios: Record<string, unknown>) => {
    setError(null)
    editar.mutateAsync({ id: p.id, cambios }).catch(fallo)
  }
  const orden = (i: number, paso: -1 | 1) => {
    setError(null)
    ordenar.mutateAsync(mover(activas, i, paso).map((p) => p.id)).catch(fallo)
  }

  return (
    <section className="co-seccion" aria-labelledby="co-titulo-personas">
      <h3 id="co-titulo-personas" className="co-subtitulo">
        Personas
      </h3>
      <p className="co-texto-suave">
        El orden es el de los formularios. Dar de baja no borra su historial. El PIN lo pone cada
        uno desde "¿Quién soy?".
      </p>
      <ul className="co-lista-config">
        {activas.map((p, i) => (
          <li key={p.id} className="co-lista-config__item">
            <span className="co-persona__iniciales" aria-hidden>
              {p.iniciales ?? p.nombre.slice(0, 1)}
            </span>
            <TextoEditable
              valor={p.nombre}
              etiqueta={`Nombre de ${p.nombre}`}
              max={60}
              onGuardar={(v) => cambiar(p, { nombre: v, iniciales: null })}
            />
            {p.tiene_pin && <span className="co-chip-estado">Con PIN</span>}
            <BotonesOrden
              nombre={p.nombre}
              onSubir={i > 0 ? () => orden(i, -1) : undefined}
              onBajar={i < activas.length - 1 ? () => orden(i, 1) : undefined}
            />
            <button
              type="button"
              className="co-boton-sutil"
              disabled={!conectado}
              onClick={() => cambiar(p, { activa: false })}
            >
              Dar de baja
            </button>
          </li>
        ))}
      </ul>
      {bajas.length > 0 && (
        <details>
          <summary className="co-texto-suave">Dadas de baja ({bajas.length})</summary>
          <ul className="co-lista-config">
            {bajas.map((p) => (
              <li key={p.id} className="co-lista-config__item" data-inactiva>
                <span className="co-lista-config__nombre">{p.nombre}</span>
                <button
                  type="button"
                  className="co-boton-sutil"
                  disabled={!conectado}
                  onClick={() => cambiar(p, { activa: true })}
                >
                  Reactivar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <form
        className="co-proyecto-nuevo"
        onSubmit={(e) => {
          e.preventDefault()
          if (!nombre.trim()) return
          setError(null)
          crear
            .mutateAsync(nombre.trim())
            .then(() => setNombre(''))
            .catch(fallo)
        }}
      >
        <input
          className="co-entrada"
          aria-label="Nombre de la persona nueva"
          placeholder="Nombre de la persona nueva"
          maxLength={60}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <button type="submit" className="co-boton-sutil" disabled={!conectado}>
          <Plus size={14} aria-hidden /> Agregar persona
        </button>
      </form>
      <AvisoError error={error} />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Categorías: alta, renombrar, para qué es, activar/desactivar y orden.
// ---------------------------------------------------------------------------
const PARA_QUE: Record<CategoriaConfig['tipo_aplica'], string> = {
  pedido: 'Pedidos',
  interna: 'Tareas internas',
  ambos: 'Ambos',
}

function SelectorParaQue({
  valor,
  etiqueta,
  onCambiar,
}: {
  valor: CategoriaConfig['tipo_aplica']
  etiqueta: string
  onCambiar: (v: CategoriaConfig['tipo_aplica']) => void
}) {
  const conectado = useConectado()
  return (
    <select
      className="co-entrada co-entrada--select co-entrada--fila"
      aria-label={etiqueta}
      disabled={!conectado}
      value={valor}
      onChange={(e) => onCambiar(e.target.value as CategoriaConfig['tipo_aplica'])}
    >
      {Object.entries(PARA_QUE).map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  )
}

export function SeccionCategorias() {
  const categorias = useCategoriasConfig()
  const editar = useEditarCategoria()
  const ordenar = useOrdenarCategorias()
  const crear = useCrearCategoria()
  const conectado = useConectado()
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<CategoriaConfig['tipo_aplica']>('pedido')
  const [error, setError] = useState<string | null>(null)
  const lista = categorias.data ?? []
  const fallo = (e: unknown) => setError(mensaje(e))
  const cambiar = (c: CategoriaConfig, cambios: Record<string, unknown>) => {
    setError(null)
    editar.mutateAsync({ id: c.id, cambios }).catch(fallo)
  }
  const orden = (i: number, paso: -1 | 1) => {
    setError(null)
    ordenar.mutateAsync(mover(lista, i, paso).map((c) => c.id)).catch(fallo)
  }

  return (
    <section className="co-seccion" aria-labelledby="co-titulo-categorias">
      <h3 id="co-titulo-categorias" className="co-subtitulo">
        Categorías
      </h3>
      <p className="co-texto-suave">
        Las desactivadas dejan de ofrecerse en los formularios; las tareas que ya la tienen la
        conservan.
      </p>
      <ul className="co-lista-config">
        {lista.map((c, i) => (
          <li key={c.id} className="co-lista-config__item" data-inactiva={!c.activa || undefined}>
            <TextoEditable
              valor={c.nombre}
              etiqueta={`Nombre de la categoría ${c.nombre}`}
              max={60}
              onGuardar={(v) => cambiar(c, { nombre: v })}
            />
            <SelectorParaQue
              valor={c.tipo_aplica}
              etiqueta={`Para qué es ${c.nombre}`}
              onCambiar={(v) => cambiar(c, { tipo_aplica: v })}
            />
            <BotonesOrden
              nombre={c.nombre}
              onSubir={i > 0 ? () => orden(i, -1) : undefined}
              onBajar={i < lista.length - 1 ? () => orden(i, 1) : undefined}
            />
            <label className="co-interruptor co-interruptor--chico">
              <input
                type="checkbox"
                className="co-casilla"
                checked={c.activa}
                disabled={!conectado}
                onChange={(e) => cambiar(c, { activa: e.target.checked })}
              />
              <span>Activa</span>
            </label>
          </li>
        ))}
      </ul>
      <form
        className="co-proyecto-nuevo"
        onSubmit={(e) => {
          e.preventDefault()
          if (!nombre.trim()) return
          setError(null)
          crear
            .mutateAsync({ nombre: nombre.trim(), tipo_aplica: tipo })
            .then(() => setNombre(''))
            .catch(fallo)
        }}
      >
        <input
          className="co-entrada"
          aria-label="Nombre de la categoría nueva"
          placeholder="Nombre de la categoría nueva"
          maxLength={60}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <SelectorParaQue
          valor={tipo}
          etiqueta="Para qué es la categoría nueva"
          onCambiar={setTipo}
        />
        <button type="submit" className="co-boton-sutil" disabled={!conectado}>
          <Plus size={14} aria-hidden /> Agregar categoría
        </button>
      </form>
      <AvisoError error={error} />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Urgencia (umbrales en horas) y disposición de los cuadrantes.
// ---------------------------------------------------------------------------
const LUGARES: { clave: keyof Disposicion; texto: string }[] = [
  { clave: 'arriba_izquierda', texto: 'Arriba a la izquierda' },
  { clave: 'arriba_derecha', texto: 'Arriba a la derecha' },
  { clave: 'abajo_izquierda', texto: 'Abajo a la izquierda' },
  { clave: 'abajo_derecha', texto: 'Abajo a la derecha' },
]

const NIVELES: { clave: keyof Umbrales; texto: string; ayuda: string }[] = [
  { clave: 'nivel_5_horas', texto: 'Crítica', ayuda: 'Faltan menos de estas horas' },
  { clave: 'nivel_3_horas', texto: 'Alta', ayuda: 'Faltan menos de estas horas' },
  { clave: 'nivel_2_horas', texto: 'Media', ayuda: 'Faltan menos de estas horas' },
]

export function SeccionUrgencia() {
  const config = useMatriz().data?.config
  if (!config) return null
  return (
    <FormularioUrgencia
      key={JSON.stringify([config.umbrales, config.disposicion])}
      umbrales={config.umbrales}
      disposicion={config.disposicion}
    />
  )
}

function FormularioUrgencia({
  umbrales,
  disposicion,
}: {
  umbrales: Umbrales
  disposicion: Disposicion
}) {
  const guardar = useGuardarConfiguracion()
  const conectado = useConectado()
  const idForm = useId()
  const [horas, setHoras] = useState(() =>
    Object.fromEntries(NIVELES.map((n) => [n.clave, String(umbrales[n.clave])])),
  )
  const [lugares, setLugares] = useState<Disposicion>(disposicion)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const numeros = Object.fromEntries(
    NIVELES.map((n) => [n.clave, Number(horas[n.clave]?.replace(',', '.'))]),
  ) as unknown as Umbrales
  const cambioUmbrales = NIVELES.some((n) => numeros[n.clave] !== umbrales[n.clave])
  const cambioLugares = JSON.stringify(lugares) !== JSON.stringify(disposicion)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setListo(false)
    if (NIVELES.some((n) => !(numeros[n.clave] > 0 && numeros[n.clave] <= 720))) {
      return setError('Las horas tienen que estar entre 0 y 720')
    }
    if (!(
      numeros.nivel_5_horas < numeros.nivel_3_horas && numeros.nivel_3_horas < numeros.nivel_2_horas
    )) {
      return setError('Las horas tienen que ir de menor a mayor: crítica < alta < media')
    }
    if (new Set(Object.values(lugares)).size !== 4) {
      return setError('Cada cuadrante tiene que aparecer una sola vez')
    }
    try {
      if (cambioUmbrales) await guardar.mutateAsync({ clave: 'umbrales_urgencia', valor: numeros })
      if (cambioLugares) {
        await guardar.mutateAsync({ clave: 'disposicion_cuadrantes', valor: lugares })
      }
      setListo(true)
    } catch (err) {
      setError(mensaje(err))
    }
  }

  return (
    <section className="co-seccion" aria-labelledby="co-titulo-urgencia">
      <h3 id="co-titulo-urgencia" className="co-subtitulo">
        Urgencia y cuadrantes
      </h3>
      <p className="co-texto-suave">
        Urgencia automática según cuánto falta para la entrega. "Vence hoy" (nivel 4) es el mismo
        día; con más tiempo que "Media", es baja.
      </p>
      <form id={idForm} className="co-formulario" onSubmit={enviar} noValidate>
        <div className="co-fila co-fila--campos">
          {NIVELES.map((n) => (
            <Campo key={n.clave} etiqueta={`${n.texto} (horas)`}>
              {({ id }) => (
                <input
                  id={id}
                  className="co-entrada"
                  inputMode="decimal"
                  title={n.ayuda}
                  value={horas[n.clave]}
                  onChange={(e) => setHoras((h) => ({ ...h, [n.clave]: e.target.value }))}
                />
              )}
            </Campo>
          ))}
        </div>
        <div className="co-fila co-fila--campos co-fila--dos">
          {LUGARES.map((l) => (
            <Campo key={l.clave} etiqueta={l.texto}>
              {({ id }) => (
                <select
                  id={id}
                  className="co-entrada co-entrada--select"
                  value={lugares[l.clave]}
                  onChange={(e) =>
                    setLugares((x) => ({ ...x, [l.clave]: e.target.value as Cuadrante }))
                  }
                >
                  {(Object.keys(NOMBRES_CUADRANTE) as Cuadrante[]).map((c) => (
                    <option key={c} value={c}>
                      {NOMBRES_CUADRANTE[c]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          ))}
        </div>
        <AvisoError error={error} />
        {listo && !cambioUmbrales && !cambioLugares && (
          <p className="co-texto-suave" role="status">
            Guardado.
          </p>
        )}
        <button
          type="submit"
          className="co-boton co-alinear-inicio"
          disabled={!conectado || (!cambioUmbrales && !cambioLugares) || guardar.isPending}
        >
          Guardar urgencia y cuadrantes
        </button>
      </form>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Días que las tareas quedan en la papelera.
// ---------------------------------------------------------------------------
export function DiasPapelera() {
  const dias = useMatriz().data?.config.papeleraDias ?? 30
  const guardar = useGuardarConfiguracion()
  const conectado = useConectado()
  const [texto, setTexto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const valor = texto ?? String(dias)
  const n = Number(valor)
  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!Number.isInteger(n) || n < 1 || n > 365) return setError('De 1 a 365 días')
    setError(null)
    guardar
      .mutateAsync({ clave: 'papelera_dias', valor: n })
      .then(() => setTexto(null))
      .catch((err: unknown) => setError(mensaje(err)))
  }
  return (
    <form className="co-fila co-fila--fin" onSubmit={enviar} noValidate>
      <Campo etiqueta="Días en la papelera">
        {({ id }) => (
          <input
            id={id}
            className="co-entrada co-entrada--corta"
            inputMode="numeric"
            value={valor}
            onChange={(e) => setTexto(e.target.value)}
          />
        )}
      </Campo>
      <button
        type="submit"
        className="co-boton-sutil"
        disabled={!conectado || n === dias || guardar.isPending}
      >
        Guardar
      </button>
      <AvisoError error={error} />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Respaldo: descarga todo en un archivo JSON (sin los PIN).
// ---------------------------------------------------------------------------
export function SeccionRespaldo() {
  const conectado = useConectado()
  const qc = useQueryClient()
  const [estado, setEstado] = useState<'listo' | 'bajando' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const descargar = async () => {
    setError(null)
    setEstado('bajando')
    try {
      const datos = await qc.fetchQuery({
        queryKey: ['respaldo'],
        queryFn: () => pedir<unknown>('/respaldo'),
        staleTime: 0,
      })
      const archivo = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(archivo)
      const a = document.createElement('a')
      a.href = url
      a.download = `todocopias-respaldo-${diaLocal(new Date())}.json`
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setEstado('listo')
    } catch (e) {
      setError(mensaje(e))
      setEstado(null)
    }
  }
  return (
    <section className="co-seccion" aria-labelledby="co-titulo-respaldo">
      <h3 id="co-titulo-respaldo" className="co-subtitulo">
        Respaldo
      </h3>
      <p className="co-texto-suave">
        Descarga todo lo guardado (tareas, clientes, proyectos, personas, historial y configuración)
        en un archivo. Los PIN no se incluyen.
      </p>
      <button
        type="button"
        className="co-boton-sutil co-alinear-inicio"
        disabled={!conectado || estado === 'bajando'}
        onClick={() => void descargar()}
      >
        <Download size={14} aria-hidden />{' '}
        {estado === 'bajando' ? 'Preparando…' : 'Exportar respaldo'}
      </button>
      {estado === 'listo' && (
        <p className="co-texto-suave" role="status">
          Respaldo descargado.
        </p>
      )}
      <AvisoError error={error} />
    </section>
  )
}
