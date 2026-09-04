/**
 * Los gastos de la empresa: producción, pauta, muestras y lo que venga.
 *
 * Se mira de a un mes porque es el período en que se cierra el resultado y se
 * reparte. Lo que se carga acá es exactamente lo que le resta a la ganancia en
 * la pantalla de Rentabilidad: no hay un segundo lugar donde anotar gastos.
 */
import { useState } from 'react'
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_LABELS,
  EXPENSE_TYPE_TONES,
  OPERATIVE_TYPES,
  REINVESTMENT_TYPES,
  createExpense,
  deleteExpense,
  listExpenses,
  totalsByType,
  updateExpense,
} from '../api/expenses'
import { findOrderByNumber } from '../api/orders'
import { useAsync } from '../lib/useAsync'
import { currentMonth, formatDate, formatMonth, formatPesos, monthRange, todayISO } from '../lib/format'
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
  Stat,
  Table,
  Td,
  Textarea,
  Th,
} from '../components/ui'

const EMPTY = {
  fecha: '',
  tipo: 'flete',
  descripcion: '',
  monto: '',
  proveedor: '',
  pedido: '',
  notas: '',
}

function ExpenseModal({ expense, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    expense
      ? {
          fecha: expense.fecha,
          tipo: expense.tipo,
          descripcion: expense.descripcion,
          monto: String(Number(expense.monto)),
          proveedor: expense.proveedor ?? '',
          pedido: expense.pedido ? String(expense.pedido.numero) : '',
          notas: expense.notas ?? '',
        }
      : { ...EMPTY, fecha: todayISO() },
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    const descripcion = form.descripcion.trim()
    if (!descripcion) {
      setError('Poné qué se pagó.')
      return
    }

    const monto = Number(form.monto)
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Poné cuánto se pagó.')
      return
    }

    setSaving(true)
    setError('')

    try {
      /*
        El pedido se escribe por número, que es como se lo nombra en todos
        lados, pero la base guarda su id. Si el número no existe conviene
        frenar: un gasto imputado a un pedido equivocado es peor que uno sin
        imputar, porque se descubre mucho más tarde.
      */
      let orderId = null
      if (form.pedido.trim()) {
        const numero = Number.parseInt(form.pedido.replace('#', ''), 10)
        const order = Number.isFinite(numero) ? await findOrderByNumber(numero) : null
        if (!order) {
          setError(`No hay ningún pedido #${form.pedido.replace('#', '')}.`)
          setSaving(false)
          return
        }
        orderId = order.id
      }

      const values = {
        fecha: form.fecha || todayISO(),
        tipo: form.tipo,
        descripcion,
        monto,
        proveedor: form.proveedor.trim() || null,
        order_id: orderId,
        notas: form.notas.trim() || null,
      }

      if (expense) await updateExpense(expense.id, values)
      else await createExpense(values)
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={expense ? 'Editar gasto' : 'Nuevo gasto'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha">
            <Input type="date" value={form.fecha} onChange={set('fecha')} />
          </Field>
          {/* Agrupado por quién lo paga y no como una lista plana: elegir mal
              el tipo no desordena un informe, le mueve plata a alguien. */}
          <Field label="Tipo">
            <Select value={form.tipo} onChange={set('tipo')}>
              <optgroup label="Los paga la empresa">
                {OPERATIVE_TYPES.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {EXPENSE_TYPE_LABELS[tipo]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Los paga la reinversión">
                {REINVESTMENT_TYPES.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {EXPENSE_TYPE_LABELS[tipo]}
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
        </div>

        <Field label="Qué se pagó">
          <Input value={form.descripcion} onChange={set('descripcion')} autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Importe" hint="Sin IVA, como todo lo demás.">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.monto}
              onChange={set('monto')}
            />
          </Field>
          <Field label="Proveedor">
            <Input value={form.proveedor} onChange={set('proveedor')} />
          </Field>
        </div>

        <Field
          label="Pedido"
          hint="Opcional. El número del pedido al que corresponde, si es de uno solo."
        >
          <Input
            inputMode="numeric"
            placeholder="#128"
            value={form.pedido}
            onChange={set('pedido')}
          />
        </Field>

        <Field label="Notas">
          <Textarea rows={2} value={form.notas} onChange={set('notas')} />
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

export default function Expenses() {
  const [mes, setMes] = useState(currentMonth)
  const [tipo, setTipo] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const query = useAsync(
    () => listExpenses({ ...monthRange(mes), tipo: tipo || undefined }),
    [mes, tipo],
  )

  const remove = async (expense) => {
    if (!confirm(`¿Borrar el gasto "${expense.descripcion}"?`)) return
    setError('')
    try {
      await deleteExpense(expense.id)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const totales = totalsByType(query.data ?? [])

  return (
    <>
      <PageHeader
        title="Costos"
        description={`Lo que salió en ${formatMonth(mes)}. Todo esto le resta a la ganancia del mes.`}
        actions={
          <>
            <input
              type="month"
              value={mes}
              onChange={(event) => setMes(event.target.value)}
              className="rounded-md border border-steel-200 bg-white px-3 py-2 text-sm text-steel-700"
            />
            <Button onClick={() => setEditing({})}>Nuevo gasto</Button>
          </>
        }
      />

      {/* Los dos del medio son la división que importa: no es cómo se ordenan
          los gastos, es quién los paga. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total del mes" value={<Money value={totales.total} />} tone="warn" />
        <Stat
          label="Los paga la empresa"
          value={<Money value={totales.operativos} />}
          hint="Producción, flete"
        />
        <Stat
          label="Los paga la reinversión"
          value={<Money value={totales.reinversion} />}
          hint="Pauta, muestras, suscripciones y otros"
          tone="warn"
        />
        <Stat
          label="Pauta"
          value={<Money value={totales.pauta} />}
          hint="La parte de la reinversión que más se mira"
        />
      </div>

      {totales.retirados > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          Hay <strong>{formatPesos(totales.retirados)}</strong> cargados como gasto
          de <em>producción</em> en este mes. Ese costo ahora sale del stock —de lo
          que costaba hacer cada varilla el día que se produjo—, así que estos ya
          no se cuentan en ningún total. Conviene borrarlos o pasarlos a otro tipo
          para que el mes no muestre plata que no se está sumando.
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Card
        title="Movimientos"
        actions={
          /* Un `<select>` pelado y no el `Select` de `ui.jsx`: aquel viene con
             `w-full`, y dos utilidades de ancho en la misma clase las resuelve
             el orden del CSS generado, no el del atributo. */
          <select
            value={tipo}
            onChange={(event) => setTipo(event.target.value)}
            className="rounded-md border border-steel-200 bg-white px-2 py-1 text-xs text-steel-700"
          >
            <option value="">Todos los tipos</option>
            {EXPENSE_TYPES.map((item) => (
              <option key={item} value={item}>
                {EXPENSE_TYPE_LABELS[item]}
              </option>
            ))}
          </select>
        }
      >
        <Async query={query} empty="No hay gastos cargados en este mes.">
          {(expenses) => (
            <Table
              head={
                <>
                  <Th>Fecha</Th>
                  <Th>Tipo</Th>
                  <Th>Concepto</Th>
                  <Th>Proveedor</Th>
                  <Th>Pedido</Th>
                  <Th align="right">Importe</Th>
                  <Th align="right"> </Th>
                </>
              }
            >
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-steel-50">
                  <Td className="whitespace-nowrap text-steel-500">
                    {formatDate(expense.fecha)}
                  </Td>
                  <Td>
                    <Badge tone={EXPENSE_TYPE_TONES[expense.tipo]}>
                      {EXPENSE_TYPE_LABELS[expense.tipo]}
                    </Badge>
                  </Td>
                  <Td className="font-medium text-steel-700">
                    {expense.descripcion}
                    {expense.notas && (
                      <span className="block text-xs font-normal text-steel-400">
                        {expense.notas}
                      </span>
                    )}
                  </Td>
                  <Td className="text-steel-500">{expense.proveedor}</Td>
                  <Td className="whitespace-nowrap text-steel-500">
                    {expense.pedido ? `#${expense.pedido.numero}` : ''}
                  </Td>
                  <Td align="right">
                    <Money value={expense.monto} className="font-semibold text-steel-800" />
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        className="px-2.5 py-1.5 text-xs"
                        onClick={() => setEditing(expense)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1.5 text-xs"
                        onClick={() => remove(expense)}
                      >
                        Borrar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>

      {editing && (
        <ExpenseModal
          expense={editing.id ? editing : null}
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
