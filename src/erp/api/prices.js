/**
 * Las listas de precios: una por producto.
 *
 * Antes era **la** lista, porque había un solo producto. Ahora cada uno tiene
 * sus escalones, y la landing lee los del que esté marcado para la web.
 */
import { db, unwrap } from './client'
import { invalidatePriceTiers } from '../../lib/priceTiers'

/**
 * Los escalones de un producto.
 *
 * Sin producto devuelve la lista vacía y no todos los escalones de todos: una
 * pantalla que todavía no eligió producto no tiene que mostrar precios
 * mezclados de dos cosas distintas, que es como se cotiza mal sin enterarse.
 */
export async function listTiers(productId) {
  if (!productId) return []

  return unwrap(
    await db().from('price_tiers').select('*').eq('product_id', productId).order('min_qty'),
  )
}

/**
 * Cualquier cambio en la lista invalida la copia que tiene cargada la web, así
 * el simulador de la landing empieza a cotizar con los precios nuevos sin
 * esperar a que alguien recargue.
 */
function priceChanged(result) {
  invalidatePriceTiers()
  return result
}

export async function createTier(values) {
  return priceChanged(
    unwrap(await db().from('price_tiers').insert(values).select().single()),
  )
}

export async function updateTier(id, changes) {
  return priceChanged(
    unwrap(
      await db()
        .from('price_tiers')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    ),
  )
}

export async function deleteTier(id) {
  priceChanged(unwrap(await db().from('price_tiers').delete().eq('id', id)))
}
