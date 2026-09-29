/**
 * El calendario de redes: qué se publica cada día y con qué texto.
 *
 * Acá se guardan los datos de cada pieza, no la imagen. La imagen la arma el
 * navegador con las plantillas del manual cuando se la pide (ver
 * `src/erp/redes/`), así que un posteo se puede corregir hasta el último
 * momento sin rediseñar nada.
 */
import { db, unwrap } from './client'

/** Los posteos entre dos fechas, en el orden en que salen. */
export async function listPosts({ desde, hasta } = {}) {
  let query = db().from('social_posts').select('*').order('fecha').order('created_at')
  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)
  return unwrap(await query)
}

export async function getPost(id) {
  return unwrap(await db().from('social_posts').select('*').eq('id', id).single())
}

export async function createPost(values) {
  return unwrap(await db().from('social_posts').insert(values).select().single())
}

/**
 * Marcar como publicado deja anotado cuándo; volver atrás lo borra, para que
 * `publicado_at` nunca diga una fecha de algo que figura sin publicar.
 */
export async function updatePost(id, changes) {
  const extra = {}
  if (changes.estado === 'publicado' && !changes.publicado_at) {
    extra.publicado_at = new Date().toISOString()
  } else if (changes.estado && changes.estado !== 'publicado') {
    extra.publicado_at = null
  }

  return unwrap(
    await db()
      .from('social_posts')
      .update({ ...changes, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),
  )
}

export async function deletePost(id) {
  unwrap(await db().from('social_posts').delete().eq('id', id))
}

/*
  Las fotos del celular pesan de 4 a 12 MB y la pieza más grande mide 1920 px
  de alto. Se achican antes de subir: mandar el original sólo gasta datos
  móviles y espacio, y no se ve mejor.
*/
const LADO_MAXIMO = 2160

async function achicar(file) {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo leer la foto.'))),
      'image/jpeg',
      0.88,
    ),
  )
}

/**
 * Sube una foto al bucket `redes` y devuelve su URL pública.
 *
 * El nombre lleva la fecha y un sufijo al azar: dos fotos que se llamen
 * "IMG_0001.jpg" desde dos teléfonos no se pisan entre sí.
 */
export async function uploadPhoto(file) {
  const blob = await achicar(file)
  const hoy = new Date().toISOString().slice(0, 10)
  const path = `${hoy.slice(0, 7)}/${hoy}-${crypto.randomUUID().slice(0, 8)}.jpg`

  unwrap(
    await db().storage.from('redes').upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
    }),
  )

  return db().storage.from('redes').getPublicUrl(path).data.publicUrl
}

/**
 * Datos del negocio que sirven para contar algo en redes.
 *
 * Son dos preguntas chicas: a qué localidades llegaron las entregas de los
 * últimos dos meses, y cuántas varillas salieron en el mes (por la fecha del
 * pedido, que es la que tienen todos). Van sin nombres de
 * clientes a propósito: lo que se publica es "llegamos a Tandil", nunca a
 * quién.
 */
export async function loadSocialFacts() {
  const hace60 = new Date()
  hace60.setDate(hace60.getDate() - 60)
  const desde = hace60.toISOString().slice(0, 10)

  const hoy = new Date()
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`

  const [entregas, items] = await Promise.all([
    db()
      .from('orders')
      .select('localidad, provincia')
      .eq('estado', 'entregado')
      .gte('fecha', desde)
      .not('localidad', 'is', null)
      .then(unwrap),
    db()
      .from('order_items')
      .select('cantidad, orders!inner(estado, fecha), products!inner(se_produce)')
      .eq('orders.estado', 'entregado')
      .gte('orders.fecha', inicioMes)
      // Sólo lo que se fabrica: el alambre de reventa no son varillas.
      .eq('products.se_produce', true)
      .then(unwrap),
  ])

  const porLocalidad = new Map()
  for (const { localidad } of entregas) {
    const nombre = localidad.trim()
    if (nombre) porLocalidad.set(nombre, (porLocalidad.get(nombre) ?? 0) + 1)
  }

  return {
    localidades: [...porLocalidad.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nombre]) => nombre),
    varillasMes: items.reduce((suma, item) => suma + item.cantidad, 0),
  }
}
