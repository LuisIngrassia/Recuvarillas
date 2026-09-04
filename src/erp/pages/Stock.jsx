/**
 * Stock y producción.
 *
 * El saldo de arriba es la suma de los movimientos de abajo, no un número
 * aparte que alguien mantiene. Por eso la pantalla muestra las dos cosas
 * juntas: cuando el stock no cuadra, la respuesta está en la lista.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MANUAL_MOVEMENTS,
  MOVEMENT_LABELS,
  addMovement,
  deleteMovement,
  listMovements,
  listProducts,
  listStock,
} from '../api/stock'
import { useAsync } from '../lib/useAsync'
import { formatDate, formatNumber, todayISO } from '../lib/format'
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

const MOVEMENT_TONES = {
  produccion: 'good',
  venta: 'info',
  ajuste: 'warn',
  devolucion: 'neutral',
}

/**
 * Carga de un movimiento a mano.
 *
 * Producción y devolución siempre suman, así que se piden en positivo. El
 * ajuste es el único donde el signo lo pone quien carga: es el movimiento que
 * corrige lo que no coincide con lo contado en el depósito, y puede ir para
 * cualquier lado.
 */
function MovementModal({ products, onClose, onSaved }) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [tipo, setTipo] = useState('produccion')
  const [cantidad, setCantidad] = useState('')
  const [fecha, setFecha] = useState(todayISO)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const cantidadNum = Number.parseInt(cantidad, 10)
    if (!Number.isFinite(cantidadNum) || cantidadNum === 0) {
      setError(
        tipo === 'ajuste'
          ? 'Poné cuántas varillas sobran o faltan (con menos si faltan).'
          : 'Poné cuántas varillas.',
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      await addMovement({
        product_id: productId,
        tipo,
        cantidad: cantidadNum,
        fecha,
        nota,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Cargar movimiento" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Producto">
          <Select value={productId} onChange={(event) => setProductId(event.target.value)}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.nombre}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={tipo} onChange={(event) => setTipo(event.target.value)}>
              {MANUAL_MOVEMENTS.map((value) => (
                <option key={value} value={value}>
                  {MOVEMENT_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Cantidad"
            hint={tipo === 'ajuste' ? 'Negativa si falta mercadería' : 'Entra al depósito'}
          >
            <Input
              type="number"
              step="1"
              inputMode="numeric"
              value={cantidad}
              onChange={(event) => setCantidad(event.target.value)}
              autoFocus
            />
          </Field>
        </div>

        <Field label="Fecha">
          <Input
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
          />
        </Field>

        <Field label="Nota" hint="Turno, quién contó, motivo del ajuste.">
          <Input value={nota} onChange={(event) => setNota(event.target.value)} />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Cargar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Las existencias de un producto.
 *
 * El número grande es el disponible y no el físico, porque es el que contesta
 * la pregunta que se hace por teléfono: no «cuántas tengo» sino «cuántas puedo
 * vender». Las que están en el depósito pero ya son de alguien no se pueden
 * prometer dos veces.
 */
function StockCard({ row }) {
  const disponible = row.disponible
  const reservadas = row.comprometido

  const tono =
    disponible < 0 ? 'text-red-600' : disponible === 0 ? 'text-amber-600' : 'text-steel-800'

  return (
    <div className="rounded-xl border border-steel-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-steel-400">
        {row.nombre}
      </p>

      <p className={`mt-2 text-3xl font-bold tabular-nums ${tono}`}>
        {formatNumber(disponible)}
      </p>
      <p className="text-xs text-steel-400">
        {disponible === 1 ? 'varilla disponible' : 'varillas disponibles'}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-steel-100 pt-3 text-xs">
        <span className="text-steel-500">
          En depósito{' '}
          <span className="font-semibold tabular-nums text-steel-700">
            {formatNumber(row.stock)}
          </span>
        </span>
        <span className={reservadas > 0 ? 'text-amber-700' : 'text-steel-400'}>
          Reservadas{' '}
          <span className="font-semibold tabular-nums">{formatNumber(reservadas)}</span>
        </span>
      </div>

      {disponible < 0 && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          Hay más comprometido que fabricado: falta producir {formatNumber(-disponible)}.
        </p>
      )}
    </div>
  )
}

export default function Stock() {
  const [tipo, setTipo] = useState('')
  const [productId, setProductId] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const stock = useAsync(listStock, [])
  const products = useAsync(listProducts, [])
  const movements = useAsync(() => listMovements({ tipo, productId }), [tipo, productId])

  const reloadAll = () => {
    stock.reload()
    movements.reload()
  }

  const remove = async (movement) => {
    if (movement.tipo === 'venta') return
    if (!confirm('¿Borrar este movimiento? El stock se recalcula solo.')) return

    setError('')
    try {
      await deleteMovement(movement.id)
      reloadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Stock"
        description="Lo que hay en el depósito y de dónde salió cada número."
        actions={
          <Button onClick={() => setAdding(true)} disabled={!products.data?.length}>
            Cargar movimiento
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Async query={stock}>
        {(rows) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map((row) => (
                <StockCard key={row.product_id} row={row} />
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-steel-400">
              Reservadas son las de los pedidos confirmados y en producción, que
              todavía están en el depósito pero ya tienen dueño. Un presupuesto
              no reserva nada: reservar es confirmar el pedido.
            </p>
          </>
        )}
      </Async>

      <div className="mb-4 mt-8 flex flex-wrap gap-3">
        <Select
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="w-auto"
        >
          <option value="">Todos los productos</option>
          {(products.data ?? []).map((product) => (
            <option key={product.id} value={product.id}>
              {product.nombre}
            </option>
          ))}
        </Select>
        <Select
          value={tipo}
          onChange={(event) => setTipo(event.target.value)}
          className="w-auto"
        >
          <option value="">Todos los movimientos</option>
          {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <Card title="Movimientos">
        <Async query={movements} empty="No hay movimientos con ese filtro.">
          {(rows) => (
            <Table
              head={
                <>
                  <Th>Fecha</Th>
                  <Th>Producto</Th>
                  <Th>Tipo</Th>
                  <Th align="right">Cantidad</Th>
                  <Th>Origen</Th>
                  <Th align="right"> </Th>
                </>
              }
            >
              {rows.map((movement) => (
                <tr key={movement.id} className="hover:bg-steel-50">
                  <Td className="whitespace-nowrap text-steel-600">
                    {formatDate(movement.fecha)}
                  </Td>
                  <Td className="text-steel-700">{movement.product?.nombre}</Td>
                  <Td>
                    <Badge tone={MOVEMENT_TONES[movement.tipo]}>
                      {MOVEMENT_LABELS[movement.tipo]}
                    </Badge>
                  </Td>
                  <Td
                    align="right"
                    className={`tabular-nums font-medium ${
                      movement.cantidad > 0 ? 'text-secondary-600' : 'text-red-600'
                    }`}
                  >
                    {movement.cantidad > 0 ? '+' : ''}
                    {formatNumber(movement.cantidad)}
                  </Td>
                  <Td className="text-xs text-steel-400">
                    {movement.order ? (
                      <>Pedido #{movement.order.numero}</>
                    ) : (
                      movement.nota
                    )}
                    {/* Lo que costó fabricar esa tanda, con el costo que tenía
                        la varilla ese día. Es lo que le resta a la ganancia del
                        mes, así que conviene que se vea acá y no sólo en
                        Rentabilidad. */}
                    {movement.tipo === 'produccion' &&
                      (movement.costo_unitario ? (
                        <span className="block text-steel-500">
                          Costó {formatPesos(movement.cantidad * Number(movement.costo_unitario))}
                        </span>
                      ) : (
                        <span className="block text-amber-600">
                          Sin costo: se cargó antes del costeo
                        </span>
                      ))}
                  </Td>
                  <Td align="right">
                    {movement.tipo !== 'venta' && (
                      <button
                        type="button"
                        onClick={() => remove(movement)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Borrar
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>

      <p className="mt-4 text-xs text-steel-400">
        Las salidas por venta las genera el sistema al marcar un pedido como
        entregado, y vuelven solas si el pedido se saca de ese estado. Por eso no
        se borran desde acá:{' '}
        <Link to="/erp/pedidos" className="underline">
          se cambian desde el pedido
        </Link>
        .
      </p>

      {adding && products.data && (
        <MovementModal
          products={products.data}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            reloadAll()
          }}
        />
      )}
    </>
  )
}
