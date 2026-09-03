/**
 * Los fletes: con quién se manda, hasta dónde llega cada uno y a cuánto.
 *
 * Un transporte tiene zonas —rangos de código postal— y cada zona tiene su
 * tarifario por cantidad. Se carga una vez y después el pedido pregunta "¿quién
 * llega a este CP con esta cantidad y por cuánto?" en `quoteFreight`.
 */
import { db, unwrap } from './client'

export const CARRIER_TYPES = ['expreso', 'correo', 'propio', 'otro']

export const CARRIER_TYPE_LABELS = {
  expreso: 'Expreso',
  correo: 'Correo',
  propio: 'Camión propio',
  otro: 'Otro',
}

export const CARRIER_TYPE_TONES = {
  expreso: 'neutral',
  correo: 'info',
  propio: 'good',
  otro: 'neutral',
}

/**
 * Todos los transportes con sus zonas y tarifas colgadas.
 *
 * Viene todo en una consulta porque la pantalla lo muestra todo junto: son
 * pocos transportes y pocas filas cada uno, y pedirlo por partes obligaría a
 * encadenar una carga por zona para pintar la misma tabla.
 *
 * El orden se arma acá y no en la consulta: son listas de unas pocas filas y
 * ordenarlas en JavaScript se lee mejor que tres `referencedTable` anidados.
 */
export async function listCarriers() {
  const carriers = unwrap(
    await db()
      .from('carriers')
      .select('*, zones:carrier_zones(*, rates:carrier_rates(*))')
      .order('nombre'),
  )

  return carriers.map((carrier) => ({
    ...carrier,
    zones: [...(carrier.zones ?? [])]
      .sort((a, b) => a.cp_desde - b.cp_desde)
      .map((zone) => ({
        ...zone,
        rates: [...(zone.rates ?? [])].sort((a, b) => a.min_qty - b.min_qty),
      })),
  }))
}

export async function createCarrier(values) {
  return unwrap(await db().from('carriers').insert(values).select().single())
}

export async function updateCarrier(id, changes) {
  return unwrap(await db().from('carriers').update(changes).eq('id', id).select().single())
}

/** Borrar un transporte se lleva sus zonas y tarifas (cascada en la base). */
export async function deleteCarrier(id) {
  unwrap(await db().from('carriers').delete().eq('id', id))
}

export async function createZone(values) {
  return unwrap(await db().from('carrier_zones').insert(values).select().single())
}

export async function updateZone(id, changes) {
  return unwrap(await db().from('carrier_zones').update(changes).eq('id', id).select().single())
}

export async function deleteZone(id) {
  unwrap(await db().from('carrier_zones').delete().eq('id', id))
}

export async function createRate(values) {
  return unwrap(await db().from('carrier_rates').insert(values).select().single())
}

export async function updateRate(id, changes) {
  return unwrap(
    await db()
      .from('carrier_rates')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),
  )
}

export async function deleteRate(id) {
  unwrap(await db().from('carrier_rates').delete().eq('id', id))
}

/**
 * Qué transportes llegan a ese código postal con esa cantidad, del más barato
 * al más caro.
 *
 * La cuenta la hace la base (`cotizar_flete` en `schema.sql`) y no esta
 * función: es una pregunta sobre datos que están todos allá, y así la contesta
 * igual quien la haga.
 *
 * Sin código postal o sin cantidad no hay nada que preguntar, y devolver una
 * lista vacía es más honesto que consultar con un dato que no está.
 */
export async function quoteFreight(cp, cantidad) {
  if (!cp || !Number.isFinite(cantidad) || cantidad < 1) return []

  return unwrap(
    await db().rpc('cotizar_flete', { cp: String(cp), cantidad }),
  )
}
