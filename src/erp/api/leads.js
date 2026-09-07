/** Leads: todo el que preguntó, venga de donde venga. */
import { db, searchTerm, unwrap } from './client'
import { addOrderItem, createOrder, deleteOrder } from './orders'

/**
 * De dónde salió el contacto.
 *
 * 'web' lo pone el simulador solo y es el único que se puede cargar sin sesión
 * (ver la política de `leads` en `schema.sql`). Los demás se eligen a mano
 * cuando alguien escribe por Instagram, llama o lo trae un conocido.
 *
 * Esta lista tiene que coincidir con el `check` de `leads.origen`.
 */
export const LEAD_ORIGINS = [
  'web',
  'instagram',
  'whatsapp',
  'telefono',
  'referido',
  'feria',
  'otro',
]

export const LEAD_ORIGIN_LABELS = {
  web: 'Web',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  telefono: 'Teléfono',
  referido: 'Referido',
  feria: 'Feria',
  otro: 'Otro',
}

export const LEAD_ORIGIN_TONES = {
  web: 'info',
  instagram: 'warn',
  whatsapp: 'good',
  telefono: 'neutral',
  referido: 'good',
  feria: 'neutral',
  otro: 'neutral',
}

export const LEAD_STATES = ['nuevo', 'contactado', 'ganado', 'perdido']

export const LEAD_STATE_LABELS = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  ganado: 'Ganado',
  perdido: 'Perdido',
}

export const LEAD_STATE_TONES = {
  nuevo: 'info',
  contactado: 'warn',
  ganado: 'good',
  perdido: 'neutral',
}

/**
 * Trae los leads más nuevos primero, que es el orden en el que se trabajan.
 *
 * El tope existe para que la pantalla no se vuelva impracticable con el tiempo:
 * un lead de hace ocho meses no se llama, y para revisar el histórico está el
 * buscador por nombre o teléfono.
 */
