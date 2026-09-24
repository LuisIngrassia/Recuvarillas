/**
 * Qué se vende.
 *
 * Hasta acá había un solo producto, sembrado por el schema y sin pantalla: la
 * varilla. Todo el sistema daba por sentado lo que era cierto de ella —se
 * produce acá, se agujerea, lleva stock, se cotiza por escalones de cantidad— y
 * con dos productos eso deja de ser cierto de a uno.
 *
 * Así que cada cosa que se daba por sentada es una marca de esta ficha, y cada
 * marca enciende o apaga algo concreto en otra pantalla. Están explicadas al
 * lado de cada una, porque tocar la equivocada no rompe nada visible: hace que
 * un presupuesto diga algo raro, o que un faltante no avise.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UNIDADES,
  createProduct,
  deleteProduct,
  listProducts,
  setProductoWeb,
  updateProduct,
} from '../api/products'
import { useAsync } from '../lib/useAsync'
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
  Select,
  Table,
  Td,
  Textarea,
  Th,
} from '../components/ui'

/* Qué hace cada marca, en el lugar donde se la elige. */
const MARCAS = [
  {
    campo: 'se_produce',
    label: 'Se fabrica acá',
    hint: 'Habilita los movimientos de producción en Stock. Lo que se compra hecho va sin esto.',
  },
  {
    campo: 'se_agujerea',
    label: 'Se agujerea',
    hint: 'La línea del pedido pide acabado y el presupuesto lo aclara. Sin esto, un presupuesto diría «Bolsa de grampas sin agujerear».',
  },
  {
    campo: 'lleva_stock',
    label: 'Lleva stock',
    hint: 'Aparece en Stock y avisa faltantes. Lo que se compra por pedido puede ir sin control de existencias.',
  },
]

/** El código con el que se lo guarda: corto, en mayúsculas y sin espacios. */
function aCodigo(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 12)
}

