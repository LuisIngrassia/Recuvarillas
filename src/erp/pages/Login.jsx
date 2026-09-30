/**
 * Entrada al ERP.
 *
 * No hay registro ni recuperación de contraseña a propósito: las cuentas las
 * crea quien administra el proyecto desde el panel de Supabase. Es un equipo
 * chico y conocido, y un formulario de alta abierto en internet sería una
 * puerta que nadie necesita.
 */
import { useState } from 'react'
import { signIn } from '../lib/session'
import { Button, ErrorNote, Field, Input } from '../components/ui'
import { LOGO } from '../../lib/marca'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSending(true)

    try {
      await signIn(email.trim(), password)
      // No hay que navegar: al cambiar la sesión, el contexto vuelve a
      // renderizar y `Gate` deja pasar.
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grafito-900 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-md bg-white p-6 shadow-sm"
      >
        <div>
          <img
            src={LOGO.principal.color}
            alt="Recuvarilla"
            width={LOGO.principal.width}
            height={LOGO.principal.height}
            className="h-auto w-48"
          />
          <h1 className="rotulo mt-4 text-grafito-500">Sistema de gestión</h1>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Email">
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Contraseña">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <Button type="submit" disabled={sending} className="mt-6 w-full">
          {sending ? 'Entrando…' : 'Entrar'}
        </Button>

        <p className="mt-4 text-center text-xs text-grafito-400">
          Las cuentas las crea el administrador desde Supabase.
        </p>
      </form>
    </div>
  )
}
