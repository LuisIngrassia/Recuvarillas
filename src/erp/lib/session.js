/**
 * La sesión del ERP: el contexto y las dos operaciones de cuenta.
 *
 * El componente que la mantiene al día está aparte, en
 * `components/SessionProvider.jsx`. Separarlos no es capricho: un archivo que
 * exporta un componente y además funciones sueltas rompe el refresco en
 * caliente durante el desarrollo, porque Vite no puede decidir si al cambiarlo
 * tiene que rehacer la pantalla o recargar todo.
 */
import { createContext, useContext } from 'react'
import { supabase } from '../../lib/supabase'

export const SessionContext = createContext({ session: null, loading: false })

export function useSession() {
  return useContext(SessionContext)
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // El mensaje de Supabase viene en inglés y es el mismo para usuario
    // inexistente y contraseña equivocada, a propósito: decir cuál de las dos
    // falló le confirmaría a un extraño qué correos tienen cuenta.
    throw new Error(
      error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos.'
        : error.message,
    )
  }
}

export async function signOut() {
  await supabase?.auth.signOut()
}
