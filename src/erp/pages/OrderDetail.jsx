/**
 * Un pedido con todo lo que hace falta para cerrarlo: la mercadería, el flete,
 * el estado y lo que se cobró.
 *
 * Está todo en una pantalla y no en pasos porque así se trabaja: el cliente
 * llama, cambia la cantidad, pregunta cuánto debe. Tener que ir y volver entre
 * pantallas para contestar eso sería peor que una tabla larga.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ORDER_STATE_LABELS,
  ORDER_STATE_TONES,
  addOrderItem,
  deleteOrder,
  deleteOrderItem,
  getOrder,
  nextState,
  setOrderStatus,
  updateOrder,
} from '../api/orders'
import { addPayment, deletePayment, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../api/payments'
import { listProducts } from '../api/stock'
import { CARRIER_TYPE_LABELS, quoteFreight } from '../api/carriers'
import { listSellers } from '../api/sellers'
import { useAsync } from '../lib/useAsync'
import { useDebounced } from '../lib/useDebounced'
import { formatDate, formatNumber, todayISO } from '../lib/format'
import { usePriceTiers } from '../../lib/priceTiers'
import { tierFor } from '../../lib/quote'
import {
  Async,
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  Money,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
} from '../components/ui'

/** Fila de totales del pie del pedido. */
function TotalRow({ label, value, strong, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={strong ? 'font-semibold text-steel-800' : 'text-steel-500'}>
        {label}
        {hint && <span className="block text-xs text-steel-400">{hint}</span>}
      </span>
      <span className={strong ? 'text-lg font-bold text-steel-900' : 'text-steel-700'}>
        {value}
      </span>
    </div>
  )
}

/**
 * Alta de un ítem, con el precio de lista ya puesto.
 *
 * El precio sugerido sale del escalón que corresponde al total de varillas del
 * pedido, no al de esta línea sola: quien compra 600 comunes y 600 agujereadas
 * está comprando 1.200, y le toca el escalón de esa cantidad.
 *
 * Y sale de la lista del cliente, no de la general: si es revendedor cotiza con
 * la mayorista aunque esta vez lleve poco. El tipo se cambia en su ficha.
 */
function AddItem({ order, products, onAdded }) {
  const tiers = usePriceTiers()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [cantidad, setCantidad] = useState('')
  const [precio, setPrecio] = useState('')
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const product = products.find((p) => p.id === productId)
  const cantidadNum = Number.parseInt(cantidad, 10)

  const sugerido = useMemo(() => {
    if (!product || !Number.isFinite(cantidadNum) || cantidadNum < 1) return null
    const yaCargadas = order.items.reduce((sum, item) => sum + item.cantidad, 0)
    const tier = tierFor(yaCargadas + cantidadNum, tiers, order.cliente_tipo)
    return product.drilled ? tier.drilled : tier.plain
  }, [product, cantidadNum, order.items, tiers, order.cliente_tipo])

  // Mientras nadie escriba un precio a mano, el campo sigue al sugerido.
  const precioMostrado = tocado ? precio : (sugerido ?? '')

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!productId || !Number.isFinite(cantidadNum) || cantidadNum < 1) {
      setError('Poné qué producto y cuántas varillas.')
      return
    }
    /*
      El campo vacío no es cero. `Number('')` da 0, así que sin este chequeo
      borrar el precio y darle Agregar cargaría la línea regalada.
    */
    const precioNum = precioMostrado === '' ? NaN : Number(precioMostrado)
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      setError('Poné el precio unitario.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await addOrderItem({
        order_id: order.id,
        product_id: productId,
        cantidad: cantidadNum,
        precio_unitario: precioNum,
      })
      setCantidad('')
      setPrecio('')
      setTocado(false)
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-steel-100 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Field label="Producto">
          <Select value={productId} onChange={(event) => setProductId(event.target.value)}>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cantidad">
          <Input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={cantidad}
            onChange={(event) => setCantidad(event.target.value)}
          />
        </Field>
        <Field
          label="Precio unitario"
          hint={
            sugerido
              ? `Lista ${order.cliente_tipo}: ${formatNumber(sugerido)}`
              : 'Sin IVA'
          }
        >
          <Input
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={precioMostrado}
            onChange={(event) => {
              setTocado(true)
              setPrecio(event.target.value)
            }}
          />
        </Field>
        <Button type="submit" disabled={saving}>
          Agregar
        </Button>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </form>
  )
}

