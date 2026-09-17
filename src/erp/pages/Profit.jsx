/**
 * Cuánto ganó la empresa en el mes y cómo se reparte.
 *
 * Es la única pantalla que junta las dos mitades: lo que entró por ventas y lo
 * que salió por costos y comisiones. Ninguno de los dos números se carga acá
 * —salen de Pedidos y de Costos— justamente para que el resultado no se pueda
 * "arreglar" escribiéndolo a mano.
 *
 * Lo que muestra no es una ganancia repartida en porcentajes: es la cuenta de
 * cada uno. Cada socio cobra su porcentaje sobre el valor del producto y
 * después se le descuentan los costos que él banca, no los de todos.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createPayout,
  createShare,
  deletePayout,
  deleteShare,
  listMonths,
  listPayouts,
  listShares,
  pesoDelPozo,
  runReserve,
  splitProfit,
  updateShare,
} from '../api/profit'
import { listExpenseTypes } from '../api/expenses'
import { LEAD_SOURCE_LABELS, listLeadsByOrigin } from '../api/leads'
import { useAsync } from '../lib/useAsync'
import {
  currentMonth,
  formatDate,
  formatMonth,
  formatNumber,
  formatPesos,
  monthRange,
  todayISO,
} from '../lib/format'
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
  Money,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from '../components/ui'

/* Un mes sin ventas ni gastos no tiene fila en la vista, y no es un error:
   simplemente no pasó nada. Se muestra en cero en vez de "no hay datos". */
const MES_VACIO = {
  pedidos: 0,
  mercaderia: 0,
  servicios: 0,
  flete_facturado: 0,
  facturado: 0,
  cobrado: 0,
  comisiones: 0,
  base_reparto: 0,
  varillas_producidas: 0,
  costo_produccion: 0,
  costo_produccion_cargado: 0,
  costo_flete: 0,
  costo_pauta: 0,
  gastos_por_tipo: {},
  costos: 0,
  ganancia_neta: 0,
}

