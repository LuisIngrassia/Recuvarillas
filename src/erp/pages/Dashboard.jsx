/**
 * El panel de entrada.
 *
 * Contesta las cuatro preguntas con las que se abre el día: a quién hay que
 * llamar, qué hay que producir, quién debe plata y cómo viene el mes. Todo lo
 * que se ve acá es un atajo a la pantalla donde se trabaja de verdad.
 */
import { Link } from 'react-router-dom'
import { loadDashboard } from '../api/dashboard'
import { useAsync } from '../lib/useAsync'
import { formatDate, formatNumber, formatPesos } from '../lib/format'
import { ORDER_STATE_LABELS, ORDER_STATE_TONES, entregaInfo } from '../api/orders'
import { LEAD_STATE_LABELS, LEAD_STATE_TONES } from '../api/leads'
import {
  Async,
  Badge,
  Card,
  Empty,
  Money,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from '../components/ui'

/* Un mes sin ventas ni gastos no tiene fila en `finanzas_mensuales`, y eso no
   es un error: recién arrancó. Se muestra en cero. */
const MES_VACIO = {
  costos: 0,
  comisiones: 0,
  ganancia_neta: 0,
  costo_pauta: 0,
}

export default function Dashboard() {
  const query = useAsync(loadDashboard, [])

  return (
    <>
      <PageHeader
        title="Panel"
        description="Cómo viene el mes y qué hay pendiente hoy."
      />

      <Async query={query}>
        {(data) => {
          const agenda = data.agenda.map((order) => ({
            ...order,
            salida: entregaInfo(order),
          }))

          const atrasados = agenda.filter((o) => o.salida.dias !== null && o.salida.dias < 0)
          const paraHoy = agenda.filter((o) => o.salida.dias === 0)
          const sinFecha = agenda.filter((o) => o.salida.dias === null)
          const despachos = agenda.filter((o) => o.salida.despacho)

          const finanzas = data.finanzas ?? MES_VACIO
          const ganancia = Number(finanzas.ganancia_neta)
          const reservado = data.stock.reduce((sum, row) => sum + row.comprometido, 0)

          return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Leads sin contactar"
                value={formatNumber(data.nuevos)}
                hint={data.nuevos > 0 ? 'Gente que cotizó y espera respuesta' : 'Al día'}
                tone={data.nuevos > 0 ? 'warn' : 'good'}
              />
              <Stat
                label="Pedidos en curso"
                value={formatNumber(data.enCurso)}
                hint={`${despachos.length} para despachar · ${agenda.length - despachos.length} retiran`}
              />
              <Stat
                label="Por cobrar"
                value={formatPesos(data.cobranzas)}
                hint="Saldo de pedidos ya vendidos"
                tone={data.cobranzas > 0 ? 'warn' : 'good'}
              />
              <Stat
                label="Facturado este mes"
                value={formatPesos(data.mes.facturado)}
                hint={`${formatNumber(data.mes.unidades)} varillas`}
                tone="good"
              />
            </div>

            {/* La segunda fila es el resultado, no la actividad: qué salió y
                qué quedó. Antes había que entrar a Rentabilidad para saberlo. */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Gastos del mes"
                value={formatPesos(finanzas.costos)}
                hint={
                  Number(finanzas.costo_pauta) > 0
                    ? `${formatPesos(finanzas.costo_pauta)} de pauta`
                    : 'Producción, pauta, muestras y demás'
                }
                tone="warn"
              />
              <Stat
                label="Comisiones del mes"
                value={formatPesos(finanzas.comisiones)}
                hint="Devengado según lo cobrado"
              />
              <Stat
                label="Ganancia del mes"
                value={formatPesos(ganancia)}
                hint="Facturado menos costos y comisiones"
                tone={ganancia >= 0 ? 'good' : 'warn'}
              />
              <Stat
                label="Varillas reservadas"
                value={formatNumber(reservado)}
                hint={reservado > 0 ? 'Están en el depósito pero ya tienen dueño' : 'Nada apartado'}
                tone={reservado > 0 ? 'warn' : 'neutral'}
              />
            </div>

            {/*
              Qué hay que despachar y quién viene a buscar. Va arriba de todo
              porque es lo que se mira apenas se abre el día: lo demás son
              números para saber cómo viene el mes, esto es trabajo con fecha.
            */}
            <Card
              title="Para entregar"
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {atrasados.length > 0 && (
                    <Badge tone="bad">{atrasados.length} atrasado{atrasados.length === 1 ? '' : 's'}</Badge>
                  )}
                  {paraHoy.length > 0 && <Badge tone="warn">{paraHoy.length} para hoy</Badge>}
                  {sinFecha.length > 0 && (
                    <Badge tone="neutral">{sinFecha.length} sin fecha</Badge>
                  )}
                  <Link
                    to="/erp/pedidos"
                    className="text-xs font-semibold text-secondary-500 hover:underline"
                  >
                    Ver todos
                  </Link>
                </div>
              }
            >
              {agenda.length === 0 ? (
                <Empty>No hay pedidos esperando salir.</Empty>
              ) : (
                <Table
                  head={
                    <>
                      <Th>Pedido</Th>
                      <Th>Cliente</Th>
                      <Th>Cómo sale</Th>
                      <Th>Cuándo</Th>
                      <Th>Estado</Th>
                      <Th align="right">Unidades</Th>
                      <Th align="right">Saldo</Th>
                    </>
                  }
                >
                  {agenda.map((order) => (
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
                        <span className="text-steel-700">{order.cliente_nombre}</span>
                        {order.cliente_telefono && (
                          <span className="block text-xs text-steel-400">
                            {order.cliente_telefono}
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs">
                        <span
                          className={`font-semibold ${
                            order.salida.despacho ? 'text-primary-700' : 'text-steel-600'
                          }`}
                        >
                          {order.salida.modo}
                        </span>
                        {order.salida.destino && (
                          <span className="block text-steel-400">{order.salida.destino}</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={order.salida.tono}>
                          {order.salida.cuando ?? formatDate(order.salida.fecha)}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge tone={ORDER_STATE_TONES[order.estado]}>
                          {ORDER_STATE_LABELS[order.estado]}
                        </Badge>
                      </Td>
                      <Td align="right" className="tabular-nums text-steel-600">
                        {formatNumber(order.unidades)}
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

            <div className="grid gap-6 xl:grid-cols-3">
              <Card
                title="Stock"
                className="xl:col-span-1"
                actions={
                  <Link
                    to="/erp/stock"
                    className="text-xs font-semibold text-secondary-500 hover:underline"
                  >
                    Ver movimientos
                  </Link>
                }
              >
                <div className="divide-y divide-steel-100">
                  {data.stock.map((row) => (
                    <div
                      key={row.product_id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-steel-700">{row.nombre}</p>
                        <p className="text-xs text-steel-400">
                          {formatNumber(row.stock)} en depósito
                          {row.comprometido > 0 &&
                            ` · ${formatNumber(row.comprometido)} reservadas`}
                        </p>
                      </div>
                      {/* El número grande es el disponible, que es con el que
                          se contesta el teléfono. */}
                      <p
                        className={`text-lg font-bold tabular-nums ${
                          row.disponible > 0
                            ? 'text-steel-800'
                            : row.disponible === 0
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        {formatNumber(row.disponible)}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                title="Últimos leads"
                className="xl:col-span-2"
                actions={
                  <Link
                    to="/erp/leads"
                    className="text-xs font-semibold text-secondary-500 hover:underline"
                  >
                    Ver todos
                  </Link>
                }
              >
                <Table
                  head={
                    <>
                      <Th>Contacto</Th>
                      <Th align="right">Cotizó</Th>
                      <Th align="right">Monto</Th>
                      <Th>Estado</Th>
                      <Th>Fecha</Th>
                    </>
                  }
                >
                  {data.ultimosLeads.map((lead) => (
                    <tr key={lead.id}>
                      <Td>
                        <span className="font-medium text-steel-700">{lead.nombre}</span>
                        <span className="block text-xs text-steel-400">
                          {lead.telefono}
                        </span>
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {formatNumber(lead.cantidad)}
                        <span className="block text-xs text-steel-400">
                          {lead.agujereada ? 'agujereada' : 'común'}
                        </span>
                      </Td>
                      <Td align="right">
                        <Money value={lead.mercaderia} />
                      </Td>
                      <Td>
                        <Badge tone={LEAD_STATE_TONES[lead.estado]}>
                          {LEAD_STATE_LABELS[lead.estado]}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-steel-400">
                        {formatDate(lead.created_at)}
                      </Td>
                    </tr>
                  ))}
                </Table>
              </Card>
            </div>

            <Card
              title="Últimos pedidos"
              actions={
                <Link
                  to="/erp/pedidos"
                  className="text-xs font-semibold text-secondary-500 hover:underline"
                >
                  Ver todos
                </Link>
              }
            >
              <Table
                head={
                  <>
                    <Th>Pedido</Th>
                    <Th>Cliente</Th>
                    <Th>Estado</Th>
                    <Th>Fecha</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Saldo</Th>
                  </>
                }
              >
                {data.ultimosPedidos.map((order) => (
                  <tr key={order.id} className="hover:bg-steel-50">
                    <Td>
                      <Link
                        to={`/erp/pedidos/${order.id}`}
                        className="font-semibold text-secondary-500 hover:underline"
                      >
                        #{order.numero}
                      </Link>
                    </Td>
                    <Td className="text-steel-700">{order.cliente_nombre}</Td>
                    <Td>
                      <Badge tone={ORDER_STATE_TONES[order.estado]}>
                        {ORDER_STATE_LABELS[order.estado]}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-steel-400">
                      {formatDate(order.fecha)}
                    </Td>
                    <Td align="right">
                      <Money value={order.total} />
                    </Td>
                    <Td align="right">
                      <Money
                        value={order.saldo}
                        className={Number(order.saldo) > 0 ? 'font-semibold text-amber-600' : 'text-steel-400'}
                      />
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
          )
        }}
      </Async>
    </>
  )
}
