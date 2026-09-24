/** Leads: todo el que preguntó, venga de donde venga, y en qué anda cada uno. */
import { db, searchTerm, unwrap } from './client'
import { addOrderItem, createOrder, deleteOrder } from './orders'

/**
 * Las etapas del embudo.
 *
 * Reemplazan a los cuatro estados de antes (`nuevo / contactado / ganado /
 * perdido`). "Contactado" tapaba tres situaciones que se trabajan distinto —le
 * mandé la lista, le mandé el presupuesto, está regateando— y no había forma de
 * saber en cuál de las tres se caía la venta.
 *
 * El orden de esta lista es el del kanban y el de las pantallas: es el camino
 * que recorre un lead de izquierda a derecha.
 */
export const LEAD_STATES = [
  'new',
  'qualifying',
  'qualified',
  'quoted',
  'negotiating',
  'closing',
  'won',
  'dormant',
  'lost',
]

/** Los estados en los que el lead todavía se trabaja. */
export const LEAD_STATES_ACTIVE = [
  'new',
  'qualifying',
  'qualified',
  'quoted',
  'negotiating',
  'closing',
]

/** Las columnas del kanban. `dormant` y `lost` van en paneles aparte. */
export const LEAD_BOARD = [...LEAD_STATES_ACTIVE, 'won']

export const LEAD_STATE_LABELS = {
  new: 'Nuevo',
  qualifying: 'En calificación',
  qualified: 'Calificado',
  quoted: 'Presupuesto enviado',
  negotiating: 'En negociación',
  closing: 'Por cerrar',
  won: 'Ganado',
  dormant: 'Dormido',
  lost: 'Perdido',
}

export const LEAD_STATE_TONES = {
  new: 'info',
  qualifying: 'info',
  qualified: 'warn',
  quoted: 'warn',
  negotiating: 'warn',
  closing: 'warn',
  won: 'good',
  dormant: 'neutral',
  lost: 'neutral',
}

/**
 * A dónde puede ir cada estado.
 *
 * Es una copia de `lead_transicion_valida` en `schema.sql`, y la de allá es la
 * que manda: ésta existe nada más que para saber qué botones ofrecer. Si las
 * dos se separan, el error que se ve es un rechazo de la base al guardar —
 * molesto, pero no un dato mal escrito.
 */
export const LEAD_TRANSITIONS = {
  new: ['qualifying', 'qualified', 'lost'],
  qualifying: ['qualified', 'quoted', 'dormant', 'lost'],
  qualified: ['quoted', 'dormant', 'lost'],
  quoted: ['negotiating', 'closing', 'dormant', 'lost'],
  negotiating: ['closing', 'quoted', 'dormant', 'lost'],
  closing: ['won', 'negotiating', 'dormant', 'lost'],
  dormant: ['qualified', 'quoted', 'lost', 'new'],
  won: [],
  lost: ['dormant'],
}

export function puedePasarA(desde, hasta) {
  return (LEAD_TRANSITIONS[desde] ?? []).includes(hasta)
}

/**
 * Qué campos hay que pedir antes de dejar entrar a un estado.
 *
 * Los valida la base igual (ver `leads_guard`), pero pedirlos antes convierte
 * un error rojo al guardar en un formulario que dice qué falta.
 */
export const LEAD_STATE_REQUIRES = {
  qualified: ['localidad', 'cantidad', 'agujereada'],
  quoted: ['quote_amount'],
  won: ['won_amount'],
  lost: ['lost_reason'],
}

/** Qué es el que pregunta. Define con qué lista de precios se le cotiza. */
export const LEAD_TYPES = ['end_user', 'installer', 'retailer', 'distributor']

export const LEAD_TYPE_LABELS = {
  end_user: 'Consumidor final',
  installer: 'Alambrador',
  retailer: 'Corralón / agropecuaria',
  distributor: 'Distribuidor',
}

/**
 * Los revendedores llevan lista mayorista; el resto, minorista.
 *
 * Está acá y no en la pantalla porque es la misma regla que decide el `tipo`
 * del cliente cuando el lead se convierte, y tenerla escrita dos veces es cómo
 * terminan cotizando distinto la ficha y el presupuesto.
 */
export const LEAD_TYPE_PRICE_LIST = {
  end_user: 'minorista',
  installer: 'minorista',
  retailer: 'mayorista',
  distributor: 'mayorista',
}

/**
 * De dónde salió el contacto.
 *
 * 'web' lo pone el simulador solo y es el único que se puede cargar sin sesión
 * (ver la política de `leads` en `schema.sql`). Los demás se eligen a mano.
 *
 * Esta lista tiene que coincidir con el enum `lead_source` de la base.
 */
