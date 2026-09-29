/**
 * Qué se puede postear, armado con lo que ya hay.
 *
 * Cada idea es un posteo casi listo: plantilla, textos y foto. Salen de cuatro
 * lugares que ya existen —las reseñas de la web, los seis pasos de la historia
 * de la varilla, los usos y preguntas del manual, y los números del ERP— así
 * que la pregunta de todas las semanas, "¿qué subimos?", arranca con opciones.
 *
 * Cada una lleva un `origen` que se guarda en el posteo. Así se sabe qué ideas
 * ya se usaron sin comparar textos, que cambian en cuanto alguien los edita.
 */
import { testimonials } from '../../data/siteContent'
import { STORY_CHAPTERS } from '../../data/storyChapters'
import { currentMonth, formatMonth, formatNumber } from '../lib/format'
import { HASHTAGS, captionBase } from './plantillas'

/* De la sección "Dónde trabaja la varilla" del manual. */
const APLICACIONES = [
  {
    id: 'alambrados',
    titular: 'Alambrados perimetrales.',
    bajada: 'Perimetrales y de potrero. Agujereada a la altura de cada hilo.',
    foto: 'uso-alambrado-vs-madera.jpg',
    foco: { x: 30, y: 45 },
  },
  {
    id: 'cercos-electricos',
    titular: 'Cercos eléctricos.',
    bajada: 'El plástico no conduce la corriente: el hilo pasa directo por la varilla.',
    foto: 'uso-quinta.jpg',
  },
  {
    id: 'divisiones',
    titular: 'Divisiones.',
    bajada: 'Parcelas, huertas y jardines. Varillas más juntas y menos hilos.',
    foto: 'uso-quinta-folleto.jpg',
  },
  {
    id: 'instalaciones',
    titular: 'Instalaciones rurales.',
    bajada: 'La tranquera va en sus postes; la varilla, en los tramos del cerco.',
    foto: 'uso-quinta.jpg',
  },
  {
    id: 'reparaciones',
    titular: 'Reparaciones.',
    bajada: 'Reemplazá la varilla rota sin rehacer el alambrado. Pedila agujereada a la misma altura.',
    foto: 'producto-perforada.jpg',
  },
]

/* Preguntas que llegan por WhatsApp, contestadas con lo que dice el manual. */
const PREGUNTAS = [
  {
    id: 'no-se-pudre',
    titular: '¿Por qué no se pudre?',
    items: [
      'Es plástico: no absorbe la humedad del suelo.',
      'No tiene fibras que se pudran, como la madera.',
      'No es metal: no se oxida.',
    ],
  },
  {
    id: 'cerco-electrico',
    titular: '¿Sirve para cerco eléctrico?',
    items: [
      'Sí. El plástico no conduce la corriente.',
      'El hilo pasa directo por la varilla.',
      'Pedila agujereada a la altura de cada hilo.',
    ],
  },
  {
    id: 'lisa-o-agujereada',
    titular: '¿Lisa o agujereada?',
    items: [
      'Lisa: sin agujerear.',
      'Agujereada: de fábrica, a la altura de tus hilos.',
      'Decinos cuántos hilos y a qué altura.',
    ],
  },
  {
    id: 'como-se-pide',
    titular: '¿Cómo se pide?',
    items: [
      'Metros de alambrado y localidad.',
      'Lisa o agujereada, y cuántas.',
      'Presupuesto sin IVA, vale 7 días. Flete aparte.',
    ],
  },
]

const x = (texto) => texto.replace(/(\d) x (?=\d)/g, '$1 × ')

function idea({ origen, grupo, titulo, plantilla, campos, primeraLinea, formatos, nota }) {
  return {
    origen,
    grupo,
    titulo,
    nota,
    post: {
      plantilla,
      formatos: formatos ?? ['cuadrado', 'historia'],
      campos: { ...campos, origen },
      caption: captionBase(primeraLinea),
      hashtags: HASHTAGS,
    },
  }
}

/**
 * Todas las ideas, con `usada` marcada según los posteos que ya existen.
 *
 * `hechos` y `tramos` vienen del ERP y pueden faltar: sin base no hay datos,
 * y las ideas de siempre siguen estando.
 */
