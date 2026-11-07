import { repartir } from './densidad'

describe('repartir', () => {
  it('con lugar de sobra usa el tamaño normal', () => {
    const r = repartir(3, 900, 400)
    expect(r.nivel.densidad).toBe('normal')
    expect(r.visibles).toBe(3)
    expect(r.ocultos).toBe(0)
  })

  it('achica los globos antes de esconder tareas', () => {
    // 900 px de ancho: 4 columnas normales; 230 px de alto: 2 filas normales (8), 2 compactas (10)...
    const r = repartir(9, 900, 230)
    expect(r.nivel.densidad).not.toBe('normal')
    expect(r.ocultos).toBe(0)
  })

  it('si no entra ni con el más chico, reserva un lugar para "+N"', () => {
    const r = repartir(40, 600, 200)
    expect(r.nivel.densidad).toBe('mini')
    expect(r.visibles + r.ocultos).toBe(40)
    expect(r.ocultos).toBeGreaterThan(0)
    // visibles + el globo "+N" ocupan exactamente la capacidad
    const filas = Math.floor((200 + 8) / (72 + 8))
    expect(r.visibles + 1).toBe(r.columnas * filas)
  })

  it('sin lugar para nada, todo queda como "+N"', () => {
    const r = repartir(5, 300, 20)
    expect(r.visibles).toBe(0)
    expect(r.ocultos).toBe(5)
  })

  it('cero tareas', () => {
    expect(repartir(0, 500, 300).visibles).toBe(0)
  })
})
