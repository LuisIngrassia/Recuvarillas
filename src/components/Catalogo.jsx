/**
 * Todo lo que vendemos, con su precio, tal como está cargado en el ERP.
 *
 * Las tarjetas de arriba (`Products`) cuentan la varilla con fotos y videos;
 * esto es la lista: cada producto activo con su precio vigente. Lo que
 * fabricamos va con sus escalones minoristas —y la columna agujereada si se
 * agujerea—; lo que se compra hecho, con su precio único. Se carga un producto
 * en el ERP y aparece acá, sin tocar la web.
 *
 * Si la base no contesta, la sección no se muestra: un catálogo de respaldo
 * escrito en el código publicaría precios de cosas que quizás ya no se venden.
 */
import { company } from '../data/siteContent'
import { tienePrecio, useCatalogo } from '../lib/catalogo'
import { formatNumber, formatPesos } from '../lib/quote'

/** «1 a 99», «5.000 o más». */
function rango(tier) {
  if (tier.max === Infinity) return `${formatNumber(tier.min)} o más`
  return `${formatNumber(tier.min)} a ${formatNumber(tier.max)}`
}

function consultaPorWhatsapp(producto) {
  const texto = `Hola ${company.name}, quiero consultar por ${producto.nombre}.`
  return `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(texto)}`
}

function Escalones({ producto }) {
  const conAcabado = producto.se_agujerea

  return (
    <table className="mt-4 w-full text-sm">
      <thead>
        <tr className="border-b border-grafito-200 text-left">
          <th className="rotulo pb-2 font-normal text-grafito-500">Cantidad</th>
          <th className="rotulo pb-2 text-right font-normal text-grafito-500">
            {conAcabado ? 'Lisa' : 'Precio'}
          </th>
          {conAcabado && (
            <th className="rotulo pb-2 text-right font-normal text-grafito-500">Agujereada</th>
          )}
        </tr>
      </thead>
      <tbody>
        {producto.escalones.map((tier) => (
          <tr key={tier.min} className="border-b border-grafito-100 last:border-0">
            <td className="py-2 font-mono text-grafito-600">{rango(tier)}</td>
            <td className="py-2 text-right font-mono font-semibold text-grafito-900">
              {formatPesos(tier.plain)}
            </td>
            {conAcabado && (
              <td className="py-2 text-right font-mono font-semibold text-grafito-900">
                {formatPesos(tier.drilled)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Tarjeta({ producto }) {
  const unidad = producto.unidad && producto.unidad !== 'unidad' ? producto.unidad : 'unidad'

  return (
    <article className="flex flex-col rounded-md border border-grafito-200 bg-white p-5 shadow-sm">
      <h3 className="font-display text-2xl text-grafito-900">{producto.nombre}</h3>

      {producto.se_produce ? (
        <>
          <p className="mt-1 text-xs text-grafito-500">
            Precio por unidad, sin IVA. Baja con la cantidad.
          </p>
          <Escalones producto={producto} />
        </>
      ) : (
        <p className="mt-3">
          <span className="font-mono text-3xl font-semibold text-grafito-900">
            {formatPesos(producto.precio)}
          </span>
          <span className="ml-2 text-sm text-grafito-500">por {unidad}, sin IVA</span>
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
        {/* El simulador cotiza el producto marcado para la web: a ése se lo
            manda a calcular; a los demás, a preguntar. */}
        {producto.en_web ? (
          <a href="#presupuesto" className="btn-principal min-h-10 px-3.5 py-2 text-sm">
            Calcular presupuesto
          </a>
        ) : null}
        <a
          href={consultaPorWhatsapp(producto)}
          target="_blank"
          rel="noopener noreferrer"
          className="link-marca text-sm"
        >
          Consultar por WhatsApp →
        </a>
      </div>
    </article>
  )
}

export default function Catalogo() {
  const catalogo = useCatalogo()
  const productos = (catalogo ?? []).filter(tienePrecio)

  if (!productos.length) return null

  return (
    <div id="precios" className="mt-16 scroll-mt-24">
      <div className="max-w-2xl">
        <h3 className="font-display text-3xl text-grafito-900 sm:text-4xl">
          Precios de todo lo que vendemos.
        </h3>
        <p className="mt-3 text-grafito-500">
          Los vigentes hoy, sin IVA. El flete se cotiza aparte según la
          localidad.
        </p>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {productos.map((producto) => (
          <Tarjeta key={producto.id} producto={producto} />
        ))}
      </div>
    </div>
  )
}
