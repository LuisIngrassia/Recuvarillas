/**
 * Los tipos de gasto y quién banca cada uno.
 *
 * Es la pantalla más chica del ERP y la que más plata mueve. Todo lo que se
 * carga en Costos termina descontándose de la parte de alguien, y acá se decide
 * de quién. Antes esa decisión estaba escrita en el código y en la base, en dos
 * listas que había que mantener sincronizadas a mano.
 *
 * Los tipos no se borran: se retiran. Un gasto ya cargado apunta a su tipo, y
 * borrarlo dejaría plata sin dueño en un mes ya liquidado.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PAGA,
  PAGA_HINTS,
  PAGA_LABELS,
  PAGA_TONES,
  createExpenseType,
  listExpenseTypes,
  setExpenseTypePayers,
  updateExpenseType,
} from '../api/expenses'
import { listShares } from '../api/profit'
import { useAsync } from '../lib/useAsync'
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
  Table,
  Td,
  Th,
} from '../components/ui'

/**
 * La clave estable de un tipo, a partir de su nombre.
 *
 * Se genera una vez, al crearlo, y después no se toca aunque se le cambie el
 * nombre: es lo que tienen guardado los gastos ya cargados. Renombrar «Pauta» a
 * «Publicidad» no puede reescribir el historial.
 */
