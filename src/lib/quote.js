import { PRICE_TIERS } from '../data/pricing'

/**
 * Las dos listas de precios.
 *
 * No son dos tramos de la misma escala: son listas distintas, con sus propios
 * escalones, y cuál se aplica lo decide **quién compra**, no cuánto compra. El
 * revendedor paga la lista mayorista aunque esta vez lleve poco, porque lo que
 * se le está reconociendo es que vuelve todos los meses.
 *
 * Antes `kind` rotulaba tramos de volumen dentro de una sola lista. Eso alcanzó
 * mientras hubo una sola, pero hacía que un particular que compraba 1.000
 * pagara lo mismo que un distribuidor, que es justamente lo que no se quiere.
 */
export const LIST_KINDS = ['minorista', 'mayorista']

/**
 * Escalón de precio que corresponde a una cantidad, dentro de una lista.
 *
 * Los escalones se pasan por parámetro porque desde que la lista vive en
 * Supabase pueden venir de la base (ver `lib/priceTiers.js`). Los del código
 * quedan como valor por defecto: sirven de respaldo y evitan tener que
 * enhebrar la lista por lugares que no la necesitan.
 *
 * La lista mayorista arranca en 1.000 unidades, así que un revendedor que esta
 * vez lleva 300 no cae en ningún escalón. En ese caso toma el primero de su
 * lista, que es lo correcto: sigue siendo revendedor. Por eso el `?? usable[0]`
 * no es una red por si algo falla, es la regla para las cantidades chicas.
 *
 * Si la lista pedida no existe todavía —una base a la que aún no se le cargó la
 * mayorista— se cae a la minorista antes que devolver nada: cobrar de más es un
 * error recuperable, no cotizar es una venta perdida.
 */
export function tierFor(quantity, tiers = PRICE_TIERS, kind = 'minorista') {
  const propios = tiers.filter((t) => t.kind === kind)
  const usable = propios.length ? propios : tiers.filter((t) => t.kind === 'minorista')

  return usable.find((t) => quantity >= t.min && quantity <= t.max) ?? usable[0]
}

/**
 * Presupuesto de la mercadería. Todos los importes son sin IVA.
 *
 * El flete queda afuera: lo cotiza la empresa de transporte según el destino, y
 * no es un precio nuestro como para calcularlo acá.
 *
 * @param quantity cantidad de varillas
 * @param drilled si va agujereada de fábrica
 * @param tiers lista de precios a aplicar
 * @param kind qué lista: 'minorista' (por defecto) o 'mayorista'
 */
export function buildQuote({ quantity, drilled, tiers = PRICE_TIERS, kind = 'minorista' }) {
  const tier = tierFor(quantity, tiers, kind)
  const unitPrice = drilled ? tier.drilled : tier.plain

  return { tier, unitPrice, total: unitPrice * quantity }
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export const formatPesos = (value) => pesos.format(value)

export const formatNumber = (value) => new Intl.NumberFormat('es-AR').format(value)
