/**
 * Cómo se llama una línea de mercadería.
 *
 * El agujereado vive en la línea y no en el producto, así que el nombre del
 * producto no alcanza para describir lo que se vende: dos líneas del mismo
 * pedido pueden decir "Varilla 3x3x120" y ser cosas que valen distinto. El
 * acabado se pega acá, en un solo lugar, porque el mismo texto va a la pantalla
 * del pedido y al presupuesto que se le manda al cliente, y que digan cosas
 * distintas es como se arma una discusión por un remito.
 *
 * Se nombra siempre, también cuando va sin agujerear: en un presupuesto el
 * silencio no se lee como "común", se lee como que no se aclaró.
 *
 * **Salvo que el producto no se agujeree.** Una bolsa de grampas no tiene
 * acabado, y un presupuesto que dijera "Bolsa de grampas sin agujerear" es una
 * forma de que el cliente deje de confiar en el papel. Lo decide la marca
 * `se_agujerea` del producto.
 */
export function nombreDeItem(item) {
  const producto = item.product?.nombre ?? 'Varilla'

  /* Sin el producto embebido no se puede saber si lleva acabado. Se asume que
     sí, que es el caso de la varilla y el de todo lo que existía antes de que
     hubiera productos sin acabado. */
  if (item.product && !item.product.se_agujerea) return producto

  return `${producto} ${item.agujereada ? 'agujereada' : 'sin agujerear'}`
}
