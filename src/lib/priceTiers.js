/**
 * La lista de precios que usa la web, traída de la base.
 *
 * Los precios se editan desde el ERP y la landing los toma sin que haya que
 * volver a deployar: es el motivo de que vivan en Supabase y no sólo en el
 * código.
 *
 * `src/data/pricing.js` sigue siendo el respaldo. Si la base no contesta, si
 * todavía no está configurada o si la tabla quedó vacía, se muestran esos
 * valores en vez de un error o una pantalla sin precios. Que la lista impresa
 * y el respaldo digan lo mismo es responsabilidad de quien cambia precios;
 * el ERP lo recuerda al guardar.
 */
import { useEffect, useState } from 'react'
import { PRICE_TIERS } from '../data/pricing'
import { isSupabaseConfigured, restSelect } from './supabaseRest'

/**
 * Pasa una fila de `price_tiers` al formato que usan `quote.js` y las
 * pantallas. `max_qty` en null es el tramo sin tope.
 */
export function tierFromRow(row) {
  return {
    id: row.id,
    min: row.min_qty,
    max: row.max_qty ?? Infinity,
    plain: Number(row.plain_price),
    drilled: Number(row.drilled_price),
    kind: row.kind,
  }
}

async function fetchTiers() {
  if (!isSupabaseConfigured) return PRICE_TIERS

  try {
    const rows = await restSelect(
      'price_tiers?select=id,min_qty,max_qty,plain_price,drilled_price,kind&order=min_qty.asc',
    )
    return rows.length ? rows.map(tierFromRow) : PRICE_TIERS
  } catch {
    return PRICE_TIERS
  }
}

// Una sola consulta por carga de página, aunque la pidan varios componentes.
let pending = null

export function loadPriceTiers() {
  if (!pending) pending = fetchTiers()
  return pending
}

/** Fuerza a que la próxima lectura vuelva a la base, después de editar precios. */
export function invalidatePriceTiers() {
  pending = null
}

/**
 * Arranca con los precios del código y los reemplaza por los de la base cuando
 * llegan. Así el simulador se puede usar desde el primer render en vez de
 * mostrar un cartel de "cargando" sobre algo que casi siempre es igual.
 */
export function usePriceTiers() {
  const [tiers, setTiers] = useState(PRICE_TIERS)

  useEffect(() => {
    let cancelled = false
    loadPriceTiers().then((loaded) => {
      if (!cancelled) setTiers(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return tiers
}
