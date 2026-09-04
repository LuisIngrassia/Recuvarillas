/**
 * Cuánto cuesta producir una varilla.
 *
 * Es la pantalla que reemplaza a cargar "producción" como un gasto suelto. Acá
 * se define una vez qué se gasta y en qué base, y después cada producción que
 * se carga al stock arrastra ese costo sola.
 *
 * La cuenta que hace todo el trabajo:
 *
 *     costo por varilla = (lo de unidad) + (lo de hora ÷ varillas por hora)
 *
 * Por eso las varillas por hora están arriba y no escondidas en un ajuste: es
 * el número que convierte la luz y los sueldos en costo por varilla, y si está
 * mal, todo el costeo está mal en la misma proporción.
 */
import { useState } from 'react'
import {
  COST_BASES,
  COST_BASE_LABELS,
  createProductionCost,
  deleteProductionCost,
  getCostoVarilla,
  getProductionSetup,
  listProductionCosts,
  setVarillasPorHora,
  updateProductionCost,
} from '../api/production'
import { useAsync } from '../lib/useAsync'
import { formatDateTime, formatNumber } from '../lib/format'
import {
  Async,
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Stat,
  Table,
  Td,
  Th,
} from '../components/ui'

/*
  Acá los importes se muestran con centavos, a diferencia del resto del ERP.
  El costo de una varilla se mide en pesos con decimales —la luz puede ser
  ochenta centavos por unidad— y redondear a peso entero haría desaparecer
  conceptos enteros del desglose.
*/
const pesosFinos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fino = (valor) => pesosFinos.format(Number(valor) || 0)

