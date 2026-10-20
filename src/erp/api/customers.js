/** Clientes y su cuenta corriente. */
import { db, searchTerm, unwrap } from './client'
import { clave } from './shipping'
import { findPostalCode, loadPostalCodes } from '../../lib/postalCodes'
import { ROAD_FACTOR } from '../../data/pricing'

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
 * La dirección del cliente es la de sus leads.
 *
 * Una vez convertido, la dirección se corrige en la ficha del cliente: es la
 * que se abre con «Ver cliente», y la del lead no tiene dónde editarse. Si no
 * se copia, el lead se queda con la vieja, y el filtro por provincia, la lista
 * y las rutas de viaje —que miran el lead— lo siguen ubicando donde no está.
 *
 * Se copia tal cual, también los vacíos: si el cliente quedó sin código postal,
 * dejarle al lead uno que ya no corresponde sería peor que no tener ninguno.
 * Sólo se toca lo que cambió, para no reescribir leads que ya coinciden.
 *
 * Los kilómetros se recalculan con el código postal nuevo, igual que en la web:
 * con la dirección cambiada, los de antes son de otro lugar. Si el código no
 * está en el padrón quedan en null, que es «no se sabe», y no un número viejo.
 */
async function completarLeads(customer) {
  const leads = unwrap(
    await db()
      .from('leads')
      .select('id, localidad, provincia, codigo_postal')
      .eq('customer_id', customer.id),
  )

  const mismo = (a, b) => clave(a) === clave(b)
  const cambiados = leads.filter(
    (lead) =>
      !mismo(lead.localidad, customer.localidad) ||
      !mismo(lead.provincia, customer.provincia) ||
      String(lead.codigo_postal ?? '').trim() !== String(customer.codigo_postal ?? '').trim(),
  )
  if (cambiados.length === 0) return

  const padron = await loadPostalCodes()
  const lugar = findPostalCode(padron, String(customer.codigo_postal ?? '').match(/\d{4}/)?.[0])

  const cambios = {
    localidad: customer.localidad,
    provincia: customer.provincia,
    codigo_postal: customer.codigo_postal,
    kilometros: lugar ? Math.round(lugar.km * ROAD_FACTOR) : null,
  }

  unwrap(
    await db()
      .from('leads')
      .update(cambios)
      .in('id', cambiados.map((lead) => lead.id)),
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