/** Alta de un cobro contra el pedido. */
function AddPayment({ order, onAdded }) {
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('transferencia')
  const [fecha, setFecha] = useState(todayISO)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const saldo = Number(order.saldo)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const montoNum = Number(monto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError('Poné cuánto pagó.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await addPayment({
        order_id: order.id,
        monto: montoNum,
        metodo,
        fecha,
        nota: nota.trim() || null,
      })
      setMonto('')
      setNota('')
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-steel-100 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Field
          label="Monto"
          hint={
            saldo > 0 ? (
              <button
                type="button"
                onClick={() => setMonto(String(saldo))}
                className="font-semibold text-secondary-500 hover:underline"
              >
                Poner el saldo ({formatNumber(saldo)})
              </button>
            ) : null
          }
        >
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={monto}
            onChange={(event) => setMonto(event.target.value)}
          />
        </Field>
        <Field label="Medio">
          <Select value={metodo} onChange={(event) => setMetodo(event.target.value)}>
            {PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_METHOD_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha">
          <Input
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
          />
        </Field>
        <Button type="submit" disabled={saving}>
          Registrar
        </Button>
      </div>

      <div className="mt-3">
        <Field label="Nota">
          <Input
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            placeholder="Número de transferencia, cheque, etc."
          />
        </Field>
      </div>

      {/* Cobrar una seña contra un presupuesto es normal, pero conviene decir
          en el momento que esa plata todavía no cuenta como venta: si no, el
          mes aparece en cero y no se entiende por qué. */}
      {order.estado === 'presupuesto' && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
          Este pedido todavía es un presupuesto. El cobro va a figurar en Caja,
          pero no cuenta como venta —ni en el facturado del mes ni en
          Rentabilidad— hasta que lo pases a confirmado.
        </p>
      )}

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </form>
  )
}

/**
 * Los transportes que llegan a ese destino, para elegir uno sin salir de acá.
 *
 * Elegir una opción sólo completa los campos: el importe queda escrito y se
 * puede pisar a mano antes de guardar. Es a propósito, porque el tarifario es
 * una referencia y el transporte a veces cobra otra cosa —un adicional, un
 * descuento por volumen que se arregló por teléfono—, y en ese caso lo que vale
 * es lo que se pagó, no lo que decía la tabla.
 */