export function armarIdeas({ posts = [], hechos, tramos }) {
  const usadas = new Set(posts.map((post) => post.campos?.origen).filter(Boolean))
  const lista = []

  // Del ERP primero: son las que envejecen, y las que más dicen del negocio.
  // La lista pública, la del simulador: la mayorista no se publica.
  const tramo = tramos?.find((item) => item.kind !== 'mayorista' && item.min <= 1)
  if (tramo && tramo.plain > 0) {
    const lisa = formatNumber(tramo.plain)
    const agujereada = formatNumber(tramo.drilled)
    const hasta = Number.isFinite(tramo.max) ? ` a ${formatNumber(tramo.max)}` : ' en adelante'
    lista.push(
      idea({
        origen: `precio:${tramo.plain}-${tramo.drilled}`,
        grupo: 'Del ERP',
        titulo: `Precio de lista: $ ${lisa} la lisa`,
        nota: 'Sale de la lista de precios de hoy. Si la lista cambia, aparece una idea nueva.',
        plantilla: 'producto',
        campos: {
          etiqueta: 'Precio de lista',
          titular: `$ ${lisa} + IVA.`,
          bajada: `La lisa. La agujereada, $ ${agujereada} + IVA. De ${formatNumber(tramo.min)}${hasta} unidades; por cantidad baja.`,
          foto: 'producto-lisa.jpg',
          foco: { x: 50, y: 50 },
        },
        primeraLinea: `La varilla lisa está $ ${lisa} + IVA. La agujereada, $ ${agujereada}.`,
      }),
    )
  }

  if (hechos?.localidades?.length >= 2) {
    const tres = hechos.localidades.slice(0, 3)
    const nombres = `${tres.slice(0, -1).join(', ')} y ${tres.at(-1)}`
    lista.push(
      idea({
        origen: `entregas:${tres.join('|')}`,
        grupo: 'Del ERP',
        titulo: `Llegamos a ${nombres}`,
        nota: 'Las localidades con más entregas de los últimos 60 días. Sin nombres de clientes.',
        plantilla: 'aplicaciones',
        campos: {
          etiqueta: 'Entregas',
          titular: `${nombres}.`,
          bajada: 'Adonde llegaron las últimas varillas. Coordinamos la entrega hasta el campo.',
          foto: 'producto-pallet.jpg',
          foco: { x: 50, y: 50 },
        },
        primeraLinea: `Las últimas varillas fueron a ${nombres}.`,
      }),
    )
  }

  if (hechos?.varillasMes >= 100) {
    const mes = formatMonth(currentMonth()).replace(/ de \d+$/, '')
    const cantidad = formatNumber(hechos.varillasMes)
    lista.push(
      idea({
        origen: `varillas:${currentMonth()}`,
        grupo: 'Del ERP',
        titulo: `${cantidad} varillas entregadas en ${mes}`,
        nota: 'Lo entregado en pedidos de este mes. Conviene subirlo a fin de mes, con el número cerrado.',
        plantilla: 'producto',
        campos: {
          etiqueta: `Entregas de ${mes}`,
          titular: `${cantidad} varillas.`,
          bajada: `Lo que salió de Luján en ${mes}.`,
          foto: 'producto-pallet.jpg',
          foco: { x: 50, y: 50 },
        },
        primeraLinea: `En ${mes} entregamos ${cantidad} varillas.`,
      }),
    )
  }

  for (const resena of testimonials) {
    lista.push(
      idea({
        origen: `resena:${resena.author}`,
        grupo: 'Reseñas',
        titulo: resena.author,
        nota: resena.text,
        plantilla: 'pruebas',
        campos: {
          etiqueta: 'Reseña en Google',
          cita: `"${resena.text}"`,
          quien: resena.author,
        },
        primeraLinea: `"${resena.text}" — ${resena.author}.`,
      }),
    )
  }

  for (const capitulo of STORY_CHAPTERS) {
    const paso = Number(capitulo.step)
    lista.push(
      idea({
        origen: `proceso:${paso}`,
        grupo: 'Proceso',
        titulo: `${capitulo.step} · ${capitulo.title}`,
        plantilla: 'proceso',
        campos: {
          paso,
          total: STORY_CHAPTERS.length,
          titular: `${capitulo.title}.`,
          bajada: x(capitulo.description),
        },
        primeraLinea: `Paso ${paso} de ${STORY_CHAPTERS.length}: ${capitulo.title.toLowerCase()}.`,
      }),
    )
  }

  for (const aplicacion of APLICACIONES) {
    lista.push(
      idea({
        origen: `aplicacion:${aplicacion.id}`,
        grupo: 'Aplicaciones',
        titulo: aplicacion.titular.replace(/\.$/, ''),
        plantilla: 'aplicaciones',
        campos: {
          etiqueta: 'Aplicaciones',
          titular: aplicacion.titular,
          bajada: aplicacion.bajada,
          foto: aplicacion.foto,
          foco: aplicacion.foco ?? { x: 50, y: 50 },
        },
        primeraLinea: aplicacion.bajada.split('.')[0] + '.',
      }),
    )
  }

  for (const pregunta of PREGUNTAS) {
    lista.push(
      idea({
        origen: `pregunta:${pregunta.id}`,
        grupo: 'Preguntas',
        titulo: pregunta.titular,
        plantilla: 'educacion',
        campos: { etiqueta: 'Preguntas', titular: pregunta.titular, items: pregunta.items },
        primeraLinea: pregunta.titular,
      }),
    )
  }

  return lista.map((item) => ({ ...item, usada: usadas.has(item.origen) }))
}
