/**
 * La ficha de un lead: los datos y, sobre todo, el historial.
 *
 * El estado dice dónde está el lead hoy. El historial dice por dónde pasó, y es
 * lo único que contesta la pregunta que importa cuando una venta se cae: en qué
 * momento se torció. Por eso el timeline ocupa la mitad de la pantalla y no un
 * acordeón al final.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  LEAD_EVENT_LABELS,
  LEAD_EVENT_TYPES,
  LEAD_SOURCE_LABELS,
  LEAD_STATE_LABELS,
  LEAD_TYPE_LABELS,
  LOST_REASON_LABELS,
  addLeadEvent,
  getLead,
  listLeadEvents,
} from '../api/leads'
import { StatusBadge, TransitionButtons } from '../components/LeadPipeline'
import {
  Async,
  Button,
  Card,
  ErrorNote,
  Field,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui'
import { formatDate, formatDateTime, formatNumber, formatPesos, whatsappLink } from '../lib/format'
import { useAsync } from '../lib/useAsync'

/** Un dato de la ficha. El guión evita que un campo vacío parezca un cero. */
function Dato({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-steel-500">{label}</dt>
      <dd className="text-sm text-steel-800">{children ?? '—'}</dd>
    </div>
  )
}

/**
 * Una entrada del historial.
 *
 * Los cambios de estado se leen distinto del resto —son el esqueleto de la
 * historia— así que llevan el punto marcado y las etapas escritas.
 */
function Evento({ evento }) {
  const esCambio = evento.type === 'status_change'

  return (
    <li className="relative pl-6">
      <span
        className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${
          esCambio ? 'bg-secondary-500' : 'bg-steel-300'
        }`}
      />

      <p className="text-sm text-steel-800">
        {esCambio ? (
          <>
            {evento.from_status ? (
              <>
                {LEAD_STATE_LABELS[evento.from_status]} →{' '}
                <strong className="font-semibold">{LEAD_STATE_LABELS[evento.to_status]}</strong>
              </>
            ) : (
              <strong className="font-semibold">Lead creado</strong>
            )}
          </>
        ) : (
          <strong className="font-semibold">{LEAD_EVENT_LABELS[evento.type] ?? evento.type}</strong>
        )}
      </p>

      {evento.note && <p className="text-sm text-steel-600">{evento.note}</p>}

      <p className="text-xs text-steel-400">
        {formatDateTime(evento.created_at)}
        {evento.actor && evento.actor !== 'system' ? ` · ${evento.actor}` : ' · automático'}
      </p>
    </li>
  )
}

/** Anotar algo que pasó y que no es un cambio de etapa. */
function Anotar({ leadId, onSaved }) {
  const [type, setType] = useState('note')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    if (!note.trim()) {
      setError('Escribí qué pasó.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await addLeadEvent(leadId, { type, note: note.trim() })
      setNote('')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-steel-100 px-4 py-4">
      <Field label="Anotar">
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          {LEAD_EVENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {LEAD_EVENT_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      <Textarea
        rows={2}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Qué pasó. Ej.: pidió que le mande la ficha técnica."
      />

      <ErrorNote>{error}</ErrorNote>

      <Button onClick={guardar} disabled={saving}>
        {saving ? 'Guardando…' : 'Agregar al historial'}
      </Button>
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams()
  const lead = useAsync(() => getLead(id), [id])
  const eventos = useAsync(() => listLeadEvents(id), [id])

  const recargar = () => {
    lead.reload()
    eventos.reload()
  }

  return (
    <div className="space-y-6">
      <Async query={lead}>
        {(l) => {
          const wa = whatsappLink(l.telefono, `Hola ${l.nombre?.split(' ')[0] ?? ''}, te escribo de Recuvarilla.`)

          return (
            <>
              <PageHeader
                title={l.nombre}
                description={
                  l.next_action
                    ? `${l.next_action} — ${formatDate(l.next_action_at)}`
                    : l.status === 'dormant'
                      ? `Recontactar el ${formatDate(l.dormant_until)}`
                      : 'Sin próxima acción.'
                }
                actions={
                  <>
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer">
                        <Button>WhatsApp</Button>
                      </a>
                    )}
                    <Link to="/erp/leads">
                      <Button variant="ghost">Volver</Button>
                    </Link>
                  </>
                }
              />

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                  <Card title="Etapa">
                    <div className="space-y-4 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={l.status} />
                        {l.status === 'lost' && l.lost_reason && (
                          <span className="text-sm text-steel-500">
                            {LOST_REASON_LABELS[l.lost_reason]}
                          </span>
                        )}
                        {l.reactivation_count > 0 && (
                          <span className="text-xs text-steel-400">
                            {l.reactivation_count} recontacto(s)
                          </span>
                        )}
                      </div>

                      {l.lost_notes && <p className="text-sm text-steel-600">{l.lost_notes}</p>}

                      <TransitionButtons lead={l} onDone={recargar} />
                    </div>
                  </Card>

                  <Card title="Datos">
                    <dl className="grid grid-cols-2 gap-4 px-4 py-4">
                      <Dato label="Teléfono">{l.telefono}</Dato>
                      <Dato label="Email">{l.email}</Dato>
                      <Dato label="Canal">{LEAD_SOURCE_LABELS[l.source] ?? l.source}</Dato>
                      <Dato label="Tipo">{LEAD_TYPE_LABELS[l.lead_type]}</Dato>
                      <Dato label="Zona">{l.localidad}</Dato>
                      <Dato label="Provincia">{l.provincia}</Dato>
                      <Dato label="Cantidad">
                        {l.cantidad ? formatNumber(l.cantidad) : null}
                      </Dato>
                      <Dato label="Agujereadas">
                        {l.agujereada === null ? 'Todavía no se sabe' : l.agujereada ? 'Sí' : 'No'}
                      </Dato>
                      <Dato label="Responsable">{l.owner}</Dato>
                      <Dato label="Entró">{formatDate(l.created_at)}</Dato>
                      <Dato label="Presupuestado">
                        {l.quote_amount ? formatPesos(Number(l.quote_amount)) : null}
                      </Dato>
                      <Dato label="Vendido">
                        {l.won_amount ? formatPesos(Number(l.won_amount)) : null}
                      </Dato>
                      <Dato label="Cliente">
                        {l.customer ? (
                          <Link
                            to={`/erp/clientes/${l.customer.id}`}
                            className="font-semibold text-secondary-600 hover:underline"
                          >
                            {l.customer.nombre}
                          </Link>
                        ) : null}
                      </Dato>
                      <Dato label="Notas">{l.notas}</Dato>
                    </dl>
                  </Card>
                </div>

                <Card title="Historial">
                  <Async query={eventos} empty="Sin movimientos.">
                    {(lista) => (
                      <ol className="space-y-4 border-l border-steel-200 px-4 py-4 ml-4">
                        {lista.map((evento) => (
                          <Evento key={evento.id} evento={evento} />
                        ))}
                      </ol>
                    )}
                  </Async>

                  <Anotar leadId={l.id} onSaved={eventos.reload} />
                </Card>
              </div>
            </>
          )
        }}
      </Async>
    </div>
  )
}
