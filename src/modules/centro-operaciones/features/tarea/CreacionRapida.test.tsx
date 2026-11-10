import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { ContextoConexion, type EstadoConexion } from '../../lib/tiempoReal'
import { borradorVacio } from './borrador'
import { CreacionRapida, type EstadoCreacion } from './CreacionRapida'

const ahora = new Date('2026-11-06T14:20:00-03:00')

function dibujar({
  conexion = 'conectado',
  inicial,
  error,
}: { conexion?: EstadoConexion; inicial?: EstadoCreacion; error?: string } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        personas: [
          { id: 'p1', nombre: 'Uno', iniciales: 'U' },
          { id: 'p2', nombre: 'Dos', iniciales: 'D' },
        ],
        categorias: [],
      }),
    ),
  )
  const onCerrar = vi.fn()
  const onGuardar = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ContextoConexion.Provider value={conexion}>
        <CreacionRapida
          ahora={ahora}
          onCerrar={onCerrar}
          onGuardar={onGuardar}
          inicial={inicial}
          error={error}
        />
      </ContextoConexion.Provider>
    </QueryClientProvider>,
  )
  return { onCerrar, onGuardar }
}

afterEach(() => vi.unstubAllGlobals())

describe('CreacionRapida', () => {
  it('arranca con el foco en el título y sin "Más datos" a la vista', () => {
    dibujar()
    expect(screen.getByLabelText('Título')).toHaveFocus()
    expect(screen.queryByLabelText('Seña')).not.toBeInTheDocument()
  })

  it('no guarda sin título ni importancia', () => {
    const { onGuardar } = dibujar()
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
    expect(screen.getByText('Escribí un título')).toBeInTheDocument()
    expect(screen.getByText('Elegí si es importante')).toBeInTheDocument()
    expect(onGuardar).not.toHaveBeenCalled()
  })

  it('entrega el alta con su versión provisoria para la matriz', async () => {
    const { onGuardar } = dibujar()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Vinilo vidriera' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Dos' }))
    fireEvent.click(screen.getByRole('button', { name: '+2 h' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Sí' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))

    expect(onGuardar).toHaveBeenCalledTimes(1)
    const [alta, estado] = onGuardar.mock.calls[0]!
    expect(alta.cuerpo).toMatchObject({
      tarea: {
        titulo: 'Vinilo vidriera',
        importante: true,
        // 14:20 + 2 h → 16:30 en Buenos Aires.
        fecha_entrega: '2026-11-06T19:30:00.000Z',
      },
      responsables: ['p2'],
      subtareas: [],
    })
    // La provisoria usa el mismo id con el que se guarda.
    expect(alta.provisoria).toMatchObject({
      id: alta.cuerpo.tarea.id,
      provisoria: true,
      titulo: 'Vinilo vidriera',
      responsables: [{ id: 'p2', nombre: 'Dos', iniciales: 'D' }],
    })
    expect(estado.b.titulo).toBe('Vinilo vidriera')
  })

  it('tras un rechazo reabre con lo cargado y el motivo', () => {
    dibujar({
      inicial: { b: { ...borradorVacio(), titulo: 'Folletos', importante: false }, subtareas: [] },
      error: 'Datos inválidos',
    })
    expect(screen.getByLabelText('Título')).toHaveValue('Folletos')
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar: Datos inválidos')
  })

  it('sin conexión se puede cargar pero no guardar', () => {
    const { onGuardar } = dibujar({ conexion: 'sin_conexion' })
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión')
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Vinilo' } })
    expect(screen.getByRole('button', { name: 'Crear tarea' })).toBeDisabled()
    expect(onGuardar).not.toHaveBeenCalled()
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
