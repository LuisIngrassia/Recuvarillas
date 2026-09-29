/**
 * Las fuentes de marca, cargadas antes de medir o exportar una pieza.
 *
 * Una pieza medida con la fuente de reemplazo da cualquier cosa: la condensada
 * de marca ocupa bastante menos que la genérica, y el ajuste automático
 * achicaría el titular por un desborde que después no existe. Así que nada se
 * mide ni se exporta hasta que estén las cinco.
 */
import { useEffect, useState } from 'react'
import './piezas.css'

const VARIANTES = [
  '800 40px "RV Archivo Condensed"',
  '400 40px "RV Archivo"',
  '700 40px "RV Archivo"',
  '500 40px "RV Chivo Mono"',
  '600 40px "RV Chivo Mono"',
]

let listas = false
let pendiente = null

export function cargarFuentes() {
  if (!pendiente) {
    pendiente = Promise.all(VARIANTES.map((variante) => document.fonts.load(variante))).then(
      () => {
        listas = true
      },
    )
  }
  return pendiente
}

/** `true` cuando ya se pueden medir las piezas. */
export function useFuentes() {
  const [ok, setOk] = useState(listas)

  useEffect(() => {
    if (ok) return
    let vigente = true
    cargarFuentes().then(() => vigente && setOk(true))
    return () => {
      vigente = false
    }
  }, [ok])

  return ok
}
