/**
 * El padrón de clientes, ordenado por lo que más se consulta: quién debe.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listCustomers } from '../api/customers'
import { useAsync } from '../lib/useAsync'
import { useDebounced } from '../lib/useDebounced'
import { formatNumber, whatsappLink } from '../lib/format'
import CustomerForm from '../components/CustomerForm'
import {
  Async,
  Badge,
  Button,
  Card,
  Input,
  Money,
  PageHeader,
  Table,
  Td,
  Th,
} from '../components/ui'

export default function Customers() {
  const [search, setSearch] = useState('')
  const [onlyDebtors, setOnlyDebtors] = useState(false)
  const [creating, setCreating] = useState(false)

  const term = useDebounced(search)
  const query = useAsync(
    () => listCustomers({ search: term, onlyDebtors }),
    [term, onlyDebtors],
  )
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Con el saldo de cada cuenta corriente."
        actions={<Button onClick={() => setCreating(true)}>Nuevo cliente</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Buscar por nombre o teléfono"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-auto min-w-[16rem] flex-1"
        />
        <label className="flex items-center gap-2 text-sm text-steel-600">
          <input
            type="checkbox"
            checked={onlyDebtors}
            onChange={(event) => setOnlyDebtors(event.target.checked)}
            className="h-4 w-4 rounded border-steel-300 text-secondary-500 focus:ring-secondary-500"
          />
          Sólo los que deben
        </label>
      </div>

      <Card>
        <Async
          query={query}
          empty={
            onlyDebtors
              ? 'Nadie tiene saldo pendiente.'
              : 'Todavía no hay clientes cargados.'
          }
        >
          {(customers) => (
            <Table
              head={
                <>
                  <Th>Cliente</Th>
                  <Th>Tipo</Th>
                  <Th align="right">Pedidos</Th>
                  <Th align="right">Facturado</Th>
                  <Th align="right">Cobrado</Th>
                  <Th align="right">Saldo</Th>
                  <Th align="right"> </Th>
                </>
              }
            >
              {customers.map((customer) => {
                const saldo = Number(customer.saldo)
                const wa = whatsappLink(customer.telefono)

                return (
                  <tr
                    key={customer.customer_id}
                    className="cursor-pointer hover:bg-steel-50"
                    onClick={() => navigate(`/erp/clientes/${customer.customer_id}`)}
                  >
                    <Td>
                      <Link
                        to={`/erp/clientes/${customer.customer_id}`}
                        className="font-medium text-steel-700 hover:text-secondary-500"
                      >
                        {customer.nombre}
                      </Link>
                      <span className="block text-xs text-steel-400">
                        {customer.telefono}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={customer.tipo === 'mayorista' ? 'info' : 'neutral'}>
                        {customer.tipo}
                      </Badge>
                    </Td>
                    <Td align="right" className="tabular-nums text-steel-600">
                      {formatNumber(customer.pedidos)}
                    </Td>
                    <Td align="right" className="text-steel-600">
                      <Money value={customer.facturado} />
                    </Td>
                    <Td align="right" className="text-steel-600">
                      <Money value={customer.cobrado} />
                    </Td>
                    <Td align="right">
                      <Money
                        value={saldo}
                        className={
                          saldo > 0
                            ? 'font-semibold text-amber-600'
                            : saldo < 0
                              ? 'font-semibold text-primary-600'
                              : 'text-steel-400'
                        }
                      />
                    </Td>
                    <Td align="right">
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="text-xs font-semibold text-secondary-500 hover:underline"
                        >
                          WhatsApp
                        </a>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Async>
      </Card>

      {creating && (
        <CustomerForm
          onClose={() => setCreating(false)}
          onSaved={(customer) => navigate(`/erp/clientes/${customer.id}`)}
        />
      )}
    </>
  )
}
