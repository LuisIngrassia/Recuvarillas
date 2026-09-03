/**
 * Lista de precios de las varillas.
 *
 * Todos los importes son SIN IVA, igual que la lista impresa. Este archivo es
 * el único lugar donde se tocan los precios: el cálculo y la interfaz los leen
 * de acá.
 *
 * El flete no está acá ni se calcula en ningún lado, a propósito: lo pone una
 * empresa de transporte y su tarifa cambia sin que nosotros la manejemos.
 * Publicar un número fijo sería comprometernos a un precio ajeno, y cuando lo
 * suban la diferencia la terminamos poniendo nosotros. Se cotiza a mano al
 * cerrar el pedido.
 *
 * Vigente desde: 01/08/2026
 */

/**
 * Escalones de precio por cantidad. `plain` es sin agujerear y `drilled`
 * agujereada; la diferencia es el recargo por agujereado.
 *
 * Son **dos listas distintas**, no dos tramos de una. `kind` dice a cuál
 * pertenece cada escalón, y cuál se aplica lo decide quién compra:
 *
 * - `minorista` es la lista pública, la que cotiza el simulador de la web.
 *   Baja por cantidad, pero es la que paga cualquiera que no tenga acuerdo.
 * - `mayorista` es la de los revendedores, que compran todos los meses. Arranca
 *   en 1.000 unidades; el revendedor que un mes lleva menos igual paga esta
 *   lista, porque lo que se le reconoce es que vuelve.
 */
export const PRICE_TIERS = [
  { min: 1, max: 99, plain: 2950, drilled: 3450, kind: 'minorista' },
  { min: 100, max: 499, plain: 2900, drilled: 3400, kind: 'minorista' },
  { min: 500, max: 999, plain: 2850, drilled: 3350, kind: 'minorista' },
  { min: 1000, max: 4999, plain: 2750, drilled: 3250, kind: 'minorista' },
  { min: 5000, max: Infinity, plain: 2550, drilled: 2800, kind: 'minorista' },

  { min: 1000, max: 4999, plain: 2655, drilled: 2905, kind: 'mayorista' },
  { min: 5000, max: 9999, plain: 2475, drilled: 2725, kind: 'mayorista' },
  { min: 10000, max: Infinity, plain: 2295, drilled: 2545, kind: 'mayorista' },
]

/** Desde dónde sale el camión. El padrón de códigos postales guarda la distancia hasta acá. */
export const ORIGIN = { city: 'Luján', province: 'Buenos Aires', postalCode: '6700' }

/**
 * Las distancias del padrón son en línea recta. La ruta siempre da más, y en
 * Argentina el desvío ronda el 15% para los destinos habituales.
 *
 * Es sólo un dato a la vista —a qué distancia queda el destino, y el número que
 * después se le pasa a quien cotiza el flete—: no entra en ningún precio.
 */
export const ROAD_FACTOR = 1.15

/** Días que se sostiene el presupuesto, según las condiciones de la lista. */
export const QUOTE_VALID_DAYS = 7
