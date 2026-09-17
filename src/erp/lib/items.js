/**
 * Cómo se llama una línea de mercadería.
 *
 * El producto es uno solo —la varilla— y el agujereado vive en la línea, así
 * que el nombre del producto ya no alcanza para describir lo que se vende: dos
 * líneas del mismo pedido pueden decir "Varilla 3x3x120" y ser cosas que valen
 * distinto. El acabado se pega acá, en un solo lugar, porque el mismo texto va
 * a la pantalla del pedido y al presupuesto que se le manda al cliente, y que
 * digan cosas distintas es como se arma una discusión por un remito.
 *
 * Se nombra siempre, también cuando va sin agujerear. En un presupuesto el
 * silencio no se lee como "común": se lee como que no se aclaró.
 */
export function nombreDeItem(item) {
  const producto = item.product?.nombre ?? 'Varilla'
  return `${producto} ${item.agujereada ? 'agujereada' : 'sin agujerear'}`
}

/**
 * La varilla, que es lo que cotiza un lead.
 *
 * Se la busca por código y no agarrando el primero de la lista: hoy hay un solo
 * producto y las dos cosas dan igual, pero el día que haya otro, "el primero"
 * pasa a depender del orden alfabético y presupuestar un lead empieza a cargar
 * en silencio lo que no era.
 */
export function varillaDe(products) {
  const lista = products ?? []
  return lista.find((item) => item.codigo === 'VAR') ?? lista[0] ?? null
}
