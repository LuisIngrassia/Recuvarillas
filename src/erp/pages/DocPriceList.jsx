/**
 * La lista de precios que se reparte.
 *
 * Reemplaza a `docs/lista-precios-recuvarilla.html` y a su gemela mayorista.
 * Dos cosas cambian respecto de aquellos archivos, y son las dos que hacían
 * falta:
 *
 * - Los precios salen de la base, los mismos que cotiza el ERP y la web. Aquel
 *   archivo había que volver a editarlo cada vez que cambiaba un escalón, y
 *   entre que se cambiaba el precio y se rehacía el PDF siempre había alguien
 *   repartiendo la lista vieja.
 * - El contacto es el del vendedor que se elija. Antes salía el de la empresa,
 *   así que cuando el cliente llamaba no había forma de saber quién lo trajo.
 *
 * La fecha de vigencia tampoco se escribe a mano: es la última vez que se tocó
 * un precio, que es exactamente lo que esa línea quiere decir.
 */
import { useState } from 'react'
import { listTiers } from '../api/prices'
import { useAsync } from '../lib/useAsync'
import { formatDate } from '../lib/format'
import { documentoPorTipo, TAGLINE } from '../lib/documentos'
import DocSheet from '../components/DocSheet'
import { Async } from '../components/ui'

const numero = new Intl.NumberFormat('es-AR')
const pesos = (value) => `$${numero.format(Math.round(Number(value)))}`

const ESTILOS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');

.lista {
  --bg: #1e211b;
  --panel: #262a22;
  --panel-2: #2e332a;
  --rule: #454a3d;
  --olive: #9fb25f;
  --bone: #ece9dd;
  --bone-dim: #a8a89a;
  --steel: #7d8a93;
  max-width: 860px;
  margin: 0 auto;
  background: var(--bg);
  color: var(--bone);
  font-family: 'Work Sans', system-ui, sans-serif;
  padding: 34px 38px 30px;
}
.lista header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 28px;
  border-bottom: 1px solid var(--rule);
  padding-bottom: 18px;
}
.lista .eyebrow {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--olive);
}
.lista h1 {
  font-family: 'Oswald', 'Trebuchet MS', sans-serif;
  font-size: 42px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 6px 0 8px;
  line-height: 1;
}
.lista .tagline { font-size: 13px; color: var(--bone-dim); max-width: 480px; line-height: 1.5; }
.lista .valid-box {
  text-align: right;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--bone-dim);
  white-space: nowrap;
}
.lista .valid-date {
  font-family: 'Oswald', sans-serif;
  font-size: 20px;
  letter-spacing: 0.04em;
  color: var(--bone);
  margin-top: 4px;
}
.lista .divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 16px;
}
.lista .divider .cap {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--olive);
}
.lista .divider .rod { flex: 1; height: 2px; background: var(--rule); }
.lista .product { display: grid; grid-template-columns: 260px 1fr; gap: 22px; align-items: start; }
.lista .product img {
  width: 100%;
  height: 190px;
  object-fit: cover;
  border: 1px solid var(--rule);
  display: block;
}
.lista .product h2 {
  font-family: 'Oswald', sans-serif;
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 8px;
}
.lista .product p { font-size: 13.5px; line-height: 1.6; color: var(--bone-dim); margin: 0 0 12px; }
.lista .tags { display: flex; flex-wrap: wrap; gap: 6px; }
.lista .tags span {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid var(--rule);
  color: var(--bone-dim);
  padding: 4px 8px;
}
.lista .panels { display: grid; gap: 16px; }
.lista .panel { background: var(--panel); border: 1px solid var(--rule); }
.lista .panel .ph {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 12px 18px;
  background: var(--panel-2);
  border-bottom: 1px solid var(--rule);
}
.lista .panel .ph h3 { font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 600; margin: 0; }
.lista .panel .badge {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--olive);
  color: var(--bg);
  padding: 3px 8px;
  font-weight: 600;
}
.lista .panel.mayorista .badge { background: var(--steel); color: #fff; }
.lista table { width: 100%; border-collapse: collapse; }
.lista thead th {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--bone-dim);
  text-align: left;
  padding: 10px 18px 8px;
  border-bottom: 1px solid var(--rule);
  font-weight: 500;
}
.lista thead th.num, .lista td.num { text-align: right; }
.lista tbody td {
  padding: 11px 18px;
  font-size: 13.5px;
  border-bottom: 1px solid var(--rule);
  color: var(--bone);
}
.lista tbody tr:last-child td { border-bottom: none; }
.lista td.num { font-family: 'IBM Plex Mono', monospace; font-weight: 600; }
.lista td.sin { color: var(--bone-dim); }
.lista .addon {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--olive);
  padding: 10px 18px;
  border-top: 1px solid var(--rule);
}
.lista footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  border-top: 1px solid var(--rule);
  margin-top: 26px;
  padding-top: 16px;
}
.lista footer h4 {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--olive);
  margin: 0 0 6px;
}
.lista footer p { font-size: 12px; line-height: 1.65; color: var(--bone-dim); margin: 0; }
.lista footer .quien { color: var(--bone); font-weight: 600; }

