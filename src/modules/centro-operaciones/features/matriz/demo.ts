/**
 * Datos de demostración SOLO para desarrollo y pruebas (`?demo` con `npm run dev`).
 * Cubren cada cuadrante y cada aspecto visual. No son datos del negocio:
 * las personas son genéricas y la pantalla muestra la marca "DEMO".
 */
import type { TareaMatriz } from './tipos'

const A = { id: 'demo-a', nombre: 'Persona A', iniciales: 'PA' }
const B = { id: 'demo-b', nombre: 'Persona B', iniciales: 'PB' }
const C = { id: 'demo-c', nombre: 'Persona C', iniciales: 'PC' }

export function esModoDemo(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')
}

/** Fecha a `horas` de ahora (negativo = en el pasado), en formato ISO. */
function horasDesde(ahora: Date, horas: number): string {
  return new Date(ahora.getTime() + horas * 3_600_000).toISOString()
}

export function tareasDemo(ahora: Date = new Date()): TareaMatriz[] {
  let n = 0
  const t = (datos: Partial<TareaMatriz> & Pick<TareaMatriz, 'titulo' | 'importante'>) => ({
    id: `demo-${++n}`,
    tipo: 'pedido' as const,
    urgencia_manual: null,
    estado: 'pendiente' as const,
    motivo_espera: null,
    motivo_espera_detalle: null,
    fecha_entrega: null,
    responsables: [A],
    subtareas: { total: 0, hechas: 0 },
    ...datos,
  })

  // `?demo=muchas`: suma tareas para probar la densidad y el globo "+N".
  const extra =
    new URLSearchParams(window.location.search).get('demo') === 'muchas'
      ? Array.from({ length: 30 }, (_, i) =>
          t({
            titulo: `Trabajo de prueba ${i + 1}`,
            importante: true,
            fecha_entrega: horasDesde(ahora, 3 + i),
            responsables: [i % 2 ? A : B],
          }),
        )
      : []

  return [
    ...extra,
    // HACER
    t({
      titulo: 'Vinilo vidriera',
      importante: true,
      fecha_entrega: horasDesde(ahora, -0.7),
      responsables: [A, B],
      subtareas: { total: 3, hechas: 2 },
    }),
    t({ titulo: 'Anillado 30 apuntes', importante: true, fecha_entrega: horasDesde(ahora, 1.5) }),
    t({
      titulo: 'Tarjetas personales',
      importante: true,
      estado: 'terminada',
      fecha_entrega: horasDesde(ahora, 3),
      responsables: [B],
    }),
    t({
      titulo: 'Libro de recetas encuadernado tapa dura',
      importante: true,
      estado: 'en_proceso',
      fecha_entrega: horasDesde(ahora, 20),
      responsables: [A, C],
      subtareas: { total: 4, hechas: 1 },
    }),
    t({
      titulo: 'Folletos color A5',
      importante: true,
      urgencia_manual: 4,
      fecha_entrega: horasDesde(ahora, 60),
    }),
    // PLANIFICAR
    t({
      titulo: 'Regalos empresariales fin de año',
      importante: true,
      fecha_entrega: horasDesde(ahora, 50),
      responsables: [C],
      subtareas: { total: 5, hechas: 0 },
    }),
    t({
      titulo: 'Ordenar depósito de papel',
      importante: true,
      tipo: 'interna',
      responsables: [B, C],
    }),
    t({
      titulo: 'Stickers troquelados',
      importante: true,
      estado: 'en_espera',
      motivo_espera: 'archivo_cliente',
      fecha_entrega: horasDesde(ahora, 100),
    }),
    // DELEGAR
    t({
      titulo: 'Fotocopias B/N 200 juegos',
      importante: false,
      fecha_entrega: horasDesde(ahora, 22),
      responsables: [C],
    }),
    t({
      titulo: 'Envío a domicilio',
      importante: false,
      urgencia_manual: 5,
      fecha_entrega: horasDesde(ahora, 90),
      responsables: [],
    }),
    // ELIMINAR
    t({
      titulo: 'Revisar stock de lapiceras',
      importante: false,
      tipo: 'interna',
      responsables: [B],
    }),
    t({
      titulo: 'Pedido de resmas',
      importante: false,
      estado: 'en_espera',
      motivo_espera: 'proveedor',
      fecha_entrega: horasDesde(ahora, 150),
    }),
  ]
}
