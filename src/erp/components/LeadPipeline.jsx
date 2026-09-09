/**
 * Las piezas del embudo que usan las cuatro pantallas de leads.
 *
 * Están juntas porque mover un lead de etapa tiene que verse y pedir lo mismo
 * desde la lista, desde el tablero, desde la ficha y desde "Hoy". Si cada
 * pantalla armara su propio diálogo, tarde o temprano una se olvidaría de pedir
 * el motivo de la pérdida y esa venta quedaría sin explicación.
 */
import { useState } from 'react'
import {
  LEAD_STATE_LABELS,
  LEAD_STATE_REQUIRES,
  LEAD_STATE_TONES,
  LEAD_TRANSITIONS,
  LOST_REASONS,
  LOST_REASON_LABELS,
  changeLeadStatus,
} from '../api/leads'
import { Badge, Button, ErrorNote, Field, Input, Modal, Select, Textarea } from './ui'

export function StatusBadge({ status }) {
  return <Badge tone={LEAD_STATE_TONES[status]}>{LEAD_STATE_LABELS[status]}</Badge>
}

/**
 * Cuán vencida está la próxima acción.
 *
 * En cero dice "hoy" y no "0 días", que se lee como si no hubiera nada que
 * hacer. Los dormidos no muestran atraso: su fecha es de recontacto, no de
 * vencimiento, y llegar tarde a un recontacto de 75 días no es una urgencia.
 */
export function DueBadge({ dias, status }) {
  if (status === 'dormant') return <Badge tone="neutral">Recontactar</Badge>
  if (!dias) return <Badge tone="info">Hoy</Badge>

  return (
    <Badge tone={dias > 3 ? 'bad' : 'warn'}>
      {dias === 1 ? 'Vencida ayer' : `Vencida hace ${dias} días`}
    </Badge>
  )
}

/**
 * Lo que hay que completar para entrar a cada etapa.
 *
 * La base rechaza el guardado si falta algo (ver `leads_guard` en el esquema),
 * así que esto no es la validación: es preguntarlo antes para que el error sea
 * un campo vacío en un formulario y no un cartel rojo después de guardar.
 */
