import { PLANTILLA_POR_DEFECTO } from '../../lib/mensaje'
import { DISPOSICION_POR_DEFECTO, UMBRALES_POR_DEFECTO } from '../../lib/urgencia'
import { leerConfigMatriz } from './datos'

describe('leerConfigMatriz', () => {
  it('sin filas usa los valores por defecto', () => {
    expect(leerConfigMatriz([])).toEqual({
      umbrales: UMBRALES_POR_DEFECTO,
      disposicion: DISPOSICION_POR_DEFECTO,
      confeti: true,
      plantilla: PLANTILLA_POR_DEFECTO,
      papeleraDias: 30,
    })
  })

  it('lee umbrales y disposición válidos', () => {
    const config = leerConfigMatriz([
      { clave: 'umbrales_urgencia', valor: { nivel_5_horas: 3, nivel_3_horas: 30 } },
      {
        clave: 'disposicion_cuadrantes',
        valor: {
          arriba_izquierda: 'hacer',
          arriba_derecha: 'planificar',
          abajo_izquierda: 'delegar',
          abajo_derecha: 'eliminar',
        },
      },
    ])
    expect(config.umbrales).toEqual({ nivel_5_horas: 3, nivel_3_horas: 30, nivel_2_horas: 72 })
    expect(config.disposicion.arriba_izquierda).toBe('hacer')
  })

  it('ignora una disposición con cuadrantes repetidos o desconocidos', () => {
    const config = leerConfigMatriz([
      {
        clave: 'disposicion_cuadrantes',
        valor: {
          arriba_izquierda: 'hacer',
          arriba_derecha: 'hacer',
          abajo_izquierda: 'otro',
          abajo_derecha: 'eliminar',
        },
      },
      { clave: 'umbrales_urgencia', valor: { nivel_5_horas: -1 } },
    ])
    expect(config.disposicion).toEqual(DISPOSICION_POR_DEFECTO)
    expect(config.umbrales).toEqual(UMBRALES_POR_DEFECTO)
  })
})
