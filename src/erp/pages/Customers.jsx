/**
 * El padrón de clientes, ordenado por lo que más se consulta: quién debe.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { esProspecto, listCustomers } from '../api/customers'
import { clave, provinciasDe } from '../api/shipping'
import { useAsync } from '../lib/useAsync'
import { useDebounced } from '../lib/useDebounced'
import { formatNumber, whatsappLink } from '../lib/format'
import CustomerForm from '../components/CustomerForm'
import {
  Async,
  Badge,
  Button,
  Card,
  Empty,
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
  /*
    Los prospectos quedan fuera por defecto.

    Cada presupuesto abre una ficha, así que después de una temporada de
    cotizar, la mayor parte del padrón es gente que nunca compró. Mezclada con
    la que sí, la lista deja de servir para lo que se la abre: ver quién debe.

    Fuera no quiere decir escondida. Cuando se busca a alguien y los que
    coinciden están del otro lado del filtro, la pantalla lo dice y ofrece
    mostrarlos. Si no, el que busca no lo encuentra, concluye que no está, y
    termina con dos fichas de la misma persona.
  */
  const [verProspectos, setVerProspectos] = useState(false)
  /* Filtrar por provincia es la mitad de la pregunta de envíos: la otra mitad
     —quién está cerca de un viaje que ya sale— la contesta la pantalla de
     Envíos, que trabaja sobre estos mismos datos. */
  const [provincia, setProvincia] = useState('')
  const [creating, setCreating] = useState(false)

  const term = useDebounced(search)
  const query = useAsync(
    () => listCustomers({ search: term, onlyDebtors }),
    [term, onlyDebtors],
  )
  const navigate = useNavigate()

  /* El corte se hace acá y no en la consulta para saber cuántos quedaron
     afuera. Preguntárselo a la base sería una segunda consulta para contar lo
     que ya está en la mano. */
  const todos = query.data ?? []

  /* Las opciones salen de lo que hay cargado y no de las 24 jurisdicciones: un
     desplegable con veinticuatro opciones de las que sirven tres hay que leerlo
     entero cada vez. */
  const provincias = provinciasDe(todos)

  /* La provincia corta antes que los prospectos para que el cartel de "hay N
     fuera de la lista" hable de los de esta provincia y no de todo el padrón. */
  const enZona = provincia
    ? todos.filter(
        (item) => (item.provincia_clave ?? clave(item.provincia)) === provincia,
      )
    : todos

  const prospectos = enZona.filter(esProspecto)
  const visibles = verProspectos ? enZona : enZona.filter((item) => !esProspecto(item))
  const ocultos = verProspectos ? 0 : prospectos.length

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
        {/* Un `<select>` pelado y no el `Select` de `ui.jsx`: aquel viene con
            `w-full` y acá va al lado del buscador. */}
        <select
          value={provincia}
          onChange={(event) => setProvincia(event.target.value)}
          className="rounded-md border border-steel-200 bg-white px-3 py-2 text-sm text-steel-700"
        >
          <option value="">Todas las provincias</option>
          {provincias.map((item) => (
            <option key={item.clave} value={item.clave}>
              {item.nombre} ({item.cuenta})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-steel-600">
          <input
            type="checkbox"
            checked={onlyDebtors}
            onChange={(event) => setOnlyDebtors(event.target.checked)}
            className="h-4 w-4 rounded border-steel-300 text-secondary-500 focus:ring-secondary-500"
          />
          Sólo los que deben
        </label>
        <label className="flex items-center gap-2 text-sm text-steel-600">
          <input
            type="checkbox"
            checked={verProspectos}
            onChange={(event) => setVerProspectos(event.target.checked)}
            className="h-4 w-4 rounded border-steel-300 text-secondary-500 focus:ring-secondary-500"
          />
          Incluir prospectos
        </label>
      </div>

      {ocultos > 0 && (
        <p className="mb-4 rounded-md border border-steel-200 bg-steel-50 px-3 py-2 text-xs text-steel-600">
          {ocultos === 1
            ? term
              ? 'Hay 1 prospecto que coincide con la búsqueda y queda fuera de la lista: se le armó un presupuesto pero todavía no compró.'
              : 'Hay 1 prospecto fuera de la lista: se le armó un presupuesto pero todavía no compró.'
            : `Hay ${formatNumber(ocultos)} prospectos ${
                term ? 'que coinciden con la búsqueda y quedan ' : ''
              }fuera de la lista: se les armó un presupuesto pero todavía no compraron.`}{' '}
          <button
            type="button"
            onClick={() => setVerProspectos(true)}
            className="font-semibold text-secondary-500 hover:underline"
          >
            Mostrarlos
          </button>
        </p>
      )}

      <Card>
        <Async
          query={query}
          empty={
            onlyDebtors
              ? 'Nadie tiene saldo pendiente.'
              : 'Todavía no hay clientes cargados.'
          }
        >
          {() => visibles.length === 0 ? (
            <Empty>
              {ocultos > 0
                ? 'Los que coinciden todavía no compraron. Marcá "Incluir prospectos" para verlos.'
                : provincia
                  ? 'Nadie con dirección en esa provincia. Puede que esté cargado sin localidad.'
                  : 'Nadie coincide con ese filtro.'}
            </Empty>
          ) : (
            <Table
              head={
                <>
                  <Th>Cliente</Th>
                  <Th>Tipo</Th>
                  <Th>Dónde</Th>
                  <Th align="right">Pedidos</Th>
                  <Th align="right">Facturado</Th>
                  <Th align="right">Cobrado</Th>
                  <Th align="right">Saldo</Th>
                  <Th align="right"> </Th>
                </>
              }
            >
              {visibles.map((customer) => {
                const saldo = Number(customer.saldo)
                const wa = whatsappLink(customer.telefono)
                const prospecto = esProspecto(customer)

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
                      {/* Prospecto reemplaza al tipo de lista en vez de
                          sumarse: mientras no compró, con qué lista cotiza es
                          un detalle, y lo que hay que saber de un vistazo es
                          que todavía no es cliente. */}
                      {prospecto ? (
                        <Badge tone="warn">prospecto</Badge>
                      ) : (
                        <Badge tone={customer.tipo === 'mayorista' ? 'info' : 'neutral'}>
                          {customer.tipo}
                        </Badge>
                      )}
                    </Td>
                    {/* Sin esto, filtrar por provincia deja una lista en la
                        que no se ve por qué está cada uno. */}
                    <Td className="text-xs text-steel-500">
                      {customer.localidad || customer.provincia ? (
                        <>
                          {customer.localidad}
                          {customer.provincia && (
                            <span className="block text-steel-400">
                              {customer.provincia}
                              {customer.codigo_postal ? ` · ${customer.codigo_postal}` : ''}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-steel-300">sin dirección</span>
                      )}
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
