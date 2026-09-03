/**
 * La ficha de un cliente: sus datos, su cuenta corriente, sus pedidos y lo que
 * había cotizado en la web antes de comprar.
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteCustomer, getCustomer } from '../api/customers'
import { ORDER_STATE_LABELS, ORDER_STATE_TONES, createOrder } from '../api/orders'
import { useAsync } from '../lib/useAsync'
import { formatDate, formatDateTime, formatNumber, whatsappLink } from '../lib/format'
import CustomerForm from '../components/CustomerForm'
import {
  Async,
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Money,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from '../components/ui'

/** Un dato de la ficha. Los vacíos no se muestran para no llenar de guiones. */
function Detail({ label, value }) {
  if (!value) return null

  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-steel-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-steel-700">{value}</dd>
    </div>
  )
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useAsync(() => getCustomer(id), [id])
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  /*
    El pedido nuevo se crea vacío y se sigue cargando en su propia pantalla. Es
    a propósito: los ítems necesitan la lista de precios y el detalle del envío,
    y meter todo eso en un diálogo desde acá haría un formulario enorme para
    algo que después igual se edita.
  */
  const startOrder = async (customer) => {
    setError('')
    try {
      const order = await createOrder({
        customer_id: customer.id,
        entrega: customer.direccion ? 'envio' : 'retiro',
        direccion_entrega: customer.direccion,
        localidad: customer.localidad,
        provincia: customer.provincia,
        codigo_postal: customer.codigo_postal,
      })
      navigate(`/erp/pedidos/${order.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (customer) => {
    if (!confirm(`¿Borrar a ${customer.nombre}? No se puede si tiene pedidos.`)) return
    setError('')
    try {
      await deleteCustomer(customer.id)
      navigate('/erp/clientes')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Async query={query}>
      {(customer) => {
        const wa = whatsappLink(customer.telefono)
        const saldo = Number(customer.balance?.saldo ?? 0)

        return (
          <>
            <PageHeader
              title={customer.nombre}
              description={
                <>
                  {customer.tipo === 'mayorista' ? 'Mayorista' : 'Minorista'}
                  {customer.localidad ? ` · ${customer.localidad}` : ''}
                </>
              }
              actions={
                <>
                  <Link
                    to="/erp/clientes"
                    className="inline-flex items-center rounded-md border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-600 hover:border-steel-300"
                  >
                    Volver
                  </Link>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md bg-steel-100 px-3 py-2 text-sm font-semibold text-steel-700 hover:bg-steel-200"
                    >
                      WhatsApp
                    </a>
                  )}
                  <Button variant="ghost" onClick={() => setEditing(true)}>
                    Editar
                  </Button>
                  <Button onClick={() => startOrder(customer)}>Nuevo pedido</Button>
                </>
              }
            />

            {error && (
              <div className="mb-4">
                <ErrorNote>{error}</ErrorNote>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Facturado"
                value={<Money value={customer.balance?.facturado} />}
                hint={`${formatNumber(customer.balance?.pedidos ?? 0)} pedidos`}
              />
              <Stat label="Cobrado" value={<Money value={customer.balance?.cobrado} />} />
              <Stat
                label="Saldo"
                value={<Money value={saldo} />}
                tone={saldo > 0 ? 'warn' : 'good'}
                hint={
                  saldo > 0
                    ? 'Debe'
                    : saldo < 0
                      ? 'Pagó de más: queda a favor'
                      : 'Al día'
                }
              />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <Card title="Datos" className="lg:col-span-1">
                <dl className="space-y-3 px-4 py-4">
                  <Detail label="Teléfono" value={customer.telefono} />
                  <Detail label="Email" value={customer.email} />
                  <Detail label="CUIT" value={customer.cuit} />
                  <Detail label="Dirección" value={customer.direccion} />
                  <Detail
                    label="Localidad"
                    value={
                      [customer.localidad, customer.provincia].filter(Boolean).join(', ') ||
                      null
                    }
                  />
                  <Detail label="Código postal" value={customer.codigo_postal} />
                  <Detail label="Notas" value={customer.notas} />
                  <Detail label="Cliente desde" value={formatDate(customer.created_at)} />
                </dl>
                <div className="border-t border-steel-100 px-4 py-3">
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => remove(customer)}
                  >
                    Borrar cliente
                  </Button>
                </div>
              </Card>

              <div className="space-y-6 lg:col-span-2">
                <Card title="Pedidos">
                  {customer.orders.length === 0 ? (
                    <Empty>Todavía no le vendiste nada.</Empty>
                  ) : (
                    <Table
                      head={
                        <>
                          <Th>Pedido</Th>
                          <Th>Estado</Th>
                          <Th>Fecha</Th>
                          <Th align="right">Unidades</Th>
                          <Th align="right">Total</Th>
                          <Th align="right">Saldo</Th>
                        </>
                      }
                    >
                      {customer.orders.map((order) => (
                        <tr key={order.id} className="hover:bg-steel-50">
                          <Td>
                            <Link
                              to={`/erp/pedidos/${order.id}`}
                              className="font-semibold text-secondary-500 hover:underline"
                            >
                              #{order.numero}
                            </Link>
                          </Td>
                          <Td>
                            <Badge tone={ORDER_STATE_TONES[order.estado]}>
                              {ORDER_STATE_LABELS[order.estado]}
                            </Badge>
                          </Td>
                          <Td className="whitespace-nowrap text-xs text-steel-400">
                            {formatDate(order.fecha)}
                          </Td>
                          <Td align="right" className="tabular-nums text-steel-600">
                            {formatNumber(order.unidades)}
                          </Td>
                          <Td align="right">
                            <Money value={order.total} />
                          </Td>
                          <Td align="right">
                            <Money
                              value={order.saldo}
                              className={
                                Number(order.saldo) > 0
                                  ? 'font-semibold text-amber-600'
                                  : 'text-steel-400'
                              }
                            />
                          </Td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Card>

                {customer.leads.length > 0 && (
                  <Card title="Lo que había cotizado en la web">
                    <Table
                      head={
                        <>
                          <Th>Fecha</Th>
                          <Th align="right">Cantidad</Th>
                          <Th>Tipo</Th>
                          <Th align="right">Precio unitario</Th>
                          <Th align="right">Mercadería</Th>
                        </>
                      }
                    >
                      {customer.leads.map((lead) => (
                        <tr key={lead.id}>
                          <Td className="whitespace-nowrap text-xs text-steel-400">
                            {formatDateTime(lead.created_at)}
                          </Td>
                          <Td align="right" className="tabular-nums text-steel-600">
                            {formatNumber(lead.cantidad)}
                          </Td>
                          <Td className="text-xs text-steel-500">
                            {lead.agujereada ? 'Agujereada' : 'Común'}
                          </Td>
                          <Td align="right">
                            <Money value={lead.precio_unitario} />
                          </Td>
                          <Td align="right">
                            <Money value={lead.mercaderia} />
                          </Td>
                        </tr>
                      ))}
                    </Table>
                  </Card>
                )}
              </div>
            </div>

            {editing && (
              <CustomerForm
                customer={customer}
                onClose={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false)
                  query.reload()
                }}
              />
            )}
          </>
        )
      }}
    </Async>
  )
}