export const LEAD_SOURCES = [
  'web',
  'whatsapp_organic',
  'instagram',
  'facebook',
  'tiktok',
  'referral',
  'cold_outreach',
  'phone',
  'fair',
  'other',
]

export const LEAD_SOURCE_LABELS = {
  web: 'Web',
  whatsapp_organic: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  referral: 'Referido',
  cold_outreach: 'Prospección',
  phone: 'Teléfono',
  fair: 'Feria',
  other: 'Otro',
}

export const LEAD_SOURCE_TONES = {
  web: 'info',
  whatsapp_organic: 'good',
  instagram: 'warn',
  facebook: 'warn',
  tiktok: 'warn',
  referral: 'good',
  cold_outreach: 'neutral',
  phone: 'neutral',
  fair: 'neutral',
  other: 'neutral',
}

/** Por qué se perdió. Sin esto, "perdido" no explica nada y no se corrige nada. */
export const LOST_REASONS = [
  'price',
  'freight',
  'lead_time',
  'chose_wood',
  'chose_competitor',
  'not_target',
  'no_response',
  'other',
]

export const LOST_REASON_LABELS = {
  price: 'Precio',
  freight: 'Costo de flete',
  lead_time: 'Plazo de entrega',
  chose_wood: 'Compró madera',
  chose_competitor: 'Compró a competidor',
  not_target: 'No era el target',
  no_response: 'Nunca contestó',
  other: 'Otro',
}

export const LEAD_EVENT_LABELS = {
  inbound_message: 'Mensaje recibido',
  auto_reply_sent: 'Respuesta automática',
  price_list_sent: 'Lista de precios enviada',
  quote_sent: 'Presupuesto enviado',
  followup_sent: 'Seguimiento',
  objection_raised: 'Objeción',
  sample_requested: 'Pidió muestra',
  status_change: 'Cambio de estado',
  note: 'Nota',
  reactivation_attempt: 'Intento de recontacto',
}

/** Los eventos que se pueden anotar a mano desde la ficha. */
export const LEAD_EVENT_TYPES = [
  'note',
  'inbound_message',
  'price_list_sent',
  'followup_sent',
  'objection_raised',
  'sample_requested',
]

/* -------------------------------------------------------------------------- */
/* Lecturas                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Trae los leads más nuevos primero, que es el orden en el que se trabajan.
 *
 * El tope existe para que la pantalla no se vuelva impracticable con el tiempo:
 * un lead de hace ocho meses no se llama, y para revisar el histórico está el
 * buscador por nombre o teléfono.
 */
export async function listLeads({
  status,
  source,
  owner,
  provincia,
  search,
  limit = 300,
} = {}) {
  let query = db()
    .from('leads')
    .select('*, customer:customers(id, nombre, tipo)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (source) query = query.eq('source', source)
  if (owner) query = query.eq('owner', owner)
  /* Por la clave normalizada y no por lo que se escribió: "Córdoba" y
     "Cordoba" son la misma provincia y el desplegable manda una sola. */
  if (provincia) query = query.eq('provincia_clave', provincia)

  const term = searchTerm(search)
  if (term) {
    query = query.or(
      `nombre.ilike.%${term}%,telefono.ilike.%${term}%,email.ilike.%${term}%`,
    )
  }

  return unwrap(await query)
}

/**
 * Las provincias que aparecen en los leads, para armar el desplegable.
 *
 * Consulta propia y no las provincias de la lista que se está viendo: esa corta
 * en las primeras 300, así que el desplegable no ofrecería las provincias que
 * quedaron afuera —justamente las que hay que poder elegir para ir a buscarlas.
 *
 * Son dos columnas de texto y una fila por lead; alcanza y sobra para un
 * negocio de este tamaño.
 */
export async function listLeadProvinces() {
  return unwrap(
    await db()
      .from('leads')
      .select('provincia, provincia_clave')
      .not('provincia_clave', 'is', null),
  )
}

/**
 * Lo que hay que hacer hoy.
 *
 * No es una lista de leads sino de acciones: lo que vence hoy o antes, más los
 * dormidos a los que les llegó la fecha de recontacto. El orden lo pone la
 * vista `leads_hoy` y es por cuán cerca está la plata, no por fecha: primero el
 * que está por cerrar, último el que recién entró.
 */
export async function listToday() {
  return unwrap(await db().from('leads_hoy').select('*'))
}

/** El tablero completo, para el kanban. */
export async function listPipeline({ limit = 500 } = {}) {
  return unwrap(
    await db()
      .from('leads')
      .select('*')
      .order('next_action_at', { ascending: true, nullsFirst: false })
      .limit(limit),
  )
}

export async function getLead(id) {
  return unwrap(
    await db()
      .from('leads')
      .select('*, customer:customers(id, nombre, tipo)')
      .eq('id', id)
      .single(),
  )
}

/** El historial de un lead, del más nuevo al más viejo. */
export async function listLeadEvents(leadId) {
  return unwrap(
    await db()
      .from('lead_events')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false }),
  )
}

