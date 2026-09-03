/**
 * Los papeles que se reparten, y de quién llevan el contacto.
 *
 * Hasta ahora eran archivos HTML sueltos que se editaban a mano y se guardaban
 * en la compu de cada uno. Eso tenía dos problemas: la lista de precios quedaba
 * vieja apenas cambiaban los precios, y el contacto impreso era siempre el de
 * la empresa, así que cuando el cliente llamaba no había forma de saber qué
 * vendedor lo había traído.
 *
 * Acá se resuelven los dos: los precios salen de la base y el contacto sale del
 * vendedor que se elija. Un mismo documento, tantas versiones como vendedores.
 */

/**
 * El contacto de la empresa, para los documentos que no son de nadie en
 * particular.
 *
 * Está acá y no en `src/data/siteContent.js` porque aquel es el contenido de la
 * landing —textos, redes, horarios— y esto es lo que va impreso en un papel.
 * Que hoy digan lo mismo no los hace el mismo dato: si mañana la web muestra un
 * número de atención general, los documentos del vendedor no tienen por qué
 * seguirlo.
 */
export const EMPRESA = {
  nombre: 'Recuvarilla',
  telefono: '+54 11 2395-8302',
  email: 'recuvarilla@gmail.com',
  instagram: '@recuvarilla',
  localidad: 'Luján, Buenos Aires',
}

export const TAGLINE =
  'Varilla plástica para alambrado, fabricada por extrusión a partir de material industrial recuperado. Reemplazo directo del poste de madera.'

/**
 * El bloque de contacto que va impreso.
 *
 * Sin vendedor devuelve el de la empresa. Con vendedor, el suyo, pero cayendo
 * en el de la empresa campo por campo: un vendedor sin email cargado tiene que
 * imprimir el de la empresa y no un renglón vacío, que en un papel que se le da
 * a un cliente se lee como un descuido.
 *
 * La excepción es Instagram, que queda en null: la cuenta es de la empresa y no
 * del vendedor. Ponerla en su folleto mandaría al cliente a un lugar donde ese
 * vendedor no existe, que es justo lo contrario de lo que el folleto propio
 * busca. Cada documento omite el renglón cuando no hay.
 */
export function contactoDe(seller) {
  if (!seller) return { ...EMPRESA, esEmpresa: true }

  return {
    nombre: seller.nombre,
    telefono: seller.telefono || EMPRESA.telefono,
    email: seller.email || EMPRESA.email,
    instagram: null,
    localidad: seller.localidad || EMPRESA.localidad,
    esEmpresa: false,
  }
}

/**
 * Los documentos que se pueden emitir.
 *
 * `archivo` es cómo se llama el PDF al guardarlo. Se le pega el vendedor
 * cuando lo hay, así que dos vendedores no terminan con el mismo archivo en la
 * carpeta de descargas.
 */
export const DOCUMENTOS = [
  {
    tipo: 'lista-de-precios',
    titulo: 'Lista de precios',
    archivo: 'Lista-de-precios-Recuvarilla',
    descripcion:
      'Los escalones por cantidad, salidos de la base: siempre los vigentes, sin volver a armar el archivo.',
  },
  {
    tipo: 'folleto',
    titulo: 'Folleto',
    archivo: 'Folleto-Recuvarilla',
    descripcion:
      'Una hoja con las fotos, las especificaciones y las ventajas. Es el papel que se deja en el mostrador.',
  },
  {
    tipo: 'ficha-tecnica',
    titulo: 'Ficha técnica',
    archivo: 'Ficha-tecnica-Recuvarilla',
    descripcion:
      'El dibujo dimensional y la tabla de características, para el cliente que pregunta los números.',
  },
]

export const documentoPorTipo = (tipo) => DOCUMENTOS.find((doc) => doc.tipo === tipo) ?? null

/** Deja un nombre listo para usar como nombre de archivo. */
export function parteDeArchivo(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
