/**
 * "Hoy": la pantalla con la que se abre el ERP.
 *
 * No es una lista de leads, es una lista de acciones. La diferencia importa:
 * una lista de leads invita a mirarla, y una lista de acciones invita a
 * vaciarla. Trae lo que vence hoy o antes más los dormidos a los que les llegó
 * la fecha de recontacto, ordenado por cuán cerca está la plata —primero el que
 * está por cerrar, último el que recién entró— y no por fecha: dos días de
 * atraso en alguien que ya dijo "dale, mandámelas" no valen lo mismo que dos
 * días de atraso en alguien que preguntó un precio.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LEAD_SOURCE_LABELS,
  listToday,
  registerReactivation,
  runLeadSla,
} from '../api/leads'
import { DueBadge, StatusBadge, TransitionButtons } from '../components/LeadPipeline'
import {
  Async,
  Button,
  Card,
  ErrorNote,
  PageHeader,
  Table,
  Td,
  Th,
} from '../components/ui'
import { formatDate, formatNumber, whatsappLink } from '../lib/format'
import { useAsync } from '../lib/useAsync'

/**
 * El saludo con el que se abre el chat.
 *
 * Va la próxima acción adentro para que quien atiende no tenga que volver a la
 * pantalla a ver qué había que decirle.
 */
function saludo(lead) {
  return `Hola ${lead.nombre?.split(' ')[0] ?? ''}, te escribo de Recuvarilla.`
}

function Fila({ lead, onChanged, onError }) {
  const wa = whatsappLink(lead.telefono, saludo(lead))
  const [reactivando, setReactivando] = useState(false)

  const recontactar = async () => {
    setReactivando(true)
    try {
      await registerReactivation(lead)
      onChanged()
    } catch (error) {
      onError(error.message)
      setReactivando(false)
    }
  }

  return (
    <tr className={lead.dias_vencido > 3 ? 'bg-red-50/40' : undefined}>
      <Td>
        <Link
          to={`/erp/leads/${lead.id}`}
          className="font-semibold text-steel-800 hover:text-secondary-600"
        >
          {lead.nombre}
        </Link>
        <span className="block text-xs text-steel-400">
          {LEAD_SOURCE_LABELS[lead.source] ?? lead.source}
          {lead.localidad ? ` · ${lead.localidad}` : ''}
          {lead.owner ? ` · ${lead.owner}` : ''}
        </span>
      </Td>

      <Td>
        <StatusBadge status={lead.status} />
      </Td>

      <Td>
        <span className="text-steel-700">
          {lead.status === 'dormant'
            ? 'Recontactar con alguna novedad'
            : (lead.next_action ?? '—')}
        </span>
        <span className="block text-xs text-steel-400">
          {lead.cantidad ? `${formatNumber(lead.cantidad)} varillas · ` : ''}
          {formatDate(lead.vence_el)}
        </span>
      </Td>

      <Td>
        <DueBadge dias={lead.dias_vencido} status={lead.status} />
      </Td>

      <Td>
        <div className="flex flex-wrap items-center gap-1.5">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-secondary-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-secondary-600"
            >
              WhatsApp
            </a>
          )}

          {lead.status === 'dormant' ? (
            <button
              type="button"
              onClick={recontactar}
              disabled={reactivando}
              className="rounded-md border border-steel-200 bg-white px-2.5 py-1 text-xs font-semibold text-steel-600 transition-colors hover:border-steel-300 hover:text-steel-800 disabled:opacity-60"
            >
              {reactivando ? 'Anotando…' : `Intento ${(lead.reactivation_count ?? 0) + 1}`}
            </button>
          ) : null}

          <TransitionButtons lead={lead} onDone={onChanged} size="small" />
        </div>
      </Td>
    </tr>
  )
}

export default function LeadsToday() {
  const query = useAsync(listToday, [])
  const [error, setError] = useState('')
  const [barrido, setBarrido] = useState(null)

  /*
    El barrido de vencimientos lo dispara `pg_cron` a las 7, pero el proyecto
    puede no tener la extensión habilitada. Llamarlo también acá hace que lo
    corra la primera persona que entra cada día, que es justo antes de mirar
    esta lista. Es idempotente, así que abrir la pantalla diez veces no cambia
    nada.
  */
  useEffect(() => {
    let vivo = true
    runLeadSla()
      .then((resumen) => {
        if (!vivo) return
        setBarrido(resumen)
        const movidos =
          (resumen?.a_calificar ?? 0) + (resumen?.a_dormir ?? 0) + (resumen?.perdidos ?? 0)
        if (movidos) query.reload()
      })
      .catch(() => {
        /* Que falle el barrido no puede impedir ver la lista. */
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const movidos = barrido
    ? (barrido.a_calificar ?? 0) + (barrido.a_dormir ?? 0) + (barrido.perdidos ?? 0)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hoy"
        description="Lo que hay que hacer, de lo más cerca de cerrar a lo más lejos."
        actions={
          <>
            <Link to="/erp/leads/tablero">
              <Button variant="ghost">Tablero</Button>
            </Link>
            <Link to="/erp/leads">
              <Button variant="ghost">Todos los leads</Button>
            </Link>
          </>
        }
      />

      <ErrorNote onRetry={() => setError('')}>{error}</ErrorNote>

      {movidos > 0 && (
        <p className="rounded-md border border-steel-200 bg-steel-50 px-4 py-3 text-sm text-steel-600">
          El barrido de hoy movió {movidos}{' '}
          {movidos === 1 ? 'lead' : 'leads'}:{' '}
          {barrido.a_calificar ? `${barrido.a_calificar} a calificación, ` : ''}
          {barrido.a_dormir ? `${barrido.a_dormir} a dormidos, ` : ''}
          {barrido.perdidos ? `${barrido.perdidos} dados por perdidos ` : ''}
          por vencimiento.
        </p>
      )}

      <Card title="Para hoy">
        <Async query={query} empty="No hay nada vencido ni para hoy. Está todo al día.">
          {(leads) => (
            <Table
              head={
                <>
                  <Th>Lead</Th>
                  <Th>Etapa</Th>
                  <Th>Próxima acción</Th>
                  <Th>Vencimiento</Th>
                  <Th>Acciones</Th>
                </>
              }
            >
              {leads.map((lead) => (
                <Fila
                  key={lead.id}
                  lead={lead}
                  onChanged={query.reload}
                  onError={setError}
                />
              ))}
            </Table>
          )}
        </Async>
      </Card>
    </div>
  )
}