@media (max-width: 720px) {
  .lista { padding: 22px; }
  .lista .product, .lista footer { grid-template-columns: 1fr; }
}
`

/** El texto del escalón: "1 a 99 unidades", "5.000 unidades o más". */
function rangoTexto(tier) {
  if (tier.max_qty === null) return `${numero.format(tier.min_qty)} unidades o más`
  return `${numero.format(tier.min_qty)} a ${numero.format(tier.max_qty)} unidades`
}

/**
 * El recargo por agujereado, leído de los propios escalones.
 *
 * Es la diferencia entre las dos columnas. Estaba escrito a mano en el archivo
 * viejo ("+$500/u agujereado, +$250 desde 5.000u") y por eso podía contradecir
 * a la tabla que tenía justo arriba. Acá sale de la tabla, así que no puede.
 */
function recargoTexto(tiers) {
  const tramos = []

  for (const tier of tiers) {
    const recargo = Number(tier.drilled_price) - Number(tier.plain_price)
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && ultimo.recargo === recargo) ultimo.hasta = tier.max_qty
    else tramos.push({ recargo, desde: tier.min_qty, hasta: tier.max_qty })
  }

  return tramos
    .map(({ recargo, desde, hasta }) => {
      if (tramos.length === 1) return `+${pesos(recargo)}/u por agujereado`
      if (hasta === null) return `+${pesos(recargo)}/u desde ${numero.format(desde)}u`
      return `+${pesos(recargo)}/u hasta ${numero.format(hasta)}u`
    })
    .join(' · ')
}

function Panel({ titulo, badge, tiers, mayorista }) {
  return (
    <div className={`panel${mayorista ? ' mayorista' : ''}`}>
      <div className="ph">
        <h3>{titulo}</h3>
        <span className="badge">{badge}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Cantidad</th>
            <th className="num">Sin agujerear</th>
            <th className="num">Agujereada</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.id}>
              <td>{rangoTexto(tier)}</td>
              <td className="num sin">{pesos(tier.plain_price)}</td>
              <td className="num">{pesos(tier.drilled_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="addon">{recargoTexto(tiers)}</div>
    </div>
  )
}

export default function DocPriceList() {
  const doc = documentoPorTipo('lista-de-precios')
  const query = useAsync(listTiers, [])
  /* Dos listas y no una: al cliente minorista no se le muestra el precio
     mayorista, que es justamente por lo que había dos archivos separados. */
  const [alcance, setAlcance] = useState('minorista')

  return (
    <DocSheet doc={doc}>
      {(contacto) => (
        <>
          <style>{ESTILOS}</style>

          <div className="mx-auto mb-4 flex max-w-[860px] flex-wrap items-center gap-2 print:hidden">
            <span className="text-xs font-semibold text-steel-600">Qué precios muestra:</span>
            {[
              ['minorista', 'Sólo minorista'],
              ['mayorista', 'Sólo mayorista'],
              ['completa', 'Las dos'],
            ].map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setAlcance(valor)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  alcance === valor
                    ? 'border-secondary-500 bg-secondary-50 text-secondary-700'
                    : 'border-steel-200 bg-white text-steel-600 hover:border-steel-300'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          <Async query={query} empty="No hay precios cargados.">
            {(tiers) => {
              const minoristas = tiers.filter((tier) => tier.kind === 'minorista')
              const mayoristas = tiers.filter((tier) => tier.kind === 'mayorista')

              /* La vigencia es la última vez que se tocó un precio: es lo que
                 esa línea siempre quiso decir, y ahora no hay que acordarse de
                 actualizarla. */
              const vigencia = tiers
                .map((tier) => tier.updated_at)
                .sort()
                .at(-1)

              return (
                <div className="lista doc-hoja">
                  <header>
                    <div>
                      <div className="eyebrow">
                        {contacto.localidad} · Envíos a todo el país
                      </div>
                      <h1>RECUVARILLA</h1>
                      <div className="tagline">{TAGLINE}</div>
                    </div>
                    <div className="valid-box">
                      <div>Lista vigente desde</div>
                      <div className="valid-date">{formatDate(vigencia)}</div>
                    </div>
                  </header>

                  <div className="divider">
                    <span className="cap">Producto</span>
                    <div className="rod" />
                  </div>

                  <div className="product">
                    <img src="/alambrado-1.jpg" alt="Varillas Recuvarilla en un alambrado" />
                    <div>
                      <h2>Varilla Estándar 3x3x120</h2>
                      <p>
                        Resistente a la humedad, insectos y sol. No se pudre, no se
                        astilla, no requiere pintura ni mantenimiento. Disponible con o
                        sin agujereado de fábrica.
                      </p>
                      <div className="tags">
                        <span>Sin mantenimiento</span>
                        <span>Resiste humedad</span>
                        <span>No lo atacan insectos</span>
                        <span>Material reciclado</span>
                      </div>
                    </div>
                  </div>

                  <div className="divider">
                    <span className="cap">Precios</span>
                    <div className="rod" />
                  </div>

                  <div className="panels">
                    {alcance !== 'mayorista' && minoristas.length > 0 && (
                      <Panel titulo="Precio" badge="Venta directa" tiers={minoristas} />
                    )}
                    {alcance !== 'minorista' && mayoristas.length > 0 && (
                      <Panel titulo="Precio mayorista" badge="Por volumen" tiers={mayoristas} mayorista />
                    )}
                  </div>

                  <footer>
                    <div>
                      <h4>Condiciones</h4>
                      <p>
                        Presupuestos válidos por 7 días. Flete a cotizar según destino.
                        Precios sujetos a modificación sin previo aviso por inflación.
                        Los precios son sin IVA. Preguntar por facturación con IVA en
                        caso de ser necesario.
                      </p>
                    </div>
                    <div>
                      <h4>Contacto</h4>
                      <p>
                        <span className="quien">{contacto.nombre}</span>
                        <br />
                        WhatsApp: {contacto.telefono}
                        <br />
                        Email: {contacto.email}
                        {contacto.instagram && (
                          <>
                            <br />
                            IG: {contacto.instagram}
                          </>
                        )}
                      </p>
                    </div>
                  </footer>
                </div>
              )
            }}
          </Async>
        </>
      )}
    </DocSheet>
  )
}
