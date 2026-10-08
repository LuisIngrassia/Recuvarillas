/** Lo que comparten la landing y el ERP sobre cómo se nombran los productos. */

/**
 * Cómo se nombra en plural lo que se lleva: «varillas», «postes», «rollos».
 *
 * Sale de la unidad si no es la genérica, y si no, de la primera palabra del
 * nombre. Sin producto, «unidades»: es mejor que decir «varillas» de algo que
 * no lo es, que es como empezó este problema.
 */
export function enPlural(producto) {
  if (!producto) return 'unidades'
  const base =
    producto.unidad && producto.unidad !== 'unidad'
      ? producto.unidad
      : String(producto.nombre ?? '').trim().split(/\s+/)[0]
  const palabra = base.toLowerCase()
  if (!palabra) return 'unidades'
  if (/s$/.test(palabra)) return palabra
  return /[aeiou]$/.test(palabra) ? `${palabra}s` : `${palabra}es`
}
