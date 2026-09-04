/**
 * Cuánto ganó la empresa en el mes y cómo se reparte.
 *
 * Es la única pantalla que junta las dos mitades: lo que entró por ventas y lo
 * que salió por costos y comisiones. Ninguno de los dos números se carga acá
 * —salen de Pedidos y de Costos— justamente para que el resultado no se pueda
 * "arreglar" escribiéndolo a mano.
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
  runReserve,
  splitProfit,
  updateShare,
} from '../api/profit'
import { LEAD_ORIGIN_LABELS, listLeadsByOrigin } from '../api/leads'
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
  flete_facturado: 0,
  facturado: 0,
  cobrado: 0,
  comisiones: 0,
  varillas_producidas: 0,
  costo_produccion: 0,
  costo_produccion_cargado: 0,
  costo_flete: 0,
  costo_pauta: 0,
  costo_muestras: 0,
  costo_suscripciones: 0,
  costo_otros: 0,
  costos_operativos: 0,
  costos_reinversion: 0,
  costos: 0,
  ganancia_base: 0,
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

  /* Nada que liquidar no es lo mismo que pendiente: un mes sin ganancia no le
     debe nada a nadie y ofrecer el botón sería invitar a registrar un cero. */
  if (Math.abs(Number(leToca)) < 0.01 && pagos.length === 0) {
    return <span className="text-xs text-steel-300">—</span>
  }

  const saldado = Math.abs(falta) < 0.01

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
function PayoutModal({ parte, tipo, leToca, pagos, onClose, onRegistrar, onBorrar }) {
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
    <Modal
      title={`Liquidar a ${parte.nombre}${tipo === 'pozo' ? ' · pozo vencido' : ''}`}
      onClose={onClose}
    >
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
        <Field label="Porcentaje" hint="Entre todas las partes tienen que sumar 100.">
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

  const query = useAsync(
    async () => {
      const [meses, shares] = await Promise.all([listMonths(), listShares()])
      return { meses, shares }
    },
    [],
  )

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
  const liquidarTodo = async (share, tipo, monto) => {
    setError('')
    try {
      await createPayout({ share_id: share.id, mes, tipo, monto })
      pagos.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  /* El alta desde el diálogo, con monto libre. El error lo muestra el propio
     diálogo, así que acá se deja propagar. */
  const registrarPago = (share, tipo) => async (valores) => {
    await createPayout({ share_id: share.id, mes, tipo, ...valores })
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
        description={`El resultado de ${formatMonth(mes)} y cómo se reparte.`}
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
        {({ meses, shares }) => {
          const fila = meses.find((row) => String(row.mes).slice(0, 7) === mes)
          const datos = fila ?? MES_VACIO
          const ganancia = Number(datos.ganancia_neta)
          const aRepartir = Number(datos.ganancia_base)

          /* El pozo de reinversión se arrastra de un mes al otro, así que el
             reparto de este mes depende de los anteriores: hay que recorrer la
             cadena entera y después buscar el mes que se está mirando. */
          const cadena = runReserve(meses, shares)
          const reparto = cadena.get(mes) ?? splitProfit(0, 0, shares, 0)
          const pozo = reparto.reinversion

          const todosLosPagos = pagos.data ?? []
          const listaPagos = todosLosPagos.filter(
            (p) => String(p.mes).slice(0, 7) === mes,
          )
          const pagosDe = (shareId, tipo) =>
            listaPagos.filter((p) => p.share_id === shareId && p.tipo === tipo)

          /*
            La cuenta de cada socio a lo largo de todos los meses: cuánto le
            tocó en total, cuánto cobró y qué saldo queda. Se arma recorriendo
            la cadena completa —que ya está calculada— y cruzándola con los
            pagos. Es la pregunta que no se podía contestar mirando un mes por
            vez: "¿cuánto le debo a Pipo?".
          */
          const cuentas = new Map()
          const cuentaDe = (share) => {
            if (!cuentas.has(share.id)) {
              cuentas.set(share.id, {
                id: share.id,
                nombre: share.nombre,
                leToca: 0,
                pagado: 0,
                meses: [],
              })
            }
            return cuentas.get(share.id)
          }

          for (const [mesKey, rep] of cadena) {
            for (const parte of rep.partes) {
              /* La reinversión no tiene cuenta: su parte no se le paga a nadie. */
              if (parte.es_reinversion || Math.abs(parte.monto) < 0.01) continue
              const cuenta = cuentaDe(parte)
              cuenta.leToca += parte.monto
              cuenta.meses.push({ mes: mesKey, tipo: 'reparto', monto: parte.monto })
            }
            for (const socio of rep.liquidacion) {
              if (Math.abs(socio.monto) < 0.01) continue
              const cuenta = cuentaDe(socio)
              cuenta.leToca += socio.monto
              cuenta.meses.push({ mes: mesKey, tipo: 'pozo', monto: socio.monto })
            }
          }

          for (const pago of todosLosPagos) {
            const cuenta = cuentas.get(pago.share_id)
            /* Un pago de una parte que ya no figura en el reparto —se borró, o
               el mes quedó sin datos— igual tiene que sumar: la plata salió. */
            if (cuenta) cuenta.pagado += Number(pago.monto)
          }

          const listaCuentas = [...cuentas.values()].sort((a, b) => b.leToca - a.leToca)

          /* El margen sobre lo facturado: el número que dice si el mes fue
             bueno más allá de cuánto se vendió. Sin ventas no hay margen que
             calcular, y dividir por cero daría un infinito en pantalla. */
          const facturado = Number(datos.facturado)
          const margen = facturado > 0 ? (ganancia / facturado) * 100 : null

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
                <Stat label="Costos" value={<Money value={datos.costos} />} tone="warn" />
                <Stat label="Comisiones" value={<Money value={datos.comisiones} />} tone="warn" />
                <Stat
                  label="Ganancia neta"
                  value={<Money value={ganancia} />}
                  tone={ganancia >= 0 ? 'good' : 'warn'}
                  hint={
                    margen === null
                      ? 'Sin ventas en el mes'
                      : `${margen.toFixed(1)}% de lo facturado · a repartir ${formatPesos(aRepartir)}`
                  }
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Cómo se llegó a ese número">
                  <div className="py-1">
                    <Linea label="Mercadería" value={datos.mercaderia} />
                    <Linea label="Flete facturado" value={datos.flete_facturado} />
                    <Linea label="Facturado" value={datos.facturado} strong />

                    <Linea label="Comisiones" value={datos.comisiones} signo="−" />
                    <Linea
                      label="Producción"
                      hint={
                        datos.varillas_producidas > 0
                          ? `${formatNumber(datos.varillas_producidas)} varillas fabricadas`
                          : 'Sale del costo de cada varilla al cargarla en Stock'
                      }
                      value={datos.costo_produccion}
                      signo="−"
                    />
                    <Linea label="Flete bonificado" value={datos.costo_flete} signo="−" />

                    <Linea
                      label="Ganancia a repartir"
                      hint="Sobre esto se calculan los porcentajes"
                      value={aRepartir}
                      strong
                    />

                    {/* Los gastos de reinversión van después de la línea del
                        reparto porque no los paga la empresa: los paga la parte
                        de reinversión. Restarlos arriba haría que los socios
                        los pagaran dos veces. */}
                    <Linea label="Pauta" value={datos.costo_pauta} signo="−" />
                    <Linea label="Muestras" value={datos.costo_muestras} signo="−" />
                    <Linea label="Suscripciones" value={datos.costo_suscripciones} signo="−" />
                    <Linea label="Otros" value={datos.costo_otros} signo="−" />

                    <Linea
                      label="Ganancia neta"
                      hint="El resultado del mes con todo descontado"
                      value={ganancia}
                      strong
                    />
                  </div>
                  <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                    Cuenta como venta todo pedido confirmado en adelante, por su
                    fecha. Los presupuestos y los anulados no entran. Los cuatro
                    gastos de abajo los paga la parte de reinversión, no la
                    empresa: por eso quedan fuera de lo que se reparte.
                  </p>
                </Card>

                <Card
                  title="Reparto"
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

                  {pozo.escalo && (
                    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
                      <strong>
                        La reinversión subió del {pozo.base}% al {pozo.tasa}%.
                      </strong>{' '}
                      Entre la reserva del mes anterior y su {pozo.base}% juntaba{' '}
                      {formatPesos(pozo.reservaEntrante + (aRepartir * pozo.base) / 100)}, y los
                      gastos fueron {formatPesos(pozo.gastos)}. Los puntos que subió
                      salen de los socios, a cada uno en proporción a su parte.
                    </div>
                  )}

                  {pozo.faltante > 0 && (
                    <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700">
                      <strong>
                        Ni con el {pozo.tasa}% y la reserva alcanza: faltan{' '}
                        {formatPesos(pozo.faltante)}.
                      </strong>{' '}
                      Los montos de abajo reparten la ganancia igual, así que ese
                      hueco todavía no tiene de dónde salir.
                    </div>
                  )}

                  <Table
                    head={
                      <>
                        <Th>Parte</Th>
                        <Th align="right">%</Th>
                        <Th align="right">Le toca</Th>
                        <Th align="right">Liquidación</Th>
                        <Th align="right"> </Th>
                      </>
                    }
                  >
                    {reparto.partes.map((parte) => {
                      const movido = Math.abs(parte.aplicado - Number(parte.porcentaje)) > 0.001

                      return (
                        <tr key={parte.id} className="hover:bg-steel-50">
                          <Td className="font-medium text-steel-700">
                            {parte.nombre}
                            {parte.es_reinversion && (
                              <span className="ml-2">
                                <Badge tone="info">pozo con destino</Badge>
                              </span>
                            )}
                          </Td>
                          <Td align="right" className="tabular-nums text-steel-500">
                            {parte.aplicado.toFixed(2).replace(/\.?0+$/, '')}%
                            {/* Cuando la escalera movió el porcentaje se muestra
                                de dónde salió, para que el número no aparezca
                                cambiado sin explicación. */}
                            {movido && (
                              <span className="block text-xs text-steel-300">
                                base {Number(parte.porcentaje)}%
                              </span>
                            )}
                          </Td>
                          <Td align="right">
                            <Money value={parte.monto} className="font-semibold text-steel-800" />
                            {parte.es_reinversion && pozo.reservaEntrante > 0 && (
                              <span className="block text-xs text-steel-400">
                                + {formatPesos(pozo.reservaEntrante)} de reserva
                              </span>
                            )}
                          </Td>
                          <Td align="right">
                            {/* La reinversión no se le paga a nadie: su parte
                                es el pozo, y lo que se liquida de ahí sale más
                                abajo cuando vence. */}
                            {parte.es_reinversion ? (
                              <span className="text-xs text-steel-300">va al pozo</span>
                            ) : (
                              <Liquidacion
                                leToca={parte.monto}
                                pagos={pagosDe(parte.id, 'reparto')}
                                onLiquidar={() =>
                                  liquidarTodo(
                                    parte,
                                    'reparto',
                                    parte.monto - sumarPagos(pagosDe(parte.id, 'reparto')),
                                  )
                                }
                                onAbrir={() =>
                                  setLiquidando({
                                    parte,
                                    tipo: 'reparto',
                                    leToca: parte.monto,
                                  })
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
                      )
                    })}
                  </Table>

                  {/* La pregunta que se hace a fin de mes no es cuánto le toca a
                      cada uno sino si ya se le pagó. Sin esta línea hay que ir
                      fila por fila para contestarla. */}
                  {(() => {
                    const aPagar =
                      reparto.partes
                        .filter((parte) => !parte.es_reinversion)
                        .reduce((sum, parte) => sum + parte.monto, 0) +
                      reparto.liquidacion.reduce((sum, socio) => sum + socio.monto, 0)
                    const pagado = listaPagos.reduce((sum, pago) => sum + Number(pago.monto), 0)
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

                  {/* El pozo de reinversión mes a mes: qué entró de reserva, qué
                      se juntó, qué se gastó y qué queda. Es la plata que más
                      fácil se vuelve invisible, porque no es de nadie hasta que
                      vence. */}
                  <div className="border-t border-steel-200 bg-steel-50 px-4 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-steel-500">
                      El pozo de reinversión
                    </p>
                    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                      <div className="flex justify-between gap-3">
                        <dt className="text-steel-500">Reserva del mes anterior</dt>
                        <dd className="tabular-nums text-steel-700">
                          {formatPesos(pozo.reservaEntrante)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-steel-500">Aporte de este mes ({pozo.tasa}%)</dt>
                        <dd className="tabular-nums text-steel-700">{formatPesos(pozo.fondo)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-steel-500">Gastado</dt>
                        <dd className="tabular-nums text-steel-700">−{formatPesos(pozo.gastos)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 font-semibold">
                        <dt className="text-steel-600">Queda para el mes que viene</dt>
                        <dd className="tabular-nums text-steel-800">
                          {formatPesos(pozo.reservaSaliente)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {pozo.vencido > 0 && (
                    <div className="border-t border-secondary-200 bg-secondary-50 px-4 py-3">
                      <p className="text-xs leading-relaxed text-secondary-800">
                        <strong>
                          Se liquidan {formatPesos(pozo.vencido)} del pozo.
                        </strong>{' '}
                        Esa plata venía de la reserva del mes anterior y tampoco se
                        usó este mes, así que dejó de ser reserva. Vuelve entera{' '}
                        <strong>al socio minoritario</strong>, que es quien resignó
                        esos cinco puntos para financiar la reinversión.
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {reparto.liquidacion.map((socio) => (
                          <li
                            key={socio.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs"
                          >
                            <span className="text-secondary-800">
                              {socio.nombre}{' '}
                              <span className="text-secondary-600">
                                ({socio.fraccion.toFixed(2)}%)
                              </span>
                            </span>
                            <span className="flex items-baseline gap-3">
                              <Money
                                value={socio.monto}
                                className="font-semibold text-secondary-900"
                              />
                              <Liquidacion
                                leToca={socio.monto}
                                pagos={pagosDe(socio.id, 'pozo')}
                                onLiquidar={() =>
                                  liquidarTodo(
                                    socio,
                                    'pozo',
                                    socio.monto - sumarPagos(pagosDe(socio.id, 'pozo')),
                                  )
                                }
                                onAbrir={() =>
                                  setLiquidando({ parte: socio, tipo: 'pozo', leToca: socio.monto })
                                }
                              />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="border-t border-steel-100 px-4 py-3 text-xs leading-relaxed text-steel-400">
                    La reinversión no es una parte que se guarda: paga la pauta,
                    las muestras y las suscripciones. Lo que sobra queda de
                    reserva para el mes siguiente y ahí se gasta primero. Si
                    sobrevive ese mes sin usarse, vuelve al socio minoritario: el
                    reparto de fondo es 50 / 25 / 25 y él resignó cinco puntos
                    para financiar el pozo, así que lo que no se usó es suyo. De
                    paso, el pozo no engorda para siempre sin que nadie decida
                    nada.
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
                              {LEAD_ORIGIN_LABELS[fila.origen] ?? fila.origen}
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
              <Card title="Cuenta de cada socio" className="mt-6">
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
                                {cuenta.meses.length === 1 ? 'liquidación' : 'liquidaciones'}
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
                            <Th>Concepto</Th>
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
                                  p.tipo === fila.tipo &&
                                  String(p.mes).slice(0, 7) === fila.mes,
                              )
                              .reduce((sum, p) => sum + Number(p.monto), 0)

                            return (
                              <tr
                                key={`${fila.cuenta.id}-${fila.mes}-${fila.tipo}`}
                                onClick={() => setMes(fila.mes)}
                                className={`cursor-pointer hover:bg-steel-50 ${
                                  fila.mes === mes ? 'bg-secondary-50' : ''
                                }`}
                              >
                                <Td className="whitespace-nowrap capitalize text-steel-600">
                                  {formatMonth(fila.mes)}
                                </Td>
                                <Td className="text-steel-700">{fila.cuenta.nombre}</Td>
                                <Td>
                                  <Badge tone={fila.tipo === 'pozo' ? 'info' : 'neutral'}>
                                    {fila.tipo === 'pozo' ? 'Pozo vencido' : 'Reparto'}
                                  </Badge>
                                </Td>
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
                        <Th align="right">Comisiones</Th>
                        <Th align="right">Ganancia</Th>
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
                            <Money value={row.comisiones} className="text-steel-500" />
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
          tipo={liquidando.tipo}
          leToca={liquidando.leToca}
          /* Se leen de la lista viva y no de lo que había al abrir: si se borra
             un pago desde el mismo diálogo, el saldo tiene que moverse ahí. */
          pagos={(pagos.data ?? []).filter(
            (p) =>
              p.share_id === liquidando.parte.id &&
              p.tipo === liquidando.tipo &&
              String(p.mes).slice(0, 7) === mes,
          )}
          onClose={() => setLiquidando(null)}
          onRegistrar={registrarPago(liquidando.parte, liquidando.tipo)}
          onBorrar={deshacerPago}
        />
      )}
    </>
  )
}
