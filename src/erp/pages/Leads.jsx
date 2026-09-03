/**
 * Leads: todo el que preguntó, venga de donde venga.
 *
 * La pantalla está armada alrededor de una sola pregunta —¿a quién llamo
 * ahora?— así que arranca filtrada por los que nadie tocó todavía y el botón
 * más a mano es el de WhatsApp, con el mensaje ya escrito.
 *
 * Al principio los leads sólo llegaban del simulador de la web. Ahora también
 * se cargan a mano, porque el que escribe por Instagram o llama por teléfono es
 * exactamente igual de lead y antes no tenía dónde anotarse.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LEAD_ORIGINS,
  LEAD_ORIGIN_LABELS,
  LEAD_ORIGIN_TONES,
  LEAD_STATES,
  LEAD_STATE_LABELS,
  LEAD_STATE_TONES,
  convertLeadToCustomer,
  createLead,
  deleteLead,
  linkLeadToCustomer,
  listLeads,
  updateLead,
} from '../api/leads'
import { listCustomerOptions } from '../api/customers'
import { useAsync } from '../lib/useAsync'
import { useDebounced } from '../lib/useDebounced'
import { formatDateTime, formatNumber, whatsappLink } from '../lib/format'
import {
  Async,
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  Modal,
  Money,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
} from '../components/ui'

/**
 * El mensaje con el que se retoma el contacto.
 *
 * Cambia según de dónde vino y si llegó a cotizar algo. Decirle "vi que
 * cotizaste en nuestra web" a alguien que escribió por Instagram es la clase de
 * detalle que hace sonar el mensaje a formulario automático, que es justo lo
 * contrario de lo que se busca al retomar un contacto.
 */
function saludo(lead) {
  const arranque = `Hola ${lead.nombre}, te escribo de Recuvarilla.`

  if (!lead.cantidad) {
    return `${arranque} Vi tu consulta por las varillas. ¿Te paso un presupuesto?`
  }

  const tipo = lead.agujereada ? 'agujereadas' : 'sin agujerear'
  const donde = lead.origen === 'web' ? ' en nuestra web' : ''

  return `${arranque} Vi que cotizaste ${formatNumber(lead.cantidad)} varillas ${tipo}${donde}. ¿Te sirve que repasemos el presupuesto?`
}