/* -------------------------------------------------------------------------- */
/* Escrituras                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Alta a mano de un lead que no vino por la web.
 *
 * Los campos del simulador —cantidad, precio, kilómetros— quedan en null y está
 * bien: el que escribe por Instagram preguntando un precio todavía no cotizó
 * nada. Inventar una cantidad para llenar la fila sería peor que dejarla vacía,
 * porque después esa cifra se lee como si la hubiera pedido el cliente.
 *
 * La próxima acción la pone la base sola si no viene: todo lead activo tiene
 * que tener una, y que dependa de que la pantalla se acuerde es cómo terminan
 * apareciendo leads que nadie vuelve a mirar.
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
 * Anota algo en el historial.
 *
 * Los cambios de estado los escribe la base sola con un trigger; esto es para
 * lo demás: que mandó la lista, que pidió una muestra, que objetó el precio. Es
 * lo que después permite reconstruir por qué se cayó una venta.
 */
export async function addLeadEvent(leadId, { type, note }) {
  return unwrap(
    await db()
      .from('lead_events')
      .insert({ lead_id: leadId, type, note: note || null })
      .select()
      .single(),
  )
}

/**
 * Mueve un lead de etapa.
 *
 * Los campos obligatorios del estado destino van en `extra` y los valida la
 * base; acá se chequea antes nada más que para no mandar una escritura que se
 * sabe que va a rebotar.
 *
 * La fecha de la próxima acción se recalcula sola con el plazo de la etapa
 * nueva, salvo que se mande una en `extra`. Eso es a propósito: quien está
 * hablando con la persona sabe mejor que la tabla cuándo hay que volver a
 * llamarla, pero si no dice nada, algo tiene que quedar agendado igual.
 */
export async function changeLeadStatus(lead, status, extra = {}) {
  if (lead.status === status) return lead

  if (!puedePasarA(lead.status, status)) {
    throw new Error(
      `Un lead en "${LEAD_STATE_LABELS[lead.status]}" no puede pasar a "${LEAD_STATE_LABELS[status]}".`,
    )
  }

  const faltan = (LEAD_STATE_REQUIRES[status] ?? []).filter((campo) => {
    const valor = extra[campo] ?? lead[campo]
    return valor === null || valor === undefined || valor === ''
  })

  if (faltan.length) {
    throw new Error(`Faltan datos para pasar a "${LEAD_STATE_LABELS[status]}": ${faltan.join(', ')}.`)
  }

  return updateLead(lead.id, { status, ...extra })
}

/**
 * Registra un intento de recontacto sobre un lead dormido.
 *
 * El contador se sube acá y no en el barrido nocturno a propósito: si lo subiera
 * el job, un lead dormido llegaría a dos "intentos" en dos días sin que nadie lo
 * haya llamado, y a los dos intentos el job lo da por perdido. Contar acá es
 * contar los recontactos que de verdad ocurrieron.
 *
 * Si se reactiva, el contador **no** se resetea: haber costado tres recontactos
 * es parte de lo que hay que saber de ese lead.
 */
export async function registerReactivation(lead, { status, dormant_until, ...extra } = {}) {
  const changes = {
    reactivation_count: (lead.reactivation_count ?? 0) + 1,
    ...extra,
  }

  if (status) {
    if (!puedePasarA(lead.status, status)) {
      throw new Error(
        `Un lead en "${LEAD_STATE_LABELS[lead.status]}" no puede pasar a "${LEAD_STATE_LABELS[status]}".`,
      )
    }
    changes.status = status
  } else {
    /* Sigue dormido: se corre la fecha para volver a intentarlo más adelante. */
    changes.dormant_until = dormant_until ?? enDias(75)
  }

  const actualizado = await updateLead(lead.id, changes)
  await addLeadEvent(lead.id, {
    type: 'reactivation_attempt',
    note: status ? `Reactivado a ${LEAD_STATE_LABELS[status]}` : 'Sin respuesta, se reprograma',
  })

  return actualizado
}

