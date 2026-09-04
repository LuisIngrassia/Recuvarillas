/**
 * Cuánto cuesta producir una varilla.
 *
 * Los conceptos tienen dos bases y esa es toda la idea: la materia prima se
 * gasta por varilla, mientras que la luz, los sueldos y el galpón corren con el
 * reloj. Para pasar los segundos a costo por varilla hace falta saber cuántas
 * hace la máquina por hora.
 *
 *     costo por varilla = (lo de unidad) + (lo de hora ÷ varillas por hora)
 *
 * La cuenta la hace la vista `costo_varilla`; acá sólo se pide y se edita.
 */
import { db, unwrap } from './client'

export const COST_BASES = ['unidad', 'hora']

export const COST_BASE_LABELS = {
  unidad: 'Por varilla',
  hora: 'Por hora',
}

export async function listProductionCosts() {
  return unwrap(await db().from('production_costs').select('*').order('orden').order('nombre'))
}

export async function createProductionCost(values) {
  return unwrap(await db().from('production_costs').insert(values).select().single())
}

export async function updateProductionCost(id, changes) {
  return unwrap(
    await db()
      .from('production_costs')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),
  )
}

export async function deleteProductionCost(id) {
  unwrap(await db().from('production_costs').delete().eq('id', id))
}

/** La fila única con las varillas por hora. */
export async function getProductionSetup() {
  return unwrap(await db().from('production_setup').select('*').eq('id', true).single())
}

export async function setVarillasPorHora(varillas_por_hora) {
  return unwrap(
    await db()
      .from('production_setup')
      .update({ varillas_por_hora, updated_at: new Date().toISOString() })
      .eq('id', true)
      .select()
      .single(),
  )
}

/** El desglose y el total, ya calculados por la base. */
export async function getCostoVarilla() {
  return unwrap(await db().from('costo_varilla').select('*').single())
}
