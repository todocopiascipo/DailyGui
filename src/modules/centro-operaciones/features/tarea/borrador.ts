/**
 * Estado de los formularios de tarea (creación rápida y detalle) y su
 * conversión a lo que espera la API. Funciones puras, con pruebas.
 */
import type { Enums } from '../../lib/database.types'
import { aFechaHora, aIso, SIN_FECHA, type FechaHora } from '../../lib/fechas'
import type { PersonaBreve, TareaMatriz } from '../matriz/tipos'
import type { DetalleTarea } from './tipos'
import { urgenciaElegida, type Umbrales } from '../../lib/urgencia'

export interface BorradorCliente {
  /** Cliente existente vinculado (null = nuevo). */
  id: string | null
  nombre_apellido: string
  telefono: string
}

export type MedioPago = Enums<'medio_pago'>

export interface Borrador {
  titulo: string
  tipo: Enums<'tipo_tarea'>
  responsables: string[]
  entrega: FechaHora
  inicio: FechaHora
  importante: boolean | null
  /** Al crear: urgente sí / no, o null = según la fecha de entrega. */
  urgente: boolean | null
  urgencia_manual: number | null
  estado: Enums<'estado_tarea'>
  motivo_espera: Enums<'motivo_espera'> | null
  motivo_espera_detalle: string
  cliente: BorradorCliente
  sena: string
  saldo: string
  sena_medio: MedioPago | null
  saldo_medio: MedioPago | null
  categoria_id: string
  /** Pedido (OT) con el que se relaciona una tarea interna ('' = ninguno). */
  pedido_id: string
  descripcion: string
}

export const CLIENTE_VACIO: BorradorCliente = { id: null, nombre_apellido: '', telefono: '' }

export function borradorVacio(): Borrador {
  return {
    titulo: '',
    tipo: 'pedido',
    responsables: [],
    entrega: SIN_FECHA,
    inicio: SIN_FECHA,
    importante: null,
    urgente: null,
    urgencia_manual: null,
    estado: 'pendiente',
    motivo_espera: null,
    motivo_espera_detalle: '',
    cliente: CLIENTE_VACIO,
    sena: '',
    saldo: '',
    sena_medio: null,
    saldo_medio: null,
    categoria_id: '',
    pedido_id: '',
    descripcion: '',
  }
}

const importeATexto = (n: number) => (n === 0 ? '' : String(n))

export function borradorDe(d: DetalleTarea): Borrador {
  const t = d.tarea
  return {
    titulo: t.titulo,
    tipo: t.tipo,
    responsables: d.responsables.map((p) => p.id),
    entrega: aFechaHora(t.fecha_entrega),
    inicio: aFechaHora(t.fecha_inicio),
    importante: t.importante,
    urgente: null,
    urgencia_manual: t.urgencia_manual,
    estado: t.estado,
    motivo_espera: t.motivo_espera,
    motivo_espera_detalle: t.motivo_espera_detalle ?? '',
    cliente: d.cliente
      ? {
          id: d.cliente.id,
          nombre_apellido: d.cliente.nombre_apellido,
          telefono: d.cliente.telefono ?? '',
        }
      : CLIENTE_VACIO,
    sena: importeATexto(t.sena),
    saldo: importeATexto(t.saldo),
    sena_medio: t.sena_medio,
    saldo_medio: t.saldo_medio,
    categoria_id: t.categoria_id ?? '',
    pedido_id: t.pedido_id ?? '',
    descripcion: t.descripcion ?? '',
  }
}

export type Errores = Partial<
  Record<
    'titulo' | 'importante' | 'entrega' | 'inicio' | 'motivo' | 'cliente' | 'sena' | 'saldo',
    string
  >
>

/** Acepta "1500", "1.500", "1500,50", "1.500,50" y "1500.5". Vacío = 0. */
export function leerImporte(texto: string): number | null {
  const t = texto.trim().replace(/\s|\$/g, '')
  if (t === '') return 0
  const conMiles = /^\d{1,3}(\.\d{3})+$/.test(t)
  const normal = t.includes(',') || conMiles ? t.replace(/\./g, '').replace(',', '.') : t
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null
  return Number(normal)
}

function fechaIncompleta(f: FechaHora): string | undefined {
  if (!f.fecha && !f.hora) return undefined
  if (!f.fecha) return 'Falta el día'
  if (!f.hora) return 'Falta la hora'
  return aIso(f) ? undefined : 'Fecha inválida'
}

const tieneCliente = (c: BorradorCliente) =>
  c.nombre_apellido.trim() !== '' || c.telefono.trim() !== ''

export function validar(b: Borrador): Errores {
  const e: Errores = {}
  if (b.titulo.trim() === '') e.titulo = 'Escribí un título'
  if (b.importante === null) e.importante = 'Elegí si es importante'
  const entrega = fechaIncompleta(b.entrega)
  if (entrega) e.entrega = entrega
  const inicio = fechaIncompleta(b.inicio)
  if (inicio) e.inicio = inicio
  if (b.estado === 'en_espera' && !b.motivo_espera) e.motivo = 'Elegí el motivo de la espera'
  if (b.tipo === 'pedido' && tieneCliente(b.cliente) && b.cliente.nombre_apellido.trim() === '') {
    e.cliente = 'Falta el nombre y apellido'
  }
  if (leerImporte(b.sena) === null) e.sena = 'Importe inválido'
  if (leerImporte(b.saldo) === null) e.saldo = 'Importe inválido'
  return e
}

