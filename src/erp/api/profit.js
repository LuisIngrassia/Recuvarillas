/**
 * El resultado del mes y cómo se reparte.
 *
 * La cuenta de cuánto entró y cuánto salió la hace la vista
 * `finanzas_mensuales`; acá está el reparto, que es donde se decide de quién
 * sale cada peso. Es la única parte del sistema que mueve plata entre personas,
 * así que vive en un solo archivo y se lee de corrido.
 */
import { db, unwrap } from './client'

/** El resultado de cada mes, del más reciente al más viejo. */
export async function listMonths({ limit = 24 } = {}) {
  return unwrap(
    await db()
      .from('finanzas_mensuales')
      .select('*')
      .order('mes', { ascending: false })
      .limit(limit),
  )
}

export async function listShares() {
  return unwrap(await db().from('profit_shares').select('*').order('orden'))
}

export async function createShare(values) {
  return unwrap(await db().from('profit_shares').insert(values).select().single())
}

export async function updateShare(id, changes) {
  return unwrap(await db().from('profit_shares').update(changes).eq('id', id).select().single())
}

export async function deleteShare(id) {
  unwrap(await db().from('profit_shares').delete().eq('id', id))
}

/**
 * Los pagos hechos a las partes del reparto.
 *
 * Sin argumento trae todos, que es lo que necesita la cuenta histórica de cada
 * socio. Con un mes ('AAAA-MM') trae sólo los de ese mes; en la base la columna
 * es una fecha, el día 1, igual que en `finanzas_mensuales`.
 *
 * La pantalla de Rentabilidad los pide todos una sola vez y filtra el mes en el
 * navegador: son unas pocas filas por mes y así el histórico y el detalle del
 * mes no se pueden contradecir por venir de dos consultas distintas.
 */
export async function listPayouts(mes) {
  let query = db()
    .from('profit_payouts')
    .select('*')
    .order('mes', { ascending: false })
    .order('fecha', { ascending: false })

  if (mes) query = query.eq('mes', `${mes}-01`)

  return unwrap(await query)
}

/**
 * Registra un pago a una parte del reparto.
 *
 * El monto se pasa desde la pantalla y no se recalcula acá: es lo que decía la
 * cuenta en el momento de pagar, y eso es justamente lo que hay que dejar
 * escrito.
 */
export async function createPayout({ share_id, mes, tipo, monto, fecha, nota }) {
  return unwrap(
    await db()
      .from('profit_payouts')
      .insert({
        share_id,
        mes: `${mes}-01`,
        tipo: tipo ?? 'reparto',
        monto: Math.round(Number(monto) * 100) / 100,
        fecha: fecha ?? undefined,
        nota: nota || null,
      })
      .select()
      .single(),
  )
}

/** Deshace un pago mal registrado. */
export async function deletePayout(id) {
  unwrap(await db().from('profit_payouts').delete().eq('id', id))
}

/* -------------------------------------------------------------------------
   El reparto

   La regla, en una frase: cada uno cobra su porcentaje sobre el valor del
   producto vendido, y después cada costo se le descuenta **a quien lo banca**,
   no a todos.

   Eso es lo que cambió. Antes los costos salían de arriba, de la ganancia, y
   por lo tanto los pagaban las tres partes en proporción a su porcentaje: un
   costo de producción de $100.000 le salía $50.000 a quien tenía el 50 y
   $20.000 a quien tenía el 20, sin que nadie lo hubiera acordado así. Ahora un
   costo lo pagan los socios que figuran como pagadores de su tipo de gasto, en
   mitades iguales entre ellos.

   La única excepción es la comisión del vendedor, que se sigue descontando
   antes de repartir —ya viene restada en `base_reparto`— y por eso la termina
   pagando cada parte en proporción a lo suyo. Un tipo de gasto marcado como
   `proporcional` sigue esa misma regla.
   ------------------------------------------------------------------------- */

const num = (valor) => Number(valor) || 0

/** Un peso arriba o abajo por los decimales no es una diferencia. */
const CENTAVO = 0.01

/**
 * Reparte un monto en mitades iguales entre quienes lo bancan.
 *
 * Mitades y no en proporción a los porcentajes: es lo que se acordó. Si dos
 * socios bancan la producción, le cuesta lo mismo a cada uno aunque uno tenga
 * el 50% del reparto y el otro el 25%. Repartirlo en proporción sería otra
 * regla, y una que le cobra más al que más arriesga.
 *
 * Sin pagadores devuelve la lista vacía y el monto queda sin asignar. No se
 * reparte entre todos por defecto: ese reparto silencioso es exactamente el que
 * se quiso dejar atrás, y un gasto sin dueño tiene que verse.
 */
