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

export const testimonials = [
  {
    quote:
      'Cambiamos varios kilómetros de alambrado con varillas de Recuvarilla y el ahorro fue notable, sin resignar calidad.',
    author: 'Cliente de campo — Provincia de Buenos Aires',
  },
  {
    quote:
      'Buena atención, cumplieron con el plazo de entrega acordado y la varilla llegó en muy buen estado.',
    author: 'Cliente de campo — La Pampa',
  },
]
