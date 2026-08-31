import { PRICE_TIERS } from '../data/pricing'

/** Escalón de precio que corresponde a una cantidad. */
export function tierFor(quantity) {
  return (
    PRICE_TIERS.find((t) => quantity >= t.min && quantity <= t.max) ?? PRICE_TIERS[0]
  )
}

/**
 * Presupuesto de la mercadería. Todos los importes son sin IVA.
 *
 * El flete queda afuera: lo cotiza la empresa de transporte según el destino, y
 * no es un precio nuestro como para calcularlo acá.
 *
 * @param quantity cantidad de varillas
 * @param drilled si va agujereada de fábrica
 */
export function buildQuote({ quantity, drilled }) {
  const tier = tierFor(quantity)
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
