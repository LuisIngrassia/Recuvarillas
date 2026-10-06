/**
 * Lo que dice cada documento de cada producto.
 *
 * Los tres papeles —lista de precios, folleto y ficha técnica— eran de la
 * varilla y tenían el texto escrito en el código. Con más productos eso no
 * alcanza: el poste o las tablas necesitan su ficha, y armarla no puede
 * depender de que alguien toque el código.
 *
 * Así que el texto vive en la ficha del producto (`products.documentos`, un
 * jsonb) y lo que hay acá es:
 *
 * - qué campos tiene cada documento y cómo se editan (`CAMPOS`),
 * - con qué arranca un producto que todavía no tiene nada cargado
 *   (`contenidoInicial`): la varilla, con lo que ya decían sus papeles; los
 *   demás, con su nombre y las condiciones que valen para todo.
 *
 * Una sección vacía no sale impresa. Un producto recién creado ya tiene sus
 * tres documentos con un click: salen cortos, y se completan de a poco.
 */
import { QUOTE_VALID_DAYS } from '../../data/pricing'
import { TAGLINE } from './documentos'
import dimensionesPerforada from '../../../brand/assets/producto/dimensiones-perforada.svg?url'
import dimensionesLisa from '../../../brand/assets/producto/dimensiones-lisa.svg?url'
import fotoUso from '../../../brand/assets/fotos/uso-alambrado-vs-madera.jpg'
import fotoPallet from '../../../brand/assets/fotos/producto-pallet.jpg'
import fotoLisa from '../../../brand/assets/fotos/producto-lisa.jpg'
import fotoPerforada from '../../../brand/assets/fotos/producto-perforada.jpg'
import fotoQuinta from '../../../brand/assets/fotos/uso-quinta.jpg'

/**
 * Las imágenes del manual de marca que se pueden elegir sin subir nada.
 *
 * Se guardan como `marca:<clave>` y no como la URL: la URL de un archivo del
 * proyecto cambia con cada build, y guardada en la base dejaría de andar en el
 * deploy siguiente. Lo que se sube desde el ERP sí se guarda como URL, porque
 * vive en Supabase y no se mueve.
 */
export const IMAGENES_MARCA = {
  'dimensiones-perforada': { url: dimensionesPerforada, nombre: 'Dibujo con medidas · agujereada' },
  'dimensiones-lisa': { url: dimensionesLisa, nombre: 'Dibujo con medidas · lisa' },
  'uso-alambrado': { url: fotoUso, nombre: 'Foto · alambrado contra la madera', encuadre: '35% 45%' },
  pallet: { url: fotoPallet, nombre: 'Foto · pallet de varillas', encuadre: '50% 30%' },
  'producto-lisa': { url: fotoLisa, nombre: 'Foto · varilla lisa' },
  'producto-perforada': { url: fotoPerforada, nombre: 'Foto · varilla agujereada' },
  'uso-quinta': { url: fotoQuinta, nombre: 'Foto · quinta' },
}

/** De lo guardado a algo que se puede poner en un `src`. */
export function urlDeImagen(valor) {
  if (!valor) return null
  if (valor.startsWith('marca:')) return IMAGENES_MARCA[valor.slice(6)]?.url ?? null
  return valor
}

/** Las condiciones que valen para cualquier cosa que se venda. */
const CONDICIONES = [
  `El presupuesto vale ${QUOTE_VALID_DAYS} días.`,
  'Flete aparte: lo cotiza el expreso según la localidad. Despacho desde Luján.',
  'Precios sin IVA. Si necesitás factura con IVA, consultanos.',
  'Precios sujetos a modificación sin previo aviso.',
]

const LOGISTICA = [
  { clave: 'Plazo de entrega', valor: 'Según cantidad y localidad del pedido.' },
  {
    clave: 'Flete',
    valor:
      'El valor del presupuesto corresponde exclusivamente al producto. Los costos de envío desde nuestra planta (Luján) hasta el destino son a cargo del cliente.',
  },
]

/**
 * Lo que decían los papeles de la varilla cuando estaban escritos en el
 * código. Es su punto de partida: la primera vez que alguien guarda, queda
 * todo en la base y esto ya no se lee más.
 */
