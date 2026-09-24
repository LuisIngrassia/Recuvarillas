/**
 * Qué se vende.
 *
 * Durante mucho tiempo hubo un solo producto —la varilla— y todo el sistema lo
 * daba por sentado: se producía acá, se agujereaba, tenía stock y se cotizaba
 * por escalones de cantidad. Con dos productos eso deja de ser cierto de a uno,
 * así que cada cosa que se daba por sentada es ahora una marca de la ficha.
 *
 * Lo que decide cada marca está en el comentario de `products` en
 * `supabase/schema.sql`, porque es la base la que las hace valer.
 */
import { db, unwrap } from './client'

export const UNIDADES = ['unidad', 'metro', 'kilo', 'bolsa', 'rollo', 'par']

/**
 * Los productos, con sus marcas.
 *
 * Por defecto sólo los activos, que es lo que quiere cualquier pantalla donde
 * se elija uno. La de Ajustes los pide todos: un producto retirado tiene que
 * poder verse para volver a activarlo.
 */
export async function listProducts({ todos = false } = {}) {
  let query = db().from('products').select('*').order('orden').order('codigo')
  if (!todos) query = query.eq('activo', true)
  return unwrap(await query)
}

export async function createProduct(values) {
  return unwrap(await db().from('products').insert(values).select().single())
}

export async function updateProduct(id, changes) {
  return unwrap(await db().from('products').update(changes).eq('id', id).select().single())
}

/**
 * Borrar un producto falla si tiene historia.
 *
 * Las claves foráneas de `order_items` y `stock_movements` son `on delete
 * restrict`, así que un producto que se vendió alguna vez no se va: el
 * historial de ventas no puede quedar sin saber qué se vendió. Lo que
 * corresponde en ese caso es desactivarlo, y es lo que ofrece la pantalla.
 */
export async function deleteProduct(id) {
  unwrap(await db().from('products').delete().eq('id', id))
}

/**
 * Marca cuál cotiza el simulador de la web.
 *
 * Son dos escrituras y no una porque la base sólo admite un producto en la web
 * —un índice único lo garantiza— así que hay que sacárselo al anterior antes de
 * dárselo a éste. En el orden inverso el índice rechazaría la primera.
 */
export async function setProductoWeb(id) {
  unwrap(await db().from('products').update({ en_web: false }).eq('en_web', true))
  return unwrap(await db().from('products').update({ en_web: true }).eq('id', id).select().single())
}

/**
 * El producto que cotiza la web, que es también con el que se presupuesta un
 * lead.
 *
 * Se lo busca por su marca y no agarrando el primero de la lista: "el primero"
 * depende de cómo quedó ordenada una tabla, y presupuestar un lead empezaría a
 * cargar en silencio lo que no era. Si nadie lo marcó, cae al código histórico
 * de la varilla y recién después al primero, para que una base a medio
 * configurar siga cotizando algo.
 */
export function productoWeb(products) {
  const lista = products ?? []
  return (
    lista.find((item) => item.en_web) ??
    lista.find((item) => item.codigo === 'VAR') ??
    lista[0] ??
    null
  )
}

/** Los que se pueden llevar a una pantalla de existencias. */
export const conStock = (products) => (products ?? []).filter((item) => item.lleva_stock)
