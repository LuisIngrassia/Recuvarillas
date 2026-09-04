/** Los gastos de la empresa. */
import { db, unwrap } from './client'

/*
  El tipo no es sólo una etiqueta para ordenar: define **quién paga el gasto**.

  Los operativos salen de la ganancia antes de repartir: los paga la empresa.
  Los de reinversión los paga la parte de reinversión del reparto, que para eso
  existe —y si no alcanza, sube—. Poner un gasto en el grupo equivocado le mueve
  plata a alguien.

  Estas listas tienen que coincidir con el `check` de `expenses.tipo` y con los
  `filter` de `finanzas_mensuales`, los dos en `supabase/schema.sql`. Si se
  agrega un tipo acá sin agregarlo allá, la base rechaza la carga.
*/
export const OPERATIVE_TYPES = ['flete']

export const REINVESTMENT_TYPES = ['pauta', 'muestras', 'suscripciones', 'otro']

/*
  'produccion' ya no se ofrece ni se cuenta: ese costo sale del stock, de lo que
  costaba hacer cada varilla el día que se produjo. Sigue siendo un tipo válido
  para que los gastos ya cargados no se rompan, pero no entra en ningún total
  —contarlos sería cobrarse la producción dos veces— y la pantalla los señala
  para que se puedan limpiar.
*/
export const RETIRED_TYPES = ['produccion']

export const EXPENSE_TYPES = [...OPERATIVE_TYPES, ...REINVESTMENT_TYPES]

/** Todos los que pueden aparecer en un gasto ya guardado. */
export const ALL_EXPENSE_TYPES = [...EXPENSE_TYPES, ...RETIRED_TYPES]

export const EXPENSE_TYPE_LABELS = {
  produccion: 'Producción',
  flete: 'Flete',
  pauta: 'Pauta',
  muestras: 'Muestras',
  suscripciones: 'Suscripciones',
  otro: 'Otro',
}

export const EXPENSE_TYPE_TONES = {
  produccion: 'info',
  flete: 'neutral',
  pauta: 'warn',
  muestras: 'warn',
  suscripciones: 'warn',
  otro: 'warn',
}

/** Si lo paga la reinversión o la empresa. */
export const esDeReinversion = (tipo) => REINVESTMENT_TYPES.includes(tipo)

export async function listExpenses({ desde, hasta, tipo, limit = 400 } = {}) {
  let query = db()
    .from('expenses')
    .select('*, pedido:orders(numero)')
    .order('fecha', { ascending: false })
    .limit(limit)

  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)
  if (tipo) query = query.eq('tipo', tipo)

  return unwrap(await query)
}

export async function createExpense(values) {
  return unwrap(await db().from('expenses').insert(values).select().single())
}

export async function updateExpense(id, changes) {
  return unwrap(await db().from('expenses').update(changes).eq('id', id).select().single())
}

export async function deleteExpense(id) {
  unwrap(await db().from('expenses').delete().eq('id', id))
}

/** El total por tipo de un conjunto de gastos ya traído, y por quién lo paga. */
export function totalsByType(expenses) {
  const totals = Object.fromEntries(ALL_EXPENSE_TYPES.map((tipo) => [tipo, 0]))
  let total = 0
  let operativos = 0
  let reinversion = 0
  let retirados = 0

  for (const expense of expenses) {
    const monto = Number(expense.monto)
    totals[expense.tipo] = (totals[expense.tipo] ?? 0) + monto
    total += monto
    if (RETIRED_TYPES.includes(expense.tipo)) retirados += monto
    else if (esDeReinversion(expense.tipo)) reinversion += monto
    else operativos += monto
  }

  return { ...totals, total, operativos, reinversion, retirados }
}
