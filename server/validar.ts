/**
 * Validación de lo que llega por la API. Solo se aceptan los campos editables,
 * con su tipo y rango; la base vuelve a controlar todo con sus restricciones.
 */
import type { Tarea } from './reglas.ts'
import type {
  CambiosTarea,
  DatosCliente,
  DatosNuevaTarea,
  DatosProyecto,
  ExtrasEdicion,
} from './servicio.ts'
import { ErrorNoEncontrado, ErrorValidacion } from './servicio.ts'

type Objeto = Record<string, unknown>

const ESTADOS = ['pendiente', 'en_proceso', 'en_espera', 'terminada', 'entregada', 'cancelada']
const MOTIVOS = ['archivo_cliente', 'material', 'pago', 'proveedor', 'otro']
const TIPOS = ['pedido', 'interna']
const MEDIOS = ['posnet', 'efectivo', 'transferencia']

function medio(v: unknown, nombre: string): Tarea['sena_medio'] {
  return v === null || v === undefined || v === '' ? null : opcion(v, MEDIOS, nombre)
}

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
  if ('pedido_id' in o) c.pedido_id = idOpcional(o.pedido_id, 'Pedido relacionado')
  if ('proyecto_id' in o) c.proyecto_id = idOpcional(o.proyecto_id, 'Proyecto')
  if ('sena' in o) c.sena = importe(o.sena, 'Seña')
  if ('saldo' in o) c.saldo = importe(o.saldo, 'Saldo')
  if ('sena_medio' in o) c.sena_medio = medio(o.sena_medio, 'Medio de pago de la seña')
  if ('saldo_medio' in o) c.saldo_medio = medio(o.saldo_medio, 'Medio de pago del saldo')
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
    datos: { ...(campos as DatosNuevaTarea), ...('id' in t ? { id: id(t.id, 'Tarea') } : {}) },
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
  // Un pedido no tiene "pedido relacionado" (eso es de las internas).
  if (cambios.tipo === 'pedido') {
    cambios.pedido_id = null
    cambios.proyecto_id = null
  }
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

/** Claves de configuración que se pueden cambiar desde la app, con su validación. */
export function validarConfiguracion(clave: string, cuerpo: unknown): unknown {
  const o = objeto(cuerpo, 'Configuración')
  if (clave === 'confeti_activado') return booleano(o.valor, 'Confeti')
  if (clave === 'plantilla_mensaje') return texto(o.valor, 'Plantilla del mensaje', 500)
  if (clave === 'papelera_dias') {
    const n = o.valor
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 365) {
      falla('Días en la papelera: de 1 a 365')
    }
    return n
  }
  if (clave === 'umbrales_urgencia') {
    const u = objeto(o.valor, 'Umbrales')
    const horas = (k: string, nombre: string) => {
      const n = u[k]
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 720) {
        falla(`${nombre}: entre 0 y 720 horas`)
      }
      return Math.round(n * 100) / 100
    }
    const v = {
      nivel_5_horas: horas('nivel_5_horas', 'Crítica'),
      nivel_3_horas: horas('nivel_3_horas', 'Alta'),
      nivel_2_horas: horas('nivel_2_horas', 'Media'),
    }
    if (!(v.nivel_5_horas < v.nivel_3_horas && v.nivel_3_horas < v.nivel_2_horas)) {
      falla('Las horas tienen que ir de menor a mayor: crítica < alta < media')
    }
    return v
  }
  if (clave === 'disposicion_cuadrantes') {
    const d = objeto(o.valor, 'Disposición')
    const lugares = ['arriba_izquierda', 'arriba_derecha', 'abajo_izquierda', 'abajo_derecha']
    const cuadrantes = ['hacer', 'planificar', 'delegar', 'eliminar']
    const v = Object.fromEntries(lugares.map((l) => [l, d[l]]))
    const valores = Object.values(v)
    if (
      !valores.every((x) => typeof x === 'string' && cuadrantes.includes(x)) ||
      new Set(valores).size !== 4
    ) {
      falla('Disposición: cada cuadrante tiene que aparecer una vez')
    }
    return v
  }
  throw new ErrorNoEncontrado('Esa configuración no se puede cambiar')
}

/** PIN: de 4 a 8 números. */
function pin(v: unknown, nombre: string): string {
  if (typeof v !== 'string' || !/^\d{4,8}$/.test(v)) falla(`${nombre}: de 4 a 8 números`)
  return v
}

export function validarVerificarPin(cuerpo: unknown): string {
  const o = objeto(cuerpo, 'PIN')
  // Cualquier texto vale para comparar; el formato se exige al guardarlo.
  return typeof o.pin === 'string' ? o.pin.slice(0, 16) : ''
}

export function validarCambioPin(cuerpo: unknown) {
  const o = objeto(cuerpo, 'PIN')
  return {
    pin_actual: typeof o.pin_actual === 'string' ? o.pin_actual.slice(0, 16) : null,
    pin_nuevo: o.pin_nuevo === null ? null : pin(o.pin_nuevo, 'PIN'),
  }
}

const ESTADOS_PROYECTO = ['activo', 'en_pausa', 'terminado', 'cancelado']

/** Campos de un proyecto (alta: `nuevo`, exige nombre). Solo incluye los que vienen. */
export function validarProyecto(cuerpo: unknown, nuevo: boolean): DatosProyecto & { id?: string } {
  const o = objeto(cuerpo, 'Proyecto')
  const c: DatosProyecto & { id?: string } = {}
  if (nuevo && !('nombre' in o)) falla('Nombre del proyecto: no puede quedar vacío')
  if (nuevo && 'id' in o) c.id = id(o.id, 'Proyecto')
  if ('nombre' in o) c.nombre = texto(o.nombre, 'Nombre del proyecto', 120)
  if ('descripcion' in o) c.descripcion = textoOpcional(o.descripcion, 'Descripción', 2000)
  if ('estado' in o) c.estado = opcion(o.estado, ESTADOS_PROYECTO, 'Estado')
  if ('fecha_inicio' in o) c.fecha_inicio = fecha(o.fecha_inicio, 'Inicio')
  if ('fecha_objetivo' in o) c.fecha_objetivo = fecha(o.fecha_objetivo, 'Fecha objetivo')
  if ('responsable_id' in o) c.responsable_id = idOpcional(o.responsable_id, 'Responsable')
  if ('categoria_id' in o) c.categoria_id = idOpcional(o.categoria_id, 'Categoría')
  return c
}

/** Orden de las tareas de un proyecto: { tareas: [ids] }. */
export function validarOrdenProyecto(cuerpo: unknown): string[] {
  const o = objeto(cuerpo, 'Orden')
  if (!Array.isArray(o.tareas) || o.tareas.length > 500) falla('Orden: formato inválido')
  return o.tareas.map((t) => id(t, 'Tarea'))
}
