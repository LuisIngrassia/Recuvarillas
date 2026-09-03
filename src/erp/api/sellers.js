/** Vendedores y las comisiones que devengan. */
import { db, unwrap } from './client'

export async function listSellers({ soloActivos = false } = {}) {
  let query = db().from('sellers').select('*').order('nombre')
  if (soloActivos) query = query.eq('activo', true)
  return unwrap(await query)
}

export async function createSeller(values) {
  return unwrap(await db().from('sellers').insert(values).select().single())
}

export async function updateSeller(id, changes) {
  return unwrap(await db().from('sellers').update(changes).eq('id', id).select().single())
}

export async function deleteSeller(id) {
  unwrap(await db().from('sellers').delete().eq('id', id))
}

/**
 * Lo que devengó cada vendedor en un período, pedido por pedido.
 *
 * La comisión la calcula la base (ver `orders_summary` en `schema.sql`): es un
 * porcentaje de la mercadería, proporcional a lo que el cliente ya pagó. Acá
 * sólo se pide y se le pega el nombre del vendedor.
 *
 * El nombre se junta en JavaScript y no con un embed de PostgREST porque del
 * otro lado hay una vista, y las relaciones de una vista no siempre se pueden
 * inferir. Son dos consultas chicas contra tablas de decenas de filas: no vale
 * la pena atarse a que la inferencia funcione.
 */
export async function listCommissions({ desde, hasta } = {}) {
  const [orders, sellers] = await Promise.all([
    (async () => {
      let query = db()
        .from('orders_summary')
        .select(
          'id, numero, fecha, estado, cliente_nombre, mercaderia, total, pagado, comision, comision_pct, seller_id',
        )
        .not('seller_id', 'is', null)
        .neq('estado', 'presupuesto')
        .neq('estado', 'cancelado')
        .order('fecha', { ascending: false })

      if (desde) query = query.gte('fecha', desde)
      if (hasta) query = query.lte('fecha', hasta)

      return unwrap(await query)
    })(),
    listSellers(),
  ])

  const porId = new Map(sellers.map((seller) => [seller.id, seller.nombre]))

  return orders.map((order) => ({
    ...order,
    vendedor: porId.get(order.seller_id) ?? 'Vendedor borrado',
  }))
}

/** Las mismas filas agrupadas por vendedor, que es como se liquida. */
export function groupCommissions(rows) {
  const porVendedor = new Map()

  for (const row of rows) {
    const actual = porVendedor.get(row.seller_id) ?? {
      seller_id: row.seller_id,
      vendedor: row.vendedor,
      pedidos: 0,
      mercaderia: 0,
      comision: 0,
    }

    actual.pedidos += 1
    actual.mercaderia += Number(row.mercaderia)
    actual.comision += Number(row.comision)
    porVendedor.set(row.seller_id, actual)
  }

  return [...porVendedor.values()].sort((a, b) => b.comision - a.comision)
}
