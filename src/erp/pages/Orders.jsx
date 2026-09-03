/** Los pedidos, del presupuesto a la entrega. */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ORDER_STATES,
  ORDER_STATE_LABELS,
  ORDER_STATE_TONES,
  createOrder,
  entregaInfo,
  listOrders,
} from '../api/orders'
import { listCustomerOptions } from '../api/customers'
import { useAsync } from '../lib/useAsync'
import { useDebounced } from '../lib/useDebounced'
import { formatDate, formatNumber, todayISO } from '../lib/format'
import {
  Async,
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  Loading,
  Modal,
  Money,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from '../components/ui'

/*
  Las clases se escriben enteras y se eligen de este mapa, como en `ui.jsx`:
  Tailwind busca los nombres tal cual aparecen en el código, así que armarlas
  con template string daría clases que nunca se generan.
*/
const TONO_ENTREGA = {
  bad: 'font-semibold text-red-600',
  warn: 'font-semibold text-amber-600',
  neutral: 'text-steel-500',
}

/**
 * Alta de un pedido: sólo el cliente y la fecha.
 *
 * La mercadería se carga después, en la pantalla del pedido, donde están los
 * precios sugeridos y el detalle del envío.
 */
function NewOrderModal({ onClose }) {
  const customers = useAsync(listCustomerOptions, [])
  const [customerId, setCustomerId] = useState('')
  const [fecha, setFecha] = useState(todayISO)
  const [entrega, setEntrega] = useState('retiro')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!customerId) {
      setError('Elegí a quién le vendés.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const order = await createOrder({ customer_id: customerId, fecha, entrega })
      navigate(`/erp/pedidos/${order.id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Nuevo pedido" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {customers.loading ? (
          <Loading>Cargando clientes…</Loading>
        ) : customers.data?.length === 0 ? (
          <Empty>
            Primero cargá un cliente. Podés crearlo desde Clientes o convertir un
            lead.
          </Empty>
        ) : (
          <Field label="Cliente">
            <Select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Elegir…</option>
              {(customers.data ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.nombre} ({customer.tipo})
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha">
            <Input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
            />
          </Field>
          <Field label="Entrega">
            <Select value={entrega} onChange={(event) => setEntrega(event.target.value)}>
              <option value="retiro">Retira en fábrica</option>
              <option value="envio">Con envío</option>
            </Select>
          </Field>
        </div>

        <ErrorNote>{error || customers.error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || customers.loading}>
            {saving ? 'Creando…' : 'Crear pedido'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Orders() {
  const [estado, setEstado] = useState('')
  const [entrega, setEntrega] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const term = useDebounced(search)
  const query = useAsync(
    () => listOrders({ estado, entrega, search: term }),
    [estado, entrega, term],
  )

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Todo lo vendido, con lo que falta cobrar de cada uno."
        actions={<Button onClick={() => setCreating(true)}>Nuevo pedido</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={estado}
          onChange={(event) => setEstado(event.target.value)}
          className="w-auto"
        >
          <option value="">Todos los estados</option>
          {ORDER_STATES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATE_LABELS[value]}
            </option>
          ))}
        </Select>
        <Select
          value={entrega}
          onChange={(event) => setEntrega(event.target.value)}
          className="w-auto"
        >
          <option value="">Envíos y retiros</option>
          <option value="envio">Sólo para despachar</option>
          <option value="retiro">Sólo retiran en fábrica</option>
        </Select>
        <Input
          type="search"
          placeholder="Buscar por número de pedido o cliente"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-auto min-w-[16rem] flex-1"
        />
      </div>

      <Card>
        <Async query={query} empty="No hay pedidos con ese filtro.">
          {(orders) => (
            <Table
              head={
                <>
                  <Th>Pedido</Th>
                  <Th>Cliente</Th>
                  <Th>Estado</Th>
                  <Th>Fecha</Th>
                  <Th>Cómo y cuándo sale</Th>
                  <Th align="right">Unidades</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Saldo</Th>
                </>
              }
            >
              {orders.map((order) => {
                const salida = entregaInfo(order)
                /* Un pedido entregado o anulado ya no espera a nadie: pintarle
                   "atrasado" en rojo sería ruido sobre algo que no hay que
                   hacer. */
                const pendiente =
                  order.estado === 'confirmado' || order.estado === 'en_produccion'

                return (
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
                    <Link
                      to={`/erp/clientes/${order.customer_id}`}
                      className="text-steel-700 hover:text-secondary-500"
                    >
                      {order.cliente_nombre}
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
                  <Td className="text-xs">
                    <span
                      className={`font-semibold ${
                        salida.despacho ? 'text-primary-700' : 'text-steel-600'
                      }`}
                    >
                      {salida.corto}
                    </span>
                    {salida.destino && (
                      <span className="block text-steel-400">{salida.destino}</span>
                    )}
                    <span
                      className={`block ${pendiente ? TONO_ENTREGA[salida.tono] : 'text-steel-400'}`}
                    >
                      {salida.cuando && pendiente
                        ? salida.cuando
                        : salida.fecha
                          ? formatDate(salida.fecha)
                          : 'Sin fecha'}
                    </span>
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
                )
              })}
            </Table>
          )}
        </Async>
      </Card>

      {creating && <NewOrderModal onClose={() => setCreating(false)} />}
    </>
  )
}
