/**
 * La lista de precios.
 *
 * Es la única pantalla del ERP que se ve desde afuera: lo que se guarda acá es
 * lo que cotiza el simulador de la web al rato siguiente, sin deployar nada.
 * Por eso pide confirmar antes de guardar y avisa qué implica.
 */
import { useState } from 'react'
import { createTier, deleteTier, listTiers, updateTier } from '../api/prices'
import { useAsync } from '../lib/useAsync'
import { formatDateTime, formatNumber, formatPesos } from '../lib/format'
import {
  Async,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from '../components/ui'

const EMPTY = {
  min_qty: '',
  max_qty: '',
  plain_price: '',
  drilled_price: '',
  kind: 'minorista',
}

/*
  Las dos listas se muestran separadas y no como una tabla con una columna
  "lista": tienen escalones propios que se solapan —las dos tienen un tramo que
  arranca en 1.000— y mezcladas por cantidad quedan intercaladas, que es la
  forma más rápida de editar el precio equivocado.
*/
const LISTAS = [
  {
    kind: 'minorista',
    titulo: 'Lista minorista',
    detalle:
      'La pública: la que cotiza el simulador de la web y la que paga cualquiera sin acuerdo.',
  },
  {
    kind: 'mayorista',
    titulo: 'Lista mayorista',
    detalle:
      'La de los revendedores. Se aplica por ser cliente mayorista, no por la cantidad de este pedido, y esas ventas no pagan comisión.',
  },
]

/** Alta y edición de un escalón. */
function TierModal({ tier, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    tier
      ? {
          min_qty: String(tier.min_qty),
          max_qty: tier.max_qty === null ? '' : String(tier.max_qty),
          plain_price: String(Number(tier.plain_price)),
          drilled_price: String(Number(tier.drilled_price)),
          kind: tier.kind,
        }
      : EMPTY,
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    const min = Number.parseInt(form.min_qty, 10)
    const max = form.max_qty === '' ? null : Number.parseInt(form.max_qty, 10)
    const plain = Number(form.plain_price)
    const drilled = Number(form.drilled_price)

    if (!Number.isFinite(min) || min < 1) {
      setError('El escalón tiene que arrancar en 1 o más.')
      return
    }
    if (max !== null && max < min) {
      setError('El tope no puede ser menor que el arranque.')
      return
    }
    if (!Number.isFinite(plain) || !Number.isFinite(drilled) || plain < 0 || drilled < 0) {
      setError('Revisá los precios.')
      return
    }

    setSaving(true)
    setError('')

    const values = {
      min_qty: min,
      max_qty: max,
      plain_price: plain,
      drilled_price: drilled,
      kind: form.kind,
    }

    try {
      if (tier) await updateTier(tier.id, values)
      else await createTier(values)
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={tier ? 'Editar escalón' : 'Nuevo escalón'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desde (unidades)">
            <Input
              type="number"
              min="1"
              step="1"
              value={form.min_qty}
              onChange={set('min_qty')}
              autoFocus
            />
          </Field>
          <Field label="Hasta" hint="Vacío = sin tope, el último escalón.">
            <Input type="number" min="1" step="1" value={form.max_qty} onChange={set('max_qty')} />
          </Field>
          <Field label="Precio sin agujerear" hint="Sin IVA">
            <Input
              type="number"
              min="0"
              step="1"
              value={form.plain_price}
              onChange={set('plain_price')}
            />
          </Field>
          <Field label="Precio agujereada" hint="Sin IVA">
            <Input
              type="number"
              min="0"
              step="1"
              value={form.drilled_price}
              onChange={set('drilled_price')}
            />
          </Field>
        </div>

        <Field label="Lista">
          <Select value={form.kind} onChange={set('kind')}>
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
          </Select>
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Lo que guardes acá es lo que cotiza el simulador de la web.
        </p>

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

export default function Prices() {
  const query = useAsync(listTiers, [])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const remove = async (tier) => {
    if (!confirm('¿Borrar este escalón de la lista?')) return
    setError('')
    try {
      await deleteTier(tier.id)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Precios"
        description="La lista que usa el ERP y también el simulador de la web. Todo sin IVA."
        actions={<Button onClick={() => setEditing({})}>Nuevo escalón</Button>}
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Async query={query} empty="No hay precios cargados.">
        {(tiers) => (
          <div className="space-y-6">
            {LISTAS.map(({ kind, titulo, detalle }) => {
              const propios = tiers.filter((tier) => tier.kind === kind)

              return (
                <Card key={kind} title={titulo}>
                  <p className="border-b border-steel-100 px-4 py-2 text-xs text-steel-400">
                    {detalle}
                  </p>

                  {propios.length === 0 ? (
                    <Empty>Esta lista no tiene escalones cargados.</Empty>
                  ) : (
                    <Table
                      head={
                        <>
                          <Th>Cantidad</Th>
                          <Th align="right">Sin agujerear</Th>
                          <Th align="right">Agujereada</Th>
                          <Th align="right">Diferencia</Th>
                          <Th>Actualizado</Th>
                          <Th align="right"> </Th>
                        </>
                      }
                    >
                      {propios.map((tier) => (
                        <tr key={tier.id} className="hover:bg-steel-50">
                          <Td className="whitespace-nowrap font-medium text-steel-700">
                            {formatNumber(tier.min_qty)}
                            {tier.max_qty === null
                              ? ' o más'
                              : ` a ${formatNumber(tier.max_qty)}`}
                          </Td>
                          <Td align="right" className="tabular-nums text-steel-700">
                            {formatPesos(Number(tier.plain_price))}
                          </Td>
                          <Td align="right" className="tabular-nums text-steel-700">
                            {formatPesos(Number(tier.drilled_price))}
                          </Td>
                          <Td align="right" className="tabular-nums text-xs text-steel-400">
                            {/* El recargo por agujereado, que es lo que se revisa al cambiar precios. */}
                            +{formatPesos(Number(tier.drilled_price) - Number(tier.plain_price))}
                          </Td>
                          <Td className="whitespace-nowrap text-xs text-steel-400">
                            {formatDateTime(tier.updated_at)}
                          </Td>
                          <Td align="right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                className="px-2.5 py-1.5 text-xs"
                                onClick={() => setEditing(tier)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="danger"
                                className="px-2.5 py-1.5 text-xs"
                                onClick={() => remove(tier)}
                              >
                                Borrar
                              </Button>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </Async>

      <div className="mt-4 space-y-2 text-xs text-steel-400">
        <p>
          La minorista tiene que cubrir toda la escala sin huecos: el escalón que
          arranca en 1 y el último sin tope. La mayorista puede arrancar donde
          quiera —hoy en 1.000— porque al revendedor que un mes lleva menos se le
          aplica igual su primer escalón.
        </p>
        <p>
          <code className="rounded bg-steel-100 px-1">src/data/pricing.js</code>{' '}
          guarda una copia de esta lista que se usa si la base no responde.
          Conviene actualizarla cuando el cambio de precios es grande.
        </p>
      </div>

      {editing && (
        <TierModal
          tier={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.reload()
          }}
        />
      )}
    </>
  )
}
