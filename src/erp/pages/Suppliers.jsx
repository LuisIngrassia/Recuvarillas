/**
 * A quién se le compra lo que no se fabrica acá.
 *
 * Contesta lo que se pregunta el día que hay que reponer: a quién se le pide
 * cada cosa, a cuánto la cobró la última vez y cuándo fue. Lo primero sale de
 * la ficha de cada producto; lo demás, de las compras cargadas en Stock.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createSupplier,
  deleteSupplier,
  listPurchases,
  listSuppliers,
  updateSupplier,
} from '../api/suppliers'
import { listProducts, margen } from '../api/products'
import { useAsync } from '../lib/useAsync'
import { formatDate, formatNumber, formatPesos } from '../lib/format'
import {
  Async,
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  Modal,
  PageHeader,
  Table,
  Td,
  Textarea,
  Th,
} from '../components/ui'

const CAMPOS = ['nombre', 'contacto', 'telefono', 'email', 'cuit', 'localidad', 'notas']

function SupplierModal({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(CAMPOS.map((campo) => [campo, supplier?.[campo] ?? ''])),
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.nombre.trim()) {
      setError('Poné el nombre del proveedor.')
      return
    }

    setSaving(true)
    setError('')

    /* Vacío va como null, igual que en Vendedores: un teléfono en blanco no es
       un teléfono. */
    const values = Object.fromEntries(
      CAMPOS.map((campo) => [campo, form[campo].trim() || null]),
    )

    try {
      if (supplier) await updateSupplier(supplier.id, values)
      else await createSupplier(values)
      onSaved()
    } catch (err) {
      setError(
        err.message.includes('suppliers_nombre_key')
          ? 'Ya hay un proveedor con ese nombre.'
          : err.message,
      )
      setSaving(false)
    }
  }

  return (
    <Modal title={supplier ? `Editar ${supplier.nombre}` : 'Nuevo proveedor'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre" hint="La empresa o el comercio, como figura en la factura.">
          <Input value={form.nombre} onChange={set('nombre')} autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contacto" hint="Con quién se habla.">
            <Input value={form.contacto} onChange={set('contacto')} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={set('telefono')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="CUIT">
            <Input value={form.cuit} onChange={set('cuit')} />
          </Field>
        </div>

        <Field label="Localidad">
          <Input value={form.localidad} onChange={set('localidad')} />
        </Field>

        <Field label="Notas" hint="Plazos de entrega, mínimos de compra, cómo se le paga.">
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

/** Las compras cargadas en Stock, de todos o de uno. */
function Compras({ suppliers }) {
  const [supplierId, setSupplierId] = useState('')
  const query = useAsync(() => listPurchases({ supplierId }), [supplierId])
  const nombre = (id) => suppliers.find((item) => item.id === id)?.nombre

  return (
    <Card
      title="Últimas compras"
      actions={
        <select
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          className="rounded-md border border-grafito-200 bg-white px-2 py-1 text-sm text-grafito-700"
        >
          <option value="">Todos los proveedores</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.nombre}
            </option>
          ))}
        </select>
      }
    >
      <Async
        query={query}
        empty={
          <>
            No hay compras cargadas. Se cargan en{' '}
            <Link to="/erp/stock" className="underline underline-offset-2">
              Stock
            </Link>
            , como un movimiento de compra.
          </>
        }
      >
        {(rows) => (
          <Table
            head={
              <>
                <Th>Fecha</Th>
                <Th>Proveedor</Th>
                <Th>Producto</Th>
                <Th align="right">Cantidad</Th>
                <Th align="right">Costo c/u</Th>
                <Th align="right">Total</Th>
              </>
            }
          >
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-grafito-50">
                <Td className="whitespace-nowrap text-grafito-600">{formatDate(row.fecha)}</Td>
                <Td className="text-grafito-700">
                  {nombre(row.supplier_id) ?? <span className="text-grafito-400">Sin indicar</span>}
                </Td>
                <Td className="text-grafito-600">
                  {row.product?.nombre}
                  {row.nota && <span className="block text-xs text-grafito-400">{row.nota}</span>}
                </Td>
                <Td align="right" className="tabular-nums text-grafito-600">
                  {formatNumber(row.cantidad)}
                </Td>
                <Td align="right" className="tabular-nums text-grafito-600">
                  {row.costo_unitario === null ? '—' : formatPesos(Number(row.costo_unitario))}
                </Td>
                <Td align="right" className="tabular-nums font-medium text-grafito-700">
                  {row.costo_unitario === null
                    ? '—'
                    : formatPesos(row.cantidad * Number(row.costo_unitario))}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Async>
    </Card>
  )
}

export default function Suppliers() {
  const query = useAsync(listSuppliers, [])
  const products = useAsync(() => listProducts({ todos: true }), [])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const productosDe = (id) => (products.data ?? []).filter((item) => item.supplier_id === id)

  const guard = async (fn) => {
    setError('')
    try {
      await fn()
      query.reload()
      products.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = (supplier) => {
    const cuantos = productosDe(supplier.id).length
    const aviso = cuantos
      ? ` ${cuantos === 1 ? 'Su producto queda' : `Sus ${cuantos} productos quedan`} sin proveedor y sus compras siguen en Stock, sin nombre.`
      : ' Sus compras siguen en Stock, sin nombre.'
    if (!confirm(`¿Borrar a ${supplier.nombre}?${aviso}`)) return
    guard(() => deleteSupplier(supplier.id))
  }

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="A quién se le compra lo que no fabricamos, y a cuánto."
        actions={<Button onClick={() => setEditing({})}>Nuevo proveedor</Button>}
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Async query={query}>
        {(suppliers) => (
          <>
            <Card>
              {suppliers.length === 0 ? (
                <Empty>Todavía no hay proveedores cargados.</Empty>
              ) : (
                <Table
                  head={
                    <>
                      <Th>Proveedor</Th>
                      <Th>Contacto</Th>
                      <Th>Qué se le compra</Th>
                      <Th align="right"> </Th>
                    </>
                  }
                >
                  {suppliers.map((supplier) => {
                    const suyos = productosDe(supplier.id)

                    return (
                      <tr
                        key={supplier.id}
                        className={`align-top hover:bg-grafito-50 ${supplier.activo ? '' : 'opacity-60'}`}
                      >
                        <Td className="font-medium text-grafito-700">
                          {supplier.nombre}
                          {!supplier.activo && (
                            <span className="ml-2">
                              <Badge>inactivo</Badge>
                            </span>
                          )}
                          {supplier.cuit && (
                            <span className="block text-xs font-normal text-grafito-400">
                              CUIT {supplier.cuit}
                            </span>
                          )}
                          {supplier.notas && (
                            <span className="block text-xs font-normal italic text-grafito-400">
                              {supplier.notas}
                            </span>
                          )}
                        </Td>
                        <Td className="text-xs text-grafito-500">
                          {supplier.contacto && (
                            <span className="block text-grafito-600">{supplier.contacto}</span>
                          )}
                          {[supplier.telefono, supplier.email].filter(Boolean).join(' · ')}
                          {supplier.localidad && (
                            <span className="block text-grafito-400">{supplier.localidad}</span>
                          )}
                        </Td>
                        <Td className="text-xs">
                          {suyos.length === 0 ? (
                            <span className="text-grafito-300">—</span>
                          ) : (
                            suyos.map((product) => {
                              const m = margen(product.precio, product.costo)
                              return (
                                <span key={product.id} className="block text-grafito-600">
                                  {product.nombre}
                                  <span className="tabular-nums text-grafito-400">
                                    {product.costo != null &&
                                      ` · costo ${formatPesos(Number(product.costo))}`}
                                    {product.precio != null &&
                                      ` · venta ${formatPesos(Number(product.precio))}`}
                                    {m !== null && ` (${m.toFixed(0)}%)`}
                                  </span>
                                </span>
                              )
                            })
                          )}
                        </Td>
                        <Td align="right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              className="px-2.5 py-1.5 text-xs"
                              onClick={() => setEditing(supplier)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              className="px-2.5 py-1.5 text-xs"
                              onClick={() =>
                                guard(() =>
                                  updateSupplier(supplier.id, { activo: !supplier.activo }),
                                )
                              }
                            >
                              {supplier.activo ? 'Desactivar' : 'Activar'}
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2.5 py-1.5 text-xs"
                              onClick={() => remove(supplier)}
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

              <p className="border-t border-grafito-100 px-4 py-3 text-xs leading-relaxed text-grafito-400">
                Qué se le compra a cada uno se elige en la ficha del producto, en{' '}
                <Link to="/erp/productos" className="font-semibold underline underline-offset-2">
                  Productos
                </Link>
                . El costo se actualiza solo con cada compra que se carga en Stock.
              </p>
            </Card>

            <div className="mt-6">
              <Compras suppliers={suppliers} />
            </div>

            <p className="mt-4 text-xs leading-relaxed text-grafito-400">
              Las compras no entran en Rentabilidad: la factura del proveedor se
              carga como un gasto, y contarlas además acá sería pagarlas dos veces.
            </p>
          </>
        )}
      </Async>

      {editing && (
        <SupplierModal
          supplier={editing.id ? editing : null}
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
