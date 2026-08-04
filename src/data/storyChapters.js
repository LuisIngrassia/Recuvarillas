/**
 * Capítulos de la historia de la varilla. `range` es el tramo del scroll
 * (0 a 1) que ocupa cada uno: lo usan tanto la escena 3D para animar como
 * la capa de texto para saber qué mostrar, así nunca quedan desfasados.
 *
 * Este archivo no importa three.js a propósito, para que la capa de texto
 * no arrastre la librería al bundle inicial.
 */
export const STORY_CHAPTERS = [
  {
    step: '01',
    title: 'Botellas recuperadas',
    description:
      'Todo empieza con envases plásticos en desuso, que juntamos y clasificamos según su tipo.',
    range: [0.0, 0.13],
  },
  {
    step: '02',
    title: 'Entran en la tolva',
    description:
      'Las botellas caen en la tolva, donde se trituran y quedan listas para entrar al proceso.',
    range: [0.13, 0.28],
  },
  {
    step: '03',
    title: 'Se funde el plástico',
    description:
      'Dentro del cañón, el material se calienta hasta fundirse por completo en una masa homogénea.',
    range: [0.28, 0.44],
  },
  {
    step: '04',
    title: 'Pasa por el molde',
    description:
      'El plástico fundido entra al molde y sale del otro lado ya perfilado: una varilla de 3 x 3 x 120 cm.',
    range: [0.44, 0.62],
  },
  {
    step: '05',
    title: 'Perforado',
    description:
      'Se perfora a medida para que los alambres pasen a la altura justa de cada tipo de alambrado.',
    range: [0.62, 0.78],
  },
  {
    step: '06',
    title: 'En la cerca',
    description:
      'La varilla llega al campo y entra en servicio: resistente, liviana y sin oxidarse nunca.',
    range: [0.78, 0.96],
  },
]

/** Tramos indexados por nombre, para leerlos cómodo desde la escena 3D. */
export const CHAPTER_RANGES = {
  bottles: STORY_CHAPTERS[0].range,
  hopper: STORY_CHAPTERS[1].range,
  melt: STORY_CHAPTERS[2].range,
  mold: STORY_CHAPTERS[3].range,
  drill: STORY_CHAPTERS[4].range,
  fence: STORY_CHAPTERS[5].range,
}

/** Índice del capítulo activo según el progreso del scroll. */
export const chapterIndexAt = (progress) => {
  let index = 0
  for (let i = 0; i < STORY_CHAPTERS.length; i += 1) {
    if (progress >= STORY_CHAPTERS[i].range[0]) index = i
  }
  return index
}
