/**
 * Validación de lo que llega por la API. Solo se aceptan los campos editables,
 * con su tipo y rango; la base vuelve a controlar todo con sus restricciones.
 */
import type { CambiosTarea, DatosCliente, DatosNuevaTarea, ExtrasEdicion } from './servicio.ts'
import { ErrorValidacion } from './servicio.ts'

type Objeto = Record<string, unknown>

const ESTADOS = ['pendiente', 'en_proceso', 'en_espera', 'terminada', 'entregada', 'cancelada']
const MOTIVOS = ['archivo_cliente', 'material', 'pago', 'proveedor', 'otro']
const TIPOS = ['pedido', 'interna']

function falla(mensaje: string): never {
  throw new ErrorValidacion(mensaje)
}

function objeto(v: unknown, nombre: string): Objeto {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) falla(`${nombre}: formato inválido`)
  return v as Objeto
}

function texto(v: unknown, nombre: string, max: number): string {
  if (typeof v !== 'string') falla(`${nombre}: tiene que ser texto`)
  const t = v.trim()
  if (t.length === 0) falla(`${nombre}: no puede quedar vacío`)
  if (t.length > max) falla(`${nombre}: máximo ${max} caracteres`)
  return t
}

function textoOpcional(v: unknown, nombre: string, max: number): string | null {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null
  return texto(v, nombre, max)
}

function id(v: unknown, nombre: string): string {
  if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v))
    falla(`${nombre}: identificador inválido`)
  return v
}

function idOpcional(v: unknown, nombre: string): string | null {
  return v === null || v === undefined || v === '' ? null : id(v, nombre)
}

function importe(v: unknown, nombre: string): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e9) {
    falla(`${nombre}: tiene que ser un número igual o mayor que 0`)
  }
  return Math.round(n * 100) / 100
}

function fecha(v: unknown, nombre: string): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) falla(`${nombre}: fecha inválida`)
  return new Date(v).toISOString()
}

function opcion<T extends string>(v: unknown, opciones: readonly string[], nombre: string): T {
  if (typeof v !== 'string' || !opciones.includes(v)) falla(`${nombre}: valor no permitido`)
  return v as T
}

function booleano(v: unknown, nombre: string): boolean {
  if (typeof v !== 'boolean') falla(`${nombre}: tiene que ser Sí o No`)
  return v
}

/** Campos editables de una tarea, validados. Solo incluye los que vienen. */
function camposTarea(o: Objeto): CambiosTarea {
  const c: CambiosTarea = {}
  if ('titulo' in o) c.titulo = texto(o.titulo, 'Título', 200)
  if ('descripcion' in o) c.descripcion = textoOpcional(o.descripcion, 'Descripción', 2000)
  if ('tipo' in o) c.tipo = opcion(o.tipo, TIPOS, 'Tipo')
  if ('categoria_id' in o) c.categoria_id = idOpcional(o.categoria_id, 'Categoría')
  if ('sena' in o) c.sena = importe(o.sena, 'Seña')
  if ('saldo' in o) c.saldo = importe(o.saldo, 'Saldo')
  if ('importante' in o) c.importante = booleano(o.importante, 'Importante')
  if ('urgencia_manual' in o) {
    const u = o.urgencia_manual
    if (u !== null && !(typeof u === 'number' && Number.isInteger(u) && u >= 1 && u <= 5)) {
      falla('Urgencia: tiene que ser de 1 a 5')
    }
    c.urgencia_manual = u
  }
  if ('estado' in o) c.estado = opcion(o.estado, ESTADOS, 'Estado')
  if ('motivo_espera' in o) {
    c.motivo_espera =
      o.motivo_espera === null ? null : opcion(o.motivo_espera, MOTIVOS, 'Motivo de espera')
  }
  if ('motivo_espera_detalle' in o) {
    c.motivo_espera_detalle = textoOpcional(o.motivo_espera_detalle, 'Detalle del motivo', 200)
  }
  if ('fecha_inicio' in o) c.fecha_inicio = fecha(o.fecha_inicio, 'Hora de inicio')
  if ('fecha_entrega' in o) c.fecha_entrega = fecha(o.fecha_entrega, 'Entrega')
  if ('mostrar_en_matriz' in o) c.mostrar_en_matriz = booleano(o.mostrar_en_matriz, 'Mostrar')

  // Fuera de "en espera" no hay motivo.
  if (c.estado && c.estado !== 'en_espera') {
    c.motivo_espera = null
    c.motivo_espera_detalle = null
  }
  if (c.estado === 'en_espera' && c.motivo_espera === undefined) {
    falla('Elegí el motivo de la espera')
  }
  return c
}

