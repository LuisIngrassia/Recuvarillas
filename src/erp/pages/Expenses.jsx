/**
 * Los gastos de la empresa, y de la parte de quién sale cada uno.
 *
 * Se mira de a un mes porque es el período en que se cierra el resultado y se
 * reparte. Lo que se carga acá es exactamente lo que le resta a alguien en la
 * pantalla de Rentabilidad: no hay un segundo lugar donde anotar gastos.
 *
 * Cada fila dice quién lo paga. Antes no lo decía, y era lo más importante: un
 * gasto mal tipeado no desordena un informe, le mueve plata a un socio.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PAGA_TONES,
  createExpense,
  deleteExpense,
  esCargable,
  listExpenseTypes,
  listExpenses,
  quienPaga,
  totalsByType,
  updateExpense,
} from '../api/expenses'
import { listShares } from '../api/profit'
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
  tipo: '',
  descripcion: '',
  monto: '',
  proveedor: '',
  pedido: '',
  notas: '',
}

function ExpenseModal({ expense, tipos, shares, onClose, onSaved }) {
  const cargables = tipos.filter(esCargable)

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
      : { ...EMPTY, fecha: todayISO(), tipo: cargables[0]?.clave ?? '' },
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const elegido = tipos.find((tipo) => tipo.clave === form.tipo)
  const paga = quienPaga(elegido, shares)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const descripcion = form.descripcion.trim()
    if (!descripcion) {
      setError('Poné qué se pagó.')
      return
    }

    if (!form.tipo) {
      setError('Elegí un tipo: es lo que define quién lo paga.')
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
          <Field label="Tipo">
            <Select value={form.tipo} onChange={set('tipo')}>
              {cargables.map((tipo) => (
                <option key={tipo.clave} value={tipo.clave}>
                  {tipo.nombre}
                </option>
              ))}
              {/* Un gasto viejo de un tipo retirado se tiene que poder abrir y
                  guardar sin que el tipo se le cambie solo al abrir el
                  diálogo. */}
              {elegido && !esCargable(elegido) && (
                <option value={elegido.clave}>{elegido.nombre} (retirado)</option>
              )}
            </Select>
          </Field>
        </div>

        {/* Lo que el tipo decide de verdad. Se muestra acá y no en una ayuda al
            pie porque es la consecuencia de lo que se acaba de elegir. */}
        <div
          className={`rounded-md px-3 py-2 text-xs leading-relaxed ${
            paga.alerta
              ? 'border border-amber-200 bg-amber-50 text-amber-800'
              : 'bg-steel-50 text-steel-600'
          }`}
        >
          <span className="text-steel-400">Lo paga: </span>
          <strong>{paga.texto}</strong>
          {paga.alerta && (
            <>
              {' · '}
              <Link
                to="/erp/tipos-de-gasto"
                className="font-semibold underline underline-offset-2"
              >
                asignarle quién lo banca
              </Link>
            </>
          )}
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

  /* Los tipos y las partes no dependen del mes, pero la pantalla no sirve sin
     ellos: un gasto sin su tipo no puede decir quién lo paga. Van juntos para
     que no haya un instante en que las filas estén pintadas y los pagadores
     todavía no. */
  const base = useAsync(async () => {
    const [tipos, shares] = await Promise.all([listExpenseTypes(), listShares()])
    return { tipos, shares }
  }, [])

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

  return (
    <>
      <PageHeader
        title="Costos"
        description={`Lo que salió en ${formatMonth(mes)}, y de la parte de quién sale.`}
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

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Async query={base}>
        {({ tipos, shares }) => {
          const porClave = new Map(tipos.map((item) => [item.clave, item]))
          const totales = totalsByType(query.data ?? [], tipos)

          /* Los gastos cargados con un tipo ya retirado: se siguen pagando,
             pero conviene reclasificarlos mientras alguien se acuerde de qué
             eran. */
          const retirados = (query.data ?? []).filter((gasto) => {
            const suyo = porClave.get(gasto.tipo)
            return suyo && !suyo.activo && !suyo.interno
          })
          const montoRetirados = retirados.reduce(
            (sum, gasto) => sum + Number(gasto.monto),
            0,
          )

          return (
            <>
              {/* La división que importa no es por rubro sino por bolsillo. */}
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Total del mes"
                  value={<Money value={totales.total} />}
                  tone="warn"
                  hint={
                    totales.proporcional > 0
                      ? `${formatPesos(totales.proporcional)} salen de arriba, en proporción`
                      : undefined
                  }
                />
                {/* Primero el pasamanos: es plata que pasa por la caja y no es
                    de nadie de adentro, así que confundirla con un costo
                    propio es el error más caro de leer este cuadro. */}
                <Stat
                  label="Los paga el cliente"
                  value={<Money value={totales.cliente} />}
                  hint="Pasamanos: se cobran y se pagan"
                />
                <Stat
                  label="Los bancan socios"
                  value={<Money value={totales.socios} />}
                  hint="En mitades entre quienes los pagan"
                />
                <Stat
                  label="Los paga el pozo"
                  value={<Money value={totales.pozo} />}
                  hint="Y lo que no cubra, sus socios"
                  tone="warn"
                />
              </div>

              {totales.sinPagador > 0 && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
                  Hay <strong>{formatPesos(totales.sinPagador)}</strong> en gastos
                  cuyo tipo no tiene ningún socio asignado. Esa plata salió de la
                  caja y no se le está descontando a nadie, así que en
                  Rentabilidad aparece como gasto sin dueño en vez de repartirse
                  sola.{' '}
                  <Link
                    to="/erp/tipos-de-gasto"
                    className="font-semibold underline underline-offset-2"
                  >
                    Asignar quién los paga
                  </Link>
                </div>
              )}

              {totales.internos > 0 && (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
                  Hay <strong>{formatPesos(totales.internos)}</strong> cargados a
                  mano con un tipo que el sistema calcula solo —la producción sale
                  del stock, de lo que costaba hacer cada varilla el día que se
                  produjo—. Estos no se cuentan en ningún total. Conviene
                  borrarlos o pasarlos a otro tipo para que el mes no muestre
                  plata que no se está sumando.
                </div>
              )}

              {montoRetirados > 0 && (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
                  Hay <strong>{formatPesos(montoRetirados)}</strong> en{' '}
                  {retirados.length === 1 ? 'un gasto' : `${retirados.length} gastos`} de
                  un tipo retirado. Se siguen contando y pagando igual, pero
                  conviene pasarlos a un tipo vigente mientras alguien se acuerde
                  de qué eran.
                </div>
              )}

              <Card
                title="Movimientos"
                actions={
                  <div className="flex items-center gap-2">
                    <Link
                      to="/erp/tipos-de-gasto"
                      className="whitespace-nowrap text-xs text-steel-400 underline-offset-2 hover:text-steel-600 hover:underline"
                    >
                      Tipos de gasto
                    </Link>
                    {/* Un `<select>` pelado y no el `Select` de `ui.jsx`: aquel
                        viene con `w-full`, y dos utilidades de ancho en la misma
                        clase las resuelve el orden del CSS generado, no el del
                        atributo. */}
                    <select
                      value={tipo}
                      onChange={(event) => setTipo(event.target.value)}
                      className="rounded-md border border-steel-200 bg-white px-2 py-1 text-xs text-steel-700"
                    >
                      <option value="">Todos los tipos</option>
                      {tipos.map((item) => (
                        <option key={item.clave} value={item.clave}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
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
                          <Th>Lo paga</Th>
                          <Th>Pedido</Th>
                          <Th align="right">Importe</Th>
                          <Th align="right"> </Th>
                        </>
                      }
                    >
                      {expenses.map((expense) => {
                        const suyo = porClave.get(expense.tipo)
                        const paga = quienPaga(suyo, shares)

                        return (
                          <tr key={expense.id} className="hover:bg-steel-50">
                            <Td className="whitespace-nowrap text-steel-500">
                              {formatDate(expense.fecha)}
                            </Td>
                            <Td>
                              <Badge tone={PAGA_TONES[suyo?.paga] ?? 'neutral'}>
                                {suyo?.nombre ?? expense.tipo}
                              </Badge>
                            </Td>
                            <Td className="font-medium text-steel-700">
                              {expense.descripcion}
                              {expense.proveedor && (
                                <span className="block text-xs font-normal text-steel-400">
                                  {expense.proveedor}
                                </span>
                              )}
                              {expense.notas && (
                                <span className="block text-xs font-normal text-steel-400">
                                  {expense.notas}
                                </span>
                              )}
                            </Td>
                            {/* La columna que antes no estaba y es la que
                                contesta la pregunta de fin de mes. */}
                            <Td
                              className={
                                paga.alerta
                                  ? 'text-xs font-semibold text-red-600'
                                  : 'text-xs text-steel-600'
                              }
                            >
                              {paga.texto}
                            </Td>
                            <Td className="whitespace-nowrap text-steel-500">
                              {expense.pedido ? `#${expense.pedido.numero}` : ''}
                            </Td>
                            <Td align="right">
                              <Money
                                value={expense.monto}
                                className="font-semibold text-steel-800"
                              />
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
                        )
                      })}
                    </Table>
                  )}
                </Async>

                <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                  Quién paga cada tipo se configura en{' '}
                  <Link
                    to="/erp/tipos-de-gasto"
                    className="font-semibold underline underline-offset-2"
                  >
                    Tipos de gasto
                  </Link>
                  . El costo de producción no se carga acá: sale del stock, de lo
                  que costaba hacer cada varilla el día que se produjo.
                </p>
              </Card>

              {editing && (
                <ExpenseModal
                  expense={editing.id ? editing : null}
                  tipos={tipos}
                  shares={shares}
                  onClose={() => setEditing(null)}
                  onSaved={() => {
                    setEditing(null)
                    query.reload()
                  }}
                />
              )}
            </>
          )
        }}
      </Async>
    </>
  )
}
