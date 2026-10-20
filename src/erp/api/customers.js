/** Clientes y su cuenta corriente. */
import { db, searchTerm, unwrap } from './client'
import { clave } from './shipping'

/**
 * El padrón con el saldo de cada uno.
 *
 * Sale de la vista `customer_balances` y no de la tabla, porque la pregunta que
 * se le hace a esta pantalla casi siempre es "¿quién me debe?". Calcularlo en
 * la base evita traerse todos los pedidos al navegador para sumarlos acá.
 */
/**
 * Quién es cliente y quién todavía no.
 *
 * `pedidos` cuenta lo que no está en presupuesto ni anulado, así que en cero
 * quiere decir que nunca compró: se le armó un presupuesto, se le abrió la
 * ficha porque un pedido necesita dueño, y ahí quedó.
 *
 * Es importante que la ficha exista igual —sin ella no hay dónde colgar el
 * presupuesto ni cómo enganchar al que vuelve a preguntar— y es importante que
 * no se llame cliente. Cliente es el que compró.
 */
export const esProspecto = (customer) => Number(customer.pedidos) === 0

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
  const customer = unwrap(
    await db().from('customers').update(changes).eq('id', id).select().single(),
  )
  await completarLeads(customer)
  return customer
}

/**
 * Lo que se carga en la ficha del cliente llega a sus leads, si les falta.
 *
 * Una vez convertido, la dirección se corrige en la ficha del cliente: es la
 * que se abre con «Ver cliente». Sin esto el lead seguía sin provincia, y el
 * filtro por provincia y las rutas de viaje —que miran el lead— no lo veían.
 *
 * Sólo se llenan los vacíos. Lo que el lead ya tiene es lo que cotizó en su
 * momento y no se pisa. La provincia, además, se completa sólo si la localidad
 * del lead es la misma que la del cliente (o no tiene): ponerle «La Pampa» a un
 * lead de Bombal porque el cliente se mudó sería inventar un dato.
 */
async function completarLeads(customer) {
  const mismaLocalidad = (texto) =>
    !texto || clave(texto) === clave(customer.localidad)

  const leads = unwrap(
    await db()
      .from('leads')
      .select('id, localidad, provincia, codigo_postal')
      .eq('customer_id', customer.id),
  )

  await Promise.all(
    leads.map((lead) => {
      const cambios = {}
      if (!lead.localidad && customer.localidad) cambios.localidad = customer.localidad
      if (!lead.provincia && customer.provincia && mismaLocalidad(lead.localidad)) {
        cambios.provincia = customer.provincia
      }
      if (!lead.codigo_postal && customer.codigo_postal && mismaLocalidad(lead.localidad)) {
        cambios.codigo_postal = customer.codigo_postal
      }
      if (Object.keys(cambios).length === 0) return null
      return db().from('leads').update(cambios).eq('id', lead.id).then(unwrap)
    }),
  )
}

/**
 * Borrar un cliente falla si tiene pedidos, y está bien que así sea: el
 * historial de ventas no se puede quedar sin dueño. La base lo impide con
 * `on delete restrict` y el mensaje traducido lo explica.
 */
export async function deleteCustomer(id) {
  unwrap(await db().from('customers').delete().eq('id', id))
}
