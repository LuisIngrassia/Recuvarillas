/**
 * Las provincias argentinas, escritas de una sola manera.
 *
 * Existe porque el mismo lugar se venía guardando de tres formas: el padrón de
 * códigos postales las escribe sin tildes —"Cordoba", "Entre Rios"—, quien
 * carga un cliente a mano las escribe como se escriben, y entre medio aparecen
 * "Bs As" y "CABA". Para filtrar y agrupar eso ya está resuelto en la base, con
 * la columna `provincia_clave`, pero normalizar al leer no arregla lo que se
 * ve: la ficha de un cliente sigue diciendo "Cordoba".
 *
 * Así que se arregla al escribir. Los formularios ofrecen esta lista y lo que
 * autocompleta el código postal pasa por `canonicalProvince`, de modo que un
 * lead que entró por la web y un cliente cargado a mano digan el mismo texto.
 */

/**
 * Las 24 jurisdicciones, con sus nombres como se escriben.
 *
 * En orden alfabético y no por cuánto se venden: un desplegable que se ordena
 * por frecuencia cambia de lugar solo, y eso obliga a leerlo entero cada vez en
 * lugar de ir directo a donde estaba la última.
 */
export const PROVINCES = [
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Ciudad Autónoma de Buenos Aires',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
]

/** Sin tildes y en minúsculas: es la misma clave que calcula la base. */
const plano = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const POR_CLAVE = new Map(PROVINCES.map((nombre) => [plano(nombre), nombre]))

/*
  Las formas en que se la nombra sin que sea su nombre. No es una lista de
  errores de tipeo —esa no tiene fin— sino de las abreviaturas que la gente usa
  en serio y que si no, quedan afuera del desplegable para siempre.
*/
const ALIAS = {
  caba: 'Ciudad Autónoma de Buenos Aires',
  capital: 'Ciudad Autónoma de Buenos Aires',
  'capital federal': 'Ciudad Autónoma de Buenos Aires',
  'ciudad de buenos aires': 'Ciudad Autónoma de Buenos Aires',
  'bs as': 'Buenos Aires',
  'bs. as.': 'Buenos Aires',
  'buenos aires provincia': 'Buenos Aires',
  'provincia de buenos aires': 'Buenos Aires',
  'tierra del fuego, antartida e islas del atlantico sur':
    'Tierra del Fuego',
}

/**
 * El nombre canónico de una provincia, venga escrita como venga.
 *
 * Lo que no reconoce **lo devuelve tal cual**, recortado. Es a propósito: una
 * provincia que no está en la lista —un dato viejo raro, un envío al exterior—
 * es algo para mirar, no algo para borrar. La pantalla la muestra como está y
 * ahí se decide.
 */
export function canonicalProvince(nombre) {
  const clave = plano(nombre)
  if (!clave) return ''
  return POR_CLAVE.get(clave) ?? ALIAS[clave] ?? String(nombre).trim()
}

/** Si lo cargado ya es uno de los nombres de la lista. */
export const esProvinciaConocida = (nombre) =>
  POR_CLAVE.has(plano(nombre)) || Boolean(ALIAS[plano(nombre)])