function clienteParaApi(b: Borrador) {
  if (b.tipo !== 'pedido' || !tieneCliente(b.cliente)) return null
  return {
    id: b.cliente.id,
    nombre_apellido: b.cliente.nombre_apellido.trim(),
    telefono: b.cliente.telefono.trim() || null,
  }
}

/** Campos de la tarea tal como los guarda la API. */
function camposTarea(b: Borrador) {
  const pedido = b.tipo === 'pedido'
  return {
    titulo: b.titulo.trim(),
    tipo: b.tipo,
    descripcion: b.descripcion.trim() || null,
    categoria_id: b.categoria_id || null,
    pedido_id: b.tipo === 'interna' ? b.pedido_id || null : null,
    sena: pedido ? (leerImporte(b.sena) ?? 0) : 0,
    saldo: pedido ? (leerImporte(b.saldo) ?? 0) : 0,
    sena_medio: pedido ? b.sena_medio : null,
    saldo_medio: pedido ? b.saldo_medio : null,
    importante: b.importante ?? false,
    urgencia_manual: b.urgencia_manual,
    estado: b.estado,
    motivo_espera: b.estado === 'en_espera' ? b.motivo_espera : null,
    motivo_espera_detalle:
      b.estado === 'en_espera' && b.motivo_espera === 'otro'
        ? b.motivo_espera_detalle.trim() || null
        : null,
    fecha_inicio: aIso(b.inicio),
    fecha_entrega: aIso(b.entrega),
  }
}

/** En la OT no hay título aparte: es la primera línea del detalle. */
export function tituloDeDetalle(detalle: string): string {
  const linea = detalle.split('\n').find((l) => l.trim() !== '') ?? ''
  return linea.trim().slice(0, 200)
}

export interface SubtareaNueva {
  titulo: string
  responsable_id: string | null
}

export function cuerpoNuevaTarea(b: Borrador, subtareas: SubtareaNueva[], id?: string) {
  return {
    tarea: { ...(id ? { id } : {}), ...camposTarea(b) },
    responsables: b.responsables,
    subtareas: subtareas.filter((s) => s.titulo.trim() !== ''),
    ...(clienteParaApi(b) ? { cliente: clienteParaApi(b) } : {}),
  }
}

/**
 * Cómo se ve la tarea en la matriz mientras el servidor la guarda
 * (actualización optimista). Usa el mismo id con el que se va a guardar.
 */
export function tareaProvisoria(
  id: string,
  b: Borrador,
  subtareas: SubtareaNueva[],
  personas: PersonaBreve[],
): TareaMatriz {
  const c = camposTarea(b)
  const conTitulo = subtareas.filter((s) => s.titulo.trim() !== '')
  const ids = new Set([
    ...b.responsables,
    ...conTitulo.flatMap((s) => (s.responsable_id ? [s.responsable_id] : [])),
  ])
  return {
    id,
    provisoria: true,
    tipo: c.tipo,
    titulo: c.titulo,
    importante: c.importante,
    urgencia_manual: c.urgencia_manual,
    estado: c.estado,
    motivo_espera: c.motivo_espera,
    motivo_espera_detalle: c.motivo_espera_detalle,
    fecha_entrega: c.fecha_entrega,
    estado_anterior: null,
    terminada_at: null,
    entregada_at: null,
    saldo: c.saldo,
    cliente: b.cliente.nombre_apellido.trim()
      ? { nombre: b.cliente.nombre_apellido.trim(), telefono: b.cliente.telefono.trim() || null }
      : null,
    responsables: personas.filter((p) => ids.has(p.id)),
    subtareas: { total: conTitulo.length, hechas: 0 },
  }
}

/** Solo lo que cambió respecto de la tarea guardada; null si no hay cambios. */
export function cuerpoEdicion(b: Borrador, original: DetalleTarea) {
  const antes = camposTarea(borradorDe(original))
  const despues = camposTarea(b)
  const cambios: Record<string, unknown> = {}
  for (const k of Object.keys(despues) as (keyof typeof despues)[]) {
    if (JSON.stringify(antes[k]) !== JSON.stringify(despues[k])) cambios[k] = despues[k]
  }
  // El servidor exige el motivo cuando se pasa a "en espera".
  if ('motivo_espera' in cambios || 'estado' in cambios) {
    cambios.estado = despues.estado
    cambios.motivo_espera = despues.motivo_espera
    cambios.motivo_espera_detalle = despues.motivo_espera_detalle
  }
  const cuerpo: Record<string, unknown> = {}
  if (Object.keys(cambios).length > 0) cuerpo.cambios = cambios

  const respAntes = original.responsables.map((p) => p.id).sort()
  const respDespues = [...b.responsables].sort()
  if (JSON.stringify(respAntes) !== JSON.stringify(respDespues))
    cuerpo.responsables = b.responsables

  const clienteAntes = clienteParaApi(borradorDe(original))
  const clienteDespues = clienteParaApi(b)
  if (JSON.stringify(clienteAntes) !== JSON.stringify(clienteDespues)) {
    cuerpo.cliente = clienteDespues
  }
  return Object.keys(cuerpo).length > 0 ? cuerpo : null
}

/** El borrador listo para guardar, con la urgencia elegida ya resuelta. */
export function conUrgenciaElegida(b: Borrador, ahora: Date, umbrales?: Umbrales): Borrador {
  if (b.urgente === null) return b
  const entrega = aIso(b.entrega)
  return {
    ...b,
    urgencia_manual: urgenciaElegida(
      b.urgente,
      entrega ? new Date(entrega) : null,
      ahora,
      umbrales,
    ),
  }
}
