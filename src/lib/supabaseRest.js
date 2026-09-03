/**
 * Las dos únicas cosas que la web pública le pide a Supabase: leer la lista de
 * precios y dejar un lead.
 *
 * Van por `fetch` contra la API REST y no con `@supabase/supabase-js` a
 * propósito. El SDK son ~40 KB comprimidos que la landing tendría que
 * descargar en la primera visita para hacer dos llamadas anónimas sin sesión
 * ni tiempo real; del otro lado hay un endpoint HTTP común y corriente. El SDK
 * sí se usa en el ERP, donde hace falta de verdad para manejar la sesión.
 *
 * La clave `anon` viaja en el bundle: es pública por diseño. Lo que cuida los
 * datos son las políticas de `supabase/schema.sql`, que sin sesión sólo
 * permiten estas dos operaciones.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

function headers(extra) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

/**
 * Una consulta de lectura. `query` es lo que va después del nombre de la tabla,
 * en el formato de PostgREST: `price_tiers?select=*&order=min_qty.asc`.
 */
export async function restSelect(query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: headers(),
  })

  if (!response.ok) throw new Error(`Supabase respondió ${response.status}`)
  return response.json()
}

/**
 * Inserta una fila.
 *
 * `return=minimal` no es sólo por ahorrar: sin él PostgREST devuelve la fila
 * recién creada, y para eso necesita permiso de lectura sobre la tabla. La
 * política de `leads` deja insertar pero no leer —a propósito, para que nadie
 * desde afuera se lleve la lista de contactos—, así que pedir la fila de vuelta
 * haría fallar la inserción entera.
 */
export async function restInsert(table, row) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  })

  if (!response.ok) throw new Error(`Supabase respondió ${response.status}`)
}