function enDias(dias) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

/**
 * Corre el barrido de vencimientos.
 *
 * En la base hay un `pg_cron` que lo dispara a las 7, pero el proyecto puede no
 * tener la extensión habilitada, así que el ERP lo llama también al abrirse: lo
 * corre la primera persona que entra cada día. Es idempotente, así que llamarlo
 * de más no hace nada.
 */
export async function runLeadSla() {
  return unwrap(await db().rpc('run_lead_sla'))
}

/**
 * El lead abierto de un teléfono, si lo hay.
 *
 * Es la deduplicación: cuando vuelve a escribir alguien que ya está en la base,
 * se retoma el lead que está en vez de abrir uno nuevo, y el historial queda
 * entero en vez de partido en dos fichas. Los ganados no cuentan como abiertos:
 * el que ya compró y vuelve es una recompra, y ésa sí merece un lead nuevo para
 * que la métrica la pueda contar.
 */
export async function findOpenLeadByPhone(telefono) {
  if (!telefono) return null

  const filas = unwrap(
    await db()
      .from('leads')
      .select('*')
      .eq('telefono', telefono)
      .neq('status', 'won')
      .order('created_at', { ascending: false })
      .limit(1),
  )

  return filas[0] ?? null
}

/* -------------------------------------------------------------------------- */
/* Clientes y presupuestos                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Convierte un lead en cliente y deja los dos enlazados.
 *
 * Se copian los datos que el lead ya tiene en vez de pedirlos de nuevo: el
 * destino del envío suele ser la dirección del cliente, y quien atiende no
 * debería tener que volver a tipear lo que la persona ya escribió en la web.
 *
 * **Ya no lo pasa a "ganado".** Antes lo hacía, porque con cuatro estados hacer
 * cliente a alguien era lo más parecido a haberle vendido. Ahora ganar es una
 * etapa del embudo con monto y fecha, a la que sólo se llega desde "por cerrar":
 * tener ficha de cliente y haber comprado dejaron de ser lo mismo, y de hecho
 * nunca lo fueron —la ficha se crea para poder colgarle un presupuesto—.
 */
