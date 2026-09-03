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
 */
import { Link, useSearchParams } from 'react-router-dom'
import { listSellers } from '../api/sellers'
import { useAsync } from '../lib/useAsync'
import { contactoDe, parteDeArchivo } from '../lib/documentos'
import { Button, ErrorNote, Loading } from './ui'

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

  const sellerId = params.get('vendedor') ?? ''
  const seller = sellers.data?.find((item) => item.id === sellerId) ?? null
  const contacto = contactoDe(seller)

  const elegir = (id) => {
    const siguiente = new URLSearchParams(params)
    if (id) siguiente.set('vendedor', id)
    else siguiente.delete('vendedor')
    setParams(siguiente, { replace: true })
  }

  /**
   * Al imprimir a PDF el navegador propone el nombre de `document.title`, así
   * que se cambia un momento y se repone al terminar.
   */
  const imprimir = () => {
    const titulo = document.title
    const partes = [doc.archivo]
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
            className="inline-flex items-center rounded-md border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-600 hover:border-steel-300"
          >
            Documentos
          </Link>

          <label className="block">
            <span className="block text-xs font-semibold text-steel-600">
              Contacto que sale impreso
            </span>
            <select
              value={sellerId}
              onChange={(event) => elegir(event.target.value)}
              className="mt-1 rounded-md border border-steel-200 bg-white px-3 py-2 text-sm text-steel-800 focus:border-secondary-500 focus:outline-none"
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

        <Button onClick={imprimir}>Exportar a PDF</Button>
      </div>

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

      {sellers.loading ? <Loading /> : children(contacto)}

      <p className="mx-auto mt-4 max-w-[860px] text-xs text-steel-400 print:hidden">
        Cada vendedor tiene su versión de este documento: elegilo arriba y el
        contacto impreso cambia. El link de la barra de direcciones ya lleva el
        vendedor puesto, así que se le puede pasar directo.
      </p>
    </>
  )
}
