import { useState } from 'react'
import { guardarClaveManual } from '../lib/acceso'

/**
 * Sin la clave del local (app publicada). Lo normal es abrir el link de
 * acceso; en el iPad con la app instalada (que no comparte lo guardado con
 * Safari) también se puede pegar acá el link o el código.
 */
export function SinAcceso() {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState(false)
  return (
    <div role="alert" className="co-mensaje-central co-sin-acceso">
      <p>Para usar la app en este dispositivo, abrí el link de acceso del local.</p>
      <form
        className="co-proyecto-nuevo"
        onSubmit={(e) => {
          e.preventDefault()
          if (guardarClaveManual(texto)) window.location.reload()
          else setError(true)
        }}
      >
        <input
          className="co-entrada"
          aria-label="Link o código de acceso"
          placeholder="O pegá acá el link de acceso"
          autoComplete="off"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setError(false)
          }}
        />
        <button type="submit" className="co-boton">
          Entrar
        </button>
      </form>
      {error && <p className="co-texto-suave">Eso no parece el link de acceso. Probá de nuevo.</p>}
    </div>
  )
}
