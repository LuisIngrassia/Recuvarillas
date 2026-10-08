/**
 * Todos los productos del ERP, con su precio, para la web.
 *
 * Sale de dos vistas públicas (`catalogo_web` y `catalogo_precios_web`, en
 * `supabase/schema.sql`) que muestran sólo lo que puede ver cualquiera: el
 * nombre, la lista minorista de lo que fabricamos y el precio único de lo que
 * se compra hecho. Ni el costo, ni el proveedor, ni la lista mayorista.
 *
 * A diferencia de la lista del simulador, acá no hay respaldo en el código:
 * si la base no contesta, el catálogo no se muestra. Inventar un catálogo de
 * respaldo sería publicar precios de productos que quizás ya no se venden.
 */
import { useEffect, useState } from 'react'
import { isSupabaseConfigured, restSelect } from './supabaseRest'

async function fetchCatalogo() {
  if (!isSupabaseConfigured) return []

  const [productos, precios] = await Promise.all([
    restSelect('catalogo_web?select=*&order=orden.asc,nombre.asc'),
    restSelect('catalogo_precios_web?select=*&order=min_qty.asc'),
  ])

  return productos.map((producto) => ({
    ...producto,
    precio: producto.precio === null ? null : Number(producto.precio),
    escalones: precios
      .filter((tier) => tier.product_id === producto.id)
      .map((tier) => ({
        min: tier.min_qty,
        max: tier.max_qty ?? Infinity,
        plain: Number(tier.plain_price),
        drilled: Number(tier.drilled_price),
      })),
  }))
}

// Una sola consulta por carga de página, aunque la pidan varios componentes.
let pending = null

export function loadCatalogo() {
  if (!pending) {
    pending = fetchCatalogo().catch(() => {
      pending = null
      return []
    })
  }
  return pending
}

/** Lo que tiene precio para mostrar: escalones cargados o precio único. */
export const tienePrecio = (producto) =>
  producto.se_produce ? producto.escalones.length > 0 : producto.precio !== null

/** El catálogo, o `null` mientras llega. Vacío si la base no contestó. */
export function useCatalogo() {
  const [productos, setProductos] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadCatalogo().then((lista) => {
      if (!cancelled) setProductos(lista)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return productos
}