function responsables(v: unknown): string[] {
  if (!Array.isArray(v)) falla('Responsables: formato inválido')
  if (v.length > 20) falla('Responsables: demasiados')
  return [...new Set(v.map((r) => id(r, 'Responsable')))]
}

function cliente(v: unknown): DatosCliente | null {
  if (v === null) return null
  const o = objeto(v, 'Cliente')
  return {
    id: idOpcional(o.id, 'Cliente'),
    nombre_apellido: texto(o.nombre_apellido, 'Nombre y apellido', 120),
    telefono: textoOpcional(o.telefono, 'Teléfono', 30),
  }
}

export interface PedidoCrearTarea {
  datos: DatosNuevaTarea
  responsables: string[]
  subtareas: { titulo: string; responsable_id: string | null }[]
  cliente: DatosCliente | null
}

export function validarNuevaTarea(cuerpo: unknown): PedidoCrearTarea {
  const o = objeto(cuerpo, 'Pedido')
  const t = objeto(o.tarea, 'Tarea')
  if (!('titulo' in t)) falla('Título: no puede quedar vacío')
  if (!('importante' in t)) falla('Elegí si es importante')
  const campos = camposTarea(t)
  const subtareas = o.subtareas === undefined ? [] : o.subtareas
  if (!Array.isArray(subtareas) || subtareas.length > 50) falla('Subtareas: formato inválido')
  const c = o.cliente === undefined ? null : cliente(o.cliente)
  if (c && campos.tipo === 'interna') falla('Las tareas internas no tienen cliente')
  return {
    datos: campos as DatosNuevaTarea,
    responsables: o.responsables === undefined ? [] : responsables(o.responsables),
    subtareas: subtareas.map((s) => {
      const so = objeto(s, 'Subtarea')
      return {
        titulo: texto(so.titulo, 'Subtarea', 200),
        responsable_id: idOpcional(so.responsable_id, 'Responsable de la subtarea'),
      }
    }),
    cliente: c,
  }
}

export function validarEdicionTarea(cuerpo: unknown): {
  cambios: CambiosTarea
  extras: ExtrasEdicion
} {
  const o = objeto(cuerpo, 'Pedido')
  const cambios = camposTarea(objeto(o.cambios ?? {}, 'Cambios'))
  const extras: ExtrasEdicion = {}
  if (o.responsables !== undefined) extras.responsables = responsables(o.responsables)
  if (o.cliente !== undefined) extras.cliente = cliente(o.cliente)
  // Una tarea interna no tiene cliente.
  if (cambios.tipo === 'interna') extras.cliente = null
  return { cambios, extras }
}

export function validarNuevaSubtarea(cuerpo: unknown) {
  const o = objeto(cuerpo, 'Subtarea')
  return {
    titulo: texto(o.titulo, 'Subtarea', 200),
    responsable_id: idOpcional(o.responsable_id, 'Responsable'),
  }
}

export function validarEdicionSubtarea(cuerpo: unknown) {
  const o = objeto(cuerpo, 'Subtarea')
  const c: { titulo?: string; responsable_id?: string | null; hecha?: boolean } = {}
  if ('titulo' in o) c.titulo = texto(o.titulo, 'Subtarea', 200)
  if ('responsable_id' in o) c.responsable_id = idOpcional(o.responsable_id, 'Responsable')
  if ('hecha' in o) c.hecha = booleano(o.hecha, 'Hecha')
  return c
}

export function validarNuevaPersona(cuerpo: unknown) {
  const o = objeto(cuerpo, 'Persona')
  const iniciales = textoOpcional(o.iniciales, 'Iniciales', 4)
  return { nombre: texto(o.nombre, 'Nombre', 60), iniciales }
}
