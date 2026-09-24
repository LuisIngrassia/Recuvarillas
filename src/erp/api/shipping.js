/**
 * Quién está cerca de dónde, y de un viaje que ya sale.
 *
 * El flete es lo que más veces mata una venta lejos: la varilla compite bien y
 * el envío no. Pero el grueso del costo de un envío es el viaje, no la varilla
 * de más. Si ya hay un pedido confirmado a Rosario, al de al lado se le puede
 * ofrecer un flete que solo no pagaría — y eso vale doble para los leads que se
 * perdieron justamente por el precio del flete.
 *
 * Esta pantalla no manda nada ni cotiza nada: contesta a quién llamar.
 */
import { db, unwrap } from './client'

/**
 * Todos los puntos del mapa: clientes y leads, con su localidad.
 *
 * Sale de la vista `destinos`, que ya los unifica y descarta al lead que se
 * convirtió en cliente para no contarlo dos veces. Los que no tienen código
 * postal cargado se traen igual: se los muestra aparte, porque un contacto sin
 * dirección no es un error de datos que se pueda tapar, es alguien a quien no
 * se le puede ofrecer un envío.
 */
export async function listDestinos({ limit = 5000 } = {}) {
  const { data, error, count } = await db()
    .from('destinos')
    .select('*', { count: 'exact' })
    .order('nombre')
    .range(0, limit - 1)

  const filas = unwrap({ data, error })
  const total = count ?? filas.length

  /*
    Se devuelve el total junto con las filas, y no sólo las filas, porque
    PostgREST corta la respuesta en un máximo configurado del lado del servidor.
    Una lista cortada en silencio sería peor que un error: la pantalla diría
    «cerca de Rosario no hay nadie» mirando media cartera. Con el total a la
    vista se puede avisar que la respuesta quedó incompleta en vez de afirmar
    algo falso.
  */
  return { filas, total, completo: filas.length >= total }
}

/** Las zonas de los transportes, para saber qué destinos cuestan lo mismo. */
export async function listZonas() {
  return unwrap(
    await db()
      .from('carrier_zones')
      .select('*, carrier:carriers(id, nombre, tipo, activo)')
      .order('cp_desde'),
  )
}

/**
 * Los envíos que ya están comprometidos y todavía no salieron.
 *
 * Un pedido confirmado o en producción con entrega por envío es un viaje que va
 * a pasar sí o sí. Los entregados no sirven —ese camión ya volvió— y los
 * presupuestos tampoco, porque todavía no son nada.
 */
export async function listViajes() {
  return unwrap(
    await db()
      .from('orders_summary')
      .select(
        'id, numero, cliente_nombre, cliente_telefono, estado, entrega, localidad, provincia, codigo_postal, fecha, unidades',
      )
      .eq('entrega', 'envio')
      .in('estado', ['confirmado', 'en_produccion'])
      .order('fecha', { ascending: false }),
  )
}

/* -------------------------------------------------------------------------
   Qué quiere decir «cerca»

   No hay coordenadas. El padrón de códigos postales guarda la distancia hasta
   la fábrica, que sirve para cotizar un envío pero no para medir entre dos
   destinos: dos localidades a 300 km de la fábrica pueden estar a 600 km entre
   sí, una al norte y la otra al sur.

   Así que «cerca» no se estima, se define con lo que sí es exacto y es lo que
   de verdad importa para el flete:

   1. **La misma localidad.** Mismo código postal. Es el mismo reparto.
   2. **La misma zona de flete.** Los transportes tarifan por rango de código
      postal: dos destinos en la misma zona **cuestan lo mismo**. No es una
      aproximación geográfica, es el precio.
   3. **La misma provincia.** El más flojo de los tres, y está para que la
      pantalla sirva igual antes de que alguien cargue el tarifario.

   Dentro de cada nivel se ordena por diferencia de código postal. En Argentina
   los códigos se asignaron por región, así que dos números parecidos suelen ser
   dos pueblos vecinos. Es un desempate, no una medida: se usa para ordenar una
   lista corta, nunca para afirmar a cuántos kilómetros está algo.
   ------------------------------------------------------------------------- */

export const CERCANIA = ['localidad', 'zona', 'provincia']

export const CERCANIA_LABELS = {
  localidad: 'Misma localidad',
  zona: 'Misma zona de flete',
  provincia: 'Misma provincia',
}

export const CERCANIA_HINTS = {
  localidad: 'Mismo código postal: entra en el mismo reparto.',
  zona: 'El transporte cobra lo mismo para los dos destinos.',
  provincia: 'Cerca en sentido amplio. Conviene confirmar el flete antes de prometer.',
}

export const CERCANIA_TONES = {
  localidad: 'good',
  zona: 'info',
  provincia: 'neutral',
}

/** El número de cuatro dígitos, venga el CP como venga: "B1900ABC" → 1900. */
export function cpNumero(codigo) {
  const encontrado = String(codigo ?? '').match(/\d{4}/)
  return encontrado ? Number(encontrado[0]) : null
}

