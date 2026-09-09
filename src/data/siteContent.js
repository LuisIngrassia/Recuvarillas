// Contenido de ejemplo (placeholder). Reemplazar por los textos, datos e imágenes reales de Recuvarilla.

export const company = {
  name: 'Recuvarilla',
  tagline: 'Varillas para el campo, hechas con plástico recuperado',
  phone: '+54 9 11 2395-8302',
  whatsapp: '5491123958302',
  email: 'recuvarilla@gmail.com',
  address: 'Luján, Buenos Aires, Argentina',
  hours: 'Lunes a sabado de 8 a 18 hs',
  social: {
    instagram: '#recuvarilla',
    facebook: '#recuvarilla',
    tiktok: '#recuvarilla',
    youtube: '#recuvarilla',
  },
}

export const navLinks = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Productos', href: '#productos' },
  { label: 'Presupuesto', href: '#presupuesto' },
  { label: 'Proceso', href: '#proceso' },
  { label: 'Nosotros', href: '#nosotros' },
  { label: 'Contacto', href: '#contacto' },
]

export const products = [
  {
    name: 'Varilla estándar para alambrado',
    description:
      'Varilla de plástico recuperado apta para tejidos y alambrados perimetrales, con perforaciones a medida.',
    specs: ['Largo: 120 cm', 'Dimensiones: 3 x 3 cm ', 'Uso: alambrados y cercos eléctricos'],
    // Arranca siempre con una foto y no con un video: el carrusel reproduce lo
    // que está a la vista, y la sección cae debajo del pliegue, así que un
    // video primero se pondría a correr sin que nadie lo esté mirando.
    media: [
      { type: 'image', src: 'varilla-sa.jpg' },
      { type: 'video', src: 'videos/comun-vid.mp4', poster: 'videos/comun-vid-poster.jpg' },
      { type: 'image', src: 'stock.png' },
    ],
    datasheet: 'fichas/varilla-estandar.pdf',
  },
  {
    name: 'Varilla estandar perforada a medida',
    description:
      'Cortamos, perforamos y adaptamos la varilla según las necesidades del establecimiento.',
    specs: ['Largo: 120 cm', 'Dimensiones: 3 x 3 cm ', 'Perforaciones a pedido', 'Uso: alambrados y cercos eléctricos'],
    media: [
      { type: 'image', src: 'alambrado-1.jpg' },
      {
        type: 'video',
        src: 'videos/agujereada-vid.mp4',
        poster: 'videos/agujereada-vid-poster.jpg',
      },
      { type: 'image', src: 'agujereada-cerca.jpg' },
      { type: 'image', src: 'stock.png' },
    ],
    datasheet: 'fichas/varilla-perforada.pdf',
  },
  {
    name: 'Alambre 17 / 15 galvanizado para alambrado rural',
    description:
      'El mejor alambre para alambrar todo ',
    specs: ['Largo: 1000 mts', "Dimensiones: 17 / 15", 'Uso: alambrados y cercos eléctricos'],
    media: [
      { type: 'image', src: 'alambre.jpg' },
      { type: 'image', src: 'alambre2.jpg' },
    ],
    datasheet: 'fichas/varilla-perforada.pdf',
  },
]

export const benefits = [
  {
    title: 'Precio competitivo',
    description:
      'Al trabajar con material recuperado, ofrecemos costos por debajo del mercado tradicional.',
  },
  {
    title: 'Sustentable',
    description:
      'Le damos una segunda vida útil al plástico, evitando que termine en el ambiente.',
  },
  {
    title: 'No se oxida ni se pudre',
    description:
      'A diferencia de la madera y el metal, resiste la intemperie sin mantenimiento.',
  },
  {
    title: 'Entrega a campo',
    description:
      'Coordinamos la logística para que el pedido llegue directo al establecimiento.',
  },
]

/**
 * Las reseñas que muestra la sección de testimonios.
 *
 * Se cargan a mano: cuando entra una buena en el perfil de Google, se copia
 * acá. No se traen solas de Google a propósito —el porqué, y cómo copiarlas
 * bien, está en `docs/resenas.md`—.
 *
 * De cada una:
 *
 * - `author`  obligatorio. Como figura en Google: el nombre y, si está, la
 *             inicial del apellido. Nunca inventar ni completar el apellido.
 * - `text`    obligatorio. La reseña tal cual la escribieron, sin retocar.
 * - `rating`  de 1 a 5. Sin esto la tarjeta sale sin estrellas.
 * - `when`    cuándo la publicaron, en texto libre: 'Marzo de 2026'. Va el mes
 *             y no "hace 3 meses" para que no envejezca sola.
 * - `place`   opcional, de dónde es. Sale abajo del nombre.
 * - `photo`   opcional, un archivo dentro de `public/`. Sin foto se dibuja la
 *             inicial del nombre, que queda bien y evita bajar una imagen más.
 * - `url`     opcional, el enlace a esa reseña en Google.
 */
export const testimonials = [
  {
    author: 'Juan Cordone',
    place: 'Provincia de Buenos Aires',
    rating: 5,
    text: 'Cambiamos varios kilómetros de alambrado, todo excelente.',
  },
  {
    author: 'Lucas Garde',
    place: 'La Pampa, Argentina',
    rating: 5,
    text: 'Buena atención, cumplieron con el plazo de entrega.',
  },
  {
    author: 'Alejandro García Lemos',
    rating: 5,
    text: "Me sacaron todas las dudas que tenía sobre las varillas.",
  },
  {
    author: 'Juan seg. Addamo',
    rating: 5,
    text: 'Excelente atención.',
  },
  {
    author: 'Nahuel David',
    rating: 5,
    text: 'Muy satisfecho con el servicio.',
  },
  {
    author: 'Joaquin Sartini',
    rating: 5,
    text: 'Gran calidad en las varillas de 1,20.',
  },
]

/**
 * El resumen del perfil de Google: el promedio, cuántas reseñas hay y el
 * enlace al perfil.
 *
 * Es la insignia grande de la sección y probablemente lo que más convence,
 * porque ese número lo pone Google y no nosotros. Justamente por eso tiene que
 * ser el real: se copia del perfil y se revisa cada tanto, aunque no se
 * agreguen reseñas nuevas acá abajo.
 *
 * Arranca en `null` para no publicar un promedio inventado. Mientras lo esté,
 * la insignia no se dibuja y la sección muestra sólo las tarjetas. Cuando
 * estén los datos de verdad:
 *
 *     export const reviewsSummary = {
 *       rating: 4.9,
 *       total: 27,
 *       url: 'https://g.page/r/CXxxxxxxxxxxEBM',
 *     }
 */
export const reviewsSummary = "https://g.page/r/CUp2AeSkJoIDEBM/review"

/**
 * El enlace para que un cliente escriba su reseña.
 *
 * Abre el formulario de Google con las estrellas listas para tocar, sin pasar
 * por buscar el negocio primero. Ese paso de menos es casi todo: la mayoría de
 * la gente que quiere dejar una reseña abandona buscando dónde.
 *
 * Se saca del panel del perfil de empresa, en **Pedir reseñas**, y tiene la
 * forma `https://g.page/r/XXXXXXXX/review`. Si esa opción no aparece, el
 * enlace largo hace lo mismo y se arma con el Place ID:
 * `https://search.google.com/local/writereview?placeid=ChIJ...`
 *
 * Vacío, el botón de la sección de testimonios no se dibuja. El mismo enlace
 * sirve para mandar por WhatsApp después de una entrega, que es cuando más
 * gente contesta.
 */
export const reviewLink = 'https://g.page/r/CUp2AeSkJoIDEBM/review'
