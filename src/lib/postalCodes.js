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
