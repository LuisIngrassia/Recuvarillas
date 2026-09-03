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
    <div className="flex min-h-screen items-center justify-center bg-steel-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-steel-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-auto" />
          <div>
            <h1 className="text-lg font-bold leading-tight text-steel-800">Recuvarilla</h1>
            <p className="text-xs text-steel-400">Sistema de gestión</p>
          </div>
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

        <p className="mt-4 text-center text-xs text-steel-400">
          Las cuentas las crea el administrador desde Supabase.
        </p>
      </form>
    </div>
  )
}
