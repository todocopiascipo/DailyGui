import { PLANTILLA_POR_DEFECTO } from '../../lib/mensaje'
import { DISPOSICION_POR_DEFECTO } from '../../lib/urgencia'
import { leerConfigMatriz } from './datos'

describe('leerConfigMatriz', () => {
  it('sin filas usa los valores por defecto', () => {
    expect(leerConfigMatriz([])).toEqual({
      disposicion: DISPOSICION_POR_DEFECTO,
      confeti: true,
      plantilla: PLANTILLA_POR_DEFECTO,
      papeleraDias: 30,
    })
  })

  it('lee una disposición válida', () => {
    const config = leerConfigMatriz([
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
    ])
    expect(config.disposicion).toEqual(DISPOSICION_POR_DEFECTO)
  })
})
