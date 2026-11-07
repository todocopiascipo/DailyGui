import { render, screen } from '@testing-library/react'
import { Raiz } from './Raiz'

describe('Raiz', () => {
  it('monta el contenedor del módulo con su clase acotada', () => {
    render(<Raiz />)
    const raiz = screen.getByTestId('co-raiz')
    expect(raiz).toHaveClass('co-app')
    expect(raiz).toHaveClass('co-fondo')
  })
})
