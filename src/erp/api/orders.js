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

/**
 * Los estados de algo que ya se vendió.
 *
 * El presupuesto es el mismo registro que el pedido —por eso confirmar una
 * venta no obliga a recargar nada— pero no es lo mismo de mirar: uno es trabajo
 * comercial que puede no ir a ningún lado, el otro es mercadería que hay que
 * fabricar, despachar y cobrar. Mezclados en una lista, la que apremia se
 * pierde entre la que no.
 *
 * Así que la tabla es una y la pantalla son dos. Esta constante es el corte.
 */
export const ORDER_SOLD_STATES = ORDER_STATES.filter((estado) => estado !== 'presupuesto')

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
 * Hace cuánto que un presupuesto está sin respuesta.
 *
 * En un pedido lo que apremia es la fecha de salida; en un presupuesto no hay
 * salida todavía, y lo único que dice si sigue vivo es cuánto hace que se
 * mandó. Sin esa columna la lista ordena por número y un presupuesto de hace
 * dos meses se ve igual que el de ayer.
 *
 * El corte de los diez días es el mismo con el que la base duerme a un lead
 * presupuestado. Que las dos pantallas usen el mismo número es lo que evita que
 * el embudo diga "dormido" mientras la lista de presupuestos lo muestra como si
 * estuviera en juego.
 */
export function antiguedadDe(order) {
  const dias = -diasHasta(order.fecha)

  return {
    dias,
    texto: dias <= 0 ? 'Hoy' : dias === 1 ? 'Ayer' : `Hace ${dias} días`,
    tono: dias > 10 ? 'bad' : dias > 3 ? 'warn' : 'neutral',
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

/**
 * @param vista  'presupuestos' trae sólo los que todavía no se vendieron;
 *               'pedidos', todo lo demás. Sin vista, trae los dos.
 */
export async function listOrders({ vista, estado, entrega, search, limit = 300 } = {}) {
  let query = db()
    .from('orders_summary')
    .select('*')
    .order('numero', { ascending: false })
    .limit(limit)

  if (vista === 'presupuestos') query = query.eq('estado', 'presupuesto')
  if (vista === 'pedidos') query = query.neq('estado', 'presupuesto')

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

/**
 * Cuántos hay de cada lado, para el número de cada solapa.
 *
 * No es decoración: una pila de presupuestos que no baja nunca es el dato que
 * dice que se está cotizando mucho y cerrando poco, y en una lista mezclada eso
 * no se ve. Que esté en la solapa lo pone a la vista sin que haya que ir a
 * buscarlo a ninguna métrica.
 *
 * Se piden con `head` y `count`: Postgres cuenta del lado del servidor y no
 * viaja ninguna fila. Traer las dos listas para contarlas sería bajar el padrón
 * entero cada vez que se abre la pantalla.
 */
export async function countOrders() {
  const contar = async (filtrar) => {
    const respuesta = await filtrar(
      db().from('orders_summary').select('id', { count: 'exact', head: true }),
    )
    /* `unwrap` devuelve `data`, que en un `head` viene vacío: se lo llama por el
       otro lado, que es traducir el error de PostgREST a algo que se entienda.
       El número está en `count`, al lado de los datos que no vinieron. */
    unwrap(respuesta)
    return respuesta.count ?? 0
  }

  const [presupuestos, pedidos] = await Promise.all([
    contar((query) => query.eq('estado', 'presupuesto')),
    contar((query) => query.neq('estado', 'presupuesto')),
  ])

  return { presupuestos, pedidos }
}

/** El pedido con todo lo que la pantalla de detalle necesita mostrar junto. */
export async function getOrder(id) {
  const [order, items, services, payments] = await Promise.all([
    db().from('orders_summary').select('*').eq('id', id).single().then(unwrap),
    db()
      .from('order_items')
      .select('*, product:products(id, codigo, nombre)')
      .eq('order_id', id)
      .then(unwrap),
    /* Las horas del trabajo de reciclado. En una venta vienen vacías. */
    db()
      .from('order_services')
      .select('*')
      .eq('order_id', id)
      .order('concepto')
      .then(unwrap),
    db()
      .from('payments')
      .select('*')
      .eq('order_id', id)
      .order('fecha', { ascending: false })
      .then(unwrap),
  ])

  return { ...order, items, services, payments }
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