const VARILLA = {
  titular: 'Varilla 3 × 3 × 120 cm',
  bajada: TAGLINE,
  condiciones: CONDICIONES,

  folleto_tipo: 'Varillas para alambrado',
  folleto_titular: 'Hecha para el campo.\nPensada para durar.',
  folleto_bajada:
    'Varillas de plástico recuperado para alambrados, hechas en Luján. 3 × 3 × 120 cm, lisas o agujereadas a la medida de tu alambrado.',
  foto_1: 'marca:uso-alambrado',
  foto_2: 'marca:pallet',
  dibujo: 'marca:dimensiones-perforada',
  especificaciones: [
    { clave: 'Largo', valor: '120 cm' },
    { clave: 'Sección', valor: '3 × 3 cm' },
    { clave: 'Peso aproximado', valor: '1.000 g' },
    { clave: 'Material', valor: 'Polipropileno (PP) recuperado de descarte industrial' },
    { clave: 'Protección UV', valor: 'Sí, estabilizante UV incorporado' },
    { clave: 'Agujereado', valor: 'Opcional, a pedido' },
    { clave: 'Presentación', valor: 'Packs de 10 unidades · mínimo 10 packs' },
    { clave: 'Flete', valor: 'A cargo del comprador, despacho desde Luján' },
  ],
  ventajas: [
    'No se pudre ni se oxida: aguanta la humedad y el sol.',
    'No lo atacan los insectos.',
    'Sin mantenimiento: no se pinta ni se repone.',
    'Agujereada de fábrica a la altura de cada hilo.',
    'Plástico: sirve para cercos eléctricos.',
    'Precio más bajo por cantidad.',
  ],

  ficha_titular: 'Varilla estándar 3 × 3 × 120 cm',
  ficha_bajada: 'Varilla para alambrado de plástico recuperado. Industria argentina.',
  revision: '00',
  identificacion: [
    { clave: 'Producto', valor: 'Varilla estándar' },
    { clave: 'Código', valor: 'RV-STD-120' },
    { clave: 'Aplicación', valor: 'Alambrado rural' },
    { clave: 'Proceso', valor: 'Inyección' },
  ],
  caracteristicas: [
    { clave: 'Largo', valor: '120 cm' },
    { clave: 'Sección', valor: '3 cm × 3 cm' },
    { clave: 'Peso unitario', valor: '1000 g', pendiente: true },
    { clave: 'Material', valor: 'Polipropileno (PP) reciclado de scrap industrial' },
    { clave: 'Color', valor: 'Grafito (variable según lote de scrap)' },
    { clave: 'Estabilización UV', valor: 'Sí', pendiente: true },
    { clave: 'Perforado', valor: 'Opcional, cantidad a pedido · con cargo adicional' },
    { clave: 'Función', valor: 'Guía y alineación de hilos entre postes' },
    { clave: 'Origen', valor: 'Luján, Buenos Aires · Industria argentina' },
  ],
  comp_propio: 'Recuvarilla',
  comp_propias: [
    'No se pudre ni junta hongos',
    'No la atacan insectos ni roedores',
    'No se oxida',
    'Flexible: absorbe golpes en lugar de quebrarse',
    'Sin mantenimiento anual',
    'Fabricada con scrap industrial recuperado',
  ],
  comp_otro: 'Varilla de madera',
  comp_otras: [
    'Se pudre por contacto con humedad',
    'Vulnerable a insectos',
    'Se quiebra ante el golpe del animal',
    'Requiere reposición periódica',
    'No es ecológico',
    'Precio creciente por escasez',
  ],
  comp_nota:
    'Los puntos de la columna izquierda describen el comportamiento esperado del material. Los que requieren un número medido están señalados como pendientes: hasta tener el ensayo, no se publican como especificación.',
  logistica: [
    { clave: 'Unidades por paquete', valor: '10 u.', pendiente: true },
    { clave: 'Compra mínima', valor: '10 paquetes', pendiente: true },
    ...LOGISTICA,
    {
      clave: 'Separación recomendada entre varillas',
      valor: '2 m (adaptable según el requerimiento de tensión y tipo de ganado).',
    },
  ],
  logistica_nota:
    'La separación de 2 m surge del criterio de cálculo del proyecto. Conviene validarla con un alambrador antes de publicarla como recomendación de instalación.',
}

/**
 * Con qué arranca un producto que todavía no tiene nada guardado.
 *
 * La varilla se reconoce por su código, el que le pone el schema. Cualquier
 * otro arranca con su nombre y lo que vale para todo; lo demás —medidas,
 * fotos, ventajas— lo sabe quien conoce el producto, y se completa desde el
 * editor del documento.
 */
export function contenidoInicial(producto) {
  if (producto?.codigo === 'VAR') return VARILLA

  const nombre = producto?.nombre ?? ''

  return {
    titular: nombre,
    bajada: '',
    condiciones: CONDICIONES,

    folleto_tipo: 'Productos para alambrado',
    folleto_titular: nombre,
    folleto_bajada: '',
    foto_1: null,
    foto_2: null,
    dibujo: null,
    especificaciones: [],
    ventajas: [],

    ficha_titular: nombre,
    ficha_bajada: '',
    revision: '00',
    identificacion: [
      { clave: 'Producto', valor: nombre },
      { clave: 'Código', valor: producto?.codigo ?? '' },
    ],
    caracteristicas: [],
    comp_propio: 'Recuvarilla',
    comp_propias: [],
    comp_otro: '',
    comp_otras: [],
    comp_nota: '',
    logistica: LOGISTICA,
    logistica_nota: '',
  }
}

