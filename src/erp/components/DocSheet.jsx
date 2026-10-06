/**
 * El marco común de los documentos que se reparten.
 *
 * Todos comparten lo mismo: se elige de qué vendedor lleva el contacto, se
 * mira, se exporta a PDF. Lo único distinto es la hoja, que la pone cada
 * documento. Tenerlo en un solo lado evita que el selector de vendedor termine
 * copiado tres veces y funcionando distinto en cada una.
 *
 * El vendedor viaja en la dirección (`?vendedor=…`) y no en el estado de la
 * pantalla: así el link a "el folleto de Marta" se puede guardar en favoritos o
 * mandar por WhatsApp, que es exactamente lo que va a querer hacer cada
 * vendedor con el suyo.
 *
 * El producto viaja igual (`?producto=…`): cada documento existe para cada
 * producto, con su texto guardado en la ficha. Sin producto en la dirección
 * se abre el de la web, que es la varilla.
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listSellers } from '../api/sellers'
import { listProducts, productoWeb } from '../api/products'
import { useAsync } from '../lib/useAsync'
import { contactoDe, parteDeArchivo } from '../lib/documentos'
import { contenidoDe } from '../lib/fichas'
import DocEditor from './DocEditor'
import { Button, ErrorNote, Loading } from './ui'
import { LOGO, QR_WHATSAPP } from '../../lib/marca'
import './documentos.css'

/**
 * El pie de todos los papeles: la varilla y, debajo, el contacto con el QR.
 *
 * El QR abre el WhatsApp de la empresa con el mensaje ya escrito; cuando el
 * contacto es el de un vendedor no va, porque mandaría al cliente a otro
 * número que el impreso.
 */
export function PieContacto({ contacto, children }) {
  return (
    <footer className="hm-pie">
      <span className="hm-varilla" aria-hidden="true" />
      <div className="hm-pie-contenido">
        <div className="hm-contacto">
          <b>{contacto.nombre}</b>
          <br />
          WhatsApp {contacto.telefono}
          <br />
          {contacto.email}
          {contacto.instagram && (
            <>
              <br />
              {contacto.instagram}
            </>
          )}
          <br />
          {contacto.localidad}
          {children}
        </div>
        {contacto.esEmpresa && <img className="hm-qr" src={QR_WHATSAPP} alt="QR para escribir por WhatsApp" />}
      </div>
    </footer>
  )
}

/** El logo principal, arriba a la izquierda de cada papel. */
export function LogoHoja() {
  return (
    <img
      className="hm-logo"
      src={LOGO.principal.color}
      alt="Recuvarilla, 100% Argentina"
      width={LOGO.principal.width}
      height={LOGO.principal.height}
    />
  )
}

