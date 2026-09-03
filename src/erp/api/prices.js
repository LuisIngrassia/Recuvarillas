/** La lista de precios, que es la que ve también la landing. */
import { db, unwrap } from './client'
import { invalidatePriceTiers } from '../../lib/priceTiers'

export async function listTiers() {
  return unwrap(await db().from('price_tiers').select('*').order('min_qty'))
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
