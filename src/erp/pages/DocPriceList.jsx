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
 *
 * Hay una por producto. Lo que fabricamos sale con sus escalones —con la
 * columna agujereada sólo si se agujerea—; lo que se compra hecho, con su
 * precio único. El titular, la bajada y las condiciones se editan con
 * «Editar contenido» y quedan en la ficha del producto.
 *
 * El diseño es la lista A4 del manual de marca (10 · Aplicaciones de marca):
 * una sola tabla con los escalones, precios en Chivo Mono, la fecha arriba y
 * el QR a WhatsApp abajo.
 */
import { useState } from 'react'
import { listTiers } from '../api/prices'
import { cotizaPorLista } from '../api/products'
import { useAsync } from '../lib/useAsync'
import { formatDate, todayISO } from '../lib/format'
import { documentoPorTipo } from '../lib/documentos'
import { conTexto } from '../lib/fichas'
import DocSheet, { LogoHoja, PieContacto } from '../components/DocSheet'
import { Async } from '../components/ui'
import reglaUrl from '../../../brand/assets/sistema/regla-120.svg?url'

const numero = new Intl.NumberFormat('es-AR')
const pesos = (value) => `$ ${numero.format(Math.round(Number(value)))}`

/** El texto del escalón: "1 a 99", "5.000 o más". */
function rangoTexto(tier) {
  if (tier.max_qty === null) return `${numero.format(tier.min_qty)} o más`
  return `${numero.format(tier.min_qty)} a ${numero.format(tier.max_qty)}`
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
      if (hasta === null) return `+${pesos(recargo)}/u desde ${numero.format(desde)} u`
      return `+${pesos(recargo)}/u hasta ${numero.format(hasta)} u`
    })
    .join(' · ')
}

function Tabla({ titulo, tiers, conAcabado }) {
  return (
    <section>
      <div className="hm-seccion">
        <span className="hm-rotulo">{titulo}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Cantidad (unidades)</th>
            <th className="num">{conAcabado ? 'Lisa' : 'Precio'}</th>
            {conAcabado && <th className="num">Agujereada</th>}
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.id}>
              <td className="mono">{rangoTexto(tier)}</td>
              <td className="num">{pesos(tier.plain_price)}</td>
              {conAcabado && <td className="num">{pesos(tier.drilled_price)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {conAcabado && (
        <p className="hm-rotulo" style={{ marginTop: 8, textTransform: 'none', letterSpacing: 0 }}>
          {recargoTexto(tiers)}
        </p>
      )}
    </section>
  )
}

/** Lo de arriba y lo de abajo de la hoja, que es igual con escalones o sin. */
function Hoja({ contacto, contenido: c, vigencia, children }) {
  const condiciones = conTexto(c.condiciones)

  return (
    <div className="hm doc-hoja">
      <header className="hm-cabecera">
        <LogoHoja />
        <dl className="hm-meta">
          <span className="hm-tipo">Lista de precios</span>
          <dt>Vigente desde</dt>
          <dd>{formatDate(vigencia)}</dd>
        </dl>
      </header>

      <h1 className="hm-titular">{c.titular}</h1>
      <p className="hm-bajada">
        {c.bajada ? `${c.bajada} ` : ''}Precio por unidad, sin IVA.
      </p>

      {children}

      <img src={reglaUrl} alt="" style={{ width: '100%', margin: '26px 0 18px', display: 'block' }} />

      {condiciones.length > 0 && (
        <ul className="hm-lista">
          {condiciones.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <PieContacto contacto={contacto} />
    </div>
  )
}

/** Lo que fabricamos: sus escalones, minorista, mayorista o las dos. */
function ConEscalones({ producto, contacto, contenido }) {
  const query = useAsync(() => listTiers(producto.id), [producto.id])
  /* Dos listas y no una: al cliente minorista no se le muestra el precio
     mayorista, que es justamente por lo que había dos archivos separados. */
  const [alcance, setAlcance] = useState('minorista')
  const conAcabado = producto.se_agujerea !== false
  const hayMayorista = (query.data ?? []).some((tier) => tier.kind === 'mayorista')

  return (
    <>
      {hayMayorista && (
        <div className="mx-auto mb-4 flex max-w-[860px] flex-wrap items-center gap-2 print:hidden">
          <span className="text-xs font-semibold text-grafito-700">Qué precios muestra:</span>
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
                  ? 'border-celeste-600 bg-celeste-50 text-celeste-800'
                  : 'border-alambre bg-white text-grafito-700 hover:border-grafito-500'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      )}

      <Async
        query={query}
        empty={`${producto.nombre} no tiene escalones cargados. Se cargan en Ajustes › Precios.`}
      >
        {(tiers) => {
          const minoristas = tiers.filter((tier) => tier.kind === 'minorista')
          const mayoristas = tiers.filter((tier) => tier.kind === 'mayorista')
          const mostrar = hayMayorista ? alcance : 'minorista'

          /* La vigencia es la última vez que se tocó un precio: es lo que
             esa línea siempre quiso decir, y ahora no hay que acordarse de
             actualizarla. */
          const vigencia = tiers
            .map((tier) => tier.updated_at)
            .sort()
            .at(-1)

          return (
            <Hoja contacto={contacto} contenido={contenido} vigencia={vigencia}>
              {mostrar !== 'mayorista' && minoristas.length > 0 && (
                <Tabla titulo="Precio por cantidad" tiers={minoristas} conAcabado={conAcabado} />
              )}
              {mostrar !== 'minorista' && mayoristas.length > 0 && (
                <Tabla
                  titulo="Precio mayorista · revendedores"
                  tiers={mayoristas}
                  conAcabado={conAcabado}
                />
              )}
            </Hoja>
          )
        }}
      </Async>
    </>
  )
}

/** Lo que se compra hecho: un precio y listo. */
function PrecioUnico({ producto, contacto, contenido }) {
  if (producto.precio == null) {
    return (
      <p className="mx-auto max-w-[860px] rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {producto.nombre} no tiene precio de venta cargado. Se carga en su
        ficha, en Ajustes › Productos.
      </p>
    )
  }

  return (
    <Hoja contacto={contacto} contenido={contenido} vigencia={todayISO()}>
      <section>
        <div className="hm-seccion">
          <span className="hm-rotulo">Precio</span>
        </div>
        <table>
          <tbody>
            <tr>
              <td>
                {producto.nombre}
                {producto.unidad && producto.unidad !== 'unidad' ? ` · por ${producto.unidad}` : ''}
              </td>
              <td className="num">{pesos(producto.precio)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </Hoja>
  )
}

export default function DocPriceList() {
  const doc = documentoPorTipo('lista-de-precios')

  return (
    <DocSheet doc={doc}>
      {(props) =>
        cotizaPorLista(props.producto) ? (
          /* `key`: al cambiar de producto, el alcance elegido vuelve a
             minorista en vez de quedar apuntando a una lista que no existe. */
          <ConEscalones key={props.producto.id} {...props} />
        ) : (
          <PrecioUnico {...props} />
        )
      }
    </DocSheet>
  )
}
