import { FREIGHT, PRICE_TIERS } from '../data/pricing'

/** Escalón de precio que corresponde a una cantidad. */
export function tierFor(quantity) {
  return (
    PRICE_TIERS.find((t) => quantity >= t.min && quantity <= t.max) ?? PRICE_TIERS[0]
  )
}

/**
 * Costo del flete hasta un destino.
 *
 * Son tres factores encadenados y conviene tenerlos a la vista porque cada uno
 * mueve el número: la distancia en línea recta se corrige a distancia de ruta,
 * se duplica porque el camión vuelve, y se multiplica por la cantidad de viajes
 * cuando el pedido no entra en uno solo.
 *
 * @param quantity cantidad de varillas del pedido
 * @param straightKm distancia en línea recta desde la fábrica
 */
export function freightFor(quantity, straightKm) {
  const roadKm = Math.round(straightKm * FREIGHT.roadFactor)
  const trips = Math.max(1, Math.ceil(quantity / FREIGHT.truckCapacity))
  const billedKm = roadKm * (FREIGHT.roundTrip ? 2 : 1) * trips

  return {
    straightKm,
    roadKm,
    trips,
    billedKm,
    perKm: FREIGHT.perKm,
    total: billedKm * FREIGHT.perKm,
  }
}

/**
 * Presupuesto completo. Todos los importes son sin IVA.
 *
 * @param quantity cantidad de varillas
 * @param drilled si va agujereada de fábrica
 * @param delivery 'pickup' (retiro en Luján) o 'shipping'
 * @param straightKm distancia del destino, sólo si es con envío
 */
export function buildQuote({ quantity, drilled, delivery, straightKm }) {
  const tier = tierFor(quantity)
  const unitPrice = drilled ? tier.drilled : tier.plain
  const goods = unitPrice * quantity

  const freight =
    delivery === 'shipping' && Number.isFinite(straightKm)
      ? freightFor(quantity, straightKm)
      : null

  return {
    tier,
    unitPrice,
    goods,
    freight,
    total: goods + (freight?.total ?? 0),
  }
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export const formatPesos = (value) => pesos.format(value)

export const formatNumber = (value) => new Intl.NumberFormat('es-AR').format(value)
