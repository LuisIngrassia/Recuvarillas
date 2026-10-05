/** Stock y producción. */
import { db, unwrap } from './client'
import { getCostoVarilla } from './production'

export const MOVEMENT_LABELS = {
  produccion: 'Producción',
  compra: 'Compra',
  venta: 'Venta',
  ajuste: 'Ajuste',
  devolucion: 'Devolución',
}

/** Los movimientos que se cargan a mano. La venta la genera el trigger de entrega. */
export const MANUAL_MOVEMENTS = ['produccion', 'compra', 'ajuste', 'devolucion']

/**
 * Cómo entra al depósito cada producto: lo que se fabrica, por producción; lo
 * que se compra hecho, por compra. Ajuste y devolución valen para los dos.
 */
export function movimientosPara(product) {
  const entrada = product?.se_produce === false ? 'compra' : 'produccion'
  return MANUAL_MOVEMENTS.filter(
    (tipo) => tipo === entrada || (tipo !== 'produccion' && tipo !== 'compra'),
  )
}

/** Saldo actual por producto, sumado en la base. */
export async function listStock() {
  return unwrap(await db().from('stock_actual').select('*').order('codigo'))
}

export async function listMovements({ productId, tipo, limit = 200 } = {}) {
  let query = db()
    .from('stock_movements')
    .select('*, product:products(codigo, nombre), order:orders(numero), supplier:suppliers(nombre)')
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
 * El signo lo pone esta función y no quien la llama: producción, compra y
 * devolución siempre suman, y un ajuste puede ir para cualquier lado según lo
 * que haya contado el que revisó el depósito. Dejar que cada pantalla decida el signo es
 * la forma más fácil de terminar sumando una salida.
 */
export async function addMovement({
  product_id,
  tipo,
  cantidad,
  fecha,
  nota,
  costo_unitario: costoPasado,
  supplier_id,
}) {
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
    /*
      El costo puede venir de la pantalla, y es lo que pasa desde que hay más de
      un producto que se fabrica: el costeo configurado es el de la varilla, y
      aplicárselo a otra cosa sería inventarle un costo. Cuando no viene, se
      usa el configurado, que es el caso de siempre.
    */
    if (costoPasado !== undefined) {
      costo_unitario = Number(costoPasado) || null
    } else {
      const costo = await getCostoVarilla()
      costo_unitario = Number(costo?.costo_unitario) || null
    }
  }

  /*
    Una compra guarda lo que se pagó por unidad y a quién. Ese costo pasa
    además a la ficha del producto, que muestra siempre el último que se pagó:
    es el que importa para poner el precio de venta, y así no hay que
    acordarse de actualizarlo a mano cada vez que el proveedor aumenta.
  */
  if (tipo === 'compra') {
    costo_unitario = costoPasado === undefined || costoPasado === null ? null : Number(costoPasado)
  }

  const movimiento = unwrap(
    await db()
      .from('stock_movements')
      .insert({
        product_id,
        tipo,
        cantidad: signed,
        fecha,
        nota: nota || null,
        costo_unitario,
        supplier_id: tipo === 'compra' ? supplier_id || null : null,
      })
      .select()
      .single(),
  )

  if (tipo === 'compra' && costo_unitario !== null) {
    unwrap(await db().from('products').update({ costo: costo_unitario }).eq('id', product_id))
  }

  return movimiento
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
