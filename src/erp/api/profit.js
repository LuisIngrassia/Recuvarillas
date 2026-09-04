/**
 * El resultado del mes y cómo se reparte.
 *
 * La cuenta de cuánto entró y cuánto salió la hace la vista
 * `finanzas_mensuales`; acá está el reparto, que es aritmética simple sobre ese
 * número y se prueba de un vistazo.
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
        tipo,
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

/**
 * Hasta dónde puede subir la reinversión cuando su parte no alcanza.
 *
 * La escalera es fija y corta a propósito: son tres posiciones acordadas entre
 * los socios, no un número que se ajusta cada mes hasta que dé. Que tenga tope
 * es lo que obliga a mirar el gasto cuando ni el 10% alcanza, en vez de que la
 * reinversión se coma el reparto sin que nadie lo decida.
 */
export const ESCALERA_REINVERSION = [7.5, 10]

/**
 * Liquida al socio minoritario el pozo de reinversión que sobró.
 *
 * Va entero a uno solo, y no es una gentileza: **ese 5% es suyo**. El reparto
 * de fondo entre los tres es 50 / 25 / 25, y el socio del 25 más chico resignó
 * cinco puntos para financiar la reinversión —por eso su fila dice 20—. Si esa
 * plata no se llegó a usar, vuelve a quien la puso.
 *
 * Minoritario es el de menor porcentaje, así que la regla se sostiene sola si
 * mañana cambian los números. En un empate se reparte en partes iguales entre
 * los empatados: desempatar por el orden de la lista sería decidir plata ajena
 * según cómo quedó ordenada una tabla.
 */
export function liquidacionAlMinoritario(monto, socios) {
  if (socios.length === 0) return []

  const menor = Math.min(...socios.map((socio) => Number(socio.porcentaje)))
  const elegidos = socios.filter(
    (socio) => Math.abs(Number(socio.porcentaje) - menor) < 0.001,
  )

  return elegidos.map((socio) => ({
    ...socio,
    fraccion: 100 / elegidos.length,
    monto: Number(monto) / elegidos.length,
  }))
}

/**
 * Reparte la ganancia y resuelve cuánto se lleva la reinversión.
 *
 * La reinversión no es una parte que se guarda: es la que paga la pauta, las
 * muestras, las suscripciones y los gastos sueltos de crecer. Por eso su
 * porcentaje no es fijo. Arranca en el configurado —5%— y si con eso no cubre
 * esos gastos sube a 7,5%, y si tampoco, a 10%. Los puntos que sube salen de
 * los socios, a cada uno en proporción a lo suyo: subir 2,5 puntos con un
 * reparto 50/25/20 le saca 1,32 a quien tiene la mitad y 0,53 a quien tiene el
 * veinte.
 *
 * Sube al primer escalón que alcanza, no al máximo: si con 7,5% cubre, no hay
 * razón para llegar a 10 y sacarles más a los socios.
 *
 * Con pérdida no escala. Un porcentaje de un número negativo no cubre nada, y
 * subirlo sólo repartiría la pérdida distinto sin que entre un peso.
 *
 * Los porcentajes se aplican tal como están cargados, sin normalizarlos a 100.
 * Si suman 97, se reparte el 97% y sobra plata sin asignar; si suman 103, se
 * reparte de más. Las dos cosas son errores de carga y la pantalla los muestra
 * como lo que son: un reparto que cierra siempre no deja ver que la lista está
 * mal.
 *
 * El pozo de reinversión no se cierra cada mes: lo que sobra queda de reserva
 * para el siguiente. Por eso la escalera mira `reservaEntrante + fondo` y no
 * sólo el fondo: subirle el porcentaje a los socios teniendo pozo sin usar
 * sería cobrarles dos veces por lo mismo.
 *
 * Y la reserva tiene un mes de gracia, no más. El gasto consume primero la
 * plata más vieja; lo que venía del mes anterior y aun así no se usó ya no es
 * una reserva sino plata quieta, y vuelve al socio minoritario, que es quien
 * resignó esos cinco puntos para financiarla. Así el pozo no puede engordar
 * indefinidamente sin que nadie decida nada.
 *
 * Ojo con un caso: cuando la escalera subió la tasa, los puntos de más los
 * pusieron los tres. Si después sobra, ese excedente igual se va entero al
 * minoritario. Es la única parte donde la regla da más de lo que su propia
 * lógica justifica; se deja así porque separar el origen de cada peso del pozo
 * sería llevar dos contabilidades para un caso que casi no ocurre —se escala
 * justamente cuando falta plata, no cuando sobra—.
 *
 * @param gananciaBase lo facturado menos costos operativos y comisiones
 * @param gastosReinversion pauta, muestras, suscripciones y otros del período
 * @param shares las partes del reparto
 * @param reservaEntrante lo que sobró del pozo del mes anterior
 */
