import { render, screen } from '@testing-library/react'
import type { Aspecto } from '../../lib/urgencia'
import { Globo } from './Globo'
import type { TareaMatriz } from './tipos'

const ahora = new Date('2026-11-06T14:00:00-03:00')

const base: TareaMatriz = {
  id: 't1',
  tipo: 'pedido',
  titulo: 'Imprimir vinilo',
  importante: true,
  urgencia_manual: null,
  estado: 'pendiente',
  motivo_espera: null,
  motivo_espera_detalle: null,
  fecha_entrega: '2026-11-06T18:00:00-03:00',
  estado_anterior: null,
  terminada_at: null,
  entregada_at: null,
  saldo: 0,
  cliente: null,
  responsables: [
    { id: 'a', nombre: 'Juan', iniciales: 'J' },
    { id: 'b', nombre: 'Ana', iniciales: 'A' },
  ],
  subtareas: { total: 0, hechas: 0 },
}

function dibujar(tarea: Partial<TareaMatriz>, aspecto: Aspecto) {
  render(<Globo tarea={{ ...base, ...tarea }} aspecto={aspecto} ahora={ahora} densidad="normal" />)
  return screen.getByTestId('co-globo')
}

describe('Globo', () => {
  it('muestra título, responsables y hora de entrega', () => {
    const globo = dibujar({}, 'neutro')
    expect(globo).toHaveTextContent('Imprimir vinilo')
    expect(globo).toHaveTextContent('Juan · Ana')
    expect(globo).toHaveTextContent('Entrega 18:00')
  })

  it('día de entrega: signo de exclamación además del color', () => {
    dibujar({}, 'dia_entrega')
    expect(screen.getByLabelText('Se entrega hoy')).toHaveTextContent('!')
  })

  it('vencida: calavera y tiempo transcurrido', () => {
    const globo = dibujar({ fecha_entrega: '2026-11-06T13:20:00-03:00' }, 'vencida')
    expect(screen.getByLabelText('Vencida')).toBeInTheDocument()
    expect(globo).toHaveTextContent('Vencida hace 40 min')
  })

  it('terminada: texto "Terminada"', () => {
    expect(dibujar({ estado: 'terminada' }, 'terminada')).toHaveTextContent('Terminada')
  })

  it('en espera: pausa y motivo', () => {
    const globo = dibujar(
      { estado: 'en_espera', motivo_espera: 'archivo_cliente', fecha_entrega: null },
      'en_espera',
    )
    expect(screen.getByLabelText('En espera')).toBeInTheDocument()
    expect(globo).toHaveTextContent('En espera · Archivo del cliente')
  })

  it('progreso de subtareas', () => {
    dibujar({ subtareas: { total: 3, hechas: 2 } }, 'neutro')
    expect(screen.getByLabelText('2 de 3 pasos hechos')).toHaveTextContent('2/3')
  })

  it('tarea interna: marca de proyecto', () => {
    dibujar({ tipo: 'interna' }, 'neutro')
    expect(screen.getByLabelText('Tarea interna')).toBeInTheDocument()
  })

  it('sin responsables', () => {
    expect(dibujar({ responsables: [] }, 'neutro')).toHaveTextContent('Sin asignar')
  })
})
