import { useId, useState } from 'react'
import { aFechaHora, aIso } from '../../lib/fechas'
import { esUrgente, urgenciaEstimada } from '../../lib/urgencia'
import { useMatriz } from '../matriz/datos'
import { nuevoId } from '../../lib/ids'
import { useConectado } from '../../lib/tiempoReal'
import { AvisoSinConexion } from './AvisoSinConexion'
import {
  borradorVacio,
  conUrgenciaElegida,
  cuerpoNuevaTarea,
  leerImporte,
  tareaProvisoria,
  tituloDeDetalle,
  validar,
  type Borrador,
  type Errores,
  type MedioPago,
} from './borrador'
import {
  CampoFechaHora,
  ElegirResponsables,
  ElegirUrgente,
  SiNo,
  SugerenciasCliente,
} from './controles'
import { MEDIOS_PAGO, useClientesPorTelefono } from './utilidades'
import type { AltaPedida, EstadoCreacion } from './CreacionRapida'
import { useCatalogos } from './datos'
import { Dialogo } from './Dialogo'

interface Props {
  ahora: Date
  onCerrar: () => void
  onGuardar: (alta: AltaPedida, estado: EstadoCreacion) => void
  inicial?: EstadoCreacion
  error?: string
}

/** OT nueva: la fecha de inicio es ahora (se puede cambiar). */
function otVacia(ahora: Date): Borrador {
  return { ...borradorVacio(), inicio: aFechaHora(ahora.toISOString()) }
}

/**
 * Orden de trabajo: el mismo pedido que la creación rápida, pero con la forma
 * de la OT de papel del local (fechas, detalle, seña y debe con su medio de
 * pago, celular y nombre). La primera línea del detalle es el título.
 */
