/** Formatos de fecha y número del ERP. Los de plata salen de `lib/quote`. */
export { formatNumber, formatPesos } from '../../lib/quote'

const fecha = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const fechaHora = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Las fechas sueltas de Postgres llegan como '2026-09-02'. Pasarlas por `new
 * Date()` las lee como UTC y en Argentina se ven un día antes, así que se
 * arman a mano en hora local.
 */
function parseDate(value) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Date(value)
}

export const formatDate = (value) => {
  const date = parseDate(value)
  return date ? fecha.format(date) : ''
}

export const formatDateTime = (value) => {
  const date = parseDate(value)
  return date ? fechaHora.format(date) : ''
}

/** Hoy en el formato que espera un `<input type="date">` y la base. */
export function todayISO() {
  const now = new Date()
  const mes = String(now.getMonth() + 1).padStart(2, '0')
  const dia = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mes}-${dia}`
}

/*
  Las pantallas de plata trabajan por mes: los costos, las comisiones y el
  reparto se miran de a un mes cerrado. Un `<input type="month">` habla en
  'AAAA-MM' y la base en fechas sueltas, así que estas tres traducen entre los
  dos formatos.
*/

/** El mes de hoy, como lo espera un `<input type="month">`. */
export const currentMonth = () => todayISO().slice(0, 7)

/**
 * El primer y el último día de un mes 'AAAA-MM'.
 *
 * El día 0 del mes siguiente es el último del pedido: así no hay que acordarse
 * de cuántos días tiene cada uno ni de los años bisiestos.
 */
export function monthRange(mes) {
  const [anio, numero] = mes.split('-').map(Number)
  const ultimo = new Date(anio, numero, 0).getDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

const mesLargo = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })

/** 'AAAA-MM' o una fecha entera, escrito "septiembre de 2026". */
export function formatMonth(value) {
  const date = parseDate(String(value ?? '').slice(0, 7) + '-01')
  return date ? mesLargo.format(date) : ''
}

const waLink = (digits, message) =>
  `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`

/**
 * Link de WhatsApp a un teléfono cargado a mano.
 *
 * Los números llegan escritos de cualquier forma —"11 2395-8302", "0221
 * 15 456789", "93516154503" tal como lo copia WhatsApp, con o sin +54— porque
 * los tipea gente distinta y los pega de lugares distintos. wa.me quiere sólo
 * dígitos con el país adelante, así que se normaliza acá.
 *
 * Devuelve null si el número no da: mejor no mostrar el botón que abrir un chat
 * con alguien que no es. Pero "no da" tiene que significar eso y no "está
 * escrito de una forma que no contemplamos": cuando la mayoría de los contactos
 * se queda sin botón, el botón no sirve para nada.
 */
export function whatsappLink(phone, message) {
  const escrito = String(phone ?? '').trim()

  /* El + es la única señal de que el número es de otro país. Sin él, un número
     que no encaja en ningún formato argentino no se puede ubicar. */
  const conPais = escrito.startsWith('+')

  let digits = escrito.replace(/\D/g, '')
  if (!digits) return null

  // El 0 de larga distancia no viaja en el formato internacional.
  if (digits.startsWith('0')) digits = digits.slice(1)

  /*
    El 15 tampoco, y va pegado después del código de área, que en Argentina
    tiene 2, 3 o 4 dígitos según la zona. Como el largo del área no se sabe de
    antemano, se prueban las tres posiciones: un número nacional con 15 tiene 12
    dígitos —área más 15 más abonado— y sin él quedan los 10 de siempre.

    Se saltea si ya trae el 54 adelante, porque ahí esos 12 dígitos son país más
    número y no área más 15. La distinción no es ambigua: el único código de área
    de dos dígitos es el 11, y ninguno de los de tres o cuatro empieza con 54.
  */
  if (digits.length === 12 && !digits.startsWith('54')) {
    for (const area of [2, 3, 4]) {
      if (digits.slice(area, area + 2) === '15') {
        digits = digits.slice(0, area) + digits.slice(area + 2)
        break
      }
    }
  }

  /*
    Las tres formas en que aparece un celular argentino, todas hacia el mismo
    549 + área + abonado:

    - 10 dígitos: área y abonado, como lo dicta alguien por teléfono.
    - 11 empezando con 9: lo que copia y pega WhatsApp, con el 9 pero sin el
      país. Es como llega casi todo lo que se carga a mano.
    - Con 54 y sin el 9: el país puesto a mano, olvidándose del 9 de celular.
  */
  if (digits.length === 10) digits = `549${digits}`
  else if (digits.length === 11 && digits.startsWith('9')) digits = `54${digits}`
  else if (digits.startsWith('54') && !digits.startsWith('549')) {
    digits = `549${digits.slice(2)}`
  }

  // 549 + área + abonado.
  if (digits.startsWith('549') && digits.length === 13) return waLink(digits, message)

  /*
    No es argentino. Si lo escribieron con el + del país se lo toma como está:
    hay clientes en Uruguay y no hay motivo para dejarlos sin botón. Los que
    empiezan con 54 no entran acá a propósito: esos son argentinos mal cargados,
    y completarlos a ojo es justo cómo se termina abriendo el chat equivocado.
  */
  if (conPais && !digits.startsWith('54') && digits.length >= 8 && digits.length <= 15) {
    return waLink(digits, message)
  }

  return null
}
