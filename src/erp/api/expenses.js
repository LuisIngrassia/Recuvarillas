/** Los gastos de la empresa, y de la parte de quién sale cada uno. */
import { db, unwrap } from './client'

/*
  El tipo de un gasto no es una etiqueta para ordenar: define **quién lo paga**.
  Ponerlo en el tipo equivocado le mueve plata a alguien.

  La lista de tipos vivía acá, escrita a mano, y en un `check` de la base que
  había que editar en paralelo. Ahora vive en la tabla `expense_types`: se
  agrega un tipo desde Ajustes, se dice quién lo banca, y tanto la carga como el
  reparto lo toman de ahí. Lo único que queda en el código son las tres reglas
  posibles, que sí son fijas porque cada una es una aritmética distinta.
*/

export const PAGA = ['proporcional', 'socios', 'pozo']

export const PAGA_LABELS = {
  proporcional: 'Todas las partes, en proporción',
  socios: 'Socios puntuales, en mitades',
  pozo: 'El pozo de reinversión',
}

export const PAGA_HINTS = {
  proporcional:
    'Se descuenta de arriba, antes de repartir, así que lo termina pagando cada parte en proporción a su porcentaje.',
  socios:
    'Lo bancan los socios que elijas, en mitades iguales entre ellos, sin mirar sus porcentajes.',
  pozo: 'Lo paga el pozo de reinversión. Lo que el pozo no llegue a cubrir lo ponen, en mitades, los socios que elijas.',
}

export const PAGA_TONES = {
  proporcional: 'neutral',
  socios: 'info',
  pozo: 'warn',
}

/**
 * Los tipos de gasto con sus pagadores.
 *
 * Trae también los inactivos y los internos: la pantalla de Costos los necesita
 * para nombrar y repartir gastos ya cargados, aunque no los ofrezca al cargar
 * uno nuevo. Filtrar acá dejaría esos gastos sin tipo.
 */
export async function listExpenseTypes() {
  const filas = unwrap(
    await db()
      .from('expense_types')
      .select('*, pagadores:expense_type_payers(share_id)')
      .order('orden')
      .order('nombre'),
  )

  /* La relación viene como una lista de objetos y en todos lados se la usa como
     una lista de ids: se aplana una sola vez, acá. */
  return filas.map((tipo) => ({
    ...tipo,
    pagadores: (tipo.pagadores ?? []).map((fila) => fila.share_id),
  }))
}

/** Los que se ofrecen al cargar un gasto: ni retirados ni calculados. */
export const esCargable = (tipo) => tipo.activo && !tipo.interno

export async function createExpenseType({ clave, nombre, paga, orden }) {
  return unwrap(
    await db()
      .from('expense_types')
      .insert({ clave, nombre, paga, orden: orden ?? 50 })
      .select()
      .single(),
  )
}

export async function updateExpenseType(id, changes) {
  return unwrap(
    await db().from('expense_types').update(changes).eq('id', id).select().single(),
  )
}

/**
 * Reemplaza los pagadores de un tipo.
 *
 * Borrar y volver a insertar, y no calcular la diferencia: son dos o tres filas
 * y el estado final es lo único que importa. La diferencia sería más código
 * para el mismo resultado.
 */
export async function setExpenseTypePayers(tipoId, shareIds) {
  unwrap(await db().from('expense_type_payers').delete().eq('tipo_id', tipoId))

  if (shareIds.length === 0) return

  unwrap(
    await db()
      .from('expense_type_payers')
      .insert(shareIds.map((share_id) => ({ tipo_id: tipoId, share_id }))),
  )
}

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

/**
 * El total del mes, y cuánto va por cada regla de pago.
 *
 * La división que importa no es por tipo sino por quién lo banca: es la que
 * contesta «¿cuánto me salió a mí este mes?» en vez de «¿cuánto se gastó en
 * pauta?».
 *
 * Los internos se cuentan aparte y no entran en el total: su monto lo calcula
 * el sistema —la producción sale del stock— y lo que haya quedado cargado a
 * mano está de más. Contarlo sería cobrarse la producción dos veces.
 */
export function totalsByType(expenses, tipos) {
  const porClave = new Map(tipos.map((tipo) => [tipo.clave, tipo]))

  const totals = {}
  let total = 0
  let proporcional = 0
  let socios = 0
  let pozo = 0
  let internos = 0
  let sinPagador = 0

  for (const expense of expenses) {
    const monto = Number(expense.monto)
    const tipo = porClave.get(expense.tipo)
    totals[expense.tipo] = (totals[expense.tipo] ?? 0) + monto

    if (tipo?.interno) {
      internos += monto
      continue
    }

    total += monto
    if (tipo?.paga === 'proporcional') proporcional += monto
    else if (tipo?.paga === 'pozo') pozo += monto
    else socios += monto

    /* Un gasto de un tipo sin pagadores salió de la caja y no tiene de quién
       descontarse. Se cuenta aparte para que se vea, no para repartirlo. */
    if (tipo && tipo.paga !== 'proporcional' && tipo.pagadores.length === 0) {
      sinPagador += monto
    }
  }

  return { ...totals, total, proporcional, socios, pozo, internos, sinPagador }
}

/**
 * Cómo se lee «quién paga esto» para un gasto, en palabras.
 *
 * Devuelve los nombres y no los ids porque es lo que va a la pantalla, y la
 * pregunta que contesta —de la parte de quién sale— es la que antes no se podía
 * contestar mirando la lista de gastos.
 */
export function quienPaga(tipo, shares) {
  if (!tipo) return { texto: 'Tipo desconocido', alerta: true }
  if (tipo.interno) return { texto: 'Sale del stock, no de acá', alerta: false }
  if (tipo.paga === 'proporcional') {
    return { texto: 'Todas las partes, en proporción', alerta: false }
  }

  const nombres = tipo.pagadores
    .map((id) => shares.find((share) => share.id === id)?.nombre)
    .filter(Boolean)

  if (nombres.length === 0) {
    return { texto: 'Sin pagador asignado', alerta: true }
  }

  const gente = nombres.join(' y ')
  return {
    texto: tipo.paga === 'pozo' ? `El pozo, y si no alcanza ${gente}` : gente,
    alerta: false,
  }
}
