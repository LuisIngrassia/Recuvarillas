/**
 * Los fletes: con quién se manda, hasta dónde llega cada uno y a cuánto.
 *
 * Un transporte tiene zonas, cada zona tiene **la lista de ciudades a las que
 * llega** y su tarifario por cantidad. Se carga una vez y después el pedido
 * pregunta "¿quién llega a este CP con esta cantidad y por cuánto?" en
 * `quoteFreight`.
 *
 * Antes una zona era un rango de códigos postales, y el rango mentía: un
 * expreso que llega a Rosario y a Venado Tuerto no llega a todo lo que hay en
 * el medio. Las zonas viejas siguen cotizando por su rango hasta que se las
 * convierte; ver `esPorRango`.
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
      .select(
        '*, zones:carrier_zones(*, rates:carrier_rates(*), places:carrier_zone_places(*))',
      )
      .order('nombre'),
  )

  return carriers.map((carrier) => ({
    ...carrier,
    /* Por nombre y no por código postal: una zona por ciudades no tiene un
       "primer CP" que signifique nada. */
    zones: [...(carrier.zones ?? [])]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((zone) => ({
        ...zone,
        rates: [...(zone.rates ?? [])].sort((a, b) => a.min_qty - b.min_qty),
        places: [...(zone.places ?? [])].sort((a, b) => a.cp - b.cp),
      })),
  }))
}

/**
 * Una zona que todavía cotiza por el rango viejo.
 *
 * Es la que tiene rango y ninguna ciudad cargada. Apenas se le agrega la
 * primera, manda la lista y el rango deja de aplicar — la misma regla que usa
 * `cotizar_flete`, escrita de los dos lados porque la pantalla tiene que
 * avisarlo antes de que el cambio pase.
 */
export const esPorRango = (zone) =>
  zone.cp_desde !== null && (zone.places?.length ?? 0) === 0

/**
 * Las ciudades de una zona, cada una con sus códigos postales.
 *
 * Se agrupa para mostrar: la Ciudad de Buenos Aires son quinientos códigos y un
 * solo lugar al que se llega. Quien carga una zona piensa en ciudades; los
 * códigos son cómo la encuentra el sistema después.
 */
export function ciudadesDe(zone) {
  const grupos = new Map()

  for (const place of zone.places ?? []) {
    const clave = `${place.localidad ?? place.cp}|${place.provincia ?? ''}`
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        localidad: place.localidad ?? `CP ${place.cp}`,
        provincia: place.provincia,
        codes: [],
      })
    }
    grupos.get(clave).codes.push(place.cp)
  }

  return [...grupos.values()]
    .map((grupo) => ({ ...grupo, codes: grupo.codes.sort((a, b) => a - b) }))
    .sort((a, b) => a.localidad.localeCompare(b.localidad))
}

/**
 * Agrega ciudades a una zona.
 *
 * `ignoreDuplicates` y no un error: agregar una ciudad que ya estaba es lo que
 * pasa cuando alguien carga una provincia entera sobre una zona que ya tenía
 * tres de sus ciudades. Es lo que quiso hacer, no un choque que haya que
 * contarle.
 */
export async function addZonePlaces(zoneId, lugares) {
  const filas = lugares.flatMap((lugar) =>
    lugar.codes.map((cp) => ({
      zone_id: zoneId,
      cp,
      localidad: lugar.name ?? lugar.localidad ?? null,
      provincia: lugar.province ?? lugar.provincia ?? null,
    })),
  )

  if (filas.length === 0) return 0

  unwrap(
    await db()
      .from('carrier_zone_places')
      .upsert(filas, { onConflict: 'zone_id,cp', ignoreDuplicates: true }),
  )

  return filas.length
}

/** Saca una ciudad entera de la zona, con todos sus códigos postales. */
export async function removeZonePlaces(zoneId, codes) {
  unwrap(
    await db().from('carrier_zone_places').delete().eq('zone_id', zoneId).in('cp', codes),
  )
}

/**
 * Da por convertida una zona vieja: le carga sus ciudades y le borra el rango.
 *
 * Las dos cosas van juntas y en ese orden. Si se borrara el rango primero y
 * fallara la carga, la zona quedaría sin cubrir nada y el transporte
 * desaparecería de las cotizaciones sin que nadie lo haya decidido.
 */
export async function convertZoneToPlaces(zoneId, lugares) {
  const cuantos = await addZonePlaces(zoneId, lugares)
  await updateZone(zoneId, { cp_desde: null, cp_hasta: null })
  return cuantos
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