export function OrdenDeTrabajo({ ahora, onCerrar, onGuardar, inicial, error }: Props) {
  const idForm = useId()
  const catalogos = useCatalogos()
  const conectado = useConectado()
  const [vacia] = useState(() => otVacia(ahora))
  const [b, setB] = useState<Borrador>(() => inicial?.b ?? vacia)
  const [errores, setErrores] = useState<Errores>({})
  const encontrados = useClientesPorTelefono(b.cliente)
  const personas = catalogos.data?.personas ?? []

  const cambiar = <K extends keyof Borrador>(k: K, v: Borrador[K]) => {
    setB((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k === 'descripcion' ? 'titulo' : k]: undefined }))
  }
  const cliente = (c: Partial<Borrador['cliente']>) => cambiar('cliente', { ...b.cliente, ...c })
  const total = (leerImporte(b.sena) ?? 0) + (leerImporte(b.saldo) ?? 0)
  const umbrales = useMatriz().data?.config.umbrales
  const entregaIso = aIso(b.entrega)
  const urgenteSegunFecha = esUrgente(
    urgenciaEstimada(entregaIso ? new Date(entregaIso) : null, ahora, umbrales),
  )

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!conectado) return
    const completo: Borrador = conUrgenciaElegida(
      { ...b, tipo: 'pedido', titulo: tituloDeDetalle(b.descripcion) },
      ahora,
      umbrales,
    )
    const err = validar(completo)
    setErrores(err)
    if (Object.keys(err).length > 0) return
    const id = nuevoId()
    onGuardar(
      {
        cuerpo: cuerpoNuevaTarea(completo, [], id),
        provisoria: tareaProvisoria(id, completo, [], personas),
      },
      { b: completo, subtareas: [], formulario: 'ot' },
    )
  }

  return (
    <Dialogo
      titulo="Orden de trabajo"
      tituloOculto
      variante="centro"
      sinGuardar={JSON.stringify(b) !== JSON.stringify(vacia)}
      onCerrar={onCerrar}
      pie={
        <>
          {error && conectado && (
            <p className="co-aviso" role="alert">
              No se pudo guardar: {error}
            </p>
          )}
          <button type="submit" form={idForm} className="co-boton" disabled={!conectado}>
            Crear OT
          </button>
        </>
      }
    >
      <AvisoSinConexion />
      <form id={idForm} className="co-ot" onSubmit={guardar} noValidate>
        <p className="co-ot__titulo" aria-hidden>
          Orden de trabajo
        </p>

        <div className="co-ot__campo">
          <label className="co-ot__etiqueta" htmlFor={`${idForm}-detalle`}>
            Detalle
          </label>
          <textarea
            id={`${idForm}-detalle`}
            data-autofocus
            className="co-ot__detalle"
            rows={5}
            maxLength={2000}
            aria-describedby={`${idForm}-detalle-ayuda`}
            aria-invalid={Boolean(errores.titulo)}
            value={b.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
          />
          <p
            id={`${idForm}-detalle-ayuda`}
            className={errores.titulo ? 'co-ot__error' : 'co-ot__ayuda'}
          >
            {errores.titulo
              ? 'Escribí el detalle del trabajo'
              : 'La primera línea es el título en la matriz.'}
          </p>
        </div>

        <div className="co-ot__cajas">
          <CajaPago
            etiqueta="Seña"
            valor={b.sena}
            medio={b.sena_medio}
            error={errores.sena}
            onCambiar={(v) => cambiar('sena', v)}
            onCambiarMedio={(m) => cambiar('sena_medio', m)}
          />
          <CajaPago
            etiqueta="Debe"
            valor={b.saldo}
            medio={b.saldo_medio}
            error={errores.saldo}
            onCambiar={(v) => cambiar('saldo', v)}
            onCambiarMedio={(m) => cambiar('saldo_medio', m)}
          />
        </div>
        {total > 0 && (
          <p className="co-ot__ayuda">Total (seña + debe): $ {total.toLocaleString('es-AR')}</p>
        )}

        <div className="co-ot__campo co-ot__campo--linea">
          <label className="co-ot__etiqueta" htmlFor={`${idForm}-celular`}>
            Celular
          </label>
          <input
            id={`${idForm}-celular`}
            className="co-ot__linea"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={30}
            value={b.cliente.telefono}
            // Otro teléfono es otro cliente: se desvincula.
            onChange={(e) => cliente({ id: null, telefono: e.target.value })}
          />
        </div>
        <SugerenciasCliente encontrados={encontrados} onUsar={(c) => cambiar('cliente', c)} />
        <div className="co-ot__campo co-ot__campo--linea">
          <label className="co-ot__etiqueta" htmlFor={`${idForm}-nombre`}>
            Nombre
          </label>
          <input
            id={`${idForm}-nombre`}
            className="co-ot__linea"
            autoComplete="off"
            maxLength={120}
            aria-invalid={Boolean(errores.cliente)}
            value={b.cliente.nombre_apellido}
            onChange={(e) => cliente({ nombre_apellido: e.target.value })}
          />
        </div>
        {errores.cliente && <p className="co-ot__error">{errores.cliente}</p>}

        {/* Las fechas, al final (como pidió el local). */}
        <CampoFechaHora
          etiqueta="Fecha inicio"
          valor={b.inicio}
          onCambiar={(v) => cambiar('inicio', v)}
          ahora={ahora}
          error={errores.inicio}
        />
        <CampoFechaHora
          etiqueta="Fecha límite"
          valor={b.entrega}
          onCambiar={(v) => cambiar('entrega', v)}
          ahora={ahora}
          error={errores.entrega}
        />

        {/* Lo que la matriz necesita y la OT de papel no tiene. */}
        <div className="co-ot__matriz">
          <ElegirResponsables
            personas={personas}
            elegidas={b.responsables}
            onCambiar={(v) => cambiar('responsables', v)}
          />
          <div className="co-fila co-fila--campos">
            <SiNo
              valor={b.importante}
              onCambiar={(v) => cambiar('importante', v)}
              error={errores.importante}
            />
            <ElegirUrgente
              valor={b.urgente}
              onCambiar={(v) => cambiar('urgente', v)}
              urgenteSegunFecha={urgenteSegunFecha}
            />
          </div>
        </div>
      </form>
    </Dialogo>
  )
}

/** Recuadro de la OT: importe y, abajo, POSNET · EFECTIVO · TRANSFERENCIA. */
function CajaPago({
  etiqueta,
  valor,
  medio,
  error,
  onCambiar,
  onCambiarMedio,
}: {
  etiqueta: string
  valor: string
  medio: MedioPago | null
  error?: string
  onCambiar: (v: string) => void
  onCambiarMedio: (m: MedioPago | null) => void
}) {
  const id = useId()
  return (
    <div className="co-ot__caja">
      <label className="co-ot__etiqueta co-ot__etiqueta--centro" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="co-ot__recuadro">
        <span aria-hidden>$</span>
        <input
          id={id}
          className="co-ot__importe"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-invalid={Boolean(error)}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
        />
      </div>
      <div className="co-ot__medios" role="group" aria-label={`Medio de pago: ${etiqueta}`}>
        {MEDIOS_PAGO.map((m) => (
          <button
            key={m.valor}
            type="button"
            className="co-ot__medio"
            aria-pressed={medio === m.valor}
            onClick={() => onCambiarMedio(medio === m.valor ? null : m.valor)}
          >
            {m.texto}
          </button>
        ))}
      </div>
      {error && <p className="co-ot__error">{error}</p>}
    </div>
  )
}
