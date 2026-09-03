/** Pedidos: del presupuesto a la entrega. */
import { db, searchTerm, unwrap } from './client'
import { todayISO } from '../lib/format'

/**
 * Los estados en el orden en que ocurren.
 *
 * Es una lista y no un conjunto suelto porque la pantalla la usa para ofrecer
 * "el que sigue" sin que nadie tenga que acordarse del circuito. `cancelado`
 * queda aparte: se puede llegar desde cualquier lado y no es un paso adelante.
 */
export const ORDER_FLOW = ['presupuesto', 'confirmado', 'en_produccion', 'entregado']
export const ORDER_STATES = [...ORDER_FLOW, 'cancelado']

export const ORDER_STATE_LABELS = {
  presupuesto: 'Presupuesto',
  confirmado: 'Confirmado',
  en_produccion: 'En producción',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

/* Colores de la etiqueta de estado, para que todas las pantallas coincidan. */
export const ORDER_STATE_TONES = {
  presupuesto: 'neutral',
  confirmado: 'info',
  en_produccion: 'warn',
  entregado: 'good',
  cancelado: 'bad',
}

/**
 * Cuándo sale el pedido y cuánto apremia.
 *
 * Vive acá y no en cada pantalla porque el panel y la lista de pedidos tienen
 * que decir lo mismo: si una llamara "atrasado" a lo que la otra muestra en
 * gris, la que se mire primero decide qué se hace ese día.
 *
 * Sin fecha no es un dato faltante sino un estado: quedó reservado y falta
 * acordar el día. Sale en ámbar porque es lo que hay que destrabar llamando,
 * no algo para dejar pasar.
 */
export function entregaInfo(order) {
  const despacho = order.entrega === 'envio'

  const base = {
    despacho,
    modo: despacho ? 'Despachar' : 'Retira en fábrica',
    corto: despacho ? 'Despachar' : 'Retira',
    destino: despacho
      ? [order.localidad, order.provincia].filter(Boolean).join(', ')
      : null,
  }

  if (!order.fecha_entrega) {
    return { ...base, fecha: null, dias: null, cuando: 'A confirmar', tono: 'warn' }
  }

  const dias = diasHasta(order.fecha_entrega)

  return {
    ...base,
    fecha: order.fecha_entrega,
    dias,
    cuando:
      dias < 0
        ? `Atrasado ${-dias} ${-dias === 1 ? 'día' : 'días'}`
        : dias === 0
          ? 'Hoy'
          : dias === 1
            ? 'Mañana'
            : null,
    /* Tres días es lo que da para preparar mercadería y avisarle al transporte;
       de ahí en más todavía no es un problema de hoy. */
    tono: dias < 0 ? 'bad' : dias === 0 ? 'bad' : dias <= 3 ? 'warn' : 'neutral',
  }
}

/**
 * Días desde hoy hasta esa fecha, negativo si ya pasó.
 *
 * Las dos fechas se arman a medianoche local: comparar un `date` de Postgres
 * con `new Date()` a secas mezcla horas con días y hace que algo de hoy a la
 * tarde figure como vencido.
 */
function diasHasta(iso) {
  const hoy = new Date(`${todayISO()}T00:00:00`)
  const objetivo = new Date(`${iso}T00:00:00`)
  return Math.round((objetivo - hoy) / 86400000)
}

/** El estado siguiente del circuito, o null si ya está entregado o anulado. */
export function nextState(estado) {
  const index = ORDER_FLOW.indexOf(estado)
  if (index === -1 || index === ORDER_FLOW.length - 1) return null
  return ORDER_FLOW[index + 1]
}

export async function listOrders({ estado, entrega, search, limit = 300 } = {}) {
  let query = db()
    .from('orders_summary')
    .select('*')
    .order('numero', { ascending: false })
    .limit(limit)

  if (estado) query = query.eq('estado', estado)
  if (entrega) query = query.eq('entrega', entrega)

  const term = searchTerm(search)
  if (term) {
    // Buscar por número tiene que andar aunque escriban "#128": es como figura
    // en la pantalla y como lo dice el cliente por teléfono.
    const numero = Number.parseInt(term.replace('#', ''), 10)
    query = Number.isFinite(numero)
      ? query.or(`numero.eq.${numero},cliente_nombre.ilike.%${term}%`)
      : query.ilike('cliente_nombre', `%${term}%`)
  }

  return unwrap(await query)
}

/** El pedido con todo lo que la pantalla de detalle necesita mostrar junto. */
export async function getOrder(id) {
  const [order, items, payments] = await Promise.all([
    db().from('orders_summary').select('*').eq('id', id).single().then(unwrap),
    db()
      .from('order_items')
      .select('*, product:products(id, codigo, nombre, drilled)')
      .eq('order_id', id)
      .then(unwrap),
    db()
      .from('payments')
      .select('*')
      .eq('order_id', id)
      .order('fecha', { ascending: false })
      .then(unwrap),
  ])

  return { ...order, items, payments }
}

/**
 * El pedido que lleva ese número, o null si no hay ninguno.
 *
 * El número es cómo se llama a un pedido por teléfono y en un remito, así que
 * es también cómo se lo busca al imputarle un gasto.
 */
export async function findOrderByNumber(numero) {
  const rows = unwrap(
    await db().from('orders').select('id, numero').eq('numero', numero).limit(1),
  )
  return rows[0] ?? null
}

export async function createOrder(values) {
  return unwrap(await db().from('orders').insert(values).select('id, numero').single())
}

export async function updateOrder(id, changes) {
  return unwrap(await db().from('orders').update(changes).eq('id', id).select().single())
}

/**
 * Cambia el estado del pedido.
 *
 * El descuento de stock al entregar no se hace acá: lo hace un trigger en la
 * base. Ver `supabase/schema.sql`.
 */
export async function setOrderStatus(id, estado) {
  return updateOrder(id, { estado })
}

export async function deleteOrder(id) {
  unwrap(await db().from('orders').delete().eq('id', id))
}

export async function addOrderItem(item) {
  return unwrap(await db().from('order_items').insert(item).select().single())
}

export async function updateOrderItem(id, changes) {
  return unwrap(await db().from('order_items').update(changes).eq('id', id).select().single())
}

export async function deleteOrderItem(id) {
  unwrap(await db().from('order_items').delete().eq('id', id))
}
