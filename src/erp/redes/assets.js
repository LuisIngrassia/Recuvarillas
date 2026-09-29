/**
 * Los archivos del manual de marca que usan las piezas.
 *
 * Se importan desde `brand/assets/` y no se copian a `public/`: así el manual
 * sigue siendo el único lugar donde viven el logo y las fotos, y Vite los sirve
 * con el nombre con hash, cacheados para siempre.
 */
import logoPalabraColor from '../../../brand/assets/logo/recuvarilla-palabra-color.svg?url'
import logoPalabraNegativo from '../../../brand/assets/logo/recuvarilla-palabra-negativo.svg?url'
import logoPrincipalColor from '../../../brand/assets/logo/recuvarilla-principal-color.svg?url'
import varillaSeparador from '../../../brand/assets/sistema/varilla-separador.svg?url'
import varillaSeparadorBlanca from '../../../brand/assets/sistema/varilla-separador-blanca.svg?url'
import vinetaAgujero from '../../../brand/assets/sistema/vineta-agujero.svg?url'

export const LOGOS = {
  palabraColor: logoPalabraColor,
  palabraNegativo: logoPalabraNegativo,
  principalColor: logoPrincipalColor,
}

export const SISTEMA = { varillaSeparador, varillaSeparadorBlanca, vinetaAgujero }

/*
  Las fotos del manual. Las que empiezan con "NO-" son los ejemplos de lo que
  no se hace (el logo anterior, la foto de stock) y quedan afuera: que estén en
  la lista sería invitar a usarlas.
*/
const archivos = import.meta.glob('../../../brand/assets/fotos/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const FOTOS_MARCA = Object.entries(archivos)
  .map(([ruta, url]) => ({ archivo: ruta.split('/').pop(), url }))
  .filter(({ archivo }) => !archivo.startsWith('NO-'))
  .sort((a, b) => a.archivo.localeCompare(b.archivo))

/**
 * La URL de la foto de un posteo.
 *
 * En `campos.foto` se guarda el nombre del archivo si es una del manual, o la
 * URL entera si se subió desde el ERP. Se guarda el nombre y no la URL de las
 * del manual porque esa URL lleva el hash del build y cambia en cada deploy.
 */
export function fotoUrl(foto) {
  if (!foto) return null
  if (/^https?:\/\//.test(foto)) return foto
  return FOTOS_MARCA.find((item) => item.archivo === foto)?.url ?? null
}
