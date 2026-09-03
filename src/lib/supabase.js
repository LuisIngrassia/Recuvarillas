/**
 * Cliente de Supabase para el ERP.
 *
 * Sólo lo usa el código de `src/erp`, que es donde hace falta manejar la sesión
 * y hacer consultas de verdad. La web pública no lo importa: sus dos llamadas
 * anónimas van por `lib/supabaseRest.js`, para no cargarle el SDK entero a
 * quien sólo entra a mirar precios.
 *
 * Si faltan las variables de entorno, `supabase` queda en null y el ERP muestra
 * un cartel explicando qué falta en vez de romperse. Eso permite levantar el
 * proyecto sin tener una cuenta.
 */
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './supabaseRest'

export { isSupabaseConfigured }

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // La sesión queda guardada en el navegador y se renueva sola, así que
        // el equipo no tiene que loguearse cada vez que abre el ERP.
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
