/**
 * El tablero del embudo.
 *
 * Es la vista que contesta "¿cómo venimos?" de un vistazo, que es distinto de
 * "¿qué hago ahora?" —eso lo contesta "Hoy"—. Sirve sobre todo para ver dónde
 * se amontonan los leads: una columna de presupuestos enviados que no baja
 * nunca dice más sobre el negocio que cualquier informe.
 *
 * `Dormidos` y `Perdidos` van en paneles aparte y cerrados. No son parte del
 * camino y meterlos como dos columnas más haría que el embudo pareciera terminar
 * ahí; pero tampoco se esconden, porque la base de dormidos es lo más valioso
 * que tiene un negocio estacional como éste.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LEAD_BOARD,
  LEAD_STATE_LABELS,
  LEAD_STATE_REQUIRES,
  LOST_REASON_LABELS,
  changeLeadStatus,
  listPipeline,
  puedePasarA,
} from '../api/leads'
import { TransitionModal } from '../components/LeadPipeline'
import { Async, Button, ErrorNote, PageHeader } from '../components/ui'
import { formatDate, formatNumber, formatPesos } from '../lib/format'
import { useAsync } from '../lib/useAsync'

/** Una tarjeta del tablero. Lo mínimo para decidir si hay que abrirla. */
function Tarjeta({ lead, onDragStart, arrastrando }) {
  const vencida = lead.next_action_at && new Date(lead.next_action_at) < new Date()

  return (
    <Link
      to={`/erp/leads/${lead.id}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        /* Firefox no arranca el arrastre sin datos puestos. */
        event.dataTransfer.setData('text/plain', lead.id)
        onDragStart(lead)
      }}
      className={`block cursor-grab rounded-lg border bg-white p-3 transition-shadow hover:shadow-sm ${
        arrastrando ? 'opacity-40' : ''
      } ${vencida ? 'border-amber-300' : 'border-steel-200'}`}
    >
      <p className="text-sm font-semibold text-steel-800">{lead.nombre}</p>

      <p className="mt-0.5 text-xs text-steel-400">
        {lead.localidad ?? 'Sin zona'}
        {lead.cantidad ? ` · ${formatNumber(lead.cantidad)} varillas` : ''}
      </p>

      {lead.quote_amount ? (
        <p className="mt-1 text-xs font-semibold text-steel-600">
          {formatPesos(Number(lead.quote_amount))}
        </p>
      ) : null}

      {lead.status === 'lost' && lead.lost_reason ? (
        <p className="mt-1 text-xs text-steel-400">{LOST_REASON_LABELS[lead.lost_reason]}</p>
      ) : null}

      {lead.next_action ? (
        <p className={`mt-1.5 text-xs ${vencida ? 'text-amber-700' : 'text-steel-500'}`}>
          {lead.next_action}
          <span className="block text-steel-400">{formatDate(lead.next_action_at)}</span>
        </p>
      ) : null}

      {lead.status === 'dormant' && lead.dormant_until ? (
        <p className="mt-1.5 text-xs text-steel-500">
          Recontactar el {formatDate(lead.dormant_until)}
          {lead.reactivation_count > 0 ? ` · ${lead.reactivation_count} intento(s)` : ''}
        </p>
      ) : null}
    </Link>
  )
}

/** Una columna del tablero: acepta lo que puede recibir y rechaza lo demás. */
function Columna({ status, leads, arrastrado, onDragStart, onDrop, className = '' }) {
  const [encima, setEncima] = useState(false)
  const admite = arrastrado ? puedePasarA(arrastrado.status, status) : false

  return (
    <div
      onDragOver={(event) => {
        if (!admite) return
        /* Sin esto el navegador no considera la zona como destino válido. */
        event.preventDefault()
        setEncima(true)
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(event) => {
        event.preventDefault()
        setEncima(false)
        if (admite) onDrop(status)
      }}
      className={`flex min-w-[240px] flex-1 flex-col rounded-lg border p-2 transition-colors ${
        encima
          ? 'border-secondary-400 bg-secondary-50'
          : arrastrado && admite
            ? 'border-dashed border-secondary-300 bg-white'
            : 'border-steel-200 bg-steel-50'
      } ${className}`}
    >
      <header className="flex items-baseline justify-between px-1 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-steel-500">
          {LEAD_STATE_LABELS[status]}
        </h3>
        <span className="text-xs text-steel-400">{leads.length}</span>
      </header>

      <div className="space-y-2">
        {leads.map((lead) => (
          <Tarjeta
            key={lead.id}
            lead={lead}
            arrastrando={arrastrado?.id === lead.id}
            onDragStart={onDragStart}
          />
        ))}

        {leads.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-steel-300">Vacío</p>
        )}
      </div>
    </div>
  )
}

/** Los paneles cerrados de dormidos y perdidos. */
function Panel({ status, leads, arrastrado, onDragStart, onDrop }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <section className="rounded-lg border border-steel-200 bg-white">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-steel-700">
          {LEAD_STATE_LABELS[status]}{' '}
          <span className="font-normal text-steel-400">({leads.length})</span>
        </span>
        <span className="text-xs text-steel-400">{abierto ? 'Ocultar' : 'Ver'}</span>
      </button>

      {abierto && (
        <div className="border-t border-steel-100 p-2">
          <Columna
            status={status}
            leads={leads}
            arrastrado={arrastrado}
            onDragStart={onDragStart}
            onDrop={onDrop}
            className="min-w-0"
          />
        </div>
      )}
    </section>
  )
}

export default function LeadsBoard() {
  const query = useAsync(listPipeline, [])
  const [arrastrado, setArrastrado] = useState(null)
  const [pendiente, setPendiente] = useState(null)
  const [error, setError] = useState('')

  /*
    Soltar aplica la transición directo cuando el destino no pide nada, y abre
    el diálogo cuando sí. Pedir siempre confirmación volvería inútil el arrastre
    —serían dos gestos para lo que tendría que ser uno— y no pedirla nunca
    dejaría leads perdidos sin motivo, que es el dato que justamente se quiere
    medir.
  */
  const soltar = async (destino) => {
    const lead = arrastrado
    setArrastrado(null)
    if (!lead || lead.status === destino) return

    if (LEAD_STATE_REQUIRES[destino]) {
      setPendiente({ lead, destino })
      return
    }

    try {
      await changeLeadStatus(lead, destino)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tablero"
        description="El embudo entero. Se arrastra una tarjeta para moverla de etapa."
        actions={
          <>
            <Link to="/erp">
              <Button variant="ghost">Hoy</Button>
            </Link>
            <Link to="/erp/leads">
              <Button variant="ghost">Todos los leads</Button>
            </Link>
          </>
        }
      />

      <ErrorNote onRetry={() => setError('')}>{error}</ErrorNote>

      <Async query={query} empty="Todavía no hay leads.">
        {(leads) => {
          const por = (status) => leads.filter((l) => l.status === status)

          return (
            <div className="space-y-4">
              <div className="flex gap-3 overflow-x-auto pb-2">
                {LEAD_BOARD.map((status) => (
                  <Columna
                    key={status}
                    status={status}
                    leads={por(status)}
                    arrastrado={arrastrado}
                    onDragStart={setArrastrado}
                    onDrop={soltar}
                  />
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Panel
                  status="dormant"
                  leads={por('dormant')}
                  arrastrado={arrastrado}
                  onDragStart={setArrastrado}
                  onDrop={soltar}
                />
                <Panel
                  status="lost"
                  leads={por('lost')}
                  arrastrado={arrastrado}
                  onDragStart={setArrastrado}
                  onDrop={soltar}
                />
              </div>
            </div>
          )
        }}
      </Async>

      {pendiente && (
        <TransitionModal
          lead={pendiente.lead}
          status={pendiente.destino}
          onClose={() => setPendiente(null)}
          onDone={() => {
            setPendiente(null)
            query.reload()
          }}
        />
      )}
    </div>
  )
}
