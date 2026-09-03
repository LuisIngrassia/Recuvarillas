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
 * La marca es la del documento original —el verde, la serif, la tipografía del
 * encabezado— y no la del ERP, porque esto lo mira el cliente y tiene que
 * seguir pareciéndose a lo que ya venía recibiendo.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrder, updateOrder } from '../api/orders'
import { listSellers } from '../api/sellers'
import { useAsync } from '../lib/useAsync'
import { formatDate } from '../lib/format'
import { contactoDe } from '../lib/documentos'
import { Async, Button, ErrorNote } from '../components/ui'

/*
  Dos decimales, como el documento de siempre. El resto del ERP los redondea a
  peso entero porque son pantallas de trabajo; un presupuesto que va afuera
  muestra el importe exacto.
*/
const pesos = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const money = (value) => `$ ${pesos.format(Number(value) || 0)}`

const IVA = 0.21

/** Los 15 días de validez, contados desde la fecha del pedido. */
function validoHasta(fecha) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha ?? ''))
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setDate(date.getDate() + 15)
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
  .presupuesto {
    --verde: #33502e;
    --tierra: #8a5a34;
    --gris: #4a4a44;
    --linea: #d8d3c4;
    font-family: Georgia, 'Times New Roman', serif;
    color: var(--gris);
  }
  .presupuesto .hoja {
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
    padding: 45px 50px;
    border: 1px solid var(--linea);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  }
  .presupuesto .encabezado {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    border-bottom: 3px solid var(--verde);
    padding-bottom: 18px;
    margin-bottom: 28px;
  }
  .presupuesto .marca h1 {
    margin: 0;
    font-size: 30px;
    letter-spacing: 1px;
    color: var(--verde);
    font-family: 'Trebuchet MS', sans-serif;
    font-weight: 800;
  }
  .presupuesto .marca p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--tierra);
    font-style: italic;
  }
  .presupuesto .doc-info { text-align: right; font-size: 13px; white-space: nowrap; }
  .presupuesto .doc-info .tag {
    display: inline-block;
    background: var(--verde);
    color: #fff;
    font-family: 'Trebuchet MS', sans-serif;
    font-size: 12px;
    letter-spacing: 2px;
    padding: 4px 10px;
    margin-bottom: 8px;
  }
  .presupuesto .doc-info dt {
    font-size: 11px;
    color: var(--tierra);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 6px;
  }
  .presupuesto .doc-info dd { margin: 0; font-size: 15px; }
  .presupuesto .cliente { margin-bottom: 26px; }
  .presupuesto .cliente dt {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--tierra);
    margin-bottom: 3px;
  }
  .presupuesto .cliente dd { margin: 0; font-size: 19px; color: var(--verde); font-weight: bold; }
  .presupuesto .cliente .destino { font-size: 13px; color: var(--gris); font-weight: normal; }
  .presupuesto table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .presupuesto th {
    background: var(--verde);
    color: #fff;
    font-family: 'Trebuchet MS', sans-serif;
    font-weight: normal;
    font-size: 12px;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 10px 8px;
    text-align: left;
  }
  .presupuesto td { padding: 10px 8px; border-bottom: 1px solid var(--linea); }
  .presupuesto td.desc { font-weight: bold; color: var(--verde); }
  .presupuesto .num { text-align: right; font-variant-numeric: tabular-nums; }
  .presupuesto .totales { margin: 18px 0 0 auto; width: 340px; }
  .presupuesto .fila {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px dashed var(--linea);
    font-size: 14px;
  }
  .presupuesto .fila .val { font-variant-numeric: tabular-nums; }
  .presupuesto .fila.grande {
    border-bottom: none;
    border-top: 3px solid var(--verde);
    margin-top: 6px;
    padding-top: 12px;
    font-size: 20px;
    font-weight: bold;
    color: var(--verde);
    font-family: 'Trebuchet MS', sans-serif;
  }
  .presupuesto .notas {
    margin-top: 30px;
    font-size: 12px;
    color: var(--tierra);
    border-top: 1px solid var(--linea);
    padding-top: 14px;
  }
  .presupuesto .notas h2 {
    margin: 0 0 6px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: normal;
  }
  .presupuesto .notas .cuerpo {
    color: var(--gris);
    line-height: 1.6;
    outline-offset: 3px;
  }
  .presupuesto .notas .cuerpo:focus { outline: 1px dashed var(--tierra); }
  .presupuesto .notas .contacto {
    margin: 12px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--linea);
    color: var(--verde);
    font-size: 13px;
  }

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
    .presupuesto th {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

const CONDICIONES_BASE = 'Presupuesto válido por 15 días.'

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

  const [conIva, setConIva] = useState(false)
  const [descuento, setDescuento] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const order = query.data

  /* El descuento guardado es el punto de partida; a partir de ahí el campo vive
     en la pantalla hasta que se lo guarde, para poder ver cómo queda el total
     antes de comprometerlo. */
  useEffect(() => {
    if (order) setDescuento(String(Number(order.descuento_pct ?? 0)))
  }, [order])

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

        const bruta = Number(pedido.mercaderia)
        const montoDescuento = Math.round(bruta * pctUsado) / 100
        const neta = bruta - montoDescuento
        const flete = pedido.flete === null ? 0 : Number(pedido.flete)
        const iva = conIva ? neta * IVA : 0
        const total = neta + iva + flete

        const cambiado = pctUsado !== Number(pedido.descuento_pct ?? 0)
        const vence = validoHasta(pedido.fecha)

        const vendedor = sellers.data?.find((item) => item.id === pedido.seller_id) ?? null
        const contacto = contactoDe(vendedor)

        const guardarDescuento = async () => {
          setGuardando(true)
          setError('')
          try {
            await updateOrder(pedido.id, { descuento_pct: pctUsado })
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

            <div className="mx-auto mb-5 flex max-w-[800px] flex-wrap items-end justify-between gap-3 print:hidden">
              <div className="flex flex-wrap items-end gap-4">
                <Link
                  to={`/erp/pedidos/${pedido.id}`}
                  className="inline-flex items-center rounded-md border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-600 hover:border-steel-300"
                >
                  Volver al pedido
                </Link>

                <label className="block">
                  <span className="block text-xs font-semibold text-steel-600">
                    Descuento (%)
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      inputMode="decimal"
                      value={descuento ?? ''}
                      onChange={(event) => setDescuento(event.target.value)}
                      className="w-24 rounded-md border border-steel-200 bg-white px-3 py-2 text-sm text-steel-800 focus:border-secondary-500 focus:outline-none"
                    />
                    {cambiado && pctValido && (
                      <Button
                        variant="soft"
                        className="px-2.5 py-1.5 text-xs"
                        onClick={guardarDescuento}
                        disabled={guardando}
                      >
                        {guardando ? 'Guardando…' : 'Guardar en el pedido'}
                      </Button>
                    )}
                  </span>
                </label>

                <label className="flex items-center gap-2 pb-2 text-sm text-steel-600">
                  <input
                    type="checkbox"
                    checked={conIva}
                    onChange={(event) => setConIva(event.target.checked)}
                  />
                  Mostrar IVA (21%)
                </label>
              </div>

              <Button onClick={imprimir}>Exportar a PDF</Button>
            </div>

            {!pctValido && (
              <div className="mx-auto mb-4 max-w-[800px] print:hidden">
                <ErrorNote>El descuento tiene que ser un porcentaje entre 0 y 100.</ErrorNote>
              </div>
            )}

            {error && (
              <div className="mx-auto mb-4 max-w-[800px] print:hidden">
                <ErrorNote>{error}</ErrorNote>
              </div>
            )}

            {cambiado && pctValido && (
              <p className="mx-auto mb-4 max-w-[800px] rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 print:hidden">
                El descuento que se ve abajo todavía no está guardado en el
                pedido: se imprime, pero no baja el total ni la cuenta corriente
                hasta que lo guardes.
              </p>
            )}

            <div className="presupuesto">
              <div className="hoja">
                <div className="encabezado">
                  <div className="marca">
                    <h1>RECUVARILLA</h1>
                    <p>
                      Varillas plásticas para alambrado · resistentes al agua,
                      insectos y sol
                    </p>
                  </div>
                  <dl className="doc-info">
                    <span className="tag">PRESUPUESTO</span>
                    <dt>N° de presupuesto</dt>
                    <dd>{String(pedido.numero).padStart(4, '0')}</dd>
                    <dt>Fecha</dt>
                    <dd>{formatDate(pedido.fecha)}</dd>
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
                      <th className="num">Precio unitario (ARS)</th>
                      <th className="num">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: '#8a5a34' }}>
                          Este pedido todavía no tiene mercadería cargada.
                        </td>
                      </tr>
                    ) : (
                      pedido.items.map((item) => (
                        <tr key={item.id}>
                          <td className="desc">{item.product.nombre}</td>
                          <td className="num">
                            {new Intl.NumberFormat('es-AR').format(item.cantidad)}
                          </td>
                          <td className="num">{money(item.precio_unitario)}</td>
                          <td className="num">{money(item.subtotal)}</td>
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

                  <p className="contacto">
                    <strong>{contacto.nombre}</strong> · {contacto.telefono} ·{' '}
                    {contacto.email}
                  </p>
                </div>
              </div>
            </div>

            <p className="mx-auto mt-4 max-w-[800px] text-xs text-steel-400 print:hidden">
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
