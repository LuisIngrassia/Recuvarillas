/** Stock y producción. */
import { db, unwrap } from './client'
import { getCostoVarilla } from './production'

export const MOVEMENT_LABELS = {
  produccion: 'Producción',
  venta: 'Venta',
  ajuste: 'Ajuste',
  devolucion: 'Devolución',
}

/** Los movimientos que se cargan a mano. La venta la genera el trigger de entrega. */
export const MANUAL_MOVEMENTS = ['produccion', 'ajuste', 'devolucion']

export async function listProducts() {
  return unwrap(await db().from('products').select('*').eq('activo', true).order('codigo'))
}

/** Saldo actual por producto, sumado en la base. */
export async function listStock() {
  return unwrap(await db().from('stock_actual').select('*').order('codigo'))
}

export async function listMovements({ productId, tipo, limit = 200 } = {}) {
  let query = db()
    .from('stock_movements')
    .select('*, product:products(codigo, nombre), order:orders(numero)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (productId) query = query.eq('product_id', productId)
  if (tipo) query = query.eq('tipo', tipo)

  return unwrap(await query)
}

/**
 * Carga un movimiento.
 *
 * El signo lo pone esta función y no quien la llama: producción y devolución
 * siempre suman, y un ajuste puede ir para cualquier lado según lo que haya
 * contado el que revisó el depósito. Dejar que cada pantalla decida el signo es
 * la forma más fácil de terminar sumando una salida.
 */
export async function addMovement({ product_id, tipo, cantidad, fecha, nota }) {
  const magnitud = Math.abs(cantidad)
  const signed = tipo === 'ajuste' ? cantidad : magnitud

  /*
    Una producción se guarda con lo que costaba hacer una varilla hoy, y ese
    número no se vuelve a tocar: si mañana sube la luz, lo que costó producir
    esta tanda no puede cambiar. Es lo mismo que hace el ítem de un pedido con
    el precio de venta.

    Sólo la producción lo lleva. Un ajuste o una devolución no fabrican nada, y
    ponerles un costo diría que sí.
  */
  let costo_unitario = null
  if (tipo === 'produccion') {
    const costo = await getCostoVarilla()
    costo_unitario = Number(costo?.costo_unitario) || null
  }

  return unwrap(
    await db()
      .from('stock_movements')
      .insert({ product_id, tipo, cantidad: signed, fecha, nota: nota || null, costo_unitario })
      .select()
      .single(),
  )
}

/**
 * Borra un movimiento cargado a mano.
 *
 * Los de venta no se borran desde acá: los pone y los saca el trigger según el
 * estado del pedido, y borrarlos por afuera dejaría el stock diciendo que
 * la mercadería nunca salió.
 */
export async function deleteMovement(id) {
  unwrap(await db().from('stock_movements').delete().eq('id', id).neq('tipo', 'venta'))
}