function CamposRequeridos({ status, form, set, lead }) {
  if (status === 'lost') {
    return (
      <>
        <Field label="¿Por qué se perdió?">
          <Select value={form.lost_reason} onChange={set('lost_reason')}>
            <option value="">Elegir motivo…</option>
            {LOST_REASONS.map((value) => (
              <option key={value} value={value}>
                {LOST_REASON_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Detalle" hint="Opcional, pero es lo que se lee al revisar por qué se cae la venta.">
          <Textarea rows={2} value={form.lost_notes} onChange={set('lost_notes')} />
        </Field>
      </>
    )
  }

  if (status === 'quoted') {
    return (
      <Field label="Monto del presupuesto" hint="Sin IVA, como la lista.">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.quote_amount}
          onChange={set('quote_amount')}
        />
      </Field>
    )
  }

  if (status === 'won') {
    return (
      <Field
        label="Monto de la venta"
        hint="Viene el del presupuesto; se corrige si cerró por otro número."
      >
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.won_amount}
          onChange={set('won_amount')}
        />
      </Field>
    )
  }

  if (status === 'qualified') {
    return (
      <>
        <p className="text-xs text-steel-500">
          Calificar es tener los tres datos con los que se puede cotizar. Sin ellos el
          estado diría que el lead está listo para presupuestar y no lo estaría.
        </p>
        <Field label="Localidad">
          <Input value={form.localidad} onChange={set('localidad')} />
        </Field>
        <Field label="Cantidad">
          <Input type="number" min="1" value={form.cantidad} onChange={set('cantidad')} />
        </Field>
        <Field label="¿Van agujereadas?">
          <Select value={form.agujereada} onChange={set('agujereada')}>
            <option value="">Todavía no se sabe</option>
            <option value="true">Sí, agujereadas</option>
            <option value="false">No, comunes</option>
          </Select>
        </Field>
      </>
    )
  }

  if (status === 'dormant') {
    return (
      <Field
        label="Volver a contactar el"
        hint="Vacío deja los 75 días de siempre. Conviene volver con una novedad real, no con un “¿qué decidiste?”."
      >
        <Input type="date" value={form.dormant_until} onChange={set('dormant_until')} />
      </Field>
    )
  }

  /* Los estados que no piden nada igual dejan agendar cuándo seguir. */
  return (
    <Field
      label="Volver a mirarlo el"
      hint={`Vacío usa el plazo de la etapa. Hoy vence ${lead.next_action ?? 'sin acción'}.`}
    >
      <Input type="datetime-local" value={form.next_action_at} onChange={set('next_action_at')} />
    </Field>
  )
}

const VACIO = {
  lost_reason: '',
  lost_notes: '',
  quote_amount: '',
  won_amount: '',
  localidad: '',
  cantidad: '',
  agujereada: '',
  dormant_until: '',
  next_action_at: '',
  next_action: '',
}

/**
 * El diálogo que mueve un lead de etapa.
 *
 * Pide sólo lo que el estado destino necesita. Lo demás —cuándo seguir, qué
 * hacer— se puede dejar vacío: la base pone el plazo de la etapa y un texto
 * sugerido, así que un lead nunca queda activo sin próxima acción por olvido.
 */
export function TransitionModal({ lead, status, onClose, onDone }) {
  const [form, setForm] = useState({
    ...VACIO,
    localidad: lead.localidad ?? '',
    cantidad: lead.cantidad === null || lead.cantidad === undefined ? '' : String(lead.cantidad),
    agujereada: lead.agujereada === null || lead.agujereada === undefined ? '' : String(lead.agujereada),
    /* Lo más común es cerrar por lo que se presupuestó, así que viene puesto. */
    won_amount: lead.quote_amount ?? '',
    quote_amount: lead.quote_amount ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const guardar = async () => {
    setSaving(true)
    setError('')

    try {
      await changeLeadStatus(lead, status, cambiosDe(status, form))
      onDone()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Pasar a “${LEAD_STATE_LABELS[status]}”`} onClose={onClose}>
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm text-steel-500">
          {lead.nombre} — de <StatusBadge status={lead.status} /> a{' '}
          <StatusBadge status={status} />
        </p>

        <CamposRequeridos status={status} form={form} set={set} lead={lead} />

        <Field label="Qué hay que hacer después" hint="Vacío usa la acción sugerida de la etapa.">
          <Input
            value={form.next_action}
            onChange={set('next_action')}
            placeholder="Ej.: llamarlo el martes a la mañana"
          />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Mover'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Traduce el formulario a los campos que espera la base.
 *
 * Sólo se manda lo que el estado destino usa: mandar un `won_amount` al pasar a
 * "perdido" no rompe nada, pero deja la fila diciendo que se vendió algo.
 */
function cambiosDe(status, form) {
  const cambios = {}

  if (form.next_action.trim()) cambios.next_action = form.next_action.trim()

  switch (status) {
    case 'lost':
      cambios.lost_reason = form.lost_reason || null
      if (form.lost_notes.trim()) cambios.lost_notes = form.lost_notes.trim()
      break
    case 'quoted':
      cambios.quote_amount = form.quote_amount === '' ? null : Number(form.quote_amount)
      break
    case 'won':
      cambios.won_amount = form.won_amount === '' ? null : Number(form.won_amount)
      break
    case 'qualified':
      cambios.localidad = form.localidad.trim() || null
      cambios.cantidad = form.cantidad === '' ? null : Number.parseInt(form.cantidad, 10)
      cambios.agujereada = form.agujereada === '' ? null : form.agujereada === 'true'
      break
    case 'dormant':
      if (form.dormant_until) cambios.dormant_until = form.dormant_until
      break
    default:
      if (form.next_action_at) cambios.next_action_at = new Date(form.next_action_at).toISOString()
  }

  return cambios
}

/**
 * Los botones para mover el lead a donde pueda ir.
 *
 * Se muestran sólo las etapas alcanzables desde donde está: ofrecer un botón
 * que la base va a rechazar es enseñarle a la gente que el sistema falla.
 */
export function TransitionButtons({ lead, onDone, size = 'normal' }) {
  const [destino, setDestino] = useState(null)
  const posibles = LEAD_TRANSITIONS[lead.status] ?? []

  if (!posibles.length) return null

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {posibles.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setDestino(status)}
            className={`rounded-md border border-steel-200 bg-white font-semibold text-steel-600 transition-colors hover:border-steel-300 hover:text-steel-800 ${
              size === 'small' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
            }`}
          >
            {LEAD_STATE_LABELS[status]}
            {LEAD_STATE_REQUIRES[status] ? ' …' : ''}
          </button>
        ))}
      </div>

      {destino && (
        <TransitionModal
          lead={lead}
          status={destino}
          onClose={() => setDestino(null)}
          onDone={() => {
            setDestino(null)
            onDone()
          }}
        />
      )}
    </>
  )
}
