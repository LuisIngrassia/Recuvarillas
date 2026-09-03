/** Clientes y su cuenta corriente. */
import { db, searchTerm, unwrap } from './client'

/**
 * El padrón con el saldo de cada uno.
 *
 * Sale de la vista `customer_balances` y no de la tabla, porque la pregunta que
 * se le hace a esta pantalla casi siempre es "¿quién me debe?". Calcularlo en
 * la base evita traerse todos los pedidos al navegador para sumarlos acá.
 */
export async function listCustomers({ search, onlyDebtors } = {}) {
  let query = db().from('customer_balances').select('*').order('nombre')

  const term = searchTerm(search)
  if (term) query = query.or(`nombre.ilike.%${term}%,telefono.ilike.%${term}%`)
  if (onlyDebtors) query = query.gt('saldo', 0)

  return unwrap(await query)
}

/** Lista mínima para los selectores de cliente al cargar un pedido. */
export async function listCustomerOptions() {
  return unwrap(await db().from('customers').select('id, nombre, tipo').order('nombre'))
}

export async function getCustomer(id) {
  const [customer, balance, orders, leads] = await Promise.all([
    db().from('customers').select('*').eq('id', id).single().then(unwrap),
    db().from('customer_balances').select('*').eq('customer_id', id).maybeSingle().then(unwrap),
    db()
      .from('orders_summary')
      .select('*')
      .eq('customer_id', id)
      .order('fecha', { ascending: false })
      .then(unwrap),
    // Lo que había cotizado antes de comprar: sirve para entender qué esperaba.
    db()
      .from('leads')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .then(unwrap),
  ])

  return { ...customer, balance, orders, leads }
}

export async function createCustomer(values) {
  return unwrap(await db().from('customers').insert(values).select().single())
}

export async function updateCustomer(id, changes) {
  return unwrap(await db().from('customers').update(changes).eq('id', id).select().single())
}

/**
 * Borrar un cliente falla si tiene pedidos, y está bien que así sea: el
 * historial de ventas no se puede quedar sin dueño. La base lo impide con
 * `on delete restrict` y el mensaje traducido lo explica.
 */
export async function deleteCustomer(id) {
  unwrap(await db().from('customers').delete().eq('id', id))
}