function FleteOpciones({ cp, unidades, elegido, onElegir }) {
  const cpFinal = useDebounced(cp ?? '')
  const query = useAsync(() => quoteFreight(cpFinal.trim(), unidades), [cpFinal, unidades])

  if (!cpFinal.trim() || !Number.isFinite(unidades) || unidades < 1) {
    return (
      <p className="rounded-md bg-steel-50 px-3 py-2 text-xs text-steel-400">
        Cargá el código postal y la mercadería para ver quién llega y a cuánto.
      </p>
    )
  }

  if (query.loading) return <p className="text-xs text-steel-400">Buscando transportes…</p>
  if (query.error) return <ErrorNote>{query.error}</ErrorNote>

  if (query.data.length === 0) {
    return (
      <p className="rounded-md bg-steel-50 px-3 py-2 text-xs text-steel-400">
        Ningún transporte cargado llega al CP {cpFinal.trim()} con{' '}
        {formatNumber(unidades)} varillas. Se puede poner el importe a mano.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {query.data.map((opcion, indice) => {
        const activo = opcion.carrier_id === elegido

        return (
          <li key={opcion.carrier_id}>
            <button
              type="button"
              onClick={() => onElegir(opcion)}
              className={`flex w-full items-baseline justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                activo
                  ? 'border-secondary-500 bg-secondary-50'
                  : 'border-steel-200 bg-white hover:border-steel-300'
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-steel-700">
                  {opcion.nombre}
                  {indice === 0 && query.data.length > 1 && (
                    <span className="ml-1.5 text-xs font-semibold text-secondary-600">
                      más barato
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-steel-400">
                  {CARRIER_TYPE_LABELS[opcion.tipo]} · {opcion.zona}
                  {opcion.plazo_dias !== null && ` · ${opcion.plazo_dias} días`}
                </span>
              </span>
              <Money value={opcion.precio} className="shrink-0 font-semibold text-steel-800" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Datos de la entrega y el flete, que se editan hasta que el pedido sale. */
function OrderInfo({ order, onSaved }) {
  const [form, setForm] = useState({
    fecha: order.fecha,
    entrega: order.entrega,
    direccion_entrega: order.direccion_entrega ?? '',
    localidad: order.localidad ?? '',
    codigo_postal: order.codigo_postal ?? '',
    // Vacío es "a confirmar", que es un estado legítimo y no un dato faltante:
    // el que avisa que pasa "la semana que viene" no dio una fecha.
    fecha_entrega: order.fecha_entrega ?? '',
    // null es "a cotizar" y hay que poder volver a dejarlo así, por eso el
    // campo vacío no se convierte en cero.
    flete: order.flete ?? '',
    carrier_id: order.carrier_id ?? '',
    notas: order.notas ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const setValue = (cambios) => {
    setForm((prev) => ({ ...prev, ...cambios }))
    setSaved(false)
  }

  const set = (key) => (event) => setValue({ [key]: event.target.value })

  const save = async () => {
    setSaving(true)
    setError('')

    try {
      const envio = form.entrega === 'envio'

      await updateOrder(order.id, {
        fecha: form.fecha,
        entrega: form.entrega,
        /* Vale para retiro y para envío, así que no se limpia al cambiar de
           uno a otro: la fecha en que el cliente lo quiere es la misma. */
        fecha_entrega: form.fecha_entrega || null,
        direccion_entrega: envio ? form.direccion_entrega.trim() || null : null,
        localidad: envio ? form.localidad.trim() || null : null,
        codigo_postal: envio ? form.codigo_postal.trim() || null : null,
        /*
          Si el pedido pasa a retiro, el flete se borra. Quedaría escondido —el
          campo ni se muestra— pero seguiría sumando al total, que es la peor
          forma de que aparezca un importe que nadie puede explicar. El
          transporte se va con él por la misma razón.
        */
        flete: envio && form.flete !== '' ? Number(form.flete) : null,
        carrier_id: envio ? form.carrier_id || null : null,
        notas: form.notas.trim() || null,
      })
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fecha del pedido">
          <Input type="date" value={form.fecha} onChange={set('fecha')} />
        </Field>
        <Field label="Entrega">
          <Select value={form.entrega} onChange={set('entrega')}>
            <option value="retiro">Retira en fábrica</option>
            <option value="envio">Con envío</option>
          </Select>
        </Field>
      </div>

      <Field
        label={form.entrega === 'retiro' ? 'Fecha de retiro' : 'Fecha de entrega'}
        hint="Vacío = a confirmar. La mercadería queda reservada igual."
      >
        <Input type="date" value={form.fecha_entrega} onChange={set('fecha_entrega')} />
      </Field>

      {form.entrega === 'envio' && (
        <>
          <Field label="Dirección de entrega">
            <Input value={form.direccion_entrega} onChange={set('direccion_entrega')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Localidad">
              <Input value={form.localidad} onChange={set('localidad')} />
            </Field>
            <Field label="Código postal">
              <Input value={form.codigo_postal} onChange={set('codigo_postal')} />
            </Field>
          </div>

          <Field label="Transporte">
            <FleteOpciones
              cp={form.codigo_postal}
              unidades={Number(order.unidades)}
              elegido={form.carrier_id}
              onElegir={(opcion) =>
                setValue({ carrier_id: opcion.carrier_id, flete: String(opcion.precio) })
              }
            />
          </Field>

          <Field
            label="Flete"
            hint="Vacío = a cotizar. Elegir un transporte lo completa, y se puede corregir a mano."
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.flete}
              onChange={set('flete')}
            />
          </Field>
        </>
      )}

      <Field label="Notas">
        <Textarea rows={3} value={form.notas} onChange={set('notas')} />
      </Field>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} type="button">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {saved && <span className="text-xs text-secondary-500">Guardado.</span>}
      </div>
    </div>
  )
}

/**
 * Quién trajo la venta y cuánto se lleva.
 *
 * El porcentaje se copia del vendedor al elegirlo pero después queda escrito en
 * el pedido: es lo que se acordó en esta venta y no tiene por qué moverse
 * cuando cambie la ficha del vendedor.
 */
function Comision({ order, onSaved }) {
  const sellers = useAsync(() => listSellers({ soloActivos: true }), [])
  const [sellerId, setSellerId] = useState(order.seller_id ?? '')
  const [pct, setPct] = useState(
    order.comision_pct == null ? '' : String(Number(order.comision_pct)),
  )
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const seller = sellers.data?.find((item) => item.id === sellerId)

  // Mientras nadie escriba un porcentaje a mano, el campo sigue al del vendedor.
  const sugerido = seller ? String(Number(seller.comision_pct)) : ''
  const pctMostrado = tocado || !seller ? pct : sugerido

  const save = async () => {
    const pctNum = pctMostrado === '' ? null : Number(pctMostrado)

    if (pctNum !== null && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100)) {
      setError('La comisión tiene que ser un porcentaje entre 0 y 100.')
      return
    }

    setSaving(true)
    setError('')

    try {
      /* Sacar el vendedor se lleva el porcentaje: una comisión sin nadie a quien
         pagársela sólo ensucia el resultado del mes. */
      await updateOrder(order.id, {
        seller_id: sellerId || null,
        comision_pct: sellerId ? pctNum : null,
      })
      setSaved(true)
      setTocado(false)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  /*
    A los revendedores no se les paga comisión, y la pantalla lo dice en vez de
    dejar el campo puesto y que la cuenta lo ignore después: un porcentaje que
    se puede escribir y no se paga es una discusión esperando a pasar. La regla
    también está en `orders_summary`, que es lo que hace que valga aunque
    alguien la cargue desde otro lado.
  */
  if (order.cliente_tipo === 'mayorista') {
    return (
      <div className="px-4 py-4">
        <p className="text-sm font-medium text-steel-700">Sin comisión</p>
        <p className="mt-1 text-xs leading-relaxed text-steel-400">
          {order.cliente_nombre} es revendedor y ya compra con la lista
          mayorista, que es más barata justamente porque vuelve todos los meses.
          Ese descuento es lo que se resigna; sumarle comisión sería resignarlo
          dos veces.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <Field label="Vendedor">
        <Select
          value={sellerId}
          onChange={(event) => {
            setSellerId(event.target.value)
            setTocado(false)
            setSaved(false)
          }}
        >
          <option value="">Sin vendedor</option>
          {(sellers.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
        </Select>
      </Field>

      {sellerId && (
        <>
          <Field
            label="Comisión (%)"
            hint={
              seller
                ? `Queda guardado en este pedido. El habitual de ${seller.nombre} es ${Number(seller.comision_pct)}%.`
                : null
            }
          >
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              inputMode="decimal"
              value={pctMostrado}
              onChange={(event) => {
                setTocado(true)
                setPct(event.target.value)
                setSaved(false)
              }}
            />
          </Field>

          <div className="rounded-md bg-steel-50 px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-steel-500">Devengado hasta hoy</span>
              <Money value={order.comision} className="font-semibold text-steel-800" />
            </div>
            <p className="mt-1 text-xs text-steel-400">
              Sobre la mercadería y en proporción a lo cobrado. Se completa
              cuando el cliente termine de pagar.
            </p>
          </div>
        </>
      )}

      <ErrorNote>{error}</ErrorNote>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} type="button">
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
        {saved && <span className="text-xs text-secondary-500">Guardado.</span>}
      </div>
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useAsync(() => getOrder(id), [id])
  const products = useAsync(listProducts, [])
  const [error, setError] = useState('')

  const advance = async (order, estado) => {
    setError('')
    try {
      await setOrderStatus(order.id, estado)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const removeOrder = async (order) => {
    if (!confirm(`¿Borrar el pedido #${order.numero}? Se borran también sus cobros.`)) {
      return
    }
    setError('')
    try {
      await deleteOrder(order.id)
      navigate('/erp/pedidos')
    } catch (err) {
      setError(err.message)
    }
  }

  const removeItem = async (itemId) => {
    setError('')
    try {
      await deleteOrderItem(itemId)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const removePayment = async (paymentId) => {
    if (!confirm('¿Borrar este cobro?')) return
    setError('')
    try {
      await deletePayment(paymentId)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Async query={query}>
      {(order) => {
        const siguiente = nextState(order.estado)
        const entregado = order.estado === 'entregado'
        const anulado = order.estado === 'cancelado'
        // Una vez entregado, tocar la mercadería descuadraría el stock que ya
        // descontó el trigger, así que los ítems quedan firmes.
        const editable = !entregado && !anulado

        return (
          <>
            <PageHeader
              title={`Pedido #${order.numero}`}
              description={
                <>
                  <Link
                    to={`/erp/clientes/${order.customer_id}`}
                    className="font-medium text-secondary-500 hover:underline"
                  >
                    {order.cliente_nombre}
                  </Link>
                  {' · '}
                  {formatDate(order.fecha)}
                </>
              }
              actions={
                <div className="flex flex-wrap gap-2 print:hidden">
                  <Link
                    to="/erp/pedidos"
                    className="inline-flex items-center rounded-md border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-600 hover:border-steel-300"
                  >
                    Volver
                  </Link>
                  {/* Dos papeles distintos: el presupuesto es el que se le
                      manda al cliente, con la marca; imprimir esta pantalla da
                      la copia de trabajo, con los cobros y el saldo. */}
                  <Link
                    to={`/erp/pedidos/${order.id}/presupuesto`}
                    className="inline-flex items-center rounded-md border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-600 hover:border-steel-300"
                  >
                    Presupuesto
                  </Link>
                  <Button variant="ghost" onClick={() => window.print()}>
                    Imprimir
                  </Button>
                  {siguiente && (
                    <Button onClick={() => advance(order, siguiente)}>
                      Pasar a {ORDER_STATE_LABELS[siguiente].toLowerCase()}
                    </Button>
                  )}
                  {!anulado && (
                    <Button variant="danger" onClick={() => advance(order, 'cancelado')}>
                      Anular
                    </Button>
                  )}
                </div>
              }
            />

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge tone={ORDER_STATE_TONES[order.estado]}>
                {ORDER_STATE_LABELS[order.estado]}
              </Badge>
              {entregado && (
                <span className="text-xs text-steel-400">
                  La mercadería ya se descontó del stock.
                </span>
              )}
              {/* Desde que se confirma, la mercadería queda apartada aunque
                  siga en el depósito. Decirlo acá evita la pregunta de por qué
                  el stock disponible bajó sin que saliera nada. */}
              {(order.estado === 'confirmado' || order.estado === 'en_produccion') && (
                <span className="text-xs text-steel-500">
                  {formatNumber(order.unidades)} varillas reservadas ·{' '}
                  {order.entrega === 'retiro' ? 'retira' : 'entrega'}{' '}
                  {order.fecha_entrega ? (
                    `el ${formatDate(order.fecha_entrega)}`
                  ) : (
                    <span className="font-semibold text-amber-600">a confirmar</span>
                  )}
                </span>
              )}
              {anulado && (
                <span className="text-xs text-steel-400">
                  Anulado: no cuenta en la cuenta corriente ni en las ventas del mes.
                </span>
              )}
            </div>

            {error && (
              <div className="mb-4">
                <ErrorNote>{error}</ErrorNote>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card title="Mercadería">
                  {order.items.length === 0 ? (
                    <Empty>Todavía no cargaste qué lleva este pedido.</Empty>
                  ) : (
                    <Table
                      head={
                        <>
                          <Th>Producto</Th>
                          <Th align="right">Cantidad</Th>
                          <Th align="right">Precio unitario</Th>
                          <Th align="right">Subtotal</Th>
                          <Th align="right"> </Th>
                        </>
                      }
                    >
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <Td className="text-steel-700">{item.product.nombre}</Td>
                          <Td align="right" className="tabular-nums text-steel-600">
                            {formatNumber(item.cantidad)}
                          </Td>
                          <Td align="right">
                            <Money value={item.precio_unitario} />
                          </Td>
                          <Td align="right" className="font-medium">
                            <Money value={item.subtotal} />
                          </Td>
                          <Td align="right">
                            {editable && (
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="text-xs font-semibold text-red-600 hover:underline print:hidden"
                              >
                                Quitar
                              </button>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </Table>
                  )}

                  {editable && products.data && (
                    <div className="print:hidden">
                      <AddItem
                        order={order}
                        products={products.data}
                        onAdded={query.reload}
                      />
                    </div>
                  )}
                </Card>

                <Card title="Cobros">
                  {order.payments.length === 0 ? (
                    <Empty>Sin cobros registrados.</Empty>
                  ) : (
                    <Table
                      head={
                        <>
                          <Th>Fecha</Th>
                          <Th>Medio</Th>
                          <Th>Nota</Th>
                          <Th align="right">Monto</Th>
                          <Th align="right"> </Th>
                        </>
                      }
                    >
                      {order.payments.map((payment) => (
                        <tr key={payment.id}>
                          <Td className="whitespace-nowrap text-steel-600">
                            {formatDate(payment.fecha)}
                          </Td>
                          <Td className="text-steel-600">
                            {PAYMENT_METHOD_LABELS[payment.metodo]}
                          </Td>
                          <Td className="text-xs text-steel-400">{payment.nota}</Td>
                          <Td align="right" className="font-medium">
                            <Money value={payment.monto} />
                          </Td>
                          <Td align="right">
                            <button
                              type="button"
                              onClick={() => removePayment(payment.id)}
                              className="text-xs font-semibold text-red-600 hover:underline print:hidden"
                            >
                              Quitar
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </Table>
                  )}

                  {!anulado && (
                    <div className="print:hidden">
                      <AddPayment order={order} onAdded={query.reload} />
                    </div>
                  )}
                </Card>
              </div>

              <div className="space-y-6">
                <Card title="Totales">
                  <div className="divide-y divide-steel-100 px-4 py-3 text-sm">
                    <TotalRow
                      label={`Mercadería (${formatNumber(order.unidades)} varillas)`}
                      value={<Money value={order.mercaderia} />}
                    />
                    {Number(order.descuento_pct) > 0 && (
                      <TotalRow
                        label={`Descuento (${Number(order.descuento_pct)}%)`}
                        hint="Se edita al armar el presupuesto"
                        value={
                          <span className="text-steel-500">
                            − <Money value={order.descuento} />
                          </span>
                        }
                      />
                    )}
                    <TotalRow
                      label="Flete"
                      hint={
                        order.entrega === 'retiro'
                          ? 'Retira en fábrica'
                          : order.flete === null
                            ? 'Lo cotiza el transporte'
                            : null
                      }
                      value={
                        order.entrega === 'retiro' ? (
                          'Sin cargo'
                        ) : order.flete === null ? (
                          'A cotizar'
                        ) : (
                          <Money value={order.flete} />
                        )
                      }
                    />
                    <TotalRow
                      label="Total sin IVA"
                      value={<Money value={order.total} />}
                      strong
                    />
                    <TotalRow label="Cobrado" value={<Money value={order.pagado} />} />
                    <TotalRow
                      label="Saldo"
                      value={
                        <Money
                          value={order.saldo}
                          className={
                            Number(order.saldo) > 0 ? 'text-amber-600' : 'text-secondary-500'
                          }
                        />
                      }
                      strong
                    />
                  </div>
                </Card>

                <Card title="Entrega y flete" className="print:hidden">
                  <OrderInfo order={order} onSaved={query.reload} />
                </Card>

                {/* La comisión es un costo nuestro, no algo que el cliente
                    tenga que ver: por eso no está en Totales, que es lo que
                    sale impreso. */}
                <Card title="Vendedor" className="print:hidden">
                  <Comision order={order} onSaved={query.reload} />
                </Card>

                <Card title="Zona de riesgo" className="print:hidden">
                  <div className="px-4 py-4">
                    <p className="mb-3 text-xs text-steel-400">
                      Anular conserva el pedido y su historia. Borrar lo saca del
                      sistema junto con sus cobros, y no se puede deshacer.
                    </p>
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={() => removeOrder(order)}
                    >
                      Borrar pedido
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )
      }}
    </Async>
  )
}
