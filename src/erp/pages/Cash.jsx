/**
 * Caja: todo lo que entró, con su total por medio de pago.
 *
 * Los cobros se cargan desde el pedido y no desde acá, porque un cobro sin
 * pedido al que imputarse no le sirve a nadie: no bajaría ningún saldo. Esta
 * pantalla es para mirar, cuadrar y buscar.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PAYMENT_METHOD_LABELS, listPayments } from '../api/payments'
import { useAsync } from '../lib/useAsync'
import { formatDate, formatPesos, todayISO } from '../lib/format'
import {
  Async,
  Badge,
  Card,
  Field,
  Input,
  Money,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from '../components/ui'

/** El primer día del mes corriente, que es el período con el que se abre. */
function startOfMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export default function Cash() {
  const [from, setFrom] = useState(startOfMonth)
  const [to, setTo] = useState(todayISO)

  const query = useAsync(() => listPayments({ from, to }), [from, to])

  const payments = query.data ?? []
  const total = payments.reduce((sum, payment) => sum + Number(payment.monto), 0)

  /*
    No todo lo que entra a la caja es una venta. Se puede cobrar una seña contra
    un presupuesto que todavía no se cerró: la plata está, pero Rentabilidad no
    la cuenta hasta que el pedido se confirme.

    Es la diferencia que más confunde —"cobré 147.500 y el mes figura en cero"—
    así que la pantalla la muestra en vez de dejar que se descubra sola.
  */
  const sinConfirmar = payments.filter((p) => p.order?.estado === 'presupuesto')
  const montoSinConfirmar = sinConfirmar.reduce((sum, p) => sum + Number(p.monto), 0)

  // El desglose por medio se arma acá porque son las mismas filas que ya están
  // a la vista: pedirle otra consulta a la base sería traer dos veces lo mismo.
  const porMedio = payments.reduce((acc, payment) => {
    acc[payment.metodo] = (acc[payment.metodo] ?? 0) + Number(payment.monto)
    return acc
  }, {})

  return (
    <>
      <PageHeader
        title="Caja"
        description="Los cobros del período, tal como se imputaron a cada pedido."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="Desde">
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Total cobrado"
          value={formatPesos(total)}
          hint={`${payments.length} cobros`}
          tone="good"
        />
        {Object.keys(PAYMENT_METHOD_LABELS).map((metodo) => (
          <Stat
            key={metodo}
            label={PAYMENT_METHOD_LABELS[metodo]}
            value={formatPesos(porMedio[metodo] ?? 0)}
          />
        ))}
      </div>

      {montoSinConfirmar > 0 && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          <strong>{formatPesos(montoSinConfirmar)}</strong> de este total son cobros
          contra {sinConfirmar.length === 1 ? 'un presupuesto' : 'presupuestos'} que
          todavía no se{sinConfirmar.length === 1 ? '' : ' '}confirmaron. La plata
          entró, pero hasta que el pedido pase a <em>confirmado</em> no cuenta como
          venta: por eso puede figurar acá y no aparecer en Rentabilidad ni en el
          facturado del mes.
        </div>
      )}

      <div className="mt-6">
        <Card title="Cobros">
          <Async query={query} empty="No hubo cobros en ese período.">
            {(rows) => (
              <Table
                head={
                  <>
                    <Th>Fecha</Th>
                    <Th>Pedido</Th>
                    <Th>Cliente</Th>
                    <Th>Medio</Th>
                    <Th>Nota</Th>
                    <Th align="right">Monto</Th>
                  </>
                }
              >
                {rows.map((payment) => (
                  <tr key={payment.id} className="hover:bg-steel-50">
                    <Td className="whitespace-nowrap text-steel-600">
                      {formatDate(payment.fecha)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Link
                        to={`/erp/pedidos/${payment.order_id}`}
                        className="font-semibold text-secondary-500 hover:underline"
                      >
                        #{payment.order?.numero}
                      </Link>
                      {payment.order?.estado === 'presupuesto' && (
                        <span className="ml-1.5">
                          <Badge tone="warn">sin confirmar</Badge>
                        </span>
                      )}
                      {payment.order?.estado === 'cancelado' && (
                        <span className="ml-1.5">
                          <Badge tone="bad">anulado</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="text-steel-700">{payment.order?.customer?.nombre}</Td>
                    <Td>
                      <Badge>{PAYMENT_METHOD_LABELS[payment.metodo]}</Badge>
                    </Td>
                    <Td className="text-xs text-steel-400">{payment.nota}</Td>
                    <Td align="right" className="font-medium">
                      <Money value={payment.monto} />
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Async>
        </Card>
      </div>

      <p className="mt-4 text-xs text-steel-400">
        Los cobros se registran desde la pantalla del pedido, para que bajen el
        saldo de esa cuenta.
      </p>
    </>
  )
}