export async function convertLeadToCustomer(lead) {
  const customer = unwrap(
    await db().from('customers').insert(datosDeCliente(lead)).select().single(),
  )

  await updateLead(lead.id, { customer_id: customer.id })

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
      El tipo sale de qué es el que pregunta, que ahora el lead lo sabe: un
      corralón o un distribuidor son revendedores y llevan lista mayorista; el
      consumidor final y el alambrador, minorista.

      Antes era siempre minorista porque el lead no tenía dónde decirlo, y
      marcar mayorista por la cantidad cotizada estaba mal: una compra grande de
      una sola vez no es un revendedor. Con `lead_type` cargado eso ya no hay
      que adivinarlo. Sin cargar, se sigue asumiendo minorista, que es el caso
      común y el que no regala margen.
    */
    tipo: LEAD_TYPE_PRICE_LIST[lead.lead_type] ?? 'minorista',
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
 * este presupuesto.
 *
 * El precio llega desde afuera en vez de calcularse acá porque no siempre es el
 * de la lista: si el cliente vio otro número en la web, a veces se le respeta
 * ese. Esa decisión la toma quien atiende, no esta función.
 *
 * Si la mercadería no entra, el pedido se borra. Un presupuesto vacío es peor
 * que ninguno: queda en la lista de pedidos como si existiera y nadie sabe qué
 * era.
 */
export async function createQuoteFromLead(
  lead,
  { customerId, productId, agujereada, cantidad, precioUnitario, leadChanges },
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
      agujereada,
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

  const monto = Number(cantidad) * Number(precioUnitario)

  await moverAPresupuestado(lead, monto, { customer_id: clienteId, ...leadChanges })

  await addLeadEvent(lead.id, {
    type: 'quote_sent',
    /* El acabado va en el historial: es la mitad del precio y sin él, tres
       presupuestos al mismo lead se leen como el mismo número repetido. */
    note: `Presupuesto #${order.numero ?? ''} por ${cantidad} ${
      agujereada ? 'agujereadas' : 'sin agujerear'
    }`.trim(),
  })

  return order
}

/**
 * Deja el lead en "presupuesto enviado", pasando por donde haya que pasar.
 *
 * Un lead recién entrado no puede saltar directo a presupuestado: la matriz de
 * transiciones no lo permite, y con razón, porque saltearse la calificación es
 * justamente lo que hace que después no se sepa dónde se cayó la venta. Cuando
 * el lead está en "nuevo" se lo pasa antes por "en calificación", que es lo que
 * de verdad ocurrió: alguien lo atendió y le sacó los datos.
 *
 * Desde "por cerrar" no se vuelve a presupuestado —la matriz tampoco lo
 * permite— así que en ese caso se actualiza el monto y se deja el estado quieto.
 * Es el caso de §8.4 de la spec: al lead se le pueden mandar varios
 * presupuestos, el campo guarda el último y el historial los guarda a todos.
 */
async function moverAPresupuestado(lead, monto, extra) {
  const cambios = {
    quote_amount: monto,
    quote_sent_at: new Date().toISOString(),
    ...extra,
  }

  if (lead.status === 'new') {
    await updateLead(lead.id, { status: 'qualifying' })
    return updateLead(lead.id, { status: 'quoted', ...cambios })
  }

  if (puedePasarA(lead.status, 'quoted')) {
    return updateLead(lead.id, { status: 'quoted', ...cambios })
  }

  return updateLead(lead.id, cambios)
}

/**
 * Engancha el lead a un cliente que ya existe.
 *
 * Es el caso del que ya te compró y vuelve a preguntar, esta vez por Instagram.
 * Sin esto, "Hacer cliente" creaba uno nuevo y quedaban dos fichas de la misma
 * persona con la cuenta corriente partida al medio: la duplicación que uno
 * quiere evitar no la genera tener dos tablas, la genera no poder decir "este
 * es aquel".
 *
 * Tampoco toca el estado, por lo mismo que `convertLeadToCustomer`: enganchar
 * una ficha no es haber vendido.
 */
export async function linkLeadToCustomer(leadId, customerId) {
  return updateLead(leadId, { customer_id: customerId })
}

/* -------------------------------------------------------------------------- */
/* Métricas                                                                    */
/* -------------------------------------------------------------------------- */

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

/**
 * Todo el tablero de métricas del embudo, de una sola vez.
 *
 * Van juntas porque la pantalla las muestra juntas y pedirlas de a una haría
 * seis viajes para dibujar una sola sección. Se calculan sobre `lead_events` y
 * no sobre el estado actual: un lead perdido hoy tiene status 'lost' y nada
 * más, pero su historial cuenta que llegó a estar por cerrar, y ése es
 * justamente el dato que dice dónde se cae la venta.
 */
export async function loadFunnelMetrics({ desde, hasta } = {}) {
  const cliente = db()

  let outcomes = cliente.from('lead_outcomes').select('*')
  if (desde) outcomes = outcomes.gte('mes', desde)
  if (hasta) outcomes = outcomes.lte('mes', hasta)

  let motivos = cliente.from('lead_lost_reasons').select('*')
  if (desde) motivos = motivos.gte('mes', desde)
  if (hasta) motivos = motivos.lte('mes', hasta)

  const [funnel, tiempos, transiciones, resultados, perdidas, reactivaciones] = await Promise.all([
    cliente.from('lead_funnel').select('*'),
    cliente.from('lead_stage_times').select('*'),
    cliente.from('lead_transitions').select('*'),
    outcomes,
    motivos,
    cliente.from('lead_reactivations').select('*').single(),
  ])

  return {
    funnel: unwrap(funnel),
    tiempos: unwrap(tiempos),
    transiciones: unwrap(transiciones),
    resultados: unwrap(resultados),
    perdidas: unwrap(perdidas),
    reactivaciones: unwrap(reactivaciones),
  }
}

/**
 * La conversión de cada paso del embudo.
 *
 * "De los que llegaron a presupuestado, cuántos siguieron" — que es distinto de
 * "cuántos hay hoy en presupuestado". El denominador sale de `lead_funnel`
 * (cuántos pasaron alguna vez por la etapa) y el numerador, de las transiciones
 * que salieron de ahí hacia adelante.
 */
export function conversionPorEtapa({ funnel, transiciones }) {
  const alcanzados = new Map(funnel.map((f) => [f.status, f.leads]))
  const orden = LEAD_STATES_ACTIVE

  return orden.map((status, i) => {
    const siguientes = orden.slice(i + 1).concat('won')
    const avanzaron = transiciones
      .filter((t) => t.from_status === status && siguientes.includes(t.to_status))
      .reduce((suma, t) => suma + t.veces, 0)

    const llegaron = alcanzados.get(status) ?? 0

    return {
      status,
      llegaron,
      avanzaron,
      conversion: llegaron ? avanzaron / llegaron : null,
    }
  })
}
