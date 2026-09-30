/**
 * El presupuesto que se le manda al cliente, armado desde el pedido.
 *
 * Reemplaza al HTML suelto de `docs/presupuesto_recu_varilla.html`. La
 * diferencia de fondo no es que esté adentro del ERP: es que ahí los datos se
 * tipeaban de nuevo cada vez y el papel era todo lo que quedaba. Acá el
 * presupuesto *es* el pedido —ya está guardado contra su cliente, con su número
 * y su historia— y esta pantalla es sólo cómo se ve cuando sale impreso.
 *
 * Por eso también puede listar varias líneas: aquel formulario tenía una sola
 * varilla más el agujereado, y un pedido de 600 comunes y 600 agujereadas no
 * entraba. Acá salen los ítems que tenga el pedido.
 *
 * También puede salir en dólares, para el cliente que lo pide así. Lo que se
 * convierte es sólo este papel: el pedido, los cobros y la cuenta corriente
 * siguen en pesos, que es la moneda en la que se cobra. Del asunto se guarda a
 * qué cotización se convirtió, porque es lo que hace falta para volver a sacar
 * el mismo PDF y para saber qué se prometió cuando el cliente conteste.
 *
 * La hoja es la del manual de marca, igual que la lista de precios y el
 * folleto: logo principal arriba, el cliente en Archivo condensada, importes
 * en Chivo Mono y la varilla cerrando el pie. Lo mira el cliente, y tiene que
 * parecerse a todo lo demás que recibe de Recuvarilla.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrder, updateOrder } from '../api/orders'
import { listSellers } from '../api/sellers'
import { useAsync } from '../lib/useAsync'
import { formatDate } from '../lib/format'
import { QUOTE_VALID_DAYS } from '../../data/pricing'
import { nombreDeItem } from '../lib/items'
import { contactoDe } from '../lib/documentos'
import {
  MONEDA_LABELS,
  MONEDAS,
  enMoneda,
  formatMoneda,
  loadCotizaciones,
  redondear,
} from '../lib/cotizacion'
import { Async, Button, ErrorNote } from '../components/ui'
import { LogoHoja } from '../components/DocSheet'

const IVA = 0.21

/* Los controles de arriba son de pantalla, no del papel: se ven todos igual. */
const CONTROL =
  'rounded-md border border-grafito-200 bg-white px-3 py-2 text-sm text-grafito-800 focus:border-celeste-700 focus:outline-none'

/**
 * La validez, contada desde la fecha del pedido. Son los mismos días que
 * promete la web y la lista de precios: salen de `QUOTE_VALID_DAYS`.
 */
function validoHasta(fecha) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha ?? ''))
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setDate(date.getDate() + QUOTE_VALID_DAYS)
  return date
}

/**
 * El nombre con el que el navegador propone guardar el PDF.
 *
 * Al imprimir a PDF, el nombre por defecto sale de `document.title`, así que se
 * cambia un momento y se repone al terminar. Es el mismo truco del HTML viejo,
 * y vale la pena: un archivo llamado "Presupuesto-Recuvarilla-Perez-02-09-2026"
 * se encuentra seis meses después.
 */
