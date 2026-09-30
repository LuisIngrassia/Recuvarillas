/**
 * Los logos y recursos del manual de marca que usa el sitio.
 *
 * Se importan desde `brand/assets/` y no se copian a `public/`: el manual
 * sigue siendo el único lugar donde viven, y Vite los sirve con el nombre con
 * hash, cacheados para siempre. Es el mismo criterio de `erp/redes/assets.js`.
 *
 * Las medidas van acá para que cada `<img>` reserve su lugar antes de que baje
 * el archivo y la página no pegue saltos al cargar.
 */
import palabraColor from '../../brand/assets/logo/recuvarilla-palabra-color.svg?url'
import palabraNegativo from '../../brand/assets/logo/recuvarilla-palabra-negativo.svg?url'
import principalColor from '../../brand/assets/logo/recuvarilla-principal-color.svg?url'
import principalNegativo from '../../brand/assets/logo/recuvarilla-principal-negativo.svg?url'
import isotipoColor from '../../brand/assets/logo/recuvarilla-isotipo-color.svg?url'
import qrWhatsapp from '../../brand/assets/qr/qr-whatsapp.svg?url'

/** Ancho y alto del viewBox de cada versión, para `width`/`height` del `<img>`. */
export const LOGO = {
  palabra: { color: palabraColor, negativo: palabraNegativo, width: 5695, height: 926 },
  principal: { color: principalColor, negativo: principalNegativo, width: 5695, height: 1133 },
  isotipo: { color: isotipoColor, width: 64, height: 64 },
}

/** Abre el chat con "Hola, quiero un presupuesto de varillas" ya escrito. */
export const QR_WHATSAPP = qrWhatsapp