/** Una línea del resultado. `signo` es sólo cómo se lee, no cómo se suma. */
function Linea({ label, value, signo, strong, hint }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-4 py-2 ${
        strong ? 'border-t border-steel-200 bg-steel-50' : ''
      }`}
    >
      <span className={strong ? 'font-semibold text-steel-800' : 'text-sm text-steel-500'}>
        {signo && <span className="mr-1 text-steel-300">{signo}</span>}
        {label}
        {hint && <span className="block text-xs text-steel-400">{hint}</span>}
      </span>
      <Money
        value={value}
        className={strong ? 'text-lg font-bold text-steel-900' : 'text-sm text-steel-700'}
      />
    </div>
  )
}

/** Lo pagado de una parte, sumando sus liquidaciones. */
const sumarPagos = (pagos) => pagos.reduce((sum, pago) => sum + Number(pago.monto), 0)

/**
 * El estado de la liquidación de una parte: cuánto se pagó, cuánto falta y los
 * dos caminos para pagar.
 *
 * **Liquidar** paga todo lo que falta de un clic, que es el caso normal.
 * **parte** abre el detalle para poner un monto a mano, que es cuando se paga a
 * cuenta porque no está toda la plata junta.
 *
 * La reinversión no aparece nunca acá: su parte no se le paga a nadie, va al
 * pozo. Eso lo decide quien usa el componente, no el componente.
 */
function Liquidacion({ leToca, pagos, onLiquidar, onAbrir }) {
  const pagado = sumarPagos(pagos)
  const falta = Number(leToca) - pagado
  const saldado = Math.abs(falta) < 0.01

  /* Nada que liquidar no es lo mismo que pendiente: un mes sin ganancia no le
     debe nada a nadie y ofrecer el botón sería invitar a registrar un cero. */
  if (Math.abs(Number(leToca)) < 0.01 && pagos.length === 0) {
    return <span className="text-xs text-steel-300">—</span>
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {pagos.length > 0 && (
        <span className="whitespace-nowrap text-xs">
          {saldado ? (
            <span className="font-semibold text-secondary-600">Pagado</span>
          ) : (
            <>
              <span className="text-steel-500">Pagado </span>
              <span className="font-semibold text-steel-700">{formatPesos(pagado)}</span>
              <span className="text-steel-400"> · falta {formatPesos(falta)}</span>
            </>
          )}
        </span>
      )}

      <span className="flex items-center gap-2">
        {!saldado && (
          <Button
            variant="soft"
            className="whitespace-nowrap px-2 py-1 text-xs"
            onClick={onLiquidar}
          >
            Liquidar
          </Button>
        )}
        <button
          type="button"
          onClick={onAbrir}
          className="text-xs text-steel-400 underline-offset-2 hover:text-steel-600 hover:underline"
        >
          {saldado ? 'ver' : 'parte'}
        </button>
      </span>
    </div>
  )
}

/**
 * El detalle de una liquidación: lo que se pagó hasta ahora y el alta de un
 * pago nuevo por el monto que sea.
 *
 * Muestra en vivo cómo queda el saldo después del pago que se está por
 * registrar. Es lo que reemplaza a la restricción de unicidad que había antes:
 * ya no se puede impedir el segundo pago —pagar en cuotas es legítimo— así que
 * lo que corresponde es que se vea con qué queda.
 */
function PayoutModal({ parte, leToca, pagos, onClose, onRegistrar, onBorrar }) {
  const pagado = sumarPagos(pagos)
  const falta = Number(leToca) - pagado

  const [monto, setMonto] = useState(() =>
    falta > 0 ? String(Math.round(falta * 100) / 100) : '',
  )
  const [fecha, setFecha] = useState(todayISO)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const montoNum = monto === '' ? 0 : Number(monto)
  const valido = Number.isFinite(montoNum) && Math.abs(montoNum) >= 0.01
  const restante = falta - (valido ? montoNum : 0)

  const registrar = async (event) => {
    event.preventDefault()

    if (!valido) {
      setError('Poné cuánto se le pagó.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await onRegistrar({ monto: montoNum, fecha, nota })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Liquidar a ${parte.nombre}`} onClose={onClose}>
      <div className="space-y-4">
        <dl className="grid grid-cols-3 gap-2 rounded-md bg-steel-50 px-3 py-2 text-xs">
          <div>
            <dt className="text-steel-400">Le toca</dt>
            <dd className="tabular-nums font-semibold text-steel-700">
              {formatPesos(leToca)}
            </dd>
          </div>
          <div>
            <dt className="text-steel-400">Pagado</dt>
            <dd className="tabular-nums font-semibold text-steel-700">
              {formatPesos(pagado)}
            </dd>
          </div>
          <div>
            <dt className="text-steel-400">Falta</dt>
            <dd
              className={`tabular-nums font-semibold ${
                Math.abs(falta) < 0.01 ? 'text-secondary-600' : 'text-amber-600'
              }`}
            >
              {formatPesos(falta)}
            </dd>
          </div>
        </dl>

        {pagos.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-steel-600">Pagos registrados</p>
            <ul className="divide-y divide-steel-100 rounded-md border border-steel-200">
              {pagos.map((pago) => (
                <li
                  key={pago.id}
                  className="flex items-baseline justify-between gap-3 px-3 py-2 text-xs"
                >
                  <span className="text-steel-500">
                    {formatDate(pago.fecha)}
                    {pago.nota && (
                      <span className="block text-steel-400">{pago.nota}</span>
                    )}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <Money value={pago.monto} className="font-semibold text-steel-700" />
                    <button
                      type="button"
                      onClick={() => onBorrar(pago)}
                      className="text-steel-400 underline-offset-2 hover:text-red-600 hover:underline"
                    >
                      borrar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={registrar} className="space-y-4 border-t border-steel-100 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Cuánto se le paga"
              hint={
                valido
                  ? Math.abs(restante) < 0.01
                    ? 'Con esto queda saldado.'
                    : `Después de esto queda ${formatPesos(restante)} pendiente.`
                  : 'Podés pagar todo o una parte.'
              }
            >
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Fecha">
              <Input
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Nota" hint="Opcional: transferencia, efectivo, a cuenta…">
            <Input value={nota} onChange={(event) => setNota(event.target.value)} />
          </Field>

          <ErrorNote>{error}</ErrorNote>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cerrar
            </Button>
            <Button type="submit" disabled={saving || !valido}>
              {saving ? 'Guardando…' : 'Registrar pago'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

function ShareModal({ share, onClose, onSaved }) {
  const [nombre, setNombre] = useState(share?.nombre ?? '')
  const [porcentaje, setPorcentaje] = useState(
    share ? String(Number(share.porcentaje)) : '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const limpio = nombre.trim()
    const pct = Number(porcentaje)

    if (!limpio) {
      setError('Poné el nombre de la parte.')
      return
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError('El porcentaje tiene que estar entre 0 y 100.')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (share) await updateShare(share.id, { nombre: limpio, porcentaje: pct })
      else await createShare({ nombre: limpio, porcentaje: pct, orden: 99 })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={share ? 'Editar parte' : 'Nueva parte'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre">
          <Input value={nombre} onChange={(event) => setNombre(event.target.value)} autoFocus />
        </Field>
        <Field
          label="Porcentaje"
          hint="Del valor del producto vendido. Entre todas las partes tienen que sumar 100."
        >
          <Input
            type="number"
            min="0"
            max="100"
            step="0.001"
            inputMode="decimal"
            value={porcentaje}
            onChange={(event) => setPorcentaje(event.target.value)}
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

export default function Profit() {
  const [mes, setMes] = useState(currentMonth)
  const [editing, setEditing] = useState(null)
  const [liquidando, setLiquidando] = useState(null)
  const [error, setError] = useState('')

  const query = useAsync(async () => {
    const [meses, shares, tipos] = await Promise.all([
      listMonths(),
      listShares(),
      listExpenseTypes(),
    ])
    return { meses, shares, tipos }
  }, [])

  /* Aparte y no dentro de la carga de arriba porque depende del mes elegido:
     mezclarlas obligaría a volver a pedir el reparto entero cada vez que se
     cambia de mes, para mirar un dato que no cambió. */
  const origenes = useAsync(() => listLeadsByOrigin(monthRange(mes)), [mes])

  /* Todos los pagos, no sólo los del mes: la cuenta histórica de cada socio los
     necesita completos, y el detalle del mes sale de filtrar esta misma lista.
     Traerlos por separado sería arriesgarse a que las dos vistas se
     contradigan. No depende del mes elegido, así que no se vuelve a pedir al
     cambiarlo. */
  const pagos = useAsync(() => listPayouts(), [])

  /**
   * Paga de un saque todo lo que falta, que es el caso normal.
   *
   * El monto va congelado tal como lo muestra la pantalla en este momento: es
   * lo que se está pagando. Si mañana se corrige un gasto viejo y la cuenta del
   * mes se mueve, lo pagado sigue diciendo lo que se pagó.
   */
  const liquidarTodo = async (share, monto) => {
    setError('')
    try {
      await createPayout({ share_id: share.id, mes, tipo: 'reparto', monto })
      pagos.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  /* El alta desde el diálogo, con monto libre. El error lo muestra el propio
     diálogo, así que acá se deja propagar. */
  const registrarPago = (share) => async (valores) => {
    await createPayout({ share_id: share.id, mes, tipo: 'reparto', ...valores })
    pagos.reload()
  }

  const deshacerPago = async (pago) => {
    if (!confirm(`¿Borrar el pago de ${formatPesos(pago.monto)}?`)) return
    setError('')
    try {
      await deletePayout(pago.id)
      pagos.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (share) => {
    if (!confirm(`¿Borrar la parte de ${share.nombre}?`)) return
    setError('')
    try {
      await deleteShare(share.id)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Rentabilidad"
        description={`El resultado de ${formatMonth(mes)} y la cuenta de cada uno.`}
        actions={
          <input
            type="month"
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className="rounded-md border border-steel-200 bg-white px-3 py-2 text-sm text-steel-700"
          />
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Async query={query}>
        {({ meses, shares, tipos }) => {
          const fila = meses.find((row) => String(row.mes).slice(0, 7) === mes)
          const datos = fila ?? MES_VACIO
          const ganancia = Number(datos.ganancia_neta)

          /* El pozo se arrastra de un mes al otro, así que el reparto de este
             mes depende de los anteriores: hay que recorrer la cadena entera y
             después buscar el mes que se está mirando. */
          const cadena = runReserve(meses, shares, tipos)
          const reparto = cadena.get(mes) ?? splitProfit(MES_VACIO, shares, tipos, 0)
          const pozo = reparto.pozo
          const pasamanos = reparto.pasamanos
          const peso = pesoDelPozo(cadena)

          const nombreDe = (id) => shares.find((s) => s.id === id)?.nombre ?? '—'
          const listaDe = (ids) => ids.map(nombreDe).join(' y ')

          const todosLosPagos = pagos.data ?? []
          const listaPagos = todosLosPagos.filter(
            (p) => String(p.mes).slice(0, 7) === mes,
          )
          const pagosDe = (shareId) =>
            listaPagos.filter((p) => p.share_id === shareId && p.tipo === 'reparto')

          /*
            La cuenta de cada socio a lo largo de todos los meses: cuánto le
            tocó en total, cuánto cobró y qué saldo queda. Se arma recorriendo
            la cadena completa —que ya está calculada— y cruzándola con los
            pagos. Es la pregunta que no se podía contestar mirando un mes por
            vez: "¿cuánto le debo a Juan?".
          */
          const cuentas = new Map()
          for (const [mesKey, rep] of cadena) {
            for (const parte of rep.socios) {
              if (Math.abs(parte.monto) < 0.01) continue
              if (!cuentas.has(parte.id)) {
                cuentas.set(parte.id, {
                  id: parte.id,
                  nombre: parte.nombre,
                  leToca: 0,
                  pagado: 0,
                  meses: [],
                })
              }
              const cuenta = cuentas.get(parte.id)
              cuenta.leToca += parte.monto
              cuenta.meses.push({ mes: mesKey, monto: parte.monto })
            }
          }

          for (const pago of todosLosPagos) {
            const cuenta = cuentas.get(pago.share_id)
            /* Un pago de una parte que ya no figura en el reparto —se borró, o
               el mes quedó sin datos— igual tiene que sumar: la plata salió. */
            if (cuenta) cuenta.pagado += Number(pago.monto)
          }

          const listaCuentas = [...cuentas.values()].sort((a, b) => b.leToca - a.leToca)

          /* Liquidaciones hechas bajo la regla vieja del pozo que vencía. Ya no
             se generan más, pero la plata salió y está contada en «cobró»: sin
             decirlo, un saldo pagado de más parece un error de cuenta. */
          const delPozoViejo = todosLosPagos.filter((p) => p.tipo === 'pozo')
          const montoPozoViejo = sumarPagos(delPozoViejo)

          /* El margen sobre lo facturado: el número que dice si el mes fue
             bueno más allá de cuánto se vendió. Sin ventas no hay margen que
             calcular, y dividir por cero daría un infinito en pantalla. */
          const facturado = Number(datos.facturado)
          const margen = facturado > 0 ? (ganancia / facturado) * 100 : null

          /* Los gastos que bancan socios puntuales, ya agrupados para mostrar.
             El flete va aparte porque se resuelve neto contra su ingreso. */
          const directos = tipos
            .filter((tipo) => tipo.paga === 'socios' && tipo.clave !== 'flete')
            .map((tipo) => ({
              ...tipo,
              monto:
                Number(datos.gastos_por_tipo?.[tipo.clave] ?? 0) +
                (tipo.clave === 'produccion' ? Number(datos.costo_produccion) : 0),
            }))
            .filter((tipo) => tipo.monto > 0)

          const delPozo = tipos
            .filter((tipo) => tipo.paga === 'pozo')
            .map((tipo) => ({
              ...tipo,
              monto: Number(datos.gastos_por_tipo?.[tipo.clave] ?? 0),
            }))
            .filter((tipo) => tipo.monto > 0)

          return (
            <>
              {Number(datos.costo_produccion_cargado) > 0 && (
                <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
                  Hay{' '}
                  <strong>{formatPesos(datos.costo_produccion_cargado)}</strong>{' '}
                  cargados en Costos como gasto de <em>producción</em>. Ese costo
                  ahora sale del stock —de lo que costaba hacer cada varilla el día
                  que se produjo—, así que esos gastos no se están contando en
                  ningún total.{' '}
                  <Link to="/erp/costos" className="font-semibold underline underline-offset-2">
                    Revisarlos
                  </Link>
                </div>
              )}

              {!pasamanos.cuadra && (
                <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
                  <strong>
                    El flete no cierra:{' '}
                    {pasamanos.descalce > 0
                      ? `se facturaron ${formatPesos(pasamanos.descalce)} de más`
                      : `se pagaron ${formatPesos(-pasamanos.descalce)} de más`}
                    .
                  </strong>{' '}
                  Se facturaron {formatPesos(pasamanos.facturado)} y se pagaron{' '}
                  {formatPesos(pasamanos.costo)}. Tiene que dar cero: el flete se
                  cotiza del tarifario y se le factura al cliente ese mismo
                  número, así que una diferencia no es plata de nadie, es{' '}
                  {pasamanos.descalce > 0
                    ? 'un flete que se facturó y todavía no se cargó como gasto'
                    : 'un flete que se pagó y no se facturó en ningún pedido'}
                  .{' '}
                  <Link to="/erp/costos" className="font-semibold underline underline-offset-2">
                    Revisar los costos del mes
                  </Link>
                </div>
              )}

              {reparto.sinDueno > 0.01 && (
                <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
                  <strong>
                    Hay {formatPesos(reparto.sinDueno)} de gastos sin dueño este
                    mes.
                  </strong>{' '}
                  Son{' '}
                  {reparto.huerfanos.map((item) => item.nombre).join(', ')}: su tipo
                  no tiene ningún socio asignado, así que la plata salió de la caja
                  y no se le descontó a nadie. Los montos de abajo no la incluyen.{' '}
                  <Link
                    to="/erp/tipos-de-gasto"
                    className="font-semibold underline underline-offset-2"
                  >
                    Asignar quién los paga
                  </Link>
                </div>
              )}

              {/* Un mes entero en cero casi nunca es "no pasó nada": lo más
                  común es que los pedidos sigan en presupuesto, que no cuentan
                  como venta. Decirlo evita salir a buscar el error a otro lado. */}
              {!fila && (
                <div className="mb-6 rounded-md border border-steel-200 bg-steel-50 px-4 py-3 text-sm leading-relaxed text-steel-600">
                  No hay nada registrado en {formatMonth(mes)}: ni ventas ni gastos.
                  Si cargaste pedidos este mes y no aparecen, fijate que estén{' '}
                  <strong>confirmados</strong> — un presupuesto todavía no es una
                  venta, aunque ya le hayas cobrado una seña.{' '}
                  <Link to="/erp/pedidos" className="font-semibold underline underline-offset-2">
                    Ver pedidos
                  </Link>
                </div>
              )}

              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Facturado"
                  value={<Money value={datos.facturado} />}
                  hint={`${datos.pedidos} pedido${datos.pedidos === 1 ? '' : 's'}`}
                />
                <Stat
                  label="Base del reparto"
                  value={<Money value={reparto.base} />}
                  hint="Mercadería y servicios, menos comisiones"
                />
                <Stat label="Costos" value={<Money value={datos.costos} />} tone="warn" />
                <Stat
                  label="Ganancia neta"
                  value={<Money value={ganancia} />}
                  tone={ganancia >= 0 ? 'good' : 'warn'}
                  hint={
                    margen === null
                      ? 'Sin ventas en el mes'
                      : `${margen.toFixed(1)}% de lo facturado`
                  }
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Cómo se llegó a ese número">
                  <div className="py-1">
                    <Linea label="Mercadería" value={datos.mercaderia} />
                    <Linea label="Servicios" value={datos.servicios} />
                    <Linea
                      label="Comisiones"
                      value={datos.comisiones}
                      signo="−"
                      hint="La única que se descuenta antes de repartir"
                    />
                    {reparto.proporcionales > 0 && (
                      <Linea
                        label="Gastos que salen de arriba"
                        value={reparto.proporcionales}
                        signo="−"
                      />
                    )}
                    <Linea
                      label="Base del reparto"
                      hint="Sobre esto corren los porcentajes de cada uno"
                      value={reparto.base}
                      strong
                    />

                    {/* El pasamanos, fuera del reparto. No es un paso de la
                        cascada sino un control: tiene que dar cero. */}
                    <Linea label="Flete facturado" value={pasamanos.facturado} />
                    <Linea label="Pagado al fletero" value={pasamanos.costo} signo="−" />
                    <Linea
                      label="Lo paga el cliente"
                      hint={
                        pasamanos.cuadra
                          ? 'Entra y sale lo mismo: no toca la parte de nadie'
                          : 'Debería dar cero — hay algo mal cargado'
                      }
                      value={pasamanos.descalce}
                      strong
                    />

                    {directos.length > 0 && (
                      <>
                        <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-steel-400">
                          Lo bancan socios puntuales
                        </p>
                        {directos.map((tipo) => (
                          <Linea
                            key={tipo.clave}
                            label={tipo.nombre}
                            hint={
                              tipo.pagadores.length > 0
                                ? `${listaDe(tipo.pagadores)}, mitades`
                                : 'Sin socios asignados'
                            }
                            value={tipo.monto}
                            signo="−"
                          />
                        ))}
                      </>
                    )}

                    {delPozo.length > 0 && (
                      <>
                        <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-steel-400">
                          Los paga el pozo
                        </p>
                        {delPozo.map((tipo) => (
                          <Linea
                            key={tipo.clave}
                            label={tipo.nombre}
                            hint={
                              tipo.pagadores.length > 0
                                ? `Si no alcanza, ${listaDe(tipo.pagadores)}`
                                : 'Sin socios asignados'
                            }
                            value={tipo.monto}
                            signo="−"
                          />
                        ))}
                      </>
                    )}

                    <Linea
                      label="Ganancia neta"
                      hint="El resultado del mes con todo descontado"
                      value={ganancia}
                      strong
                    />
                  </div>
                  <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                    Cuenta como venta todo pedido confirmado en adelante, por su
                    fecha; los presupuestos y los anulados no entran. El flete no
                    entra en la base porque no lo paga ninguno de ustedes: se
                    cotiza, se factura y se le paga al fletero. Esta es la cuenta
                    de la empresa: cuánto quedó. De quién sale cada peso es la
                    cuenta de al lado, y no da lo mismo.
                  </p>
                </Card>

                <Card
                  title="La cuenta de cada uno"
                  actions={
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1.5 text-xs"
                      onClick={() => setEditing({})}
                    >
                      Nueva parte
                    </Button>
                  }
                >
                  {!reparto.cuadra && (
                    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                      Los porcentajes suman {reparto.total.toFixed(3)}%, no 100.
                      {reparto.total < 100
                        ? ` Quedan ${formatPesos(reparto.sinAsignar)} sin asignar.`
                        : ' Se está repartiendo más de lo que hay.'}
                    </div>
                  )}

                  {pozo.faltante > 0.01 && (
                    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
                      <strong>
                        Al pozo le faltaron {formatPesos(pozo.faltante)}.
                      </strong>{' '}
                      Entre lo acumulado y el {pozo.tasa}% de este mes juntaba{' '}
                      {formatPesos(pozo.disponible)}, y los gastos fueron{' '}
                      {formatPesos(pozo.gastos)}. Esa diferencia la ponen, en
                      mitades, los socios asignados a cada tipo de gasto, y ya está
                      descontada abajo.
                    </div>
                  )}

                  <Table
                    head={
                      <>
                        <Th>Parte</Th>
                        <Th align="right">Su %</Th>
                        <Th align="right">Le toca</Th>
                        <Th align="right">Liquidación</Th>
                        <Th align="right"> </Th>
                      </>
                    }
                  >
                    {reparto.partes.map((parte) => (
                      <tr key={parte.id} className="align-top hover:bg-steel-50">
                        <Td className="font-medium text-steel-700">
                          {parte.nombre}
                          {parte.es_reinversion && (
                            <span className="ml-2">
                              <Badge tone="info">pozo</Badge>
                            </span>
                          )}
                        </Td>
                        <Td align="right" className="tabular-nums text-steel-500">
                          {parte.porcentaje}%
                        </Td>
                        <Td align="right">
                          <Money
                            value={parte.monto}
                            className={`font-semibold ${
                              parte.monto < 0 ? 'text-red-600' : 'text-steel-800'
                            }`}
                          />
                          {/* De dónde salió ese número. Sin esto, un socio ve
                              un monto más chico que su porcentaje y no tiene
                              cómo saber qué se le descontó. */}
                          {parte.cargos.length > 0 && (
                            <span className="mt-1 block space-y-0.5 text-xs font-normal text-steel-400">
                              <span className="block">
                                {formatPesos(parte.bruto)} de su {parte.porcentaje}%
                              </span>
                              {parte.cargos.map((cargo, i) => (
                                <span key={i} className="block">
                                  {cargo.monto >= 0 ? '−' : '+'}{' '}
                                  {formatPesos(Math.abs(cargo.monto))} {cargo.concepto}
                                </span>
                              ))}
                            </span>
                          )}
                        </Td>
                        <Td align="right">
                          {/* La reinversión no se le paga a nadie: su parte es
                              el pozo, y el pozo ya está invertido. */}
                          {parte.es_reinversion ? (
                            <span className="text-xs text-steel-300">va al pozo</span>
                          ) : (
                            <Liquidacion
                              leToca={parte.monto}
                              pagos={pagosDe(parte.id)}
                              onLiquidar={() =>
                                liquidarTodo(
                                  parte,
                                  parte.monto - sumarPagos(pagosDe(parte.id)),
                                )
                              }
                              onAbrir={() =>
                                setLiquidando({ parte, leToca: parte.monto })
                              }
                            />
                          )}
                        </Td>
                        <Td align="right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              onClick={() => setEditing(parte)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2 py-1 text-xs"
                              onClick={() => remove(parte)}
                            >
                              Borrar
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </Table>

                  {/* La pregunta que se hace a fin de mes no es cuánto le toca a
                      cada uno sino si ya se le pagó. Sin esta línea hay que ir
                      fila por fila para contestarla. */}
                  {(() => {
                    const aPagar = reparto.socios.reduce(
                      (sum, parte) => sum + parte.monto,
                      0,
                    )
                    const pagado = sumarPagos(listaPagos)
                    const saldado = Math.abs(aPagar - pagado) < 0.01 && aPagar !== 0

                    return (
                      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-steel-100 px-4 py-2.5 text-xs">
                        <span className="text-steel-500">
                          Liquidado de este mes
                          {saldado && (
                            <span className="ml-2 font-semibold text-secondary-600">
                              todo pagado
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums">
                          <Money value={pagado} className="font-semibold text-steel-800" />
                          <span className="text-steel-400"> de </span>
                          <Money value={aPagar} className="text-steel-500" />
                        </span>
                      </div>
                    )
                  })()}

                  {/* El pozo. No es plata guardada esperando el mes que viene:
                      es plata que ya está invertida y se acumula. */}
                  <div className="border-t border-steel-200 bg-steel-50 px-4 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-steel-500">
                      El pozo de reinversión
                    </p>
                    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                      <div className="flex justify-between gap-3">
                        <dt className="text-steel-500">Venía acumulado</dt>
                        <dd className="tabular-nums text-steel-700">
                          {formatPesos(pozo.entrante)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-steel-500">Aporte del mes ({pozo.tasa}%)</dt>
                        <dd className="tabular-nums text-steel-700">
                          {formatPesos(pozo.aporte)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-steel-500">Invertido este mes</dt>
                        <dd className="tabular-nums text-steel-700">
                          −{formatPesos(pozo.cubierto)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 font-semibold">
                        <dt className="text-steel-600">Queda en el pozo</dt>
                        <dd className="tabular-nums text-steel-800">
                          {formatPesos(pozo.saliente)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* La señal de que hay que invertir más. Un pozo grande no
                      dice nada por sí solo; dice algo medido contra lo que se
                      está gastando por mes. */}
                  {peso && peso.meses >= 2 && (
                    <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                      <strong>
                        El pozo equivale a {peso.meses.toFixed(1)} meses de
                        reinversión al ritmo actual
                      </strong>{' '}
                      ({formatPesos(peso.promedio)} por mes). Esa plata ya es de la
                      empresa y está para usarse: si sigue creciendo, lo que
                      corresponde es invertir más fuerte —más pauta, más
                      muestras— y no dejarla quieta.
                    </div>
                  )}

                  <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                    Cada uno cobra su porcentaje sobre el valor del producto
                    vendido, y de ahí se le descuentan sólo los costos que él
                    banca. El pozo no se le paga a nadie y no vence: es plata que
                    ya se está invirtiendo, y se acumula hasta que se decida
                    invertir más.
                  </p>
                </Card>
              </div>

              {/*
                El otro lado de la pauta. Arriba se ve cuánto se gastó en
                publicidad; acá, qué trajo cada canal. Sin esto la pauta es un
                gasto que baja la ganancia sin que nada diga si sirvió.
              */}
              <Card
                title="De dónde vinieron los contactos"
                className="mt-6"
                actions={
                  Number(datos.costo_pauta) > 0 && (
                    <span className="text-xs text-steel-500">
                      Pauta del mes:{' '}
                      <span className="font-semibold text-steel-700">
                        {formatPesos(datos.costo_pauta)}
                      </span>
                    </span>
                  )
                }
              >
                <Async query={origenes} empty="No entró ningún contacto este mes.">
                  {(filas) => (
                    <Table
                      head={
                        <>
                          <Th>Canal</Th>
                          <Th align="right">Contactos</Th>
                          <Th align="right">Ganados</Th>
                          <Th align="right">Cierre</Th>
                          <Th align="right">Facturado</Th>
                        </>
                      }
                    >
                      {filas.map((fila) => {
                        /* Sin contactos no hay tasa de cierre que calcular, y
                           dividir por cero pintaría un NaN en pantalla. */
                        const cierre = fila.leads > 0 ? (fila.ganados / fila.leads) * 100 : null

                        return (
                          <tr key={fila.origen} className="hover:bg-steel-50">
                            <Td className="font-medium text-steel-700">
                              {LEAD_SOURCE_LABELS[fila.origen] ?? fila.origen}
                            </Td>
                            <Td align="right" className="tabular-nums text-steel-600">
                              {formatNumber(fila.leads)}
                              {fila.sin_contactar > 0 && (
                                <span className="block text-xs text-amber-600">
                                  {fila.sin_contactar} sin llamar
                                </span>
                              )}
                            </Td>
                            <Td align="right" className="tabular-nums text-steel-600">
                              {formatNumber(fila.ganados)}
                            </Td>
                            <Td align="right" className="tabular-nums text-steel-500">
                              {cierre === null ? '—' : `${cierre.toFixed(0)}%`}
                            </Td>
                            <Td align="right">
                              <Money
                                value={fila.facturado}
                                className="font-semibold text-steel-800"
                              />
                            </Td>
                          </tr>
                        )
                      })}
                    </Table>
                  )}
                </Async>

                <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                  La venta se cuenta en el mes del contacto y no en el del
                  pedido: lo que se mide es la captación, y al que preguntó en
                  septiembre lo trajo la plata gastada en septiembre. A cada
                  cliente se le atribuye un solo lead, el primero que lo trajo; un
                  cliente cargado a mano, sin ningún lead detrás, no suma en
                  ningún canal.
                </p>
              </Card>

              {/*
                La cuenta de cada socio a lo largo de todo el historial. Las dos
                pantallas de arriba miran un mes; ésta contesta la pregunta que
                no se puede responder mes por mes: cuánto le tocó en total,
                cuánto cobró y qué falta.
              */}
              <Card title="Cuenta corriente de cada socio" className="mt-6">
                {listaCuentas.length === 0 ? (
                  <Empty>Todavía no hay ningún reparto para liquidar.</Empty>
                ) : (
                  <>
                    <Table
                      head={
                        <>
                          <Th>Socio</Th>
                          <Th align="right">Le tocó</Th>
                          <Th align="right">Cobró</Th>
                          <Th align="right">Saldo</Th>
                        </>
                      }
                    >
                      {listaCuentas.map((cuenta) => {
                        const saldo = cuenta.leToca - cuenta.pagado
                        const saldado = Math.abs(saldo) < 0.01

                        return (
                          <tr key={cuenta.id} className="hover:bg-steel-50">
                            <Td className="font-medium text-steel-700">
                              {cuenta.nombre}
                              <span className="block text-xs font-normal text-steel-400">
                                {cuenta.meses.length}{' '}
                                {cuenta.meses.length === 1 ? 'mes' : 'meses'}
                              </span>
                            </Td>
                            <Td align="right">
                              <Money value={cuenta.leToca} className="text-steel-600" />
                            </Td>
                            <Td align="right">
                              <Money value={cuenta.pagado} className="text-steel-600" />
                            </Td>
                            <Td align="right">
                              {saldado ? (
                                <span className="text-xs font-semibold text-secondary-600">
                                  al día
                                </span>
                              ) : (
                                <Money
                                  value={saldo}
                                  className={`font-semibold ${
                                    saldo > 0 ? 'text-amber-600' : 'text-red-600'
                                  }`}
                                />
                              )}
                            </Td>
                          </tr>
                        )
                      })}
                    </Table>

                    <details className="border-t border-steel-100">
                      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-steel-500 hover:bg-steel-50">
                        Ver mes por mes
                      </summary>
                      <Table
                        head={
                          <>
                            <Th>Mes</Th>
                            <Th>Socio</Th>
                            <Th align="right">Le tocó</Th>
                            <Th align="right">Cobró</Th>
                          </>
                        }
                      >
                        {listaCuentas
                          .flatMap((cuenta) =>
                            cuenta.meses.map((fila) => ({ ...fila, cuenta })),
                          )
                          /* Del mes más nuevo al más viejo, que es como se
                             revisa una cuenta corriente. */
                          .sort((a, b) => b.mes.localeCompare(a.mes))
                          .map((fila) => {
                            const cobrado = todosLosPagos
                              .filter(
                                (p) =>
                                  p.share_id === fila.cuenta.id &&
                                  p.tipo === 'reparto' &&
                                  String(p.mes).slice(0, 7) === fila.mes,
                              )
                              .reduce((sum, p) => sum + Number(p.monto), 0)

                            return (
                              <tr
                                key={`${fila.cuenta.id}-${fila.mes}`}
                                onClick={() => setMes(fila.mes)}
                                className={`cursor-pointer hover:bg-steel-50 ${
                                  fila.mes === mes ? 'bg-secondary-50' : ''
                                }`}
                              >
                                <Td className="whitespace-nowrap capitalize text-steel-600">
                                  {formatMonth(fila.mes)}
                                </Td>
                                <Td className="text-steel-700">{fila.cuenta.nombre}</Td>
                                <Td align="right">
                                  <Money value={fila.monto} className="text-steel-600" />
                                </Td>
                                <Td align="right">
                                  <Money
                                    value={cobrado}
                                    className={
                                      Math.abs(cobrado - fila.monto) < 0.01
                                        ? 'text-secondary-600'
                                        : 'font-semibold text-amber-600'
                                    }
                                  />
                                </Td>
                              </tr>
                            )
                          })}
                      </Table>
                    </details>
                  </>
                )}

                {montoPozoViejo > 0 && (
                  <div className="border-t border-steel-200 bg-steel-50 px-4 py-3 text-xs leading-relaxed text-steel-500">
                    En «cobró» hay {formatPesos(montoPozoViejo)} de liquidaciones
                    del pozo hechas bajo la regla vieja, cuando lo que no se usaba
                    en dos meses vencía y volvía al socio minoritario. Esa regla ya
                    no existe —el pozo se acumula como inversión— pero esos pagos
                    se hicieron y por eso siguen contados.
                  </div>
                )}

                <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                  «Le tocó» se recalcula siempre con los datos de hoy; «cobró» es
                  lo que quedó registrado al pagar. Si un saldo aparece donde no
                  debería, suele ser que se corrigió un gasto de un mes ya
                  liquidado: la diferencia se ve acá en vez de perderse.
                </p>
              </Card>

              <Card title="Los últimos meses" className="mt-6">
                {meses.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-steel-400">
                    Todavía no hay ningún mes con ventas ni gastos.
                  </p>
                ) : (
                  <Table
                    head={
                      <>
                        <Th>Mes</Th>
                        <Th align="right">Pedidos</Th>
                        <Th align="right">Facturado</Th>
                        <Th align="right">Costos</Th>
                        <Th align="right">Ganancia</Th>
                        <Th align="right">Pozo</Th>
                      </>
                    }
                  >
                    {meses.map((row) => {
                      const suyo = String(row.mes).slice(0, 7)
                      return (
                        <tr
                          key={row.mes}
                          onClick={() => setMes(suyo)}
                          className={`cursor-pointer hover:bg-steel-50 ${
                            suyo === mes ? 'bg-secondary-50' : ''
                          }`}
                        >
                          <Td className="whitespace-nowrap font-medium capitalize text-steel-700">
                            {formatMonth(row.mes)}
                          </Td>
                          <Td align="right" className="tabular-nums text-steel-500">
                            {row.pedidos}
                          </Td>
                          <Td align="right">
                            <Money value={row.facturado} className="text-steel-600" />
                          </Td>
                          <Td align="right">
                            <Money value={row.costos} className="text-steel-500" />
                          </Td>
                          <Td align="right">
                            <Money
                              value={row.ganancia_neta}
                              className={`font-semibold ${
                                Number(row.ganancia_neta) >= 0
                                  ? 'text-steel-800'
                                  : 'text-red-600'
                              }`}
                            />
                          </Td>
                          {/* Cómo venía creciendo el pozo mes a mes: es lo que
                              deja ver que se está acumulando sin usarse. */}
                          <Td align="right">
                            <Money
                              value={cadena.get(suyo)?.pozo.saliente ?? 0}
                              className="text-steel-500"
                            />
                          </Td>
                        </tr>
                      )
                    })}
                  </Table>
                )}
              </Card>
            </>
          )
        }}
      </Async>

      {editing && (
        <ShareModal
          share={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.reload()
          }}
        />
      )}

      {liquidando && (
        <PayoutModal
          parte={liquidando.parte}
          leToca={liquidando.leToca}
          /* Se leen de la lista viva y no de lo que había al abrir: si se borra
             un pago desde el mismo diálogo, el saldo tiene que moverse ahí. */
          pagos={(pagos.data ?? []).filter(
            (p) =>
              p.share_id === liquidando.parte.id &&
              p.tipo === 'reparto' &&
              String(p.mes).slice(0, 7) === mes,
          )}
          onClose={() => setLiquidando(null)}
          onRegistrar={registrarPago(liquidando.parte)}
          onBorrar={deshacerPago}
        />
      )}
    </>
  )
}
