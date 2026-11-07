import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreacionRapida } from './CreacionRapida'

const ahora = new Date('2026-11-06T14:20:00-03:00')

function dibujar() {
  const pedidos: { metodo: string; ruta: string; cuerpo: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET'
      pedidos.push({ metodo, ruta: url, cuerpo: init?.body ? JSON.parse(String(init.body)) : null })
      const cuerpo =
        url === '/api/catalogos'
          ? {
              personas: [
                { id: 'p1', nombre: 'Uno', iniciales: 'U' },
                { id: 'p2', nombre: 'Dos', iniciales: 'D' },
              ],
              categorias: [],
            }
          : { tarea: { id: 'nueva' }, responsables: [], subtareas: [], eventos: [] }
      return new Response(JSON.stringify(cuerpo), { status: metodo === 'POST' ? 201 : 200 })
    }),
  )
  const onCerrar = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreacionRapida ahora={ahora} onCerrar={onCerrar} />
    </QueryClientProvider>,
  )
  return { pedidos, onCerrar }
}

afterEach(() => vi.unstubAllGlobals())

describe('CreacionRapida', () => {
  it('arranca con el foco en el título y sin "Más datos" a la vista', () => {
    dibujar()
    expect(screen.getByLabelText('Título')).toHaveFocus()
    expect(screen.queryByLabelText('Seña')).not.toBeInTheDocument()
  })

  it('no guarda sin título ni importancia', () => {
    const { pedidos } = dibujar()
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
    expect(screen.getByText('Escribí un título')).toBeInTheDocument()
    expect(screen.getByText('Elegí si es importante')).toBeInTheDocument()
    expect(pedidos.filter((p) => p.metodo === 'POST')).toHaveLength(0)
  })

  it('crea la tarea con título, responsables, entrega e importancia', async () => {
    const { pedidos, onCerrar } = dibujar()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Vinilo vidriera' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Dos' }))
    fireEvent.click(screen.getByRole('button', { name: '+2 h' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Sí' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))

    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    const alta = pedidos.find((p) => p.metodo === 'POST')
    expect(alta?.ruta).toBe('/api/tareas')
    expect(alta?.cuerpo).toMatchObject({
      tarea: {
        titulo: 'Vinilo vidriera',
        importante: true,
        // 14:20 + 2 h → 16:30 en Buenos Aires.
        fecha_entrega: '2026-11-06T19:30:00.000Z',
      },
      responsables: ['p2'],
      subtareas: [],
    })
  })

  it('"Más datos" muestra cliente, seña, saldo y subtareas', () => {
    dibujar()
    fireEvent.click(screen.getByRole('button', { name: 'Más datos' }))
    expect(screen.getByLabelText('Cliente (nombre y apellido)')).toBeInTheDocument()
    expect(screen.getByLabelText('Seña')).toBeInTheDocument()
    expect(screen.getByLabelText('Saldo (lo que deben)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Tarea interna' }))
    expect(screen.queryByLabelText('Seña')).not.toBeInTheDocument()
  })
})
