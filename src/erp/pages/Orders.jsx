/** Los pedidos, del presupuesto a la entrega. */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ORDER_SOLD_STATES,
  ORDER_STATE_LABELS,
  ORDER_STATE_TONES,
  antiguedadDe,
  countOrders,
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
  const [tipo, setTipo] = useState('venta')
  const [tipoTocado, setTipoTocado] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  /*
    Una empresa es la que trae su propio plástico, así que su pedido arranca
    como trabajo de reciclado. Es una propuesta, no una regla: esa misma empresa
    puede comprarnos varillas alguna vez, y ahí es una venta común.
  */
  const cliente = customers.data?.find((item) => item.id === customerId)
  const sugerido = cliente?.tipo === 'empresa' ? 'reciclado' : 'venta'
  const tipoUsado = tipoTocado ? tipo : sugerido

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!customerId) {
      setError('Elegí a quién le vendés.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const order = await createOrder({ customer_id: customerId, fecha, entrega, tipo: tipoUsado })
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

        <Field
          label="Tipo de trabajo"
          hint={
            tipoUsado === 'reciclado'
              ? 'Se cobra por hora de máquina. Las varillas que salgan son del cliente y no entran al stock.'
              : 'Se venden varillas nuestras, con la lista de precios del cliente.'
          }
        >
          <Select
            value={tipoUsado}
            onChange={(event) => {
              setTipoTocado(true)
              setTipo(event.target.value)
            }}
          >
            <option value="venta">Venta de varillas</option>
            <option value="reciclado">Reciclado del plástico del cliente</option>
          </Select>
        </Field>

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

/**
 * Las dos solapas.
 *
 * El presupuesto y el pedido son el mismo registro —confirmar una venta no
 * obliga a recargar nada, que es todo el punto— pero no son lo mismo de mirar.
 * Un presupuesto es trabajo comercial que puede no ir a ningún lado; un pedido
 * es mercadería que hay que fabricar, despachar y cobrar. En una sola lista, la
 * que apremia se pierde entre la que no, y eran las dos terceras partes de la
 * pantalla diciendo "presupuesto" en gris.
 *
 * El número al lado no es adorno: una pila de presupuestos que no baja nunca
 * dice que se cotiza mucho y se cierra poco, y es de las pocas cosas que se ven
 * solas si están a la vista.
 */
function Solapas({ vista, onVista, totales }) {
  return (
    <div className="mb-4 flex gap-1 border-b border-steel-200">
      {[
        ['pedidos', 'Pedidos', totales?.pedidos],
        ['presupuestos', 'Presupuestos', totales?.presupuestos],
      ].map(([valor, etiqueta, total]) => (
        <button
          key={valor}
          type="button"
          onClick={() => onVista(valor)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            vista === valor
              ? 'border-secondary-500 text-secondary-600'
              : 'border-transparent text-steel-500 hover:text-steel-700'
          }`}
        >
          {etiqueta}
          {total !== undefined && (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                vista === valor ? 'bg-secondary-50 text-secondary-600' : 'bg-steel-100 text-steel-500'
              }`}
            >
              {formatNumber(total)}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export default function Orders() {
  const [vista, setVista] = useState('pedidos')
  const [estado, setEstado] = useState('')
  const [entrega, setEntrega] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const presupuestos = vista === 'presupuestos'

  const term = useDebounced(search)
  const query = useAsync(
    () => listOrders({ vista, estado, entrega, search: term }),
    [vista, estado, entrega, term],
  )
  const totales = useAsync(countOrders, [])

  /* Cambiar de solapa limpia el filtro de estado: los estados de un lado no
     existen del otro, y dejarlo puesto devolvería una lista vacía sin que se
     entienda por qué. */
  const cambiarVista = (valor) => {
    setVista(valor)
    setEstado('')
  }

  return (
    <>
      <PageHeader
        title={presupuestos ? 'Presupuestos' : 'Pedidos'}
        description={
          presupuestos
            ? 'Lo cotizado que todavía no se vendió. No cuenta en facturación ni reserva stock.'
            : 'Todo lo vendido, con lo que falta cobrar de cada uno.'
        }
        actions={<Button onClick={() => setCreating(true)}>Nuevo pedido</Button>}
      />

      <Solapas vista={vista} onVista={cambiarVista} totales={totales.data} />

      <div className="mb-4 flex flex-wrap gap-3">
        {/* En presupuestos el estado es uno solo: el filtro no tendría nada que
            filtrar y sólo ocuparía lugar. */}
        {!presupuestos && (
          <Select
            value={estado}
            onChange={(event) => setEstado(event.target.value)}
            className="w-auto"
          >
            <option value="">Todos los estados</option>
            {ORDER_SOLD_STATES.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATE_LABELS[value]}
              </option>
            ))}
          </Select>
        )}
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
          placeholder={
            presupuestos
              ? 'Buscar por número de presupuesto o cliente'
              : 'Buscar por número de pedido o cliente'
          }
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-auto min-w-[16rem] flex-1"
        />
      </div>

      <Card>
        <Async
          query={query}
          empty={
            presupuestos
              ? 'No hay presupuestos con ese filtro.'
              : 'No hay pedidos con ese filtro.'
          }
        >
          {(orders) => (
            <Table
              head={
                <>
                  <Th>{presupuestos ? 'Presupuesto' : 'Pedido'}</Th>
                  <Th>Cliente</Th>
                  {/* En presupuestos el estado es siempre el mismo, y lo que de
                      verdad dice si sigue vivo es hace cuánto se mandó. */}
                  <Th>{presupuestos ? 'Mandado' : 'Estado'}</Th>
                  <Th>Fecha</Th>
                  <Th>Cómo y cuándo sale</Th>
                  <Th align="right">Unidades</Th>
                  <Th align="right">Total</Th>
                  {/* Un presupuesto no es una deuda: su saldo es el total
                      entero y mostrarlo en ámbar diría que alguien debe algo. */}
                  {!presupuestos && <Th align="right">Saldo</Th>}
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
                const antiguedad = presupuestos ? antiguedadDe(order) : null

                return (
                <tr key={order.id} className="hover:bg-steel-50">
                  <Td>
                    <Link
                      to={`/erp/pedidos/${order.id}`}
                      className="font-semibold text-secondary-500 hover:underline"
                    >
                      #{order.numero}
                    </Link>
                    {order.tipo === 'reciclado' && (
                      <span className="ml-1.5">
                        <Badge tone="info">reciclado</Badge>
                      </span>
                    )}
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
                    {antiguedad ? (
                      <span className={`text-xs ${TONO_ENTREGA[antiguedad.tono]}`}>
                        {antiguedad.texto}
                      </span>
                    ) : (
                      <Badge tone={ORDER_STATE_TONES[order.estado]}>
                        {ORDER_STATE_LABELS[order.estado]}
                      </Badge>
                    )}
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
                  {/* Un trabajo de reciclado no tiene unidades vendidas: lo que
                      hay son las varillas que se le devolvieron al cliente. Un
                      cero acá se leería como "no llevó nada". */}
                  <Td align="right" className="tabular-nums text-steel-600">
                    {order.tipo === 'reciclado' ? (
                      order.varillas_entregadas ? (
                        <>
                          {formatNumber(order.varillas_entregadas)}
                          <span className="block text-xs text-steel-400">devueltas</span>
                        </>
                      ) : (
                        <span className="text-steel-300">—</span>
                      )
                    ) : (
                      formatNumber(order.unidades)
                    )}
                  </Td>
                  <Td align="right">
                    <Money value={order.total} />
                  </Td>
                  {!presupuestos && (
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
                  )}
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
