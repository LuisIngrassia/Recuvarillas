/**
 * El índice de los papeles que se reparten.
 *
 * Se elige el producto y el vendedor una sola vez acá, y los tres documentos
 * salen de ese producto con su contacto. Es el orden en que se trabaja:
 * primero «el poste, para Marta», y después qué papel le doy.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listSellers } from '../api/sellers'
import { conLista, listProducts, productoWeb } from '../api/products'
import { useAsync } from '../lib/useAsync'
import { DOCUMENTOS, contactoDe } from '../lib/documentos'
import { Async, Card, PageHeader } from '../components/ui'

export default function Documents() {
  const sellers = useAsync(() => listSellers({ soloActivos: true }), [])
  const [sellerId, setSellerId] = useState('')
  /* Sólo lo que fabricamos: lo que se compra hecho no lleva papeles propios. */
  const products = useAsync(async () => conLista(await listProducts()), [])
  const [productId, setProductId] = useState('')

  const seller = sellers.data?.find((item) => item.id === sellerId) ?? null
  const contacto = contactoDe(seller)
  const producto =
    products.data?.find((item) => item.id === productId) ?? productoWeb(products.data) ?? products.data?.[0]

  const params = new URLSearchParams()
  if (producto) params.set('producto', producto.id)
  if (sellerId) params.set('vendedor', sellerId)
  const query = params.toString() ? `?${params}` : ''

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Lo que se reparte: la lista de precios, el folleto y la ficha técnica de cada producto."
      />

      <Card title="¿De qué producto?" className="mb-6">
        <div className="px-4 py-4">
          <Async query={products} empty="No hay productos fabricados activos.">
            {(lista) => (
              <div className="flex flex-wrap gap-2">
                {lista.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setProductId(item.id)}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                      producto?.id === item.id
                        ? 'border-celeste-600 bg-celeste-50 text-celeste-800'
                        : 'border-grafito-200 bg-white text-grafito-600 hover:border-grafito-300'
                    }`}
                  >
                    {item.nombre}
                  </button>
                ))}
              </div>
            )}
          </Async>
          <p className="mt-3 text-xs text-grafito-500">
            Cada producto que fabricamos tiene sus tres papeles, con las mismas
            secciones que la varilla. Uno nuevo los tiene desde que se carga,
            con sus medidas si están en el nombre («Poste 6x165», «Varilla 3x3x120»); lo que
            falta sale marcado como pendiente y se completa con «Editar
            contenido» dentro de cada documento.
          </p>
        </div>
      </Card>

      <Card title="¿De quién es el contacto que sale impreso?">
        <div className="px-4 py-4">
          <Async query={sellers}>
            {(lista) => (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSellerId('')}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                      sellerId === ''
                        ? 'border-celeste-600 bg-celeste-50 text-celeste-800'
                        : 'border-grafito-200 bg-white text-grafito-600 hover:border-grafito-300'
                    }`}
                  >
                    Recuvarilla
                  </button>
                  {lista.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSellerId(item.id)}
                      className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                        sellerId === item.id
                          ? 'border-celeste-600 bg-celeste-50 text-celeste-800'
                          : 'border-grafito-200 bg-white text-grafito-600 hover:border-grafito-300'
                      }`}
                    >
                      {item.nombre}
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-xs text-grafito-500">
                  Va a salir impreso:{' '}
                  <span className="font-semibold text-grafito-700">{contacto.nombre}</span>
                  {' · '}
                  {contacto.telefono}
                  {' · '}
                  {contacto.email}
                  {' · '}
                  {contacto.localidad}
                </p>

                {seller && (!seller.telefono || !seller.email || !seller.localidad) && (
                  <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    A {seller.nombre} le falta cargar{' '}
                    {[
                      !seller.telefono && 'el teléfono',
                      !seller.email && 'el email',
                      !seller.localidad && 'la localidad',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    . Mientras tanto, en esos renglones sale el dato de la
                    empresa. Se completa en{' '}
                    <Link to="/erp/vendedores" className="font-semibold underline underline-offset-2">
                      Vendedores
                    </Link>
                    .
                  </p>
                )}

                {lista.length === 0 && (
                  <p className="mt-2 text-xs text-grafito-400">
                    Todavía no hay vendedores activos, así que por ahora todo
                    sale con el contacto de la empresa.
                  </p>
                )}
              </>
            )}
          </Async>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {DOCUMENTOS.map((doc) => (
          <Link
            key={doc.tipo}
            to={`/erp/documentos/${doc.tipo}${query}`}
            className="block rounded-xl border border-grafito-200 bg-white p-4 shadow-sm transition-colors hover:border-celeste-600"
          >
            <p className="text-sm font-semibold text-grafito-800">
              {doc.titulo}
              {producto && <span className="font-normal text-grafito-500"> · {producto.nombre}</span>}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-grafito-500">{doc.descripcion}</p>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-grafito-400">
        El presupuesto no está acá porque no es un papel general: sale de cada
        pedido, con su cliente y su mercadería. Está en el botón{' '}
        <span className="font-semibold text-grafito-500">Presupuesto</span> de{' '}
        <Link to="/erp/pedidos" className="underline underline-offset-2">
          Pedidos
        </Link>
        .
      </p>
    </>
  )
}