function enMitades(monto, pagadores) {
  if (pagadores.length === 0) return []
  const parte = num(monto) / pagadores.length
  return pagadores.map((id) => ({ share_id: id, monto: parte }))
}

/**
 * Los gastos del mes, cada uno con su regla y sus pagadores.
 *
 * Junta tres orígenes que la pantalla ve como uno solo: los gastos cargados a
 * mano (`gastos_por_tipo`), el costo de producción —que no es un gasto cargado
 * sino lo que costó fabricar, y sale del stock— y el flete, que tiene ingreso
 * propio y se resuelve neto.
 */
function gastosDelMes(fila, tipos) {
  const porTipo = fila.gastos_por_tipo ?? {}
  const porClave = new Map(tipos.map((tipo) => [tipo.clave, tipo]))

  const lista = []

  for (const [clave, monto] of Object.entries(porTipo)) {
    const tipo = porClave.get(clave)
    /* Un gasto de un tipo que ya no existe no puede pasar —lo impide la clave
       foránea— pero si pasara, mejor mostrarlo sin dueño que descartarlo. */
    lista.push({
      clave,
      nombre: tipo?.nombre ?? clave,
      paga: tipo?.paga ?? 'socios',
      pagadores: tipo?.pagadores ?? [],
      monto: num(monto),
    })
  }

  /*
    La producción no se carga como gasto: es lo que costaba hacer cada varilla
    el día que se fabricó, y sale del movimiento de stock. Pero se paga igual
    que cualquier otro costo, así que entra acá con la regla de su tipo.
  */
  const produccion = porClave.get('produccion')
  if (num(fila.costo_produccion) > 0) {
    lista.push({
      clave: 'produccion',
      nombre: produccion?.nombre ?? 'Producción',
      paga: produccion?.paga ?? 'socios',
      pagadores: produccion?.pagadores ?? [],
      monto: num(fila.costo_produccion),
      delStock: true,
    })
  }

  return lista
}

/**
 * Reparte el mes: quién cobra cuánto, quién banca qué y cómo queda el pozo.
 *
 * El orden de la cascada importa y es éste:
 *
 * 1. **La base.** `base_reparto` es mercadería + servicios − comisiones. El
 *    flete facturado no entra: es un pasamanos que se resuelve aparte. A eso se
 *    le restan los gastos marcados como `proporcional`, que son los únicos que
 *    salen de arriba.
 * 2. **Los porcentajes.** Cada parte cobra el suyo sobre esa base. La parte de
 *    reinversión no la cobra nadie: va al pozo.
 * 3. **El flete.** Lo facturado menos lo que costó, en mitades entre quienes
 *    bancan el tipo `flete`. Va neto porque es la misma plata entrando y
 *    saliendo: si se cobró más de lo que costó, la diferencia es de ellos; si
 *    se cobró de menos, la pérdida también.
 * 4. **Los costos directos.** Cada gasto de un tipo `socios` se descuenta en
 *    mitades a sus pagadores.
 * 5. **El pozo.** Los gastos de tipo `pozo` los paga la reinversión. Lo que el
 *    pozo no llega a cubrir lo ponen, en mitades, los pagadores de cada tipo.
 *
 * Los porcentajes se aplican tal como están cargados, sin normalizarlos a 100.
 * Si suman 97, se reparte el 97% y sobra plata sin asignar; si suman 103, se
 * reparte de más. Las dos cosas son errores de carga y la pantalla los muestra
 * como lo que son: un reparto que cierra siempre no deja ver que la lista está
 * mal.
 *
 * @param fila         una fila de `finanzas_mensuales`
 * @param shares       las partes del reparto
 * @param tipos        los tipos de gasto, cada uno con sus `pagadores`
 * @param pozoEntrante lo acumulado en el pozo hasta el mes anterior
 */
