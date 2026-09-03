/**
 * Vendedores y lo que hay que liquidarles.
 *
 * El porcentaje que se guarda acá es el habitual de esa persona: el que se
 * propone al cargar un pedido. Lo que se paga sale de cada venta, que guarda el
 * suyo, porque un pedido grande se negocia distinto y lo acordado entonces no
 * tiene por qué cambiar cuando cambie el porcentaje de la ficha.
 */
import { useState } from 'react'
import {
  createSeller,
  deleteSeller,
  groupCommissions,
  listCommissions,
  listSellers,
  updateSeller,
} from '../api/sellers'
import { useAsync } from '../lib/useAsync'
import { currentMonth, formatDate, formatMonth, monthRange } from '../lib/format'
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
  Table,
  Td,
  Textarea,
  Th,
} from '../components/ui'

const EMPTY = {
  nombre: '',
  telefono: '',
  email: '',
  localidad: '',
  comision_pct: '5',
  notas: '',
}

function SellerModal({ seller, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    seller
      ? {
          nombre: seller.nombre,
          telefono: seller.telefono ?? '',
          email: seller.email ?? '',
          localidad: seller.localidad ?? '',
          comision_pct: String(Number(seller.comision_pct)),
          notas: seller.notas ?? '',
        }
      : EMPTY,
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nombre = form.nombre.trim()
    if (!nombre) {
      setError('Poné el nombre del vendedor.')
      return
    }

    const pct = Number(form.comision_pct)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError('La comisión tiene que ser un porcentaje entre 0 y 100.')
      return
    }

    setSaving(true)
    setError('')

    /* Los campos vacíos van como null y no como '': un teléfono en blanco no es
       un teléfono, y guardarlo como texto vacío obliga a chequear las dos cosas
       en cada lugar donde se lee. */
    const values = {
      nombre,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      localidad: form.localidad.trim() || null,
      comision_pct: pct,
      notas: form.notas.trim() || null,
    }

    try {
      if (seller) await updateSeller(seller.id, values)
      else await createSeller(values)
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={seller ? 'Editar vendedor' : 'Nuevo vendedor'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre">
          <Input value={form.nombre} onChange={set('nombre')} autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={set('telefono')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
        </div>

        <Field
          label="Localidad"
          hint="Sale impresa en su folleto y en su lista de precios, junto al teléfono."
        >
          <Input
            value={form.localidad}
            onChange={set('localidad')}
            placeholder="Luján, Buenos Aires"
          />
        </Field>

        <Field
          label="Comisión habitual (%)"
          hint="Es el porcentaje que se propone al cargar un pedido. Cada venta guarda el suyo."
        >
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            inputMode="decimal"
            value={form.comision_pct}
            onChange={set('comision_pct')}
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

/** Lo devengado en el mes, por vendedor y después pedido por pedido. */
function Liquidacion() {
  const [mes, setMes] = useState(currentMonth)
  const query = useAsync(() => listCommissions(monthRange(mes)), [mes])

  return (
    <Card
      title={`Comisiones de ${formatMonth(mes)}`}
      actions={
        <input
          type="month"
          value={mes}
          onChange={(event) => setMes(event.target.value)}
          className="rounded-md border border-steel-200 bg-white px-2 py-1 text-sm text-steel-700"
        />
      }
    >
      <Async query={query} empty="Ningún pedido del mes tiene vendedor cargado.">
        {(rows) => {
          const porVendedor = groupCommissions(rows)
          const total = porVendedor.reduce((sum, item) => sum + item.comision, 0)

          return (
            <>
              <Table
                head={
                  <>
                    <Th>Vendedor</Th>
                    <Th align="right">Pedidos</Th>
                    <Th align="right">Mercadería</Th>
                    <Th align="right">Comisión</Th>
                  </>
                }
              >
                {porVendedor.map((item) => (
                  <tr key={item.seller_id} className="hover:bg-steel-50">
                    <Td className="font-medium text-steel-700">{item.vendedor}</Td>
                    <Td align="right" className="tabular-nums text-steel-500">
                      {item.pedidos}
                    </Td>
                    <Td align="right">
                      <Money value={item.mercaderia} className="text-steel-500" />
                    </Td>
                    <Td align="right">
                      <Money value={item.comision} className="font-semibold text-steel-800" />
                    </Td>
                  </tr>
                ))}
                <tr className="bg-steel-50">
                  <Td className="font-semibold text-steel-700" />
                  <Td />
                  <Td align="right" className="text-xs font-semibold uppercase text-steel-400">
                    Total
                  </Td>
                  <Td align="right">
                    <Money value={total} className="font-bold text-steel-900" />
                  </Td>
                </tr>
              </Table>

              <details className="border-t border-steel-100">
                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-steel-500 hover:bg-steel-50">
                  Ver los {rows.length} pedidos que la componen
                </summary>
                <Table
                  head={
                    <>
                      <Th>Pedido</Th>
                      <Th>Fecha</Th>
                      <Th>Cliente</Th>
                      <Th>Vendedor</Th>
                      <Th align="right">Mercadería</Th>
                      <Th align="right">Cobrado</Th>
                      <Th align="right">%</Th>
                      <Th align="right">Comisión</Th>
                    </>
                  }
                >
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-steel-50">
                      <Td className="whitespace-nowrap font-medium text-steel-700">
                        #{row.numero}
                      </Td>
                      <Td className="whitespace-nowrap text-steel-500">
                        {formatDate(row.fecha)}
                      </Td>
                      <Td className="text-steel-600">{row.cliente_nombre}</Td>
                      <Td className="text-steel-500">{row.vendedor}</Td>
                      <Td align="right">
                        <Money value={row.mercaderia} className="text-steel-500" />
                      </Td>
                      <Td align="right">
                        <Money value={row.pagado} className="text-steel-500" />
                      </Td>
                      <Td align="right" className="tabular-nums text-steel-500">
                        {Number(row.comision_pct ?? 0)}%
                      </Td>
                      <Td align="right">
                        <Money value={row.comision} className="font-semibold text-steel-800" />
                      </Td>
                    </tr>
                  ))}
                </Table>
              </details>
            </>
          )
        }}
      </Async>
    </Card>
  )
}

export default function Sellers() {
  const query = useAsync(listSellers, [])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const remove = async (seller) => {
    if (!confirm(`¿Borrar a ${seller.nombre}? Los pedidos que trajo quedan sin vendedor.`)) return
    setError('')
    try {
      await deleteSeller(seller.id)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const toggle = async (seller) => {
    setError('')
    try {
      await updateSeller(seller.id, { activo: !seller.activo })
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Vendedores"
        description="Quién trae la venta y qué comisión se lleva."
        actions={<Button onClick={() => setEditing({})}>Nuevo vendedor</Button>}
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Card>
        <Async query={query} empty="Todavía no hay vendedores cargados.">
          {(sellers) => (
            <Table
              head={
                <>
                  <Th>Nombre</Th>
                  <Th>Contacto</Th>
                  <Th align="right">Comisión habitual</Th>
                  <Th>Estado</Th>
                  <Th align="right"> </Th>
                </>
              }
            >
              {sellers.map((seller) => (
                <tr key={seller.id} className="hover:bg-steel-50">
                  <Td className="font-medium text-steel-700">
                    {seller.nombre}
                    {seller.notas && (
                      <span className="block text-xs font-normal text-steel-400">
                        {seller.notas}
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-steel-500">
                    {[seller.telefono, seller.email].filter(Boolean).join(' · ')}
                    {seller.localidad && (
                      <span className="block text-steel-400">{seller.localidad}</span>
                    )}
                  </Td>
                  <Td align="right" className="tabular-nums text-steel-700">
                    {Number(seller.comision_pct)}%
                  </Td>
                  <Td>
                    <Badge tone={seller.activo ? 'good' : 'neutral'}>
                      {seller.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        className="px-2.5 py-1.5 text-xs"
                        onClick={() => toggle(seller)}
                      >
                        {seller.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2.5 py-1.5 text-xs"
                        onClick={() => setEditing(seller)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1.5 text-xs"
                        onClick={() => remove(seller)}
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

      <div className="mt-6">
        <Liquidacion />
      </div>

      <p className="mt-4 text-xs text-steel-400">
        La comisión se devenga a medida que el cliente paga, no cuando se
        entrega, y se calcula sobre la mercadería sola: el flete es plata que
        pasa hacia el transporte. Un pedido anulado no devenga nada.
      </p>

      {editing && (
        <SellerModal
          seller={editing.id ? editing : null}
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