function ProductModal({ product, productos, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    codigo: product?.codigo ?? '',
    nombre: product?.nombre ?? '',
    unidad: product?.unidad ?? 'unidad',
    se_produce: product?.se_produce ?? true,
    se_agujerea: product?.se_agujerea ?? true,
    lleva_stock: product?.lleva_stock ?? true,
    notas: product?.notas ?? '',
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (campo) => (event) =>
    setForm((prev) => ({
      ...prev,
      [campo]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nombre = form.nombre.trim()
    if (!nombre) {
      setError('Poné el nombre del producto, como va en el presupuesto.')
      return
    }

    const codigo = aCodigo(form.codigo || nombre)
    if (!codigo) {
      setError('El código tiene que tener al menos una letra o un número.')
      return
    }
    if (productos.some((otro) => otro.codigo === codigo && otro.id !== product?.id)) {
      setError(`Ya hay un producto con el código «${codigo}».`)
      return
    }

    setSaving(true)
    setError('')

    try {
      const values = {
        codigo,
        nombre,
        unidad: form.unidad,
        se_produce: form.se_produce,
        se_agujerea: form.se_agujerea,
        lleva_stock: form.lleva_stock,
        notas: form.notas.trim() || null,
      }

      if (product) await updateProduct(product.id, values)
      else await createProduct(values)
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={product ? `Editar ${product.nombre}` : 'Nuevo producto'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Nombre"
          hint="Como va en el presupuesto que ve el cliente: «Varilla 2x2x120», «Bolsa de grampas x100»."
        >
          <Input value={form.nombre} onChange={set('nombre')} autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Código"
            hint={
              form.codigo || form.nombre
                ? `Se guarda como «${aCodigo(form.codigo || form.nombre)}».`
                : 'Corto y sin espacios. Si lo dejás vacío sale del nombre.'
            }
          >
            <Input value={form.codigo} onChange={set('codigo')} placeholder="VAR2" />
          </Field>
          <Field label="Unidad" hint="Cómo se cuenta al venderlo.">
            <Select value={form.unidad} onChange={set('unidad')}>
              {UNIDADES.map((unidad) => (
                <option key={unidad} value={unidad}>
                  {unidad}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="space-y-2 rounded-md border border-steel-200 px-3 py-3">
          <p className="text-xs font-semibold text-steel-600">Qué es este producto</p>
          {MARCAS.map(({ campo, label, hint }) => (
            <label key={campo} className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={form[campo]}
                onChange={set(campo)}
                className="mt-0.5 h-4 w-4 rounded border-steel-300"
              />
              <span>
                <span className="block text-sm text-steel-700">{label}</span>
                <span className="block text-xs leading-relaxed text-steel-400">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        <Field label="Notas">
          <Textarea rows={2} value={form.notas} onChange={set('notas')} />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <p className="rounded-md bg-steel-50 px-3 py-2 text-xs leading-relaxed text-steel-500">
          {product
            ? 'Los precios se cargan en Ajustes › Precios, eligiendo este producto.'
            : 'Después de guardarlo hay que cargarle la lista de precios en Ajustes › Precios: hasta entonces se puede vender, pero el precio se escribe a mano en cada pedido.'}
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

export default function Products() {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const query = useAsync(() => listProducts({ todos: true }), [])

  const guard = async (fn) => {
    setError('')
    try {
      await fn()
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const borrar = (product) => {
    if (!confirm(`¿Borrar ${product.nombre}?`)) return
    guard(() => deleteProduct(product.id))
  }

  return (
    <>
      <PageHeader
        title="Productos"
        description="Qué se vende, y qué da por sentado el sistema sobre cada cosa."
        actions={<Button onClick={() => setEditing({})}>Nuevo producto</Button>}
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Async query={query}>
        {(productos) => (
          <>
            <Card title="Los productos">
              {productos.length === 0 ? (
                <Empty>Todavía no hay ningún producto cargado.</Empty>
              ) : (
                <Table
                  head={
                    <>
                      <Th>Producto</Th>
                      <Th>Qué es</Th>
                      <Th>En la web</Th>
                      <Th align="right"> </Th>
                    </>
                  }
                >
                  {productos.map((product) => (
                    <tr
                      key={product.id}
                      className={`hover:bg-steel-50 ${product.activo ? '' : 'opacity-60'}`}
                    >
                      <Td className="font-medium text-steel-700">
                        {product.nombre}
                        {!product.activo && (
                          <span className="ml-2">
                            <Badge>retirado</Badge>
                          </span>
                        )}
                        <span className="block text-xs font-normal text-steel-400">
                          {product.codigo} · por {product.unidad}
                        </span>
                        {product.notas && (
                          <span className="block text-xs font-normal italic text-steel-400">
                            {product.notas}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          {product.se_produce && <Badge tone="good">se fabrica</Badge>}
                          {product.se_agujerea && <Badge tone="info">se agujerea</Badge>}
                          {product.lleva_stock ? (
                            <Badge tone="neutral">lleva stock</Badge>
                          ) : (
                            <Badge tone="warn">sin stock</Badge>
                          )}
                        </span>
                      </Td>
                      <Td>
                        {/* Uno solo puede estar en la web: el simulador cotiza
                            una cosa y pide una cantidad. Marcar otro se lo
                            saca al anterior, y por eso es un botón y no una
                            casilla suelta. */}
                        {product.en_web ? (
                          <Badge tone="good">la cotiza el simulador</Badge>
                        ) : product.activo ? (
                          <button
                            type="button"
                            onClick={() => guard(() => setProductoWeb(product.id))}
                            className="text-xs text-steel-400 underline-offset-2 hover:text-secondary-600 hover:underline"
                          >
                            poner en la web
                          </button>
                        ) : (
                          <span className="text-xs text-steel-300">—</span>
                        )}
                      </Td>
                      <Td align="right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            onClick={() => setEditing(product)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            onClick={() =>
                              guard(() =>
                                updateProduct(product.id, { activo: !product.activo }),
                              )
                            }
                          >
                            {product.activo ? 'Retirar' : 'Reactivar'}
                          </Button>
                          <Button
                            variant="danger"
                            className="px-2 py-1 text-xs"
                            onClick={() => borrar(product)}
                          >
                            Borrar
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}

              <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                Un producto que se vendió alguna vez <strong>no se puede borrar</strong>:
                el historial de ventas no puede quedar sin saber qué se vendió. Lo
                que corresponde ahí es retirarlo, y deja de ofrecerse al cargar un
                pedido sin tocar lo que ya se facturó. Los precios de cada uno se
                cargan en{' '}
                <Link to="/erp/precios" className="font-semibold underline underline-offset-2">
                  Precios
                </Link>
                .
              </p>
            </Card>

            {editing && (
              <ProductModal
                product={editing.id ? editing : null}
                productos={productos}
                onClose={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null)
                  query.reload()
                }}
              />
            )}
          </>
        )}
      </Async>
    </>
  )
}
