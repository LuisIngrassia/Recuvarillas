/** Cobros. */
import { db, unwrap } from './client'

export const PAYMENT_METHODS = ['efectivo', 'transferencia', 'cheque', 'otro']

export const PAYMENT_METHOD_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  otro: 'Otro',
}

/**
 * Los cobros de todos los pedidos, para la pantalla de caja.
 *
 * Trae el estado del pedido porque no todo cobro es una venta: se puede cobrar
 * una seña contra un presupuesto que todavía no se cerró. Esa plata entró a la
 * caja pero no cuenta como venta en Rentabilidad, y sin este dato la pantalla
 * no podría avisarlo.
 */
export async function listPayments({ from, to, limit = 300 } = {}) {
  let query = db()
    .from('payments')
    .select('*, order:orders(numero, estado, customer:customers(nombre))')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (from) query = query.gte('fecha', from)
  if (to) query = query.lte('fecha', to)

  return unwrap(await query)
}

export async function addPayment(payment) {
  return unwrap(await db().from('payments').insert(payment).select().single())
}

export async function deletePayment(id) {
  unwrap(await db().from('payments').delete().eq('id', id))
}
