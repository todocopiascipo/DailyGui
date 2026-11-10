import { Dialogo } from './Dialogo'

/** Diálogo de confirmación. El foco arranca en "Cancelar" (lo seguro). */
export function Confirmacion({
  titulo,
  texto,
  confirmar,
  peligro = false,
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  texto?: string
  confirmar: string
  peligro?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <Dialogo
      titulo={titulo}
      variante="centro"
      sinGuardar={false}
      onCerrar={onCancelar}
      pie={
        <>
          <button type="button" className="co-boton-sutil" data-autofocus onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className={`co-boton ${peligro ? 'co-boton--peligro' : ''}`}
            onClick={onConfirmar}
          >
            {confirmar}
          </button>
        </>
      }
    >
      {texto && <p>{texto}</p>}
    </Dialogo>
  )
}
