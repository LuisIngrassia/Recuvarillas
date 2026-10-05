/**
 * A quién se le compra lo que no se fabrica acá.
 *
 * Lo que se compra a cada uno sale de dos lados: los productos que lo tienen
 * como proveedor habitual, y las compras cargadas en Stock, que son las que
 * dicen cuándo y a cuánto se le compró de verdad.
 */
import { db, unwrap } from './client'

export async function listSuppliers({ soloActivos = false } = {}) {
  let query = db().from('suppliers').select('*').order('nombre')
  if (soloActivos) query = query.eq('activo', true)
  return unwrap(await query)
}

export async function createSupplier(values) {
  return unwrap(await db().from('suppliers').insert(values).select().single())
}

export async function updateSupplier(id, changes) {
  return unwrap(await db().from('suppliers').update(changes).eq('id', id).select().single())
}

/**
 * Borrar un proveedor no borra nada más: sus productos quedan sin proveedor
 * habitual y sus compras siguen en el historial de stock, sin nombre. Las dos
 * claves son `on delete set null` en la base.
 */
export async function deleteSupplier(id) {
  unwrap(await db().from('suppliers').delete().eq('id', id))
}

/** Las últimas compras, de todos o de un proveedor. */
export async function listPurchases({ supplierId, limit = 100 } = {}) {
  let query = db()
    .from('stock_movements')
    .select('id, fecha, cantidad, costo_unitario, nota, supplier_id, product:products(nombre, unidad)')
    .eq('tipo', 'compra')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (supplierId) query = query.eq('supplier_id', supplierId)

  return unwrap(await query)
}
