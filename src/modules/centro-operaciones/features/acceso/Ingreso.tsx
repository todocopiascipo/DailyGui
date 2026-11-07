import { useState, type FormEvent } from 'react'
import { obtenerSupabase } from '../../lib/supabase'

/** Ingreso con la cuenta compartida del local. Se hace una sola vez por dispositivo. */
export function Ingreso() {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function ingresar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const { error } = await obtenerSupabase().auth.signInWithPassword({
      email: email.trim(),
      password: clave,
    })
    setEnviando(false)
    if (error) {
      setError(
        error.message.includes('Invalid login')
          ? 'El email o la contraseña no son correctos.'
          : 'No se pudo ingresar. Revisá la conexión e intentá de nuevo.',
      )
    }
  }

  return (
    <main className="co:flex co:h-full co:items-center co:justify-center co:p-4">
      <form
        onSubmit={ingresar}
        className="co-panel co:flex co:w-full co:max-w-sm co:flex-col co:gap-4"
      >
        <div>
          <h1 className="co-subtitulo">Ingresar</h1>
          <p className="co-texto-chico co:text-white/75">
            Con la cuenta del local. Se pide una sola vez en este dispositivo.
          </p>
        </div>
        <label className="co-campo">
          <span className="co-etiqueta">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="co-campo">
          <span className="co-etiqueta">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="co-texto-chico co-aviso">
            {error}
          </p>
        )}
        <button type="submit" className="co-boton" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}

/** La sesión es válida pero la cuenta no está habilitada en la base. */
export function CuentaNoHabilitada() {
  return (
    <main className="co:flex co:h-full co:items-center co:justify-center co:p-4">
      <div className="co-panel co:flex co:w-full co:max-w-sm co:flex-col co:gap-4">
        <h1 className="co-subtitulo">Cuenta no habilitada</h1>
        <p className="co-texto-chico co:text-white/80">
          Esta cuenta no tiene acceso al centro de operaciones. Ingresá con la cuenta del local.
        </p>
        <button type="button" className="co-boton" onClick={() => obtenerSupabase().auth.signOut()}>
          Cambiar de cuenta
        </button>
      </div>
    </main>
  )
}
