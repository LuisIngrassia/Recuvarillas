/**
 * Mantiene al día la sesión del ERP y la reparte por contexto.
 *
 * Supabase guarda la sesión en el navegador y la renueva sola, así que acá
 * alcanza con escuchar los cambios. Se hace en un solo lugar para que el estado
 * de "todavía no sé si hay sesión" también sea uno solo: si cada pantalla lo
 * resolviera por su cuenta, al recargar se vería un parpadeo del login antes de
 * entrar.
 */
import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { SessionContext } from '../lib/session'

export default function SessionProvider({ children }) {
  const [session, setSession] = useState(null)
  // Sin Supabase configurado no hay nada que esperar: se muestra directo el
  // cartel que explica qué falta.
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return

    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  return <SessionContext value={{ session, loading }}>{children}</SessionContext>
}
