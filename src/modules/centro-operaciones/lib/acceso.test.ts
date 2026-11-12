describe('acceso por link secreto', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/DailyGui/')
  })

  it('toma la clave del link, la recuerda y la saca de la barra de direcciones', async () => {
    window.history.replaceState(null, '', '/DailyGui/#acceso=clave-de-prueba-larga-123')
    const { claveDeAcceso } = await import('./acceso')
    expect(claveDeAcceso()).toBe('clave-de-prueba-larga-123')
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/DailyGui/')
    expect(window.localStorage.getItem('co-acceso')).toBe('clave-de-prueba-larga-123')
  })

  it('después se usa la guardada (sin volver a abrir el link)', async () => {
    window.localStorage.setItem('co-acceso', 'guardada-de-antes-0000000')
    const { claveDeAcceso } = await import('./acceso')
    expect(claveDeAcceso()).toBe('guardada-de-antes-0000000')
  })

  it('sin link ni clave guardada, no hay acceso', async () => {
    const { claveDeAcceso } = await import('./acceso')
    expect(claveDeAcceso()).toBeNull()
  })
})
