/**
 * Búsqueda de códigos postales argentinos.
 *
 * El padrón sale de GeoNames (CC BY 4.0) y se arma en el momento de compilar,
 * con la distancia hasta la fábrica ya calculada: en el navegador no hay que
 * hacer ninguna cuenta de coordenadas, ni pedirle nada a un servicio externo.
 * Eso evita depender de una API que puede caerse, limitar pedidos o pedir clave.
 *
 * Son ~55 KB, así que se carga aparte y sólo cuando alguien escribe un código.
 */
let pending = null

export function loadPostalCodes() {
  if (!pending) {
    pending = import('../data/postalCodes.json').then((mod) => mod.default)
  }
  return pending
}

/**
 * Resuelve un código postal a localidad, provincia y distancia en línea recta.
 * Devuelve null si no está en el padrón.
 */
export function findPostalCode(data, input) {
  const code = String(input ?? '').trim()
  if (!/^\d{4}$/.test(code)) return null

  const exact = data.codes[code]
  if (exact) {
    return { code, name: exact[0], province: data.provinces[exact[1]], km: exact[2] }
  }

  /*
    GeoNames no trae la Ciudad de Buenos Aires, así que sus códigos se resuelven
    por tramo. Ver el generador del padrón para el detalle.
  */
  const numeric = Number(code)
  for (const [from, to, name, province, km] of data.ranges) {
    if (numeric >= from && numeric <= to) {
      return { code, name, province: data.provinces[province], km }
    }
  }

  return null
}

/* -------------------------------------------------------------------------
   Buscar en el padrón

   Lo de arriba resuelve un código postal a una localidad, que es lo que hace
   falta al cotizar. Lo de acá es la búsqueda al revés —escribir "Venado" y
   encontrar el 2600— y sirve para cargar las zonas de un transporte diciendo a
   qué ciudades llega en vez de a qué rango de números.
   ------------------------------------------------------------------------- */

/** Sin tildes y en minúsculas, para que "Córdoba" encuentre a "CORDOBA". */
function plano(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Recorre el padrón entero, códigos sueltos y tramos por igual.
 *
 * Los tramos —hoy sólo la Ciudad de Buenos Aires, que GeoNames no trae— son
 * quinientos códigos con el mismo nombre. Se expanden acá para que el resto del
 * código no tenga que saber que existen dos formas de estar en el padrón.
 */
function* todos(data) {
  for (const [code, [name, province, km]] of Object.entries(data.codes)) {
    yield { cp: Number(code), name, province: data.provinces[province], km }
  }

  for (const [from, to, name, province, km] of data.ranges) {
    for (let cp = from; cp <= to; cp += 1) {
      yield { cp, name, province: data.provinces[province], km }
    }
  }
}

/**
 * Las localidades que coinciden con lo que se escribió, agrupadas por ciudad.
 *
 * Agrupadas y no sueltas porque una ciudad puede tener muchos códigos postales
 * —la Ciudad de Buenos Aires tiene quinientos— y ofrecerlos de a uno convierte
 * "agregar Buenos Aires" en quinientos clics. La unidad con la que se piensa
 * una zona de flete es la ciudad; el código postal es cómo la encuentra el
 * sistema después.
 *
 * Se busca por nombre o por código. Cuatro dígitos se leen como código postal,
 * cualquier otra cosa como nombre de localidad.
 */
export function searchPlaces(data, query, { limit = 20 } = {}) {
  const texto = plano(query)
  if (texto.length < 2) return []

  const porCodigo = /^\d{2,4}$/.test(texto)
  const grupos = new Map()

  for (const lugar of todos(data)) {
    const coincide = porCodigo
      ? String(lugar.cp).startsWith(texto)
      : plano(lugar.name).includes(texto)

    if (!coincide) continue

    /* La clave junta nombre y provincia: hay una Belgrano en varias provincias
       y no son la misma ciudad. */
    const clave = `${plano(lugar.name)}|${plano(lugar.province)}`
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        name: lugar.name,
        province: lugar.province,
        km: lugar.km,
        codes: [],
      })
    }
    grupos.get(clave).codes.push(lugar.cp)

    /* Corta apenas hay de sobra para elegir: el padrón tiene miles de entradas
       y recorrerlo entero para mostrar veinte no le sirve a nadie. */
    if (grupos.size > limit * 3) break
  }

  return [...grupos.values()]
    .map((grupo) => ({ ...grupo, codes: grupo.codes.sort((a, b) => a - b) }))
    .sort(
      (a, b) =>
        /* Primero lo que empieza como se escribió: buscando "villa" importa más
           Villa María que Punta Villa. */
        Number(plano(b.name).startsWith(texto)) - Number(plano(a.name).startsWith(texto)) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
}

/** Todas las localidades de una provincia, agrupadas igual que la búsqueda. */
export function placesInProvince(data, provincia) {
  const objetivo = plano(provincia)
  const grupos = new Map()

  for (const lugar of todos(data)) {
    if (plano(lugar.province) !== objetivo) continue

    const clave = plano(lugar.name)
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        name: lugar.name,
        province: lugar.province,
        km: lugar.km,
        codes: [],
      })
    }
    grupos.get(clave).codes.push(lugar.cp)
  }

  return [...grupos.values()]
    .map((grupo) => ({ ...grupo, codes: grupo.codes.sort((a, b) => a - b) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Las localidades que caen dentro de un rango de códigos postales.
 *
 * Existe para una sola cosa: convertir las zonas de flete que se cargaron con
 * el esquema viejo, donde una zona era un rango. Traduce ese rango a la lista
 * de ciudades que de verdad hay adentro, que es lo que el transporte podía
 * haber dicho desde el principio.
 */
export function placesInRange(data, desde, hasta) {
  const grupos = new Map()

  for (const lugar of todos(data)) {
    if (lugar.cp < desde || lugar.cp > hasta) continue

    const clave = `${plano(lugar.name)}|${plano(lugar.province)}`
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        name: lugar.name,
        province: lugar.province,
        km: lugar.km,
        codes: [],
      })
    }
    grupos.get(clave).codes.push(lugar.cp)
  }

  return [...grupos.values()]
    .map((grupo) => ({ ...grupo, codes: grupo.codes.sort((a, b) => a - b) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Las provincias del padrón, ordenadas, para el alta por provincia entera. */
export function provinceNames(data) {
  return [...data.provinces].sort((a, b) => a.localeCompare(b))
}

/** El nombre de una localidad a partir de su código, para mostrar una lista. */
export function placeName(data, cp) {
  const encontrado = findPostalCode(data, String(cp))
  return encontrado ? { name: encontrado.name, province: encontrado.province } : null
}