/** Para comparar provincias escritas distinto: "Córdoba" y "Cordoba" son una. */
export function claveProvincia(nombre) {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Las zonas que cubren un código postal, de los transportes activos.
 *
 * Un destino puede estar en varias: cada transporte tiene las suyas y pueden
 * solaparse. Todas cuentan, porque alcanza con que **un** transporte trate a
 * dos destinos como la misma zona para que cobre lo mismo por los dos.
 */
export function zonasQueCubren(cp, zonas) {
  if (cp === null) return []
  return zonas.filter(
    (zona) => zona.carrier?.activo !== false && cp >= zona.cp_desde && cp <= zona.cp_hasta,
  )
}

/**
 * Quién está cerca de un destino, del más cerca al más lejos.
 *
 * El propio destino queda afuera —no tiene sentido ofrecerle a alguien que se
 * suba a su propio envío— y también los que no tienen código postal cargado,
 * que se cuentan aparte.
 *
 * @param destino  { codigo_postal, provincia }: a dónde va el viaje
 * @param destinos la lista completa de clientes y leads
 * @param zonas    las zonas de los transportes
 * @param excluir  ids que no van en la lista, típicamente el cliente del pedido
 */
export function cercaDe(destino, destinos, zonas, excluir = []) {
  const cp = cpNumero(destino?.codigo_postal)
  const provincia = claveProvincia(destino?.provincia)
  const fuera = new Set(excluir)

  /* Los ids de las zonas que cubren el destino. Comparar conjuntos de zonas es
     más barato y más claro que volver a recorrer los rangos por cada candidato. */
  const zonasDestino = new Set(zonasQueCubren(cp, zonas).map((zona) => zona.id))

  const cerca = []

  for (const punto of destinos) {
    if (fuera.has(punto.id)) continue

    const suCp = punto.cp ?? cpNumero(punto.codigo_postal)
    const suProvincia = punto.provincia_clave ?? claveProvincia(punto.provincia)

    let nivel = null
    if (cp !== null && suCp === cp) nivel = 'localidad'
    else if (
      zonasDestino.size > 0 &&
      zonasQueCubren(suCp, zonas).some((zona) => zonasDestino.has(zona.id))
    ) {
      nivel = 'zona'
    } else if (provincia && suProvincia === provincia) nivel = 'provincia'

    if (!nivel) continue

    cerca.push({
      ...punto,
      cercania: nivel,
      /* Sólo para ordenar. Ver la nota de arriba: no son kilómetros. */
      saltoCp: cp !== null && suCp !== null ? Math.abs(suCp - cp) : Number.MAX_SAFE_INTEGER,
    })
  }

  return cerca.sort(
    (a, b) =>
      CERCANIA.indexOf(a.cercania) - CERCANIA.indexOf(b.cercania) ||
      a.saltoCp - b.saltoCp ||
      a.nombre.localeCompare(b.nombre),
  )
}

/**
 * Quién de los que están cerca vale más la pena llamar.
 *
 * Un lead que se perdió por el costo del flete es el caso exacto para el que
 * existe esta pantalla: ya quiso comprar, ya dijo que sí al producto, y lo que
 * lo frenó es lo que este viaje abarata. Después vienen los otros perdidos y
 * los dormidos —gente que quedó a mitad de camino— y por último los clientes,
 * que ya compran y a los que esto les suma un envío más barato, no una venta
 * nueva.
 */
export function prioridad(punto) {
  if (punto.clase === 'lead' && punto.lost_reason === 'freight') return 0
  if (punto.clase === 'lead' && (punto.status === 'lost' || punto.status === 'dormant')) return 1
  if (punto.clase === 'lead') return 2
  return 3
}

export const MOTIVOS_DE_LLAMADO = {
  0: 'Se perdió por el flete',
  1: 'Quedó a mitad de camino',
  2: 'Lead abierto',
  3: 'Ya es cliente',
}

/**
 * El mapa de la cartera: cuánta gente hay en cada provincia.
 *
 * Se agrupa por la clave sin tildes y se muestra la escritura más frecuente. Si
 * la mitad de las fichas dicen "Córdoba" y la otra mitad "Cordoba", son una
 * provincia con la grafía que más se usó, no dos con la mitad cada una.
 */
export function porProvincia(destinos) {
  const mapa = new Map()

  for (const punto of destinos) {
    const clave = punto.provincia_clave ?? claveProvincia(punto.provincia)
    if (!clave) continue

    if (!mapa.has(clave)) {
      mapa.set(clave, {
        clave,
        grafias: new Map(),
        clientes: 0,
        leads: 0,
        perdidosPorFlete: 0,
        localidades: new Set(),
      })
    }

    const fila = mapa.get(clave)
    const escrito = String(punto.provincia).trim()
    fila.grafias.set(escrito, (fila.grafias.get(escrito) ?? 0) + 1)

    if (punto.clase === 'cliente') fila.clientes += 1
    else fila.leads += 1
    if (punto.lost_reason === 'freight') fila.perdidosPorFlete += 1
    if (punto.localidad) fila.localidades.add(punto.localidad.trim().toLowerCase())
  }

  return [...mapa.values()]
    .map((fila) => ({
      clave: fila.clave,
      nombre: [...fila.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0],
      clientes: fila.clientes,
      leads: fila.leads,
      total: fila.clientes + fila.leads,
      perdidosPorFlete: fila.perdidosPorFlete,
      localidades: fila.localidades.size,
    }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))
}

/**
 * Las provincias que aparecen en una lista, para armar un desplegable.
 *
 * Sale de los datos y no de una lista fija de las 24 jurisdicciones: un
 * desplegable con veinticuatro opciones de las que sirven tres es un
 * desplegable que hay que leer entero cada vez.
 */
export function provinciasDe(filas) {
  const mapa = new Map()

  for (const fila of filas) {
    const clave = fila.provincia_clave ?? claveProvincia(fila.provincia)
    if (!clave) continue
    const escrito = String(fila.provincia).trim()
    if (!mapa.has(clave)) mapa.set(clave, { clave, nombre: escrito, cuenta: 0 })
    mapa.get(clave).cuenta += 1
  }

  return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}
