/**
 * Reciclado por encargo: las tarifas por hora y las horas de cada trabajo.
 *
 * Es el otro negocio de la casa. La empresa trae su plástico, nosotros ponemos
 * las máquinas y el tiempo, y se le cobra por hora: no hay mercadería que
 * vender porque la materia prima era suya.
 */
import { db, unwrap } from './client'

/** Las tarifas por hora, en el orden en que se muestran. */
export async function listRates({ soloActivas = false } = {}) {
  let query = db().from('service_rates').select('*').order('orden').order('nombre')
  if (soloActivas) query = query.eq('activo', true)
  return unwrap(await query)
}

export async function createRate(values) {
  return unwrap(await db().from('service_rates').insert(values).select().single())
}

export async function updateRate(id, changes) {
  return unwrap(
    await db()
      .from('service_rates')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),
  )
}

export async function deleteRate(id) {
  unwrap(await db().from('service_rates').delete().eq('id', id))
}

/**
 * Carga las horas de un trabajo.
 *
 * El concepto y el precio se copian de la tarifa en vez de referenciarla: si
 * mañana sube la hora de máquina o se le cambia el nombre, los trabajos ya
 * facturados tienen que seguir diciendo lo que se cobró. Es el mismo criterio
 * que con el precio de una varilla en el ítem de un pedido.
 */
export async function addOrderService({ order_id, rate, horas }) {
  return unwrap(
    await db()
      .from('order_services')
      .insert({
        order_id,
        rate_id: rate.id,
        concepto: rate.nombre,
        precio_hora: Number(rate.precio_hora),
        horas,
      })
      .select()
      .single(),
  )
}

export async function deleteOrderService(id) {
  unwrap(await db().from('order_services').delete().eq('id', id))
}