/*
  El contenedor del ERP tiene el margen de una pantalla de trabajo y al imprimir
  estorba: la hoja tiene que arrancar donde arranca el papel. Los fondos de
  color se fuerzan porque el navegador los saca por defecto, y estos documentos
  son mayormente barras y paneles de color.
*/
const ESTILOS_IMPRESION = `
  @media print {
    main { padding: 0 !important; }
    .doc-hoja {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      border: none !important;
      box-shadow: none !important;
      max-width: 100% !important;
    }
    .doc-hoja * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

export default function DocSheet({ doc, children }) {
  const [params, setParams] = useSearchParams()
  const sellers = useAsync(() => listSellers({ soloActivos: true }), [])
  const products = useAsync(() => listProducts(), [])
  const [editando, setEditando] = useState(false)

  const sellerId = params.get('vendedor') ?? ''
  const seller = sellers.data?.find((item) => item.id === sellerId) ?? null
  const contacto = contactoDe(seller)

  const productId = params.get('producto') ?? ''
  const producto =
    products.data?.find((item) => item.id === productId) ??
    productoWeb(products.data) ??
    products.data?.[0] ??
    null

  const cambiarParam = (clave) => (id) => {
    const siguiente = new URLSearchParams(params)
    if (id) siguiente.set(clave, id)
    else siguiente.delete(clave)
    setParams(siguiente, { replace: true })
  }
  const elegir = cambiarParam('vendedor')
  const elegirProducto = cambiarParam('producto')

  /**
   * Al imprimir a PDF el navegador propone el nombre de `document.title`, así
   * que se cambia un momento y se repone al terminar.
   */
  const imprimir = () => {
    const titulo = document.title
    const partes = [doc.archivo]
    if (producto) partes.push(parteDeArchivo(producto.nombre))
    if (seller) partes.push(parteDeArchivo(seller.nombre))
    document.title = partes.join('-')

    const restaurar = () => {
      document.title = titulo
      window.removeEventListener('afterprint', restaurar)
    }

    window.addEventListener('afterprint', restaurar)
    window.print()
  }

  return (
    <>
      <style>{ESTILOS_IMPRESION}</style>

      <div className="mx-auto mb-5 flex max-w-[860px] flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <Link
            to="/erp/documentos"
            className="inline-flex items-center rounded-md border border-grafito-200 bg-white px-3 py-2 text-sm font-semibold text-grafito-600 hover:border-grafito-300"
          >
            Documentos
          </Link>

          <label className="block">
            <span className="block text-xs font-semibold text-grafito-600">Producto</span>
            <select
              value={producto?.id ?? ''}
              onChange={(event) => elegirProducto(event.target.value)}
              className="mt-1 rounded-md border border-grafito-200 bg-white px-3 py-2 text-sm text-grafito-800 focus:border-celeste-700 focus:outline-none"
            >
              {(products.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-grafito-600">
              Contacto que sale impreso
            </span>
            <select
              value={sellerId}
              onChange={(event) => elegir(event.target.value)}
              className="mt-1 rounded-md border border-grafito-200 bg-white px-3 py-2 text-sm text-grafito-800 focus:border-celeste-700 focus:outline-none"
            >
              <option value="">Recuvarilla (contacto de la empresa)</option>
              {(sellers.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditando(true)} disabled={!producto}>
            Editar contenido
          </Button>
          <Button onClick={imprimir}>Exportar a PDF</Button>
        </div>
      </div>

      {products.error && (
        <div className="mx-auto mb-4 max-w-[860px] print:hidden">
          <ErrorNote onRetry={products.reload}>{products.error}</ErrorNote>
        </div>
      )}

      {sellers.error && (
        <div className="mx-auto mb-4 max-w-[860px] print:hidden">
          <ErrorNote onRetry={sellers.reload}>{sellers.error}</ErrorNote>
        </div>
      )}

      {sellerId && !seller && !sellers.loading && (
        <p className="mx-auto mb-4 max-w-[860px] rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 print:hidden">
          Ese vendedor ya no está activo, así que el documento sale con el
          contacto de la empresa.
        </p>
      )}

      {sellers.loading || products.loading ? (
        <Loading />
      ) : producto ? (
        children({ contacto, producto, contenido: contenidoDe(producto) })
      ) : (
        <p className="mx-auto max-w-[860px] rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No hay productos activos.{' '}
          <Link to="/erp/productos" className="font-semibold underline underline-offset-2">
            Cargar uno
          </Link>
          .
        </p>
      )}

      {editando && producto && (
        <DocEditor
          doc={doc}
          producto={producto}
          onClose={() => setEditando(false)}
          onSaved={() => {
            setEditando(false)
            products.reload()
          }}
        />
      )}

      <p className="mx-auto mt-4 max-w-[860px] text-xs text-grafito-400 print:hidden">
        Hay uno de estos por producto y por vendedor: elegilos arriba. El
        texto se cambia con «Editar contenido» y queda guardado en el
        producto. El link de la barra de direcciones ya lleva los dos
        puestos, así que se puede pasar directo.
      </p>
    </>
  )
}