/** Ficha para cambiar estado y dejar anotado qué dijo. */
function LeadModal({ lead, onClose, onSaved }) {
  const [estado, setEstado] = useState(lead.estado)
  const [origen, setOrigen] = useState(lead.origen)
  const [notas, setNotas] = useState(lead.notas ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await updateLead(lead.id, { estado, origen, notas: notas.trim() || null })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={lead.nombre} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md bg-steel-50 p-3 text-xs text-steel-600">
          {/* Los leads cargados a mano no traen presupuesto: el que escribe por
              Instagram todavía no cotizó nada. */}
          {lead.cantidad === null ? (
            <p>Todavía no cotizó nada: se cargó a mano desde {LEAD_ORIGIN_LABELS[lead.origen]}.</p>
          ) : (
            <>
              <p>
                Cotizó {formatNumber(lead.cantidad)} varillas{' '}
                {lead.agujereada ? 'agujereadas' : 'sin agujerear'} por{' '}
                <Money value={lead.mercaderia} className="font-semibold" /> + IVA.
              </p>
              <p className="mt-1">
                {lead.entrega === 'envio'
                  ? `Envío a ${lead.localidad ?? ''} (${lead.codigo_postal ?? '—'}), ${formatNumber(lead.kilometros ?? 0)} km.`
                  : 'Retira en fábrica.'}
              </p>
            </>
          )}
          <p className="mt-1 text-steel-400">{formatDateTime(lead.created_at)}</p>
        </div>

        <Field
          label="De dónde salió"
          hint="Corregirlo cambia a qué canal se le atribuye este contacto."
        >
          <Select value={origen} onChange={(event) => setOrigen(event.target.value)}>
            {LEAD_ORIGINS.map((value) => (
              <option key={value} value={value}>
                {LEAD_ORIGIN_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Estado">
          <Select value={estado} onChange={(event) => setEstado(event.target.value)}>
            {LEAD_STATES.map((value) => (
              <option key={value} value={value}>
                {LEAD_STATE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notas" hint="Qué dijo, cuándo volver a llamar, qué lo frenó.">
          <Textarea
            rows={4}
            value={notas}
            onChange={(event) => setNotas(event.target.value)}
          />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} type="button">
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const NUEVO = {
  nombre: '',
  telefono: '',
  email: '',
  origen: 'instagram',
  cantidad: '',
  agujereada: false,
  localidad: '',
  notas: '',
}

/**
 * Alta a mano del que no vino por la web.
 *
 * Pide poco: nombre y de dónde salió. Lo demás es opcional porque en el momento
 * en que alguien escribe por Instagram no se sabe casi nada, y un formulario
 * que exige la cantidad obliga a inventarla.
 */
function NewLeadModal({ onClose, onSaved }) {
  const [form, setForm] = useState(NUEVO)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({
      ...prev,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nombre = form.nombre.trim()
    if (!nombre) {
      setError('Poné al menos el nombre.')
      return
    }

    const cantidad = form.cantidad === '' ? null : Number.parseInt(form.cantidad, 10)
    if (cantidad !== null && (!Number.isFinite(cantidad) || cantidad < 1)) {
      setError('La cantidad tiene que ser un número de varillas, o quedar vacía.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await createLead({
        nombre,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        origen: form.origen,
        cantidad,
        agujereada: form.agujereada,
        localidad: form.localidad.trim() || null,
        notas: form.notas.trim() || null,
        estado: 'nuevo',
      })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Nuevo lead" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={set('nombre')} autoFocus />
          </Field>
          <Field label="De dónde salió">
            <Select value={form.origen} onChange={set('origen')}>
              {LEAD_ORIGINS.map((value) => (
                <option key={value} value={value}>
                  {LEAD_ORIGIN_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={set('telefono')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cantidad" hint="Opcional, si ya dijo cuántas necesita.">
            <Input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.cantidad}
              onChange={set('cantidad')}
            />
          </Field>
          <Field label="Localidad">
            <Input value={form.localidad} onChange={set('localidad')} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-steel-600">
          <input type="checkbox" checked={form.agujereada} onChange={set('agujereada')} />
          Pregunta por varilla agujereada
        </label>

        <Field label="Notas" hint="Qué preguntó, por dónde escribió, quién lo trajo.">
          <Textarea rows={3} value={form.notas} onChange={set('notas')} />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Pasar el lead a cliente, sea uno nuevo o uno que ya está.
 *
 * Antes esto creaba un cliente nuevo siempre. El que ya te compró y vuelve a
 * preguntar terminaba con dos fichas y la cuenta corriente partida al medio,
 * que es la duplicación de verdad: no viene de tener dos tablas, viene de no
 * poder decir "este es aquel".
 */
function ConvertModal({ lead, onClose, onDone }) {
  const customers = useAsync(listCustomerOptions, [])
  const [modo, setModo] = useState('nuevo')
  const [customerId, setCustomerId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const confirmar = async () => {
    if (modo === 'existente' && !customerId) {
      setError('Elegí a qué cliente engancharlo.')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (modo === 'existente') {
        await linkLeadToCustomer(lead.id, customerId)
        onDone(customerId)
      } else {
        const customer = await convertLeadToCustomer(lead)
        onDone(customer.id)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`${lead.nombre} pasa a cliente`} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          {[
            ['nuevo', 'Es un cliente nuevo', 'Se crea la ficha con los datos que ya dejó.'],
            ['existente', 'Ya es cliente', 'Se engancha el lead a su ficha, sin duplicarlo.'],
          ].map(([valor, titulo, detalle]) => (
            <label
              key={valor}
              className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
                modo === valor
                  ? 'border-secondary-500 bg-secondary-50'
                  : 'border-steel-200 hover:border-steel-300'
              }`}
            >
              <input
                type="radio"
                name="modo"
                checked={modo === valor}
                onChange={() => setModo(valor)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-semibold text-steel-700">{titulo}</span>
                <span className="block text-xs text-steel-500">{detalle}</span>
              </span>
            </label>
          ))}
        </div>

        {modo === 'existente' && (
          <Field label="¿Cuál?">
            <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Elegir cliente…</option>
              {(customers.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={saving}>
            {saving ? 'Guardando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function Leads() {
  const [estado, setEstado] = useState('nuevo')
  const [origen, setOrigen] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [converting, setConverting] = useState(null)
  const [error, setError] = useState('')

  // El buscador espera a que dejes de escribir antes de consultar.
  const term = useDebounced(search)
  const query = useAsync(
    () => listLeads({ estado, origen, search: term }),
    [estado, origen, term],
  )
  const navigate = useNavigate()

  const remove = async (lead) => {
    if (!confirm(`¿Borrar el lead de ${lead.nombre}?`)) return
    setError('')
    try {
      await deleteLead(lead.id)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description="Todo el que preguntó: por la web, por Instagram, por teléfono. Cada uno es alguien a quien llamar."
        actions={<Button onClick={() => setCreating(true)}>Nuevo lead</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={estado}
          onChange={(event) => setEstado(event.target.value)}
          className="w-auto"
        >
          <option value="">Todos los estados</option>
          {LEAD_STATES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATE_LABELS[value]}
            </option>
          ))}
        </Select>
        <Select
          value={origen}
          onChange={(event) => setOrigen(event.target.value)}
          className="w-auto"
        >
          <option value="">Todos los orígenes</option>
          {LEAD_ORIGINS.map((value) => (
            <option key={value} value={value}>
              {LEAD_ORIGIN_LABELS[value]}
            </option>
          ))}
        </Select>
        <Input
          type="search"
          placeholder="Buscar por nombre, teléfono o email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-auto min-w-[16rem] flex-1"
        />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Card>
        <Async
          query={query}
          empty={
            estado === 'nuevo'
              ? 'No hay leads sin contactar. Al día.'
              : 'No hay leads con ese filtro.'
          }
        >
          {(leads) => (
            <Table
              head={
                <>
                  <Th>Contacto</Th>
                  <Th>Origen</Th>
                  <Th align="right">Cotizó</Th>
                  <Th align="right">Monto</Th>
                  <Th>Entrega</Th>
                  <Th>Estado</Th>
                  <Th>Fecha</Th>
                  <Th align="right">Acciones</Th>
                </>
              }
            >
              {leads.map((lead) => {
                const wa = whatsappLink(lead.telefono, saludo(lead))

                return (
                  <tr key={lead.id} className="hover:bg-steel-50">
                    <Td>
                      <button
                        type="button"
                        onClick={() => setEditing(lead)}
                        className="text-left font-medium text-steel-700 hover:text-secondary-500"
                      >
                        {lead.nombre}
                      </button>
                      <span className="block text-xs text-steel-400">
                        {lead.telefono}
                        {lead.email ? ` · ${lead.email}` : ''}
                      </span>
                      {lead.notas && (
                        <span className="mt-1 block max-w-xs truncate text-xs italic text-steel-400">
                          {lead.notas}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={LEAD_ORIGIN_TONES[lead.origen]}>
                        {LEAD_ORIGIN_LABELS[lead.origen]}
                      </Badge>
                    </Td>
                    {/* Un lead cargado a mano no cotizó nada: mostrar 0 haría
                        creer que pidió cero varillas por cero pesos. */}
                    <Td align="right" className="tabular-nums text-steel-700">
                      {lead.cantidad === null ? (
                        <span className="text-steel-300">—</span>
                      ) : (
                        <>
                          {formatNumber(lead.cantidad)}
                          <span className="block text-xs text-steel-400">
                            {lead.agujereada ? 'agujereada' : 'común'}
                          </span>
                        </>
                      )}
                    </Td>
                    <Td align="right">
                      {lead.mercaderia === null ? (
                        <span className="text-steel-300">—</span>
                      ) : (
                        <Money value={lead.mercaderia} />
                      )}
                    </Td>
                    <Td className="text-xs text-steel-500">
                      {lead.entrega === 'envio'
                        ? `${lead.localidad ?? '—'} · ${formatNumber(lead.kilometros ?? 0)} km`
                        : (lead.localidad ?? 'Retira')}
                    </Td>
                    <Td>
                      <Badge tone={LEAD_STATE_TONES[lead.estado]}>
                        {LEAD_STATE_LABELS[lead.estado]}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-steel-400">
                      {formatDateTime(lead.created_at)}
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md bg-secondary-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-secondary-600"
                          >
                            WhatsApp
                          </a>
                        )}
                        {lead.customer ? (
                          <Button
                            variant="ghost"
                            className="px-2.5 py-1.5 text-xs"
                            onClick={() => navigate(`/erp/clientes/${lead.customer.id}`)}
                          >
                            Ver cliente
                          </Button>
                        ) : (
                          <Button
                            variant="soft"
                            className="px-2.5 py-1.5 text-xs"
                            onClick={() => setConverting(lead)}
                          >
                            Hacer cliente
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          className="px-2.5 py-1.5 text-xs"
                          onClick={() => remove(lead)}
                        >
                          Borrar
                        </Button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Async>
      </Card>

      {editing && (
        <LeadModal
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.reload()
          }}
        />
      )}

      {creating && (
        <NewLeadModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            query.reload()
          }}
        />
      )}

      {converting && (
        <ConvertModal
          lead={converting}
          onClose={() => setConverting(null)}
          /* Abrir la ficha del cliente es lo que sigue naturalmente: se lo hizo
             cliente para cargarle un pedido. */
          onDone={(customerId) => navigate(`/erp/clientes/${customerId}`)}
        />
      )}
    </>
  )
}
