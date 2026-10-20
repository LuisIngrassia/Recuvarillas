/**
 * Quién queda sobre el camino de un viaje.
 *
 * La pantalla de Envíos contesta «quién está cerca de un destino» sin
 * coordenadas, con código postal y zona de flete. Para un viaje largo eso no
 * alcanza: de Luján a Santa Rosa se pasa por Mercedes, Chivilcoy, Bragado,
 * Pehuajó, Trenque Lauquen… y ninguno comparte zona ni provincia con el
 * destino. La pregunta es otra —¿a cuántos kilómetros del camino está?— y para
 * eso sí hacen falta coordenadas.
 *
 * Las coordenadas salen de dos servicios públicos y gratuitos, sin clave:
 *
 * - **Georef** (datos.gob.ar), el padrón oficial de localidades del Estado:
 *   «Bragado, Buenos Aires» → centroide. Acepta hasta mil consultas en un solo
 *   pedido, así que toda la cartera se resuelve de una vez.
 * - **OSRM**, el ruteador de OpenStreetMap: el camino real por ruta, no una
 *   línea recta. Si no responde se usa la recta, que para un viaje por la RN5
 *   no está tan lejos, y la pantalla lo avisa.
 *
 * Lo que Georef ya contestó se guarda en el navegador: las localidades no se
 * mudan, y la segunda vez que se abre la pantalla no hay que pedir nada.
 */
import { clave } from '../api/shipping'
import { findPostalCode, loadPostalCodes } from '../../lib/postalCodes'

const GEOREF = 'https://apis.datos.gob.ar/georef/api/localidades'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const CACHE = 'recuvarilla.geo.v1'

/* ---------------------------------------------------------------------------
   Localidades → coordenadas
   --------------------------------------------------------------------------- */

function leerCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? '{}')
  } catch {
    return {}
  }
}

function guardarCache(cache) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(cache))
  } catch {
    /* Sin almacenamiento la pantalla anda igual: vuelve a preguntar. */
  }
}

/** "Bragado, Buenos Aires" → { localidad, provincia }. La provincia es opcional. */
export function separarLugar(texto) {
  const [localidad, ...resto] = String(texto ?? '').split(',')
  return { localidad: localidad.trim(), provincia: resto.join(',').trim() }
}

const claveLugar = (localidad, provincia) => `${clave(localidad)}|${clave(provincia)}`

/**
 * Resuelve una lista de lugares a coordenadas, en un solo pedido.
 *
 * Devuelve un Map de `claveLugar` → { lat, lon, nombre } o null si Georef no lo
 * encontró. El null también se guarda: preguntar todos los días por una
 * localidad mal escrita no la va a arreglar.
 */
export async function geocodificar(lugares) {
  const cache = leerCache()
  const resultado = new Map()
  const faltan = []

  for (const lugar of lugares) {
    const k = claveLugar(lugar.localidad, lugar.provincia)
    if (resultado.has(k)) continue
    if (k in cache) resultado.set(k, cache[k])
    else if (!faltan.some((f) => f.k === k)) faltan.push({ k, ...lugar })
  }

  for (let i = 0; i < faltan.length; i += 500) {
    const tanda = faltan.slice(i, i + 500)
    const respuesta = await fetch(GEOREF, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localidades: tanda.map((lugar) => ({
          nombre: lugar.localidad,
          ...(lugar.provincia ? { provincia: lugar.provincia } : {}),
          max: 1,
          campos: 'nombre,provincia.nombre,centroide',
        })),
      }),
    })
    if (!respuesta.ok) throw new Error('No se pudo consultar el padrón de localidades (Georef).')

    const { resultados } = await respuesta.json()
    tanda.forEach((lugar, j) => {
      const encontrada = resultados[j]?.localidades?.[0]
      const valor = encontrada
        ? {
            lat: encontrada.centroide.lat,
            lon: encontrada.centroide.lon,
            nombre: encontrada.nombre,
            provincia: encontrada.provincia?.nombre ?? lugar.provincia,
          }
        : null
      cache[lugar.k] = valor
      resultado.set(lugar.k, valor)
    })
  }

  if (faltan.length) guardarCache(cache)
  return resultado
}

/**
 * Qué localidad tiene cada contacto.
 *
 * La que está escrita en la ficha manda. Si no hay, se deduce del código
 * postal con el padrón que ya usa el cotizador. Si no hay ninguna de las dos,
 * no se puede ubicar y se cuenta aparte.
 */
export async function lugarDe(punto) {
  if (punto.localidad?.trim()) {
    return { localidad: punto.localidad.trim(), provincia: punto.provincia?.trim() ?? '' }
  }
  if (punto.codigo_postal) {
    const padron = await loadPostalCodes()
    const cp = findPostalCode(padron, String(punto.codigo_postal).match(/\d{4}/)?.[0])
    if (cp) return { localidad: cp.name, provincia: cp.province }
  }
  return null
}

/** Le pone coordenadas a cada contacto. Los que no se ubican vuelven aparte. */
export async function ubicar(destinos) {
  const conLugar = []
  const sinLugar = []

  for (const punto of destinos) {
    const lugar = await lugarDe(punto)
    if (lugar) conLugar.push({ punto, lugar })
    else sinLugar.push(punto)
  }

  const coordenadas = await geocodificar(conLugar.map((item) => item.lugar))
  const ubicados = []
  const noEncontrados = []

  for (const { punto, lugar } of conLugar) {
    const geo = coordenadas.get(claveLugar(lugar.localidad, lugar.provincia))
    if (geo) ubicados.push({ ...punto, geo })
    else noEncontrados.push(punto)
  }

  return { ubicados, sinLugar, noEncontrados }
}

