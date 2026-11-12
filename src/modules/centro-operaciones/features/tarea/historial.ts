import { formatInTimeZone } from 'date-fns-tz'
import { esMismoDia, ZONA_HORARIA } from '../../lib/tiempo'
import type { EventoDetalle } from './tipos'

export const NOMBRES_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  en_espera: 'En espera',
  terminada: 'Terminada',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
}

export const NOMBRES_MOTIVO: Record<string, string> = {
  archivo_cliente: 'Archivo del cliente',
  material: 'Material',
  pago: 'Pago',
  proveedor: 'Proveedor',
  otro: 'Otro',
}

const CAMPOS: Record<string, string> = {
  titulo: 'título',
  descripcion: 'descripción',
  tipo: 'tipo',
  categoria_id: 'categoría',
  cliente_id: 'cliente',
  sena: 'seña',
  saldo: 'saldo',
  importante: 'importancia',
  urgencia_manual: 'urgencia',
  motivo_espera: 'motivo de espera',
  motivo_espera_detalle: 'motivo de espera',
  fecha_inicio: 'hora de inicio',
  fecha_entrega: 'entrega',
  mostrar_en_matriz: 'visibilidad en la matriz',
  proyecto_id: 'proyecto',
  pedido_id: 'pedido relacionado',
  nombre: 'nombre',
  fecha_objetivo: 'fecha objetivo',
  responsable_id: 'responsable',
}

const NOMBRES_ESTADO_PROYECTO: Record<string, string> = {
  activo: 'Activo',
  en_pausa: 'En pausa',
  terminado: 'Terminado',
  cancelado: 'Cancelado',
}

function lista(v: unknown): string {
  return Array.isArray(v) && v.length > 0 ? v.join(', ') : 'nadie'
}

function cambio(e: EventoDetalle, campo: string): { antes: unknown; despues: unknown } | null {
  const c = e.cambios[campo]
  return typeof c === 'object' && c !== null && 'despues' in c
    ? (c as { antes: unknown; despues: unknown })
    : null
}

/** Frase corta que describe el evento ("Cambió el estado: Pendiente → En proceso"). */
export function describirEvento(e: EventoDetalle): string {
  const sub = typeof e.cambios.subtarea === 'string' ? `“${e.cambios.subtarea}”` : ''
  switch (e.accion) {
    case 'creada':
      return 'Creó la tarea'
    case 'estado': {
      const c = cambio(e, 'estado')
      return c
        ? `Cambió el estado: ${NOMBRES_ESTADO[String(c.antes)] ?? '—'} → ${NOMBRES_ESTADO[String(c.despues)] ?? '—'}`
        : 'Cambió el estado'
    }
    case 'devuelta':
      return 'Devolvió la tarea al estado anterior'
    case 'movida_cuadrante':
      return 'Movió la tarea de cuadrante'
    case 'eliminada':
      return 'Eliminó la tarea'
    case 'restaurada':
      return 'Restauró la tarea'
    case 'reasignada': {
      const c = cambio(e, 'responsables')
      return c ? `Responsables: ${lista(c.antes)} → ${lista(c.despues)}` : 'Cambió los responsables'
    }
    case 'subtarea_creada':
      return `Agregó la subtarea ${sub}`
    case 'subtarea_hecha':
      return `Marcó como hecha ${sub}`
    case 'subtarea_deshecha':
      return `Desmarcó ${sub}`
    case 'subtarea_editada': {
      const titulo = cambio(e, 'subtarea')
      if (titulo)
        return `Renombró la subtarea “${String(titulo.antes)}” → “${String(titulo.despues)}”`
      const r = cambio(e, 'responsable')
      const nombre = typeof e.cambios.nombre === 'string' ? `“${e.cambios.nombre}”` : 'una subtarea'
      if (r)
        return r.despues ? `Asignó ${nombre} a ${String(r.despues)}` : `Dejó sin asignar ${nombre}`
      return 'Editó una subtarea'
    }
    case 'subtarea_eliminada':
      return `Quitó la subtarea ${sub}`
    case 'editada': {
      const campos = [
        ...new Set(
          // `titulo` suelto es solo referencia; los cambios traen { antes, despues }.
          Object.keys(e.cambios)
            .filter((k) => cambio(e, k))
            .map((k) => CAMPOS[k])
            .filter(Boolean),
        ),
      ]
      return campos.length > 0 ? `Editó ${campos.join(', ')}` : 'Editó la tarea'
    }
    case 'proyecto_creado':
      return 'Creó el proyecto'
    case 'proyecto_estado': {
      const c = cambio(e, 'estado')
      return c
        ? `Estado del proyecto: ${NOMBRES_ESTADO_PROYECTO[String(c.antes)] ?? '—'} → ${NOMBRES_ESTADO_PROYECTO[String(c.despues)] ?? '—'}`
        : 'Cambió el estado del proyecto'
    }
    case 'proyecto_editado': {
      const campos = Object.keys(e.cambios)
        .filter((k) => cambio(e, k))
        .map((k) => CAMPOS[k] ?? k)
      return campos.length > 0 ? `Editó el proyecto: ${campos.join(', ')}` : 'Editó el proyecto'
    }
    case 'proyecto_eliminado':
      return 'Borró el proyecto'
    default:
      return 'Modificó la tarea'
  }
}

/** "14:05" si es de hoy; "06/11 14:05" si no. */
export function momentoEvento(iso: string, ahora: Date): string {
  const d = new Date(iso)
  return formatInTimeZone(d, ZONA_HORARIA, esMismoDia(d, ahora) ? 'HH:mm' : 'dd/MM HH:mm')
}
