/**
 * Los seis tipos de posteo del manual de marca y lo que pide cada uno.
 *
 * `campos` describe el formulario: qué se completa y con qué control. El
 * diseño de cada uno vive en `Pieza.jsx`; acá sólo está qué datos lleva.
 *
 * `fondo` es lo que la pieza aporta al feed. El manual pide que el feed
 * alterne fondos blancos, fotos y un posteo oscuro cada tanto, y el calendario
 * lo usa para avisar cuando se repite.
 */

/** Lo que va al pie de todas las piezas. Viene del manual, igual que el diseño. */
export const CONTACTOS = ['WhatsApp 11 2395-8302', '@recuvarilla', 'recuvarilla.com.ar']

export const FORMATOS = {
  cuadrado: { nombre: 'Feed', medida: '1080 × 1080', ancho: 1080, alto: 1080 },
  historia: { nombre: 'Historia', medida: '1080 × 1920', ancho: 1080, alto: 1920 },
}

export const FONDOS = {
  blanco: { nombre: 'Blanco', muestra: '#FFFFFF' },
  foto: { nombre: 'Foto', muestra: '#6B7F5A' },
  oscuro: { nombre: 'Oscuro', muestra: '#1D2120' },
  hormigon: { nombre: 'Hormigón', muestra: '#EEF0EC' },
}

/**
 * La tipografía del manual para medidas: "3 × 3 × 120 cm", con el signo de
 * multiplicar y sin que el renglón se corte en el medio de una medida. No se
 * aplica a las reseñas, que van tal cual las escribieron.
 */
export function tipografia(texto) {
  return String(texto ?? '')
    .replace(/(\d)\s*[x×]\s*(?=\d)/g, '$1\u00a0×\u00a0')
    .replace(/(\d)\s+(cm|mm|m|kg|km|unidades)\b/g, '$1\u00a0$2')
    .replace(/\$\s+(?=\d)/g, '$\u00a0')
}

/** En qué anda cada posteo. Se sube a mano, así que `publicado` lo marca quien lo subió. */
export const ESTADOS = {
  borrador: { label: 'Borrador', tone: 'neutral' },
  listo: { label: 'Listo para subir', tone: 'info' },
  publicado: { label: 'Publicado', tone: 'good' },
}

const diaLargo = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

export function fechaLarga(fechaIso) {
  const [anio, mes, dia] = fechaIso.split('-').map(Number)
  return diaLargo.format(new Date(anio, mes - 1, dia))
}

const HASHTAGS = '#alambrado #campo #hechoenlujan'

export const PLANTILLAS = {
  producto: {
    nombre: 'Producto',
    fondo: 'blanco',
    para: 'La varilla en sí: medidas, lisa o agujereada, precio.',
    campos: [
      { key: 'etiqueta', label: 'Etiqueta', tipo: 'texto' },
      { key: 'titular', label: 'Titular', tipo: 'texto', hint: 'Corto y con un número: medida, precio, metros.' },
      { key: 'bajada', label: 'Bajada', tipo: 'parrafo' },
      { key: 'foto', label: 'Foto', tipo: 'foto' },
    ],
    inicial: {
      etiqueta: 'Producto',
      titular: '3 × 3 × 120 cm.',
      bajada: 'Varilla de plástico recuperado. Lisa o agujereada a la medida de tu alambrado.',
      foto: 'producto-perforada.jpg',
      foco: { x: 50, y: 30 },
    },
  },
  aplicaciones: {
    nombre: 'Aplicaciones',
    fondo: 'foto',
    para: 'La varilla trabajando: alambrados, cercos eléctricos, divisiones.',
    campos: [
      { key: 'etiqueta', label: 'Etiqueta', tipo: 'texto' },
      { key: 'titular', label: 'Titular', tipo: 'texto' },
      { key: 'bajada', label: 'Bajada', tipo: 'parrafo' },
      { key: 'foto', label: 'Foto', tipo: 'foto' },
    ],
    inicial: {
      etiqueta: 'Aplicaciones',
      titular: 'Alambrados perimetrales.',
      bajada: 'Agujereada a la altura de cada hilo.',
      foto: 'uso-alambrado-vs-madera.jpg',
      foco: { x: 30, y: 45 },
    },
  },
  educacion: {
    nombre: 'Educación',
    fondo: 'oscuro',
    para: 'Una pregunta de las que llegan por WhatsApp, contestada en tres líneas.',
    campos: [
      { key: 'etiqueta', label: 'Etiqueta', tipo: 'texto' },
      { key: 'titular', label: 'Pregunta', tipo: 'texto' },
      { key: 'items', label: 'Respuestas', tipo: 'lista', hint: 'Una por renglón. Tres entran bien.' },
    ],
    inicial: {
      etiqueta: 'Educación',
      titular: '¿Por qué no se pudre?',
      items: [
        'Es plástico: no absorbe la humedad del suelo.',
        'No tiene fibras que se pudran, como la madera.',
        'No es metal: no se oxida.',
      ],
    },
  },
  marca: {
    nombre: 'Marca',
    fondo: 'blanco',
    para: 'Una frase de marca con el logo grande. Para usar poco.',
    campos: [{ key: 'titular', label: 'Frase', tipo: 'texto' }],
    inicial: { titular: 'Hecha para el campo. Pensada para durar.' },
  },
  proceso: {
    nombre: 'Proceso',
    fondo: 'blanco',
    para: 'Cómo se hace, en seis pasos: de la botella a la cerca.',
    campos: [
      { key: 'paso', label: 'Paso', tipo: 'paso' },
      { key: 'titular', label: 'Titular', tipo: 'texto' },
      { key: 'bajada', label: 'Bajada', tipo: 'parrafo' },
    ],
    inicial: {
      paso: 4,
      total: 6,
      titular: 'Pasa por el molde.',
      bajada: 'El plástico fundido entra al molde y sale del otro lado ya perfilado: una varilla de 3 × 3 × 120 cm.',
    },
  },
  pruebas: {
    nombre: 'Pruebas',
    fondo: 'hormigon',
    para: 'Una reseña de Google, tal cual la escribieron.',
    campos: [
      { key: 'etiqueta', label: 'Etiqueta', tipo: 'texto' },
      { key: 'cita', label: 'Reseña', tipo: 'parrafo', hint: 'Tal cual, sin retocar. Con las comillas.' },
      { key: 'quien', label: 'Nombre', tipo: 'texto', hint: 'Como figura en Google.' },
    ],
    inicial: {
      etiqueta: 'Reseña en Google',
      cita: '"Gran calidad en las varillas de 1,20."',
      quien: 'Joaquin Sartini',
    },
  },
}

export const PLANTILLA_KEYS = Object.keys(PLANTILLAS)

/**
 * Un texto de arranque que ya cumple las reglas del manual para Instagram: la
 * primera línea se sostiene sola, hay un número y una acción. Es un punto de
 * partida para editar, no para publicar tal cual.
 */
export function captionBase(primeraLinea) {
  return `${primeraLinea}\n\n3 × 3 × 120 cm, plástico recuperado, hecha en Luján.\n\nPresupuesto por WhatsApp: link en el perfil.`
}

/** Un posteo nuevo de esa plantilla, con los textos de ejemplo del manual. */
export function postNuevo(plantilla, fecha) {
  const def = PLANTILLAS[plantilla]
  const campos = structuredClone(def.inicial)
  return {
    fecha,
    plantilla,
    formatos: ['cuadrado', 'historia'],
    campos,
    caption: captionBase(campos.titular ?? campos.cita ?? ''),
    hashtags: HASHTAGS,
    estado: 'borrador',
  }
}

export { HASHTAGS }
