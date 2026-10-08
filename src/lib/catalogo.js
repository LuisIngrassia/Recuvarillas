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

/**
 * El precio que se muestra en la tarjeta: uno solo.
 *
 * Con escalones va **el más alto**, que es el de quien lleva poco: es el
 * precio que paga cualquiera, y mostrar el de 5.000 unidades sería prometer un
 * número que casi nadie va a pagar. `agujereada` elige la columna; si el
 * producto no se agujerea, las dos son la misma.
 */
export function precioMasAlto(producto, { agujereada = false } = {}) {
  if (!producto) return null
  if (!producto.se_produce) return producto.precio
  if (!producto.escalones.length) return null
  const columna = agujereada && producto.se_agujerea ? 'drilled' : 'plain'
  return Math.max(...producto.escalones.map((tier) => tier[columna]))
}

/**
 * El producto del ERP que va con una tarjeta fija: el primero cuyo nombre
 * empieza con `prefijo`, prefiriendo el de la web y después el que tiene
 * precio. Si hay dos varillas cargadas, gana la que cotiza.
 */
export function productoPara(catalogo, prefijo) {
  if (!catalogo || !prefijo) return null
  const candidatos = catalogo.filter((item) =>
    item.nombre.trim().toLowerCase().startsWith(prefijo.toLowerCase()),
  )
  return (
    candidatos.find((item) => item.en_web && tienePrecio(item)) ??
    candidatos.find(tienePrecio) ??
    candidatos[0] ??
    null
  )
}

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
