/**
 * A cuánto se cotiza un producto, sea cual sea.
 *
 * Lo que fabricamos va por escalones —y con dos precios si se agujerea—; lo
 * que se compra hecho tiene un precio único en su ficha. Los leads lo
 * necesitan para cualquier producto, no sólo para el de la web: el que
 * pregunta por postes se presupuesta con los precios del poste.
 */
import { useMemo } from 'react'
import { listTiers } from '../api/prices'
import { cotizaPorLista, listProducts } from '../api/products'
import { tierFromRow } from '../../lib/priceTiers'
import { tierFor } from '../../lib/quote'
import { useAsync } from './useAsync'

/** Los escalones del producto, ya en el formato de `quote.js`. */
export function useEscalones(producto) {
  const porLista = cotizaPorLista(producto)
  const query = useAsync(
    async () => (producto && porLista ? (await listTiers(producto.id)).map(tierFromRow) : []),
    [producto?.id, porLista],
  )
  return useMemo(() => query.data ?? [], [query.data])
}

/**
 * El precio de lista por unidad, o null si no hay con qué calcularlo: un
 * fabricado sin escalones cargados, o un comprado sin precio en la ficha.
 *
 * El agujereado sólo cuenta si el producto se agujerea: un poste que no se
 * agujerea no tiene recargo, diga lo que diga el lead.
 */
export function precioDeLista(producto, escalones, { cantidad, agujereada, kind = 'minorista' }) {
  if (!producto) return null

  if (!cotizaPorLista(producto)) {
    return producto.precio == null ? null : Number(producto.precio)
  }

  if (!cantidad || !escalones.length) return null
  const tier = tierFor(cantidad, escalones, kind)
  if (!tier) return null
  return agujereada && producto.se_agujerea !== false ? tier.drilled : tier.plain
}

/*
  Una sola carga de productos para las tarjetas y filas de leads, que son
  muchas y sólo necesitan saber cómo se llama lo que pidió cada uno. Se
  comparte la promesa entre todas en vez de pedir la lista una vez por
  tarjeta.
*/
let productosCompartidos = null

export function useProductosCompartidos() {
  const query = useAsync(() => {
    productosCompartidos ??= listProducts({ todos: true }).catch((error) => {
      productosCompartidos = null
      throw error
    })
    return productosCompartidos
  }, [])
  return query.data ?? []
}