export function splitProfit(fila, shares, tipos = [], pozoEntrante = 0) {
  const activas = shares.filter((share) => share.activo)
  const total = activas.reduce((sum, share) => sum + num(share.porcentaje), 0)
  const reinversion = activas.find((share) => share.es_reinversion)

  const gastos = gastosDelMes(fila, tipos)
  const proporcionales = gastos
    .filter((gasto) => gasto.paga === 'proporcional')
    .reduce((sum, gasto) => sum + gasto.monto, 0)

  /* Lo que queda para repartir por porcentaje. Puede ser negativo: un mes malo
     es un mes malo, y estirarlo a cero escondería la pérdida. */
  const base = num(fila.base_reparto) - proporcionales

  /* Lo que se le descuenta (o se le suma) a cada parte más allá de su
     porcentaje, con el detalle de por qué. Sin el detalle, un socio ve un
     número más chico y no tiene cómo saber de dónde salió. */
  const cargos = new Map(activas.map((share) => [share.id, []]))
  const anotar = (shareId, concepto, monto, extra = {}) => {
    const lista = cargos.get(shareId)
    /* Un cargo a una parte que no está activa no tiene dónde ir. Se cuenta como
       huérfano más abajo en vez de desaparecer. */
    if (lista) lista.push({ concepto, monto, ...extra })
  }

  /* Gastos sin pagador configurado: la plata salió y no hay de quién
     descontarla. No se reparte por defecto, se muestra. */
  const huerfanos = []

  // --- 3. El flete, neto ----------------------------------------------------
  const fleteFacturado = num(fila.flete_facturado)
  const fleteCosto = gastos
    .filter((gasto) => gasto.clave === 'flete')
    .reduce((sum, gasto) => sum + gasto.monto, 0)
  const fleteNeto = fleteFacturado - fleteCosto
  const pagadoresFlete = tipos.find((tipo) => tipo.clave === 'flete')?.pagadores ?? []

  if (Math.abs(fleteNeto) >= CENTAVO) {
    const repartido = enMitades(fleteNeto, pagadoresFlete)
    if (repartido.length === 0) {
      huerfanos.push({ clave: 'flete', nombre: 'Flete', monto: -fleteNeto })
    }
    /* El signo se invierte al anotarlo: un cargo es lo que se le resta, y un
       flete que dejó ganancia se le suma. */
    for (const { share_id, monto } of repartido) {
      anotar(share_id, 'Flete (facturado − costo)', -monto, { flete: true })
    }
  }

  // --- 4. Los costos directos ----------------------------------------------
  for (const gasto of gastos) {
    if (gasto.paga !== 'socios') continue
    /* El flete ya se resolvió neto contra su ingreso: cobrarlo de nuevo acá
       sería cobrarlo dos veces. */
    if (gasto.clave === 'flete') continue

    const repartido = enMitades(gasto.monto, gasto.pagadores)
    if (repartido.length === 0) {
      huerfanos.push({ clave: gasto.clave, nombre: gasto.nombre, monto: gasto.monto })
      continue
    }
    for (const { share_id, monto } of repartido) {
      anotar(share_id, gasto.nombre, monto, { clave: gasto.clave })
    }
  }

  // --- 5. El pozo -----------------------------------------------------------
  const tasa = reinversion ? num(reinversion.porcentaje) : 0
  /* Con pérdida el pozo no crece, pero tampoco se come lo que ya había: un
     aporte negativo a una reserva no significa nada. */
  const aporte = Math.max((base * tasa) / 100, 0)
  const entrante = Math.max(num(pozoEntrante), 0)
  const disponible = entrante + aporte

  const delPozo = gastos.filter((gasto) => gasto.paga === 'pozo')
  const gastoPozo = delPozo.reduce((sum, gasto) => sum + gasto.monto, 0)

  /*
    El pozo cubre todos los tipos a la vez y en la misma proporción, no uno
    entero y después el otro. Si alcanzara para el 60%, cada tipo queda cubierto
    al 60% y cada uno arrastra su propio faltante a sus propios pagadores.
    Cubrirlos en orden daría un resultado distinto según cómo esté ordenada una
    tabla, que es decidir plata ajena por casualidad.
  */
  const cobertura = gastoPozo > 0 ? Math.min(1, disponible / gastoPozo) : 1
  const cubierto = gastoPozo * cobertura
  const faltante = gastoPozo - cubierto

  for (const gasto of delPozo) {
    const suFaltante = gasto.monto * (1 - cobertura)
    if (suFaltante < CENTAVO) continue

    const repartido = enMitades(suFaltante, gasto.pagadores)
    if (repartido.length === 0) {
      huerfanos.push({ clave: gasto.clave, nombre: gasto.nombre, monto: suFaltante })
      continue
    }
    for (const { share_id, monto } of repartido) {
      anotar(share_id, `${gasto.nombre} (lo que el pozo no cubrió)`, monto, {
        clave: gasto.clave,
        delPozo: true,
      })
    }
  }

  const saliente = disponible - cubierto

  // --- Y el reparto -------------------------------------------------------
  const partes = activas.map((share) => {
    const propio = num(share.porcentaje)
    const bruto = (base * propio) / 100
    const suyos = cargos.get(share.id) ?? []
    const descontado = suyos.reduce((sum, cargo) => sum + cargo.monto, 0)

    return {
      ...share,
      porcentaje: propio,
      bruto,
      cargos: suyos,
      descontado,
      /* La reinversión no cobra: su bruto es el aporte al pozo, y los gastos
         del pozo ya se descontaron del pozo, no de ella. */
      monto: share.es_reinversion ? bruto : bruto - descontado,
    }
  })

  return {
    base,
    proporcionales,
    total,
    /* Un rato de tolerancia por los decimales: 25,694 + 20,556 + … no da 100. */
    cuadra: Math.abs(total - 100) < CENTAVO,
    sinAsignar: (base * (100 - total)) / 100,
    partes,
    socios: partes.filter((parte) => !parte.es_reinversion),

    flete: {
      facturado: fleteFacturado,
      costo: fleteCosto,
      neto: fleteNeto,
      pagadores: pagadoresFlete,
      sinPagador: Math.abs(fleteNeto) >= CENTAVO && pagadoresFlete.length === 0,
    },

    pozo: {
      tasa,
      entrante,
      aporte,
      disponible,
      gastos: gastoPozo,
      cubierto,
      faltante,
      saliente,
    },

    /* Lo que salió de la caja y no tiene a quién cargarse. */
    huerfanos,
    sinDueno: huerfanos.reduce((sum, item) => sum + item.monto, 0),
  }
}

