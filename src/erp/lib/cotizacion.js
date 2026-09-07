/**
 * El dólar del día, para los presupuestos que salen en esa moneda.
 *
 * El sistema entero lleva pesos y eso no cambia: los pagos, la cuenta
 * corriente, las comisiones y la ganancia del mes se cuentan en pesos porque es
 * la moneda en la que se cobra. Lo único que se convierte es el papel que ve el
 * cliente, y sólo si se pide.
 *
 * La cotización se trae de dolarapi.com —gratis, sin clave y sin registro— pero
 * llega como propuesta y no como verdad: el campo se puede escribir encima. El
 * que cotiza suele tener un dólar propio, y ninguna API sabe a cuánto se
 * arregló con ese cliente.
 *
 * Se toma el valor de **venta**, que es el número que la gente dice cuando dice
 * "el dólar está a tanto".
 */

const FUENTE = 'https://dolarapi.com/v1/dolares'

/*
  Las dos casas que sirven para cotizarle a un cliente. La API devuelve varias
  más —tarjeta, cripto, mayorista— pero ninguna es el precio al que se vende, y
  una lista larga en la pantalla es una decisión más para tomar cada vez.
*/
const CASAS = [
  { casa: 'oficial', nombre: 'Oficial' },
  { casa: 'blue', nombre: 'Blue' },
]

export const MONEDAS = ['ARS', 'USD']

export const MONEDA_LABELS = {
  ARS: 'Pesos (ARS)',
  USD: 'Dólares (USD)',
}

const SIMBOLOS = { ARS: '$', USD: 'US$' }

/*
  Dos decimales, como el documento de siempre. El resto del ERP redondea a peso
  entero porque son pantallas de trabajo; un presupuesto que va afuera muestra
  el importe exacto, y en dólares los centavos son plata.
*/
const numero = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoneda(valor, moneda = 'ARS') {
  return `${SIMBOLOS[moneda] ?? SIMBOLOS.ARS} ${numero.format(Number(valor) || 0)}`
}

/** Dos decimales, que es hasta donde llega un importe en un papel. */
export const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100

/**
 * Un importe en pesos, visto en la moneda del presupuesto.
 *
 * Sin cotización devuelve el mismo importe: en pesos no hay nada que convertir,
 * y así quien llama no tiene que preguntar en qué moneda está antes de cada
 * cuenta.
 *
 * El redondeo va acá, en cada precio unitario, y los subtotales se calculan
 * después multiplicando ese número ya redondeado. Es al revés de lo que haría
 * una cuenta exacta, y es a propósito: el cliente que agarra la calculadora y
 * multiplica cantidad por precio tiene que llegar al subtotal que dice el
 * papel. Un documento que no cierra por dos centavos hace perder más tiempo del
 * que ahorra la precisión.
 */
export function enMoneda(pesos, cotizacion) {
  if (!cotizacion || cotizacion <= 0) return redondear(pesos)
  return redondear(Number(pesos) / cotizacion)
}

async function fetchCotizaciones() {
  const response = await fetch(FUENTE)
  if (!response.ok) throw new Error(`No se pudo traer la cotización (${response.status}).`)

  const filas = await response.json()

  const cotizaciones = CASAS.map(({ casa, nombre }) => {
    const fila = filas.find((item) => item.casa === casa)
    const valor = Number(fila?.venta)
    if (!Number.isFinite(valor) || valor <= 0) return null
    return { casa, nombre, valor, actualizado: fila.fechaActualizacion ?? null }
  }).filter(Boolean)

  if (!cotizaciones.length) throw new Error('La cotización llegó vacía.')
  return cotizaciones
}

/*
  Una consulta cada diez minutos como mucho. Abrir tres presupuestos seguidos no
  tiene por qué pegarle tres veces a la API, pero una pantalla que quedó abierta
  toda la mañana tampoco tiene por qué seguir proponiendo el dólar de las nueve.
*/
const VIGENCIA = 10 * 60 * 1000

let pending = null
let pedidoEn = 0

export function loadCotizaciones() {
  if (!pending || Date.now() - pedidoEn > VIGENCIA) {
    pedidoEn = Date.now()
    pending = fetchCotizaciones().catch((error) => {
      // Un fallo no se cachea: la próxima pantalla vuelve a intentar.
      pending = null
      throw error
    })
  }
  return pending
}