/* ---------------------------------------------------------------------------
   El camino
   --------------------------------------------------------------------------- */

/**
 * El recorrido por ruta entre varios puntos, como lista de [lat, lon].
 *
 * Si OSRM no contesta se devuelve la recta entre los puntos con `aproximado`
 * en true: la lista sale igual, con el aviso de que los kilómetros son
 * a vuelo de pájaro.
 */
export async function trazarRuta(paradas) {
  const coords = paradas.map((p) => `${p.lon},${p.lat}`).join(';')
  try {
    const respuesta = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson`)
    const datos = await respuesta.json()
    const ruta = datos.routes?.[0]
    if (datos.code !== 'Ok' || !ruta) throw new Error(datos.code)

    return {
      linea: ruta.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      km: ruta.distance / 1000,
      horas: ruta.duration / 3600,
      aproximado: false,
    }
  } catch {
    const linea = paradas.map((p) => [p.lat, p.lon])
    return { linea, km: largo(linea), horas: null, aproximado: true }
  }
}

/* ---------------------------------------------------------------------------
   Distancias

   Se proyecta todo a un plano en kilómetros alrededor de la latitud media del
   viaje. Para un recorrido de unos cientos de kilómetros el error es de pocos
   por ciento, que es mucho menos que lo que separa a un pueblo del siguiente.
   --------------------------------------------------------------------------- */

const KM_LAT = 110.57
const kmLon = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180)

function largo(linea) {
  let total = 0
  for (let i = 1; i < linea.length; i++) {
    const [a, b] = [linea[i - 1], linea[i]]
    const dx = (b[1] - a[1]) * kmLon((a[0] + b[0]) / 2)
    const dy = (b[0] - a[0]) * KM_LAT
    total += Math.hypot(dx, dy)
  }
  return total
}

/**
 * Prepara la línea para medir muchos puntos contra ella: cada tramo en
 * kilómetros y con lo recorrido hasta su comienzo.
 */
export function prepararLinea(linea) {
  const lat0 = linea.reduce((s, p) => s + p[0], 0) / linea.length
  const fx = kmLon(lat0)
  const xy = linea.map(([lat, lon]) => [lon * fx, lat * KM_LAT])

  const tramos = []
  let recorrido = 0
  for (let i = 1; i < xy.length; i++) {
    const [ax, ay] = xy[i - 1]
    const [bx, by] = xy[i]
    const largoTramo = Math.hypot(bx - ax, by - ay)
    if (largoTramo > 0) tramos.push({ ax, ay, bx, by, largo: largoTramo, desde: recorrido })
    recorrido += largoTramo
  }

  return { fx, tramos, total: recorrido }
}

/**
 * A cuántos kilómetros del camino está un punto, y en qué kilómetro del viaje
 * queda la salida más cercana.
 */
export function medir(preparada, lat, lon) {
  const px = lon * preparada.fx
  const py = lat * KM_LAT
  let mejor = { desvio: Infinity, km: 0 }

  for (const t of preparada.tramos) {
    const dx = t.bx - t.ax
    const dy = t.by - t.ay
    const u = Math.max(0, Math.min(1, ((px - t.ax) * dx + (py - t.ay) * dy) / (t.largo * t.largo)))
    const d = Math.hypot(t.ax + u * dx - px, t.ay + u * dy - py)
    if (d < mejor.desvio) mejor = { desvio: d, km: t.desde + u * t.largo }
  }

  return mejor
}

/** Distancia en línea recta entre dos puntos, en km. */
export function distancia(a, b) {
  const dx = (b.lon - a.lon) * kmLon((a.lat + b.lat) / 2)
  const dy = (b.lat - a.lat) * KM_LAT
  return Math.hypot(dx, dy)
}

/**
 * Las paradas del viaje, agrupadas por localidad y en el orden en que se pasa
 * por cada una.
 *
 * Entran por dos lados, porque desviarse no cuesta lo mismo en todo el viaje:
 *
 * - **En el camino**, a menos de `corredor` km. Cada desvío ahí es ida y vuelta
 *   con el camión cargado y el destino todavía por delante.
 * - **Alrededor del destino**, a menos de `radioDestino` km en línea recta. Una
 *   vez descargado, recorrer la zona es lo que se vino a hacer.
 *
 * Los que entran sólo por el radio del destino van al final, del más cerca al
 * más lejos de él, con `enDestino` en true para que la lista lo diga.
 */
export function paradasSobreRuta(ubicados, preparada, corredor, destino, radioDestino = 0) {
  const porLugar = new Map()

  for (const punto of ubicados) {
    let { desvio, km } = medir(preparada, punto.geo.lat, punto.geo.lon)
    const alDestino = destino ? distancia(destino, punto.geo) : Infinity
    let enDestino = false

    if (desvio > corredor) {
      if (alDestino > radioDestino) continue
      enDestino = true
      km = preparada.total + alDestino
    }

    const k = `${punto.geo.lat.toFixed(4)},${punto.geo.lon.toFixed(4)}`
    if (!porLugar.has(k)) {
      porLugar.set(k, {
        id: k,
        nombre: punto.geo.nombre,
        provincia: punto.geo.provincia,
        lat: punto.geo.lat,
        lon: punto.geo.lon,
        km,
        desvio,
        enDestino,
        alDestino,
        contactos: [],
      })
    }
    porLugar.get(k).contactos.push(punto)
  }

  return [...porLugar.values()].sort((a, b) => a.km - b.km)
}