function CostModal({ cost, onClose, onSaved }) {
  const [nombre, setNombre] = useState(cost?.nombre ?? '')
  const [base, setBase] = useState(cost?.base ?? 'unidad')
  const [monto, setMonto] = useState(cost ? String(Number(cost.monto)) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const limpio = nombre.trim()
    const montoNum = monto === '' ? NaN : Number(monto)

    if (!limpio) {
      setError('Poné el nombre del concepto.')
      return
    }
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      setError('Poné cuánto se gasta.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const values = { nombre: limpio, base, monto: montoNum }
      if (cost) await updateProductionCost(cost.id, values)
      else await createProductionCost({ ...values, orden: 99 })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={cost ? 'Editar concepto' : 'Nuevo concepto'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Concepto">
          <Input value={nombre} onChange={(event) => setNombre(event.target.value)} autoFocus />
        </Field>

        <Field
          label="Base"
          hint={
            base === 'unidad'
              ? 'Se gasta por varilla, vayan las horas que vayan. La materia prima es el caso típico.'
              : 'Corre con el reloj y no depende de cuántas salgan: la luz, los sueldos, el galpón.'
          }
        >
          <Select value={base} onChange={(event) => setBase(event.target.value)}>
            {COST_BASES.map((valor) => (
              <option key={valor} value={valor}>
                {COST_BASE_LABELS[valor]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={base === 'unidad' ? 'Cuánto por varilla' : 'Cuánto por hora'}>
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={monto}
            onChange={(event) => setMonto(event.target.value)}
          />
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

export default function ProductionCost() {
  const query = useAsync(async () => {
    const [costos, setup, costo] = await Promise.all([
      listProductionCosts(),
      getProductionSetup(),
      getCostoVarilla(),
    ])
    return { costos, setup, costo }
  }, [])

  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [horaEditando, setHoraEditando] = useState(null)
  const [guardandoHora, setGuardandoHora] = useState(false)

  const remove = async (cost) => {
    if (!confirm(`¿Borrar "${cost.nombre}" del costeo?`)) return
    setError('')
    try {
      await deleteProductionCost(cost.id)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const guardarHora = async () => {
    const valor = Number(horaEditando)
    if (!Number.isFinite(valor) || valor < 0) {
      setError('Las varillas por hora tienen que ser un número.')
      return
    }

    setGuardandoHora(true)
    setError('')
    try {
      await setVarillasPorHora(valor)
      setHoraEditando(null)
      query.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoHora(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Costo de la varilla"
        description="Qué se gasta en producir una, y de dónde sale ese número."
        actions={<Button onClick={() => setEditing({})}>Nuevo concepto</Button>}
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Async query={query}>
        {({ costos, setup, costo }) => {
          const porHora = Number(setup.varillas_por_hora)
          /*
            Sin varillas por hora la parte horaria no se puede repartir. No es
            cero: es un dato que falta, y mostrar cero afirmaría que la luz no
            cuesta nada.
          */
          const faltaRitmo = porHora <= 0
          const unitario = Number(costo.costo_unitario)

          return (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Cuesta cada varilla"
                  value={faltaRitmo ? '—' : fino(unitario)}
                  hint={faltaRitmo ? 'Falta cargar las varillas por hora' : 'Sin IVA'}
                  tone={faltaRitmo ? 'warn' : 'neutral'}
                />
                <Stat
                  label="Materiales por varilla"
                  value={fino(costo.por_unidad)}
                  hint="Lo que se gasta por varilla, vayan las horas que vayan"
                />
                <Stat
                  label="Estructura por hora"
                  value={fino(costo.por_hora)}
                  hint={
                    faltaRitmo
                      ? 'Sin repartir: faltan las varillas por hora'
                      : `${fino(costo.por_hora_unitario)} por varilla a ${formatNumber(porHora)} por hora`
                  }
                />
              </div>

              <Card title="Cuántas varillas hace la máquina por hora">
                <div className="flex flex-wrap items-end gap-3 px-4 py-4">
                  <Field
                    label="Varillas por hora"
                    hint="Es lo que convierte la luz, los sueldos y el galpón en costo por varilla."
                  >
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="decimal"
                      value={horaEditando ?? String(porHora)}
                      onChange={(event) => setHoraEditando(event.target.value)}
                      className="w-40"
                    />
                  </Field>
                  {horaEditando !== null && Number(horaEditando) !== porHora && (
                    <Button onClick={guardarHora} disabled={guardandoHora} className="mb-0.5">
                      {guardandoHora ? 'Guardando…' : 'Guardar'}
                    </Button>
                  )}
                  {faltaRitmo && (
                    <p className="mb-2 text-xs text-amber-600">
                      Mientras esté en cero, el costo por varilla no se puede calcular.
                    </p>
                  )}
                </div>
              </Card>

              <Card title="Qué se gasta" className="mt-6">
                <Table
                  head={
                    <>
                      <Th>Concepto</Th>
                      <Th>Base</Th>
                      <Th align="right">Monto</Th>
                      <Th align="right">Por varilla</Th>
                      <Th>Actualizado</Th>
                      <Th align="right"> </Th>
                    </>
                  }
                >
                  {costos.map((cost) => {
                    const monto = Number(cost.monto)
                    const porVarilla =
                      cost.base === 'unidad' ? monto : faltaRitmo ? null : monto / porHora

                    return (
                      <tr key={cost.id} className="hover:bg-steel-50">
                        <Td className="font-medium text-steel-700">
                          {cost.nombre}
                          {!cost.activo && (
                            <span className="ml-2">
                              <Badge tone="neutral">inactivo</Badge>
                            </span>
                          )}
                        </Td>
                        <Td>
                          <Badge tone={cost.base === 'unidad' ? 'info' : 'warn'}>
                            {COST_BASE_LABELS[cost.base]}
                          </Badge>
                        </Td>
                        <Td align="right" className="tabular-nums text-steel-700">
                          {monto > 0 ? (
                            fino(monto)
                          ) : (
                            <span className="text-amber-600">sin cargar</span>
                          )}
                        </Td>
                        <Td align="right" className="tabular-nums font-semibold text-steel-800">
                          {porVarilla === null ? (
                            <span className="text-steel-300">—</span>
                          ) : (
                            fino(porVarilla)
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-xs text-steel-400">
                          {formatDateTime(cost.updated_at)}
                        </Td>
                        <Td align="right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              className="px-2.5 py-1.5 text-xs"
                              onClick={() => setEditing(cost)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2.5 py-1.5 text-xs"
                              onClick={() => remove(cost)}
                            >
                              Borrar
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    )
                  })}

                  <tr className="bg-steel-50">
                    <Td className="font-semibold text-steel-700">Cuesta cada varilla</Td>
                    <Td />
                    <Td />
                    <Td align="right" className="tabular-nums text-lg font-bold text-steel-900">
                      {faltaRitmo ? '—' : fino(unitario)}
                    </Td>
                    <Td />
                    <Td />
                  </tr>
                </Table>
              </Card>

              <p className="mt-4 text-xs leading-relaxed text-steel-400">
                Cada producción que cargues en Stock guarda este costo en el
                movimiento, y es el que le resta a la ganancia del mes en
                Rentabilidad. Se guarda el número del día y no se recalcula: si
                mañana sube la luz, lo que costó producir en marzo no cambia.
              </p>
            </>
          )
        }}
      </Async>

      {editing && (
        <CostModal
          cost={editing.id ? editing : null}
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