/**
 * El contenido con el que se arma el documento: lo guardado, y para lo que
 * falta, el punto de partida. Campo por campo, así un campo que se agregue
 * más adelante aparece en los productos que ya tenían todo guardado.
 */
export function contenidoDe(producto) {
  return { ...contenidoInicial(producto), ...(producto?.documentos ?? {}) }
}

/**
 * Qué se edita en cada documento.
 *
 * Los campos con la misma clave son el mismo dato: el titular de la lista de
 * precios y el dibujo de la ficha se corrigen en un lado y cambian en todos
 * los papeles que lo usan.
 *
 * Tipos: `texto` (un renglón), `parrafo`, `lista` (un ítem por renglón),
 * `pares` (tabla de dato y valor; con `pendiente` se puede marcar lo que
 * todavía no se midió) e `imagen`.
 */
export const CAMPOS = {
  'lista-de-precios': [
    { clave: 'titular', tipo: 'texto', label: 'Titular' },
    { clave: 'bajada', tipo: 'parrafo', label: 'Bajada', hint: 'Debajo del titular. Al final se agrega solo «Precio por unidad, sin IVA».' },
    { clave: 'condiciones', tipo: 'lista', label: 'Condiciones', hint: 'Una por renglón.' },
  ],
  folleto: [
    { clave: 'folleto_tipo', tipo: 'texto', label: 'Rótulo de arriba' },
    { clave: 'folleto_titular', tipo: 'parrafo', label: 'Titular', hint: 'Cada renglón sale en una línea.' },
    { clave: 'folleto_bajada', tipo: 'parrafo', label: 'Bajada' },
    { clave: 'foto_1', tipo: 'imagen', label: 'Foto grande' },
    { clave: 'foto_2', tipo: 'imagen', label: 'Foto chica' },
    { clave: 'dibujo', tipo: 'imagen', label: 'Dibujo con medidas', hint: 'Es el mismo de la ficha técnica.' },
    { clave: 'especificaciones', tipo: 'pares', label: 'Especificaciones' },
    { clave: 'ventajas', tipo: 'lista', label: 'Por qué conviene', hint: 'Una por renglón.' },
  ],
  'ficha-tecnica': [
    { clave: 'ficha_titular', tipo: 'texto', label: 'Titular' },
    { clave: 'ficha_bajada', tipo: 'parrafo', label: 'Bajada' },
    { clave: 'revision', tipo: 'texto', label: 'Revisión' },
    { clave: 'identificacion', tipo: 'pares', label: 'Recuadro de identificación', hint: 'Producto, código, aplicación… Entran cuatro por fila.' },
    { clave: 'dibujo', tipo: 'imagen', label: 'Dibujo con medidas', hint: 'Es el mismo del folleto.' },
    { clave: 'caracteristicas', tipo: 'pares', pendiente: true, label: 'Características' },
    { clave: 'comp_propio', tipo: 'texto', label: 'Comparación · nuestra columna' },
    { clave: 'comp_propias', tipo: 'lista', label: 'Comparación · lo nuestro', hint: 'Uno por renglón. Si queda vacío, la comparación no sale.' },
    { clave: 'comp_otro', tipo: 'texto', label: 'Comparación · contra qué', hint: 'Por ejemplo, «Poste de madera».' },
    { clave: 'comp_otras', tipo: 'lista', label: 'Comparación · lo de la otra columna', hint: 'Uno por renglón.' },
    { clave: 'comp_nota', tipo: 'parrafo', label: 'Comparación · nota al pie' },
    { clave: 'logistica', tipo: 'pares', pendiente: true, label: 'Presentación y logística' },
    { clave: 'logistica_nota', tipo: 'parrafo', label: 'Presentación y logística · nota al pie' },
  ],
}

/** Qué parte de la foto queda a la vista cuando se recorta. */
export function encuadreDeImagen(valor) {
  if (!valor?.startsWith('marca:')) return undefined
  return IMAGENES_MARCA[valor.slice(6)]?.encuadre
}

/** Lo de una lista o tabla que vale la pena imprimir. */
export const conTexto = (items) =>
  (items ?? []).filter((item) => (typeof item === 'string' ? item.trim() : item?.clave?.trim() || item?.valor?.trim()))

/** Un valor que es un número —«120 cm», «1.000 g»— va en la tipografía de datos. */
export const esDato = (valor) => /^[\d.,]/.test(String(valor ?? '').trim())