function aClave(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

function TypeModal({ tipo, shares, tipos, onClose, onSaved }) {
  const socios = shares.filter((share) => share.activo && !share.es_reinversion)

  const [nombre, setNombre] = useState(tipo?.nombre ?? '')
  const [paga, setPaga] = useState(tipo?.paga ?? 'socios')
  const [pagadores, setPagadores] = useState(() => new Set(tipo?.pagadores ?? []))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const alternar = (id) =>
    setPagadores((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })

  const handleSubmit = async (event) => {
    event.preventDefault()

    const limpio = nombre.trim()
    if (!limpio) {
      setError('Poné el nombre del tipo.')
      return
    }

    const clave = tipo?.clave ?? aClave(limpio)
    if (!clave) {
      setError('El nombre tiene que tener al menos una letra o un número.')
      return
    }
    if (!tipo && tipos.some((otro) => otro.clave === clave)) {
      setError(`Ya hay un tipo que se guarda como «${clave}». Ponele otro nombre.`)
      return
    }

    /* Un tipo que no sea proporcional y no tenga a nadie asignado es un gasto
       que va a salir de la caja sin descontársele a nadie. Se puede guardar
       igual —a veces todavía no se decidió quién lo banca— pero avisando. */
    if (
      paga !== 'proporcional' &&
      pagadores.size === 0 &&
      !confirm(
        'Este tipo no tiene ningún socio asignado. Los gastos que se carguen con él van a aparecer como gasto sin dueño en Rentabilidad. ¿Guardar igual?',
      )
    ) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const guardado = tipo
        ? await updateExpenseType(tipo.id, { nombre: limpio, paga })
        : await createExpenseType({ clave, nombre: limpio, paga })

      await setExpenseTypePayers(
        guardado.id,
        paga === 'proporcional' ? [] : [...pagadores],
      )
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={tipo ? `Editar ${tipo.nombre}` : 'Nuevo tipo de gasto'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Nombre"
          hint={
            tipo
              ? `Se guarda como «${tipo.clave}», y eso no cambia: es lo que tienen los gastos ya cargados.`
              : nombre.trim()
                ? `Se va a guardar como «${aClave(nombre)}».`
                : 'Como aparece en la lista de Costos.'
          }
        >
          <Input value={nombre} onChange={(event) => setNombre(event.target.value)} autoFocus />
        </Field>

        <Field label="Quién lo paga" hint={PAGA_HINTS[paga]}>
          <Select value={paga} onChange={(event) => setPaga(event.target.value)}>
            {PAGA.map((regla) => (
              <option key={regla} value={regla}>
                {PAGA_LABELS[regla]}
              </option>
            ))}
          </Select>
        </Field>

        {paga !== 'proporcional' && (
          <Field
            label={paga === 'pozo' ? 'Y si el pozo no alcanza, lo ponen' : 'Lo bancan'}
            hint="En mitades iguales entre los marcados, sin mirar sus porcentajes del reparto."
          >
            <div className="space-y-1.5 rounded-md border border-steel-200 px-3 py-2">
              {socios.length === 0 && (
                <p className="text-xs text-steel-400">
                  No hay socios cargados en el reparto.
                </p>
              )}
              {socios.map((socio) => (
                <label
                  key={socio.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-steel-700"
                >
                  <input
                    type="checkbox"
                    checked={pagadores.has(socio.id)}
                    onChange={() => alternar(socio.id)}
                    className="h-4 w-4 rounded border-steel-300"
                  />
                  {socio.nombre}
                  <span className="text-xs text-steel-400">
                    {Number(socio.porcentaje)}% del reparto
                  </span>
                </label>
              ))}
              {pagadores.size > 0 && (
                <p className="border-t border-steel-100 pt-1.5 text-xs text-steel-400">
                  Le toca {(100 / pagadores.size).toFixed(pagadores.size === 3 ? 1 : 0)}% a
                  cada uno.
                </p>
              )}
            </div>
          </Field>
        )}

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

export default function ExpenseTypes() {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const query = useAsync(async () => {
    const [tipos, shares] = await Promise.all([listExpenseTypes(), listShares()])
    return { tipos, shares }
  }, [])

  const alternarActivo = async (tipo) => {
    setError('')
    try {
      await updateExpenseType(tipo.id, { activo: !tipo.activo })
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Tipos de gasto"
        description="Qué gastos existen y de la parte de quién sale cada uno."
        actions={<Button onClick={() => setEditing({})}>Nuevo tipo</Button>}
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Async query={query}>
        {({ tipos, shares }) => {
          const nombreDe = (id) =>
            shares.find((share) => share.id === id)?.nombre ?? '—'

          return (
            <>
              <Card title="Los tipos">
                <Table
                  head={
                    <>
                      <Th>Tipo</Th>
                      <Th>Regla</Th>
                      <Th>Quiénes lo bancan</Th>
                      <Th align="right"> </Th>
                    </>
                  }
                >
                  {tipos.map((tipo) => {
                    const huerfano =
                      tipo.paga !== 'proporcional' &&
                      !tipo.interno &&
                      tipo.pagadores.length === 0

                    return (
                      <tr
                        key={tipo.id}
                        className={`hover:bg-steel-50 ${tipo.activo ? '' : 'opacity-60'}`}
                      >
                        <Td className="font-medium text-steel-700">
                          {tipo.nombre}
                          <span className="ml-2">
                            {!tipo.activo && <Badge>retirado</Badge>}
                            {tipo.interno && <Badge tone="info">lo calcula el sistema</Badge>}
                          </span>
                          <span className="block text-xs font-normal text-steel-400">
                            {tipo.clave}
                          </span>
                        </Td>
                        <Td>
                          <Badge tone={PAGA_TONES[tipo.paga]}>{PAGA_LABELS[tipo.paga]}</Badge>
                        </Td>
                        <Td className="text-sm text-steel-600">
                          {tipo.paga === 'proporcional' ? (
                            <span className="text-steel-400">
                              Todas las partes, en proporción
                            </span>
                          ) : huerfano ? (
                            <span className="font-semibold text-red-600">
                              Nadie — esos gastos quedan sin dueño
                            </span>
                          ) : (
                            <>
                              {tipo.pagadores.map(nombreDe).join(' y ')}
                              <span className="block text-xs text-steel-400">
                                {(100 / tipo.pagadores.length).toFixed(
                                  tipo.pagadores.length === 3 ? 1 : 0,
                                )}
                                % cada uno
                              </span>
                            </>
                          )}
                        </Td>
                        <Td align="right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              onClick={() => setEditing(tipo)}
                            >
                              Editar
                            </Button>
                            {/* Retirar y no borrar: los gastos ya cargados
                                apuntan acá. Los internos no se retiran porque
                                nunca se ofrecieron. */}
                            {!tipo.interno && (
                              <Button
                                variant="ghost"
                                className="px-2 py-1 text-xs"
                                onClick={() => alternarActivo(tipo)}
                              >
                                {tipo.activo ? 'Retirar' : 'Reactivar'}
                              </Button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </Table>

                <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                  Un tipo no se borra, se retira: deja de ofrecerse al cargar un
                  gasto pero los que ya estaban se siguen contando y pagando
                  igual. Borrarlo dejaría plata sin dueño en un mes ya liquidado.
                </p>
              </Card>

              <Card title="Las tres reglas" className="mt-6">
                <dl className="divide-y divide-steel-100">
                  {PAGA.map((regla) => (
                    <div key={regla} className="px-4 py-3">
                      <dt className="text-sm font-semibold text-steel-700">
                        {PAGA_LABELS[regla]}
                      </dt>
                      <dd className="mt-1 text-xs leading-relaxed text-steel-500">
                        {PAGA_HINTS[regla]}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                  La comisión del vendedor no es un tipo de gasto pero sigue la
                  primera regla: se descuenta antes de repartir. El flete es el
                  único que además tiene ingreso propio, así que va neto —lo
                  facturado menos lo que costó— a quienes lo bancan. Todo esto se
                  ve mes a mes en{' '}
                  <Link
                    to="/erp/rentabilidad"
                    className="font-semibold underline underline-offset-2"
                  >
                    Rentabilidad
                  </Link>
                  .
                </p>
              </Card>

              {editing && (
                <TypeModal
                  tipo={editing.id ? editing : null}
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