export function splitProfit(gananciaBase, gastosReinversion, shares, reservaEntrante = 0) {
  const activas = shares.filter((share) => share.activo)
  const total = activas.reduce((sum, share) => sum + Number(share.porcentaje), 0)

  const ganancia = Number(gananciaBase) || 0
  const gastos = Number(gastosReinversion) || 0
  const reserva = Math.max(Number(reservaEntrante) || 0, 0)

  const reinversion = activas.find((share) => share.es_reinversion)
  const socios = activas.filter((share) => !share.es_reinversion)
  const baseReinversion = reinversion ? Number(reinversion.porcentaje) : 0
  const baseSocios = socios.reduce((sum, share) => sum + Number(share.porcentaje), 0)

  /* Sin una parte de reinversión cargada no hay escalera que subir: se reparte
     como antes y los gastos quedan a la vista como no cubiertos. */
  const escalones = reinversion
    ? [baseReinversion, ...ESCALERA_REINVERSION.filter((e) => e > baseReinversion)]
    : [0]

  const tasa =
    ganancia > 0 && gastos > reserva
      ? (escalones.find((e) => reserva + (ganancia * e) / 100 >= gastos) ?? escalones.at(-1))
      : baseReinversion

  const extra = tasa - baseReinversion

  const partes = activas.map((share) => {
    const propio = Number(share.porcentaje)
    const aplicado = share.es_reinversion
      ? propio + extra
      : propio - (baseSocios > 0 ? (extra * propio) / baseSocios : 0)

    return { ...share, aplicado, monto: (ganancia * aplicado) / 100 }
  })

  /* En un mes con pérdida el fondo no crece, pero tampoco se come lo que ya
     había: un aporte negativo a una reserva no significa nada. */
  const fondo = Math.max((ganancia * tasa) / 100, 0)

  /*
    El gasto consume primero la plata más vieja. Es lo que hace que se liquide
    sólo lo que de verdad quedó quieto dos meses: si se gastara primero el
    fondo nuevo, la reserva vieja se iría venciendo aunque el pozo se estuviera
    usando todos los meses.
  */
  const deReserva = Math.min(gastos, reserva)
  const restante = gastos - deReserva
  const deFondo = Math.min(restante, fondo)

  /* Lo que venía del mes anterior y ni así se usó: ya no es reserva. */
  const vencido = reserva - deReserva
  /* Lo del fondo de este mes que no se gastó: pasa al mes que viene. */
  const reservaSaliente = fondo - deFondo
  /* Lo que ni con la reserva ni con el último escalón se llega a cubrir. */
  const faltante = restante - deFondo

  return {
    total,
    /* Un rato de tolerancia por los decimales: 25,694 + 20,556 + … no da 100 exacto. */
    cuadra: Math.abs(total - 100) < 0.01,
    sinAsignar: (ganancia * (100 - total)) / 100,
    partes,

    reinversion: {
      base: baseReinversion,
      tasa,
      escalo: extra > 0,
      reservaEntrante: reserva,
      fondo,
      disponible: reserva + fondo,
      gastos,
      deReserva,
      deFondo,
      vencido,
      reservaSaliente,
      faltante,
    },

    /* El pozo vencido vuelve entero al socio minoritario, que es de quien
       salió ese 5%. Ver `liquidacionAlMinoritario`. */
    liquidacion: liquidacionAlMinoritario(vencido, socios),
  }
}

/**
 * Encadena los meses para arrastrar la reserva de uno al siguiente.
 *
 * Hay que recorrerlos del más viejo al más nuevo porque el pozo de un mes
 * depende de lo que sobró del anterior: no se puede calcular septiembre sin
 * haber calculado agosto. Se hace de una pasada y se guarda el resultado de
 * cada mes, en vez de recalcular la cadena entera cada vez que la pantalla
 * cambia de mes.
 *
 * Un mes sin ventas ni gastos no tiene fila en `finanzas_mensuales` y por lo
 * tanto no aparece en la cadena. La reserva salta ese hueco: sigue vigente y se
 * arrastra al primer mes que sí tenga movimiento.
 */
export function runReserve(meses, shares) {
  const ordenados = [...meses].sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
  const porMes = new Map()
  let reserva = 0

  for (const fila of ordenados) {
    const reparto = splitProfit(
      fila.ganancia_base,
      fila.costos_reinversion,
      shares,
      reserva,
    )
    porMes.set(String(fila.mes).slice(0, 7), reparto)
    reserva = reparto.reinversion.reservaSaliente
  }

  return porMes
}
