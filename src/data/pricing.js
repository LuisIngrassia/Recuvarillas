/**
 * Lista de precios y condiciones de flete.
 *
 * Todos los importes son SIN IVA, igual que la lista impresa. Este archivo es
 * el único lugar donde se tocan los precios: el cálculo y la interfaz los leen
 * de acá.
 *
 * Vigente desde: 01/08/2026
 */

/**
 * Escalones de precio por cantidad. `plain` es sin agujerear y `drilled`
 * agujereada; la diferencia es el recargo por agujereado ($500 por unidad hasta
 * 999, $250 de 1.000 en adelante).
 *
 * De 1.000 unidades arranca la lista mayorista, que es un salto grande de
 * precio: es el tramo pensado para corralones y agropecuarias.
 */
export const PRICE_TIERS = [
  { min: 1, max: 99, plain: 3750, drilled: 4250, kind: 'minorista' },
  { min: 100, max: 499, plain: 3650, drilled: 4150, kind: 'minorista' },
  { min: 500, max: 999, plain: 3550, drilled: 4050, kind: 'minorista' },
  { min: 1000, max: 4999, plain: 2750, drilled: 3000, kind: 'mayorista' },
  { min: 5000, max: Infinity, plain: 2550, drilled: 2800, kind: 'mayorista' },
]

/** Desde dónde sale el camión. El padrón de códigos postales guarda la distancia hasta acá. */
export const ORIGIN = { city: 'Luján', province: 'Buenos Aires', postalCode: '6700' }

export const FREIGHT = {
  /** Costo por kilómetro recorrido. */
  perKm: 1000,

  /**
   * El camión tiene que volver, así que se cobra el recorrido completo: los
   * kilómetros hasta el destino cuentan dos veces.
   */
  roundTrip: true,

  /**
   * Las distancias del padrón son en línea recta. La ruta siempre da más, y en
   * Argentina el desvío ronda el 15% para los destinos habituales. Es una
   * estimación: en la Patagonia se queda bastante corta, porque la recta cruza
   * territorio sin camino.
   */
  roadFactor: 1.15,

  /** Varillas que entran por viaje. Arriba de esto hace falta más de un viaje. */
  truckCapacity: 15000,

  /**
   * Cantidad desde la que conviene el camión propio. Por debajo se contrata
   * flete y todavía no está relevada la tarifa, así que por ahora se cotiza con
   * el mismo valor.
   */
  truckMinimum: 8000,
}

/** Días que se sostiene el presupuesto, según las condiciones de la lista. */
export const QUOTE_VALID_DAYS = 7
