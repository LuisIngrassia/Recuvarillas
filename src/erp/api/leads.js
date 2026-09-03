/** Leads: todo el que preguntó, venga de donde venga. */
import { db, searchTerm, unwrap } from './client'

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
    .select('*, customer:customers(id, nombre)')
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
    await db()
      .from('customers')
      .insert({
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
      })
      .select()
      .single(),
  )

  await updateLead(lead.id, { customer_id: customer.id, estado: 'ganado' })

  return customer
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
