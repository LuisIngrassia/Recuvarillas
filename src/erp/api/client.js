/**
 * Piso común de todas las consultas del ERP.
 *
 * Supabase no lanza excepciones: devuelve `{ data, error }` en cada llamada. Si
 * cada pantalla tuviera que acordarse de mirar `error`, tarde o temprano alguna
 * se olvida y muestra una tabla vacía como si no hubiera datos, cuando en
 * realidad la consulta falló. Acá el error se convierte en excepción una sola
 * vez y las pantallas lo agarran en un lugar solo.
 */
import { supabase } from '../../lib/supabase'

/**
 * El cliente, o un error claro si falta configurarlo. Sin esto el fallo sería
 * un "cannot read property from of null" que no le dice nada a nadie.
 */
export function db() {
  if (!supabase) {
    throw new Error(
      'El ERP no está conectado a Supabase. Falta cargar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
    )
  }
  return supabase
}

/**
 * Pasa a castellano los errores que sabemos que se van a ver seguido.
 *
 * Postgres avisa con un código; el mensaje que trae es correcto pero está en
 * inglés y habla de tablas y claves foráneas, que no es el vocabulario de quien
 * está cargando un pedido.
 */
function readableError(error) {
  switch (error.code) {
    case '23503':
      return 'No se puede borrar: hay pedidos o movimientos que dependen de este registro.'
    case '23505':
      return 'Ya existe un registro con esos datos.'
    case '23514':
      return 'Alguno de los valores cargados no es válido. Revisá cantidades e importes.'
    case '42501':
    case 'PGRST301':
      return 'Tu sesión no tiene permiso para esto. Probá cerrar sesión y volver a entrar.'
    default:
      return error.message || 'No se pudo completar la operación.'
  }
}

/** Devuelve los datos de una respuesta de Supabase, o lanza el error traducido. */
export function unwrap({ data, error }) {
  if (error) throw new Error(readableError(error))
  return data
}

/**
 * Deja un término listo para meter dentro de un filtro `or(...)`.
 *
 * PostgREST separa las condiciones por coma y agrupa con paréntesis, así que un
 * cliente escrito "Perez, Juan" partiría el filtro al medio y la consulta
 * volvería con un error en vez de con resultados. Esos caracteres no aportan
 * nada a una búsqueda por nombre, así que se sacan.
 */
export function searchTerm(input) {
  return String(input ?? '').trim().replace(/[,()*]/g, ' ').trim()
}