function nombreArchivo(order) {
  const cliente = String(order.cliente_nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .replace(/\s+/g, '-')

  const partes = ['Presupuesto-Recuvarilla']
  if (cliente) partes.push(cliente)
  partes.push(`N${order.numero}`)
  return partes.join('-')
}

const ESTILOS = `
  /*
    El presupuesto del manual de marca: la base es la de todos los papeles
    (\`documentos.css\`, clase \`hm\`), y acá va lo propio de este documento.
  */
  .presupuesto .hoja { max-width: 800px; }
  .presupuesto .encabezado {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    padding-bottom: 22px;
    margin-bottom: 26px;
    border-bottom: 1.5px solid var(--grafito);
  }
  .presupuesto .marca p { margin: 10px 0 0; font-size: 13px; color: var(--gris); }
  .presupuesto .doc-info { text-align: right; white-space: nowrap; margin: 0; }
  .presupuesto .doc-info .tag {
    display: inline-block;
    font-family: "Chivo Mono", monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #fff;
    background: var(--grafito);
    padding: 4px 9px;
    border-radius: 3px;
    margin-bottom: 4px;
  }
  .presupuesto .doc-info dt,
  .presupuesto .cliente dt,
  .presupuesto .notas h2 {
    font-family: "Chivo Mono", monospace;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gris);
  }
  .presupuesto .doc-info dt { margin-top: 6px; }
  .presupuesto .doc-info dd { margin: 1px 0 0; font-family: "Chivo Mono", monospace; font-size: 14px; font-weight: 500; }
  .presupuesto .cliente { margin: 0 0 24px; }
  .presupuesto .cliente dt { margin-bottom: 3px; }
  .presupuesto .cliente dd {
    margin: 0;
    font-weight: 800;
    font-stretch: 75%;
    font-size: 30px;
    line-height: 1;
    color: var(--grafito);
  }
  .presupuesto .cliente .destino {
    font-size: 15px;
    font-weight: 400;
    font-stretch: 100%;
    color: var(--gris);
  }
  .presupuesto table { font-size: 14px; }
  .presupuesto th {
    font-family: "Chivo Mono", monospace;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--gris);
    text-align: left;
    padding: 8px 8px 7px 0;
    border-bottom: 1.5px solid var(--grafito);
  }
  .presupuesto td { padding: 10px 8px 10px 0; border-bottom: 1px solid var(--linea); }
  .presupuesto td.desc { font-weight: 700; }
  .presupuesto .num { text-align: right; font-family: "Chivo Mono", monospace; font-weight: 500; white-space: nowrap; }
  .presupuesto .totales { margin: 18px 0 0 auto; width: 340px; }
  .presupuesto .fila {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px solid var(--linea);
    font-size: 14px;
  }
  .presupuesto .fila .val { font-family: "Chivo Mono", monospace; font-weight: 500; white-space: nowrap; }
  .presupuesto .fila.grande {
    border-bottom: none;
    border-top: 3px solid var(--grafito);
    margin-top: 6px;
    padding-top: 12px;
    font-size: 20px;
    font-weight: 800;
  }
  .presupuesto .fila.grande .val { font-size: 22px; font-weight: 600; }
  .presupuesto .notas { margin-top: 30px; font-size: 12.5px; }
  .presupuesto .notas h2 { margin: 0 0 6px; }
  .presupuesto .notas .cuerpo {
    color: var(--grafito);
    line-height: 1.6;
    outline-offset: 3px;
  }
  .presupuesto .notas .cuerpo:focus { outline: 1px dashed var(--alambre); }
  .presupuesto .notas .contacto {
    margin: 16px 0 0;
    padding-top: 12px;
    border-top: 0;
    font-family: "Chivo Mono", monospace;
    font-size: 12.5px;
    color: var(--grafito);
  }
  .presupuesto .notas .contacto strong { font-family: "Archivo Variable", Arial, sans-serif; }
  .presupuesto .notas .varilla-pie { display: block; width: 100%; max-width: 360px; aspect-ratio: 40 / 1; margin-top: 16px;
    background: url("../../../brand/assets/sistema/varilla-separador.svg") left center / contain no-repeat; }

  @media print {
    /*
      El contenedor del ERP tiene el margen de una pantalla de trabajo y acá
      estorba: la hoja tiene que arrancar donde arranca el papel. Es una regla
      global, pero sólo existe mientras esta pantalla está montada.
    */
    main { padding: 0 !important; }
    .presupuesto .hoja {
      border: none;
      box-shadow: none;
      max-width: 100%;
      padding: 10px 20px;
    }
    .presupuesto .hoja, .presupuesto .hoja * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

const CONDICIONES_BASE = `Presupuesto válido por ${QUOTE_VALID_DAYS} días.`

export default function QuotePrint() {
  const { id } = useParams()
  const query = useAsync(() => getOrder(id), [id])
  /*
    El contacto que va al pie es el del vendedor que trajo la venta, no el de la
    empresa: es el mismo motivo por el que cada vendedor tiene su folleto. El
    cliente que llama tiene que dar con quien lo atendió, y nosotros tenemos que
    poder saber de quién era el cliente.
  */
  const sellers = useAsync(() => listSellers(), [])

  /* El dólar del día, para no tener que ir a buscarlo a otra pestaña. Es una
     propuesta: el campo se escribe igual, y si la consulta falla la pantalla
     sirve lo mismo con el número puesto a mano. */
  const cotizaciones = useAsync(() => loadCotizaciones(), [])

  const [conIva, setConIva] = useState(false)
  const [descuento, setDescuento] = useState(null)
  const [moneda, setMoneda] = useState('ARS')
  const [cotizacion, setCotizacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const order = query.data

  /* Lo que está guardado en el pedido es el punto de partida; a partir de ahí
     los campos viven en la pantalla hasta que se los guarde, para poder ver
     cómo queda el presupuesto antes de comprometerlo. */
  useEffect(() => {
    if (!order) return
    setDescuento(String(Number(order.descuento_pct ?? 0)))
    setMoneda(order.moneda ?? 'ARS')
    setCotizacion(order.cotizacion == null ? '' : String(Number(order.cotizacion)))
  }, [order])

  /*
    Al pasar a dólares sin cotización cargada se propone la del día, una sola
    vez. Que sea una sola vez es lo que hace que el campo se pueda editar: si se
    repusiera cada vez que queda vacío, borrarlo para escribir otro número lo
    volvería a llenar antes de que se termine de tipear.

    El oficial y no el blue porque es el que se puede justificar en una factura.
    El otro está a un clic.
  */
  const propuesta = useRef(false)

  useEffect(() => {
    if (moneda !== 'USD') {
      propuesta.current = false
      return
    }
    if (propuesta.current || cotizacion.trim()) return

    const oficial = cotizaciones.data?.find((item) => item.casa === 'oficial')
    if (oficial) {
      propuesta.current = true
      setCotizacion(String(oficial.valor))
    }
  }, [moneda, cotizacion, cotizaciones.data])

  const imprimir = () => {
    const titulo = document.title
    document.title = nombreArchivo(order)

    const restaurar = () => {
      document.title = titulo
      window.removeEventListener('afterprint', restaurar)
    }

    window.addEventListener('afterprint', restaurar)
    window.print()
  }

  return (
    <Async query={query}>
      {(pedido) => {
        const pct = Number(descuento)
        const pctValido = Number.isFinite(pct) && pct >= 0 && pct <= 100
        const pctUsado = pctValido ? pct : 0

        const tipo = Number(cotizacion)
        const tipoValido = cotizacion.trim() !== '' && Number.isFinite(tipo) && tipo > 0

        /*
          Sin una cotización válida no se convierte nada y el papel sigue en
          pesos, rotulado como pesos. Mostrar los importes de siempre debajo de
          un encabezado que diga dólares es la única forma de equivocarse feo
          acá, y es la que no se permite: la pantalla lo avisa y no deja
          exportar hasta que el número esté.
        */
        const enDolares = moneda === 'USD' && tipoValido
        const monedaUsada = enDolares ? 'USD' : 'ARS'
        const tipoUsado = enDolares ? tipo : null
        const money = (value) => formatMoneda(value, monedaUsada)

        /*
          Cada línea se convierte por su precio unitario y el subtotal se
          recalcula sobre ese número ya redondeado, así el papel cierra cuando
          el cliente agarra la calculadora. Por eso la mercadería se suma acá en
          vez de tomar la que ya trae el pedido: en pesos da lo mismo, en
          dólares no.
        */
        const lineas = pedido.items.map((item) => {
          const unitario = enMoneda(item.precio_unitario, tipoUsado)
          return { item, unitario, subtotal: redondear(unitario * item.cantidad) }
        })

        const bruta = redondear(lineas.reduce((suma, linea) => suma + linea.subtotal, 0))
        const montoDescuento = redondear((bruta * pctUsado) / 100)
        const neta = bruta - montoDescuento
        const flete = pedido.flete === null ? 0 : enMoneda(pedido.flete, tipoUsado)
        const iva = conIva ? redondear(neta * IVA) : 0
        const total = neta + iva + flete

        const faltaCotizacion = moneda === 'USD' && !tipoValido

        const cambiado =
          pctUsado !== Number(pedido.descuento_pct ?? 0) ||
          moneda !== (pedido.moneda ?? 'ARS') ||
          (moneda === 'USD' && tipoValido && tipo !== Number(pedido.cotizacion ?? 0))

        const guardable = cambiado && pctValido && !faltaCotizacion
        const vence = validoHasta(pedido.fecha)

        const vendedor = sellers.data?.find((item) => item.id === pedido.seller_id) ?? null
        const contacto = contactoDe(vendedor)

        const guardarPresupuesto = async () => {
          setGuardando(true)
          setError('')
          try {
            await updateOrder(pedido.id, {
              descuento_pct: pctUsado,
              moneda,
              /* En pesos no hay tipo de cambio que registrar, y dejar el de una
                 versión anterior del presupuesto sería peor que no tener
                 ninguno: diría que se convirtió algo que no se convirtió. */
              cotizacion: moneda === 'USD' ? tipo : null,
            })
            query.reload()
          } catch (err) {
            setError(err.message)
          } finally {
            setGuardando(false)
          }
        }

        return (
          <>
            <style>{ESTILOS}</style>

            <div className="mx-auto mb-5 flex max-w-[800px] flex-wrap items-start justify-between gap-3 print:hidden">
              <div className="flex flex-wrap items-start gap-4">
                {/*
                  Los `mt-5` de esta barra son los 20px que mide la etiqueta de
                  un campo: lo que no la lleva —el link, la casilla, los
                  botones— se baja a la altura de los controles en vez de
                  quedar arriba con los títulos. La explicación larga está en
                  `Field`, en components/ui.
                */}
                <Link
                  to={`/erp/pedidos/${pedido.id}`}
                  className="mt-5 inline-flex items-center rounded-md border border-grafito-200 bg-white px-3 py-2 text-sm font-semibold text-grafito-600 hover:border-grafito-300"
                >
                  Volver al pedido
                </Link>

                <label className="block">
                  <span className="block text-xs font-semibold text-grafito-600">
                    Descuento (%)
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    inputMode="decimal"
                    value={descuento ?? ''}
                    onChange={(event) => setDescuento(event.target.value)}
                    className={`mt-1 w-24 ${CONTROL}`}
                  />
                </label>

                <label className="block">
                  <span className="block text-xs font-semibold text-grafito-600">Moneda</span>
                  <select
                    value={moneda}
                    onChange={(event) => setMoneda(event.target.value)}
                    className={`mt-1 w-40 ${CONTROL}`}
                  >
                    {MONEDAS.map((codigo) => (
                      <option key={codigo} value={codigo}>
                        {MONEDA_LABELS[codigo]}
                      </option>
                    ))}
                  </select>
                </label>

                {moneda === 'USD' && (
                  <div>
                    <label className="block">
                      <span className="block text-xs font-semibold text-grafito-600">
                        Cotización (pesos por dólar)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={cotizacion}
                        onChange={(event) => setCotizacion(event.target.value)}
                        className={`mt-1 w-36 ${CONTROL}`}
                      />
                    </label>

                    {/*
                      La del día, a un clic, sin que deje de ser un campo que se
                      escribe: el dólar con el que se cotiza suele ser el propio.
                    */}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-grafito-400">
                      {cotizaciones.data?.length ? (
                        <>
                          <span>Hoy:</span>
                          {cotizaciones.data.map((item) => (
                            <button
                              key={item.casa}
                              type="button"
                              onClick={() => setCotizacion(String(item.valor))}
                              className="rounded border border-grafito-200 px-1.5 py-0.5 font-semibold text-grafito-600 hover:border-celeste-600 hover:text-celeste-800"
                            >
                              {item.nombre} {formatMoneda(item.valor)}
                            </button>
                          ))}
                        </>
                      ) : cotizaciones.loading ? (
                        <span>Buscando la cotización del día…</span>
                      ) : (
                        <span>No se pudo traer la cotización del día: escribila a mano.</span>
                      )}
                    </div>
                  </div>
                )}

                <label className="mt-5 flex items-center gap-2 py-2 text-sm text-grafito-600">
                  <input
                    type="checkbox"
                    checked={conIva}
                    onChange={(event) => setConIva(event.target.checked)}
                  />
                  Mostrar IVA (21%)
                </label>
              </div>

              <div className="mt-5 flex gap-2">
                {guardable && (
                  <Button variant="soft" onClick={guardarPresupuesto} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar en el pedido'}
                  </Button>
                )}
                <Button onClick={imprimir} disabled={faltaCotizacion}>
                  Exportar a PDF
                </Button>
              </div>
            </div>

            {!pctValido && (
              <div className="mx-auto mb-4 max-w-[800px] print:hidden">
                <ErrorNote>El descuento tiene que ser un porcentaje entre 0 y 100.</ErrorNote>
              </div>
            )}

            {faltaCotizacion && (
              <div className="mx-auto mb-4 max-w-[800px] print:hidden">
                <ErrorNote>
                  Falta la cotización del dólar. Mientras no esté, el presupuesto
                  se muestra en pesos y no se puede exportar.
                </ErrorNote>
              </div>
            )}

            {error && (
              <div className="mx-auto mb-4 max-w-[800px] print:hidden">
                <ErrorNote>{error}</ErrorNote>
              </div>
            )}

            {guardable && (
              <p className="mx-auto mb-4 max-w-[800px] rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 print:hidden">
                Lo que se ve abajo todavía no está guardado en el pedido: se
                imprime igual, pero el descuento no baja el total ni la cuenta
                corriente, y la cotización no queda registrada, hasta que lo
                guardes.
              </p>
            )}

            <div className="presupuesto">
              <div className="hoja hm">
                <div className="encabezado">
                  <div className="marca">
                    <LogoHoja />
                    <p>Varillas de plástico recuperado para alambrados · Luján</p>
                  </div>
                  <dl className="doc-info">
                    <span className="tag">PRESUPUESTO</span>
                    <dt>N° de presupuesto</dt>
                    <dd>{String(pedido.numero).padStart(4, '0')}</dd>
                    <dt>Fecha</dt>
                    <dd>{formatDate(pedido.fecha)}</dd>
                    {/*
                      La cotización va arriba, con el número y la fecha, y no
                      sólo en la letra chica: es un dato del documento. El
                      cliente que recibe importes en dólares tiene que poder ver
                      de dónde salieron sin buscarlos.
                    */}
                    {enDolares && (
                      <>
                        <dt>Cotización</dt>
                        <dd>{formatMoneda(tipoUsado)} / USD</dd>
                      </>
                    )}
                  </dl>
                </div>

                <dl className="cliente">
                  <dt>Cliente</dt>
                  <dd>
                    {pedido.cliente_nombre}
                    {pedido.entrega === 'envio' && pedido.localidad && (
                      <span className="destino">
                        {' — '}
                        {[pedido.localidad, pedido.provincia].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </dd>
                </dl>

                <table>
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th className="num">Cantidad</th>
                      <th className="num">Precio unitario ({monedaUsada})</th>
                      <th className="num">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--gris)' }}>
                          Este pedido todavía no tiene mercadería cargada.
                        </td>
                      </tr>
                    ) : (
                      lineas.map(({ item, unitario, subtotal }) => (
                        <tr key={item.id}>
                          <td className="desc">{nombreDeItem(item)}</td>
                          <td className="num">
                            {new Intl.NumberFormat('es-AR').format(item.cantidad)}
                          </td>
                          <td className="num">{money(unitario)}</td>
                          <td className="num">{money(subtotal)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="totales">
                  <div className="fila">
                    <span>Subtotal</span>
                    <span className="val">{money(bruta)}</span>
                  </div>

                  {pctUsado > 0 && (
                    <div className="fila">
                      <span>Descuento ({pctUsado}%)</span>
                      <span className="val">− {money(montoDescuento)}</span>
                    </div>
                  )}

                  {conIva && (
                    <div className="fila">
                      <span>IVA (21%)</span>
                      <span className="val">{money(iva)}</span>
                    </div>
                  )}

                  <div className="fila">
                    <span>Flete</span>
                    <span className="val">
                      {pedido.entrega === 'retiro'
                        ? 'Retira en fábrica'
                        : pedido.flete === null
                          ? 'A cotizar'
                          : money(flete)}
                    </span>
                  </div>

                  <div className="fila grande">
                    <span>TOTAL</span>
                    <span className="val">{money(total)}</span>
                  </div>
                </div>

                <div className="notas">
                  <h2>Notas / condiciones</h2>
                  {/*
                    Editable para el retoque de último momento, como el textarea
                    del HTML de antes. No se guarda: lo que se corrige acá vale
                    para este papel y nada más, y decirlo es más honesto que
                    dejar creer que quedó anotado en el pedido.
                  */}
                  <p className="cuerpo" contentEditable suppressContentEditableWarning>
                    {[
                      CONDICIONES_BASE,
                      vence ? `Válido hasta el ${formatDate(
                        `${vence.getFullYear()}-${String(vence.getMonth() + 1).padStart(2, '0')}-${String(vence.getDate()).padStart(2, '0')}`,
                      )}.` : null,
                      enDolares
                        ? `Importes en dólares estadounidenses, convertidos a razón de ${formatMoneda(tipoUsado)} por dólar.`
                        : null,
                      conIva ? 'Precios con IVA incluido.' : 'Precios sin IVA.',
                      pedido.entrega === 'retiro'
                        ? 'Retira en fábrica.'
                        : pedido.flete === null
                          ? 'Flete a cotizar según destino.'
                          : 'Flete incluido según destino indicado.',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </p>

                  <span className="varilla-pie" aria-hidden="true" />
                  <p className="contacto">
                    <strong>{contacto.nombre}</strong> · WhatsApp {contacto.telefono} ·{' '}
                    {contacto.email}
                  </p>
                </div>
              </div>
            </div>

            <p className="mx-auto mt-4 max-w-[800px] text-xs text-grafito-400 print:hidden">
              Las condiciones se pueden retocar haciendo clic sobre ellas, pero
              ese cambio no queda guardado: vale para el PDF que estés por
              exportar.
            </p>
          </>
        )
      }}
    </Async>
  )
}