/**
 * Encadena los meses para arrastrar el pozo de uno al siguiente.
 *
 * Hay que recorrerlos del más viejo al más nuevo porque el pozo de un mes
 * depende de lo que quedó del anterior: no se puede calcular septiembre sin
 * haber calculado agosto. Se hace de una pasada y se guarda el resultado de
 * cada mes, en vez de recalcular la cadena entera cada vez que la pantalla
 * cambia de mes.
 *
 * **El pozo ya no vence.** Antes, lo que sobrevivía un mes sin usarse volvía al
 * socio minoritario: se lo trataba como plata parada que había que devolver.
 * Pero el pozo no es plata guardada esperando el mes que viene, es plata que ya
 * está invertida —en la marca, en las muestras, en lo que hace que el mes que
 * viene exista— y por eso se acumula. Lo que hay que mirar no es cuándo
 * devolverlo sino cuándo ya alcanza para invertir más fuerte, y eso lo decide
 * alguien, no una regla de vencimiento.
 *
 * Un mes sin ventas ni gastos no tiene fila en `finanzas_mensuales` y por lo
 * tanto no aparece en la cadena. El pozo salta ese hueco: sigue vigente y se
 * arrastra al primer mes que sí tenga movimiento.
 */
export function runReserve(meses, shares, tipos = []) {
  const ordenados = [...meses].sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
  const porMes = new Map()
  let pozo = 0

  for (const fila of ordenados) {
    const reparto = splitProfit(fila, shares, tipos, pozo)
    porMes.set(String(fila.mes).slice(0, 7), reparto)
    pozo = reparto.pozo.saliente
  }

  return porMes
}

/**
 * Cuánto pesa el pozo acumulado, medido en meses de gasto.
 *
 * Es la señal de que hay que invertir más. Un pozo de dos millones no dice
 * nada por sí solo: dice algo cuando se sabe que se están gastando doscientos
 * mil por mes y entonces son diez meses de pauta sin usar. Ahí el pozo dejó de
 * ser una reserva y pasó a ser plata dormida.
 *
 * Se mide contra el promedio de los últimos meses con gasto y no contra el
 * último: un mes sin pauta daría infinito y un mes puntual fuerte lo taparía.
 */
export function pesoDelPozo(cadena, meses = 6) {
  const gastos = [...cadena.values()]
    .slice(-meses)
    .map((reparto) => reparto.pozo.gastos)
    .filter((monto) => monto > 0)

  if (gastos.length === 0) return null

  const promedio = gastos.reduce((sum, monto) => sum + monto, 0) / gastos.length
  const ultimo = [...cadena.values()].at(-1)

  return { promedio, meses: ultimo.pozo.saliente / promedio }
}