export async function listLeads({ estado, origen, search, limit = 300 } = {}) {
  let query = db()
    .from('leads')
    .select('*, customer:customers(id, nombre, tipo)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (estado) query = query.eq('estado', estado)
  if (origen) query = query.eq('origen', origen)

  const term = searchTerm(search)
  if (term) {
    query = query.or(
      `nombre.ilike.%${term}%,telefono.ilike.%${term}%,email.ilike.%${term}%`,
    )
  }

  return unwrap(await query)
}

/**
 * Alta a mano de un lead que no vino por la web.
 *
 * Los campos del simulador —cantidad, precio, kilómetros— quedan en null y está
 * bien: el que escribe por Instagram preguntando un precio todavía no cotizó
 * nada. Inventar una cantidad para llenar la fila sería peor que dejarla vacía,
 * porque después esa cifra se lee como si la hubiera pedido el cliente.
 */
export async function createLead(values) {
  return unwrap(await db().from('leads').insert(values).select().single())
}

export async function updateLead(id, changes) {
  return unwrap(await db().from('leads').update(changes).eq('id', id).select().single())
}

export async function deleteLead(id) {
  unwrap(await db().from('leads').delete().eq('id', id))
}

/**
 * Convierte un lead en cliente y deja los dos enlazados.
 *
 * Se copian los datos que el lead ya tiene en vez de pedirlos de nuevo: el
 * destino del envío suele ser la dirección del cliente, y quien atiende no
 * debería tener que volver a tipear lo que la persona ya escribió en la web.
 *
 * El lead queda en 'ganado' porque convertirlo es, justamente, el momento en
 * que la venta se dio por buena.
 */
export async function convertLeadToCustomer(lead) {
  const customer = unwrap(
    await db().from('customers').insert(datosDeCliente(lead)).select().single(),
  )

  await updateLead(lead.id, { customer_id: customer.id, estado: 'ganado' })

  return customer
}

/**
 * Los datos del lead que son también datos del cliente.
 *
 * Está aparte porque hay dos formas de terminar con una ficha nueva —hacerlo
 * cliente, o armarle el presupuesto— y las dos tienen que copiar lo mismo. Que
 * una copiara el email y la otra no es la clase de diferencia que nadie nota
 * hasta que hace falta el dato.
 */
function datosDeCliente(lead) {
  return {
    nombre: lead.nombre,
    /*
      Siempre minorista. Antes se marcaba mayorista a quien cotizaba mil o
      más, cuando 'mayorista' quería decir "le toca el tramo de volumen".
      Ahora quiere decir "es revendedor": lista más barata y sin comisión
      para el vendedor, porque se supone que vuelve todos los meses.

      Una compra grande de una sola vez no es eso, y el que decide que
      alguien pasa a revendedor es una persona, no la cantidad que cotizó
      la primera vez. Se cambia en la ficha del cliente.
    */
    tipo: 'minorista',
    telefono: lead.telefono,
    email: lead.email,
    localidad: lead.localidad,
    provincia: lead.provincia,
    codigo_postal: lead.codigo_postal,
  }
}

/**
 * Arma el presupuesto de lo que el lead cotizó.
 *
 * Es el atajo de un camino que se hacía a mano: convertirlo en cliente, entrar
 * a su ficha, crear un pedido, elegir el producto, tipear la cantidad y tipear
 * el precio. Todo eso ya está en el lead —lo escribió la persona en el
 * simulador de la web— y volver a tipearlo es donde se cuelan los errores.
 *
 * El cliente se crea acá porque un pedido necesita uno: la tabla no admite un
 * pedido sin dueño. Eso no lo vuelve cliente de verdad. Cliente es el que
 * completó un pedido, y hasta entonces la ficha es nada más que dónde colgar
 * este presupuesto; por eso el lead pasa de 'nuevo' a 'contactado' y no a
 * 'ganado'. Presupuestar es haberlo trabajado, no haberle vendido: 'ganado' lo
 * pone quien confirma el pedido.
 *
 * El precio llega desde afuera en vez de calcularse acá porque no siempre es el
 * de la lista: si el cliente vio otro número en la web, a veces se le respeta
 * ese. Esa decisión la toma quien atiende, no esta función.
 *
 * `leadChanges` es para cuando el que atiende corrige, en el mismo momento,
 * cuántas quiere: el lead tiene que quedar diciendo lo que la persona pide
 * ahora y no lo que pidió hace tres semanas. Va junto al resto de la
 * actualización y no en una llamada aparte para que el lead no pueda quedar a
 * medio corregir.
 *
 * Si la mercadería no entra, el pedido se borra. Un presupuesto vacío es peor
 * que ninguno: queda en la lista de pedidos como si existiera y nadie sabe qué
 * era.
 */
export async function createQuoteFromLead(
  lead,
  { customerId, productId, cantidad, precioUnitario, leadChanges },
) {
  let clienteId = customerId ?? lead.customer_id ?? null

  if (!clienteId) {
    const customer = unwrap(
      await db().from('customers').insert(datosDeCliente(lead)).select('id').single(),
    )
    clienteId = customer.id
  }

  const order = await createOrder({
    customer_id: clienteId,
    lead_id: lead.id,
    tipo: 'venta',
    entrega: lead.entrega,
    localidad: lead.localidad,
    provincia: lead.provincia,
    codigo_postal: lead.codigo_postal,
    kilometros: lead.kilometros,
  })

  try {
    await addOrderItem({
      order_id: order.id,
      product_id: productId,
      cantidad,
      precio_unitario: precioUnitario,
    })
  } catch (error) {
    /* Si tampoco se puede borrar, el error que importa es el de arriba. */
    try {
      await deleteOrder(order.id)
    } catch {
      /* nada que hacer */
    }
    throw error
  }

  await updateLead(lead.id, {
    customer_id: clienteId,
    estado: lead.estado === 'nuevo' ? 'contactado' : lead.estado,
    ...leadChanges,
  })

  return order
}

/**
 * Engancha el lead a un cliente que ya existe.
 *
 * Es el caso del que ya te compró y vuelve a preguntar, esta vez por Instagram.
 * Sin esto, "Hacer cliente" creaba uno nuevo y quedaban dos fichas de la misma
 * persona con la cuenta corriente partida al medio: la duplicación que uno
 * quiere evitar no la genera tener dos tablas, la genera no poder decir "este
 * es aquel".
 */
export async function linkLeadToCustomer(leadId, customerId) {
  return updateLead(leadId, { customer_id: customerId, estado: 'ganado' })
}

/**
 * Cuántos contactos trajo cada canal en un período y cuánto facturaron.
 *
 * La cuenta la hace la vista `leads_por_origen`; acá sólo se suman los meses
 * pedidos, porque la pantalla mira un rango y la vista está abierta por mes.
 */
export async function listLeadsByOrigin({ desde, hasta } = {}) {
  let query = db().from('leads_por_origen').select('*')

  if (desde) query = query.gte('mes', desde)
  if (hasta) query = query.lte('mes', hasta)

  const filas = unwrap(await query)

  const porOrigen = new Map()

  for (const fila of filas) {
    const actual = porOrigen.get(fila.origen) ?? {
      origen: fila.origen,
      leads: 0,
      ganados: 0,
      perdidos: 0,
      sin_contactar: 0,
      facturado: 0,
    }

    actual.leads += fila.leads
    actual.ganados += fila.ganados
    actual.perdidos += fila.perdidos
    actual.sin_contactar += fila.sin_contactar
    actual.facturado += Number(fila.facturado)
    porOrigen.set(fila.origen, actual)
  }

  return [...porOrigen.values()].sort((a, b) => b.leads - a.leads)
}
