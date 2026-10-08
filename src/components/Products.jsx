import { useState } from 'react'
import MediaLightbox from './MediaLightbox'
import ProductCarousel from './ProductCarousel'
import { company, products } from '../data/siteContent'
import { precioMasAlto, productoPara, tienePrecio, useCatalogo } from '../lib/catalogo'
import { formatPesos } from '../lib/quote'

/**
 * El precio de una tarjeta. Uno solo: con escalones es el más alto, el de
 * quien lleva poco (ver `precioMasAlto`), y la línea de abajo avisa que baja
 * con la cantidad. Sin precio cargado en el ERP no se muestra nada: un hueco
 * es mejor que un número viejo escrito en el código.
 */
function Precio({ producto, agujereada }) {
  const precio = precioMasAlto(producto, { agujereada })
  if (precio === null || precio === undefined) return null

  const porCantidad = producto.se_produce && producto.escalones.length > 1

  return (
    <div className="mt-4">
      <p>
        <span className="font-mono text-2xl font-semibold text-grafito-900 sm:text-3xl">
          {formatPesos(precio)}
        </span>
        <span className="ml-1.5 text-sm text-grafito-500">+ IVA</span>
      </p>
      <p className="text-xs text-grafito-400">
        {porCantidad ? 'Por unidad. Baja con la cantidad.' : 'Por unidad.'}
      </p>
    </div>
  )
}

/** Lisa o agujereada: cambia el precio y, si hay, las fotos. */
function Acabado({ value, onChange }) {
  return (
    <div className="mt-4 inline-flex self-start rounded-md border border-grafito-200 p-0.5 text-sm" role="group">
      {[
        ['lisa', 'Lisa'],
        ['agujereada', 'Agujereada'],
      ].map(([valor, etiqueta]) => (
        <button
          key={valor}
          type="button"
          aria-pressed={value === valor}
          onClick={() => onChange(valor)}
          className={`rounded px-3 py-1.5 font-semibold transition-colors ${
            value === valor ? 'bg-grafito-900 text-white' : 'text-grafito-600 hover:bg-grafito-100'
          }`}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  )
}

function consultaPorWhatsapp(nombre) {
  const texto = `Hola ${company.name}, quiero consultar por ${nombre}.`
  return `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(texto)}`
}

/**
 * Tarjeta de un producto, con su material al costado y la galería que se abre
 * al tocarla.
 *
 * Sirve para las dos clases de tarjeta: las fijas de `siteContent.js` —con sus
 * fotos y videos— y las que salen sólo del ERP, con las fotos subidas en la
 * ficha del producto. Una tarjeta sin fotos va sin la tira de la izquierda.
 *
 * Un producto que se agujerea tiene **una** tarjeta, con el selector de
 * acabado: la varilla lisa y la agujereada son la misma varilla, y dos
 * tarjetas hacían creer que eran productos distintos.
 *
 * El índice del carrusel se guarda acá arriba para que la galería abra en la
 * pieza que se estaba viendo: pasar tres fotos en la tarjeta y que al ampliar
 * vuelva a la primera obliga a rehacer el camino.
 */
function ProductCard({ product, producto }) {
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [acabado, setAcabado] = useState('lisa')

  const agujereable = Boolean(producto?.se_agujerea) || Boolean(product.mediaAgujereada)
  const agujereada = agujereable && acabado === 'agujereada'
  const media =
    agujereada && product.mediaAgujereada?.length ? product.mediaAgujereada : product.media
  const conMedia = media.length > 0

  // Amplía la tarjeta entera y no sólo la foto: en el celular la tira es
  // angosta y apuntarle es incómodo. Lo que ya hace otra cosa —flechas, puntos,
  // la lupa, la ficha técnica, el enlace a contacto— sigue haciendo lo suyo.
  const onCardClick = (event) => {
    if (!conMedia) return
    if (event.target.closest('a, button')) return
    // Con movimiento reducido el video de la tarjeta lleva controles propios, y
    // usarlos no es pedir que se amplíe.
    if (event.target.matches('video[controls]')) return
    setExpanded(true)
  }

  const cambiarAcabado = (valor) => {
    setAcabado(valor)
    /* Las fotos cambian con el acabado: el carrusel vuelve a la primera. */
    setIndex(0)
  }

  return (
    <>
      <div
        onClick={onCardClick}
        className={`flex gap-5 rounded-md bg-white p-4 shadow-sm transition-shadow sm:gap-6 sm:p-5 ${
          conMedia ? 'cursor-zoom-in hover:shadow-md' : ''
        }`}
      >
        {conMedia && (
          <ProductCarousel
            /* Otra clave al cambiar de fotos: el carrusel arranca de cero en
               vez de quedar parado en un índice que la lista nueva no tiene. */
            key={agujereada ? 'agujereada' : 'lisa'}
            media={media}
            alt={product.name}
            paused={expanded}
            onIndexChange={setIndex}
            onExpand={() => setExpanded(true)}
            className="aspect-[9/16] w-28 shrink-0 sm:w-36 lg:w-40"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-display text-2xl text-grafito-900 sm:text-3xl">{product.name}</h3>
          {product.description && (
            <p className="mt-2 text-sm leading-relaxed text-grafito-500">{product.description}</p>
          )}

          {/* La viñeta es la perforación de la varilla, como en todo el sistema. */}
          {product.specs?.length > 0 && (
            <ul className="lista-agujero mt-3 space-y-1.5 text-sm text-grafito-700">
              {product.specs.map((spec) => (
                <li key={spec}>{spec}</li>
              ))}
            </ul>
          )}

          {agujereable && <Acabado value={acabado} onChange={cambiarAcabado} />}
          <Precio producto={producto} agujereada={agujereada} />

          {/*
            `download` baja el archivo en vez de abrirlo en el visor del
            navegador, que es lo que se espera de una ficha técnica. El
            nombre sugerido lleva el del producto para que no quede un
            `varilla-estandar.pdf` suelto en Descargas.
          */}
          <div className="mt-auto pt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {product.datasheet && (
              <a
                href={`/${product.datasheet}`}
                download={`Ficha técnica - ${product.name}.pdf`}
                className="btn-principal min-h-10 px-3.5 py-2 text-sm"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v11m0 0l-4-4m4 4l4-4M4 19h16"
                  />
                </svg>
                Descargar ficha técnica
              </a>
            )}
            {producto?.en_web && !product.datasheet && (
              <a href="#presupuesto" className="btn-principal min-h-10 px-3.5 py-2 text-sm">
                Calcular presupuesto
              </a>
            )}
            <a
              href={consultaPorWhatsapp(
                `${product.name}${agujereable ? (agujereada ? ' (agujereada)' : ' (lisa)') : ''}`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="link-marca text-sm"
            >
              Consultar por WhatsApp →
            </a>
          </div>
        </div>
      </div>

      {/*
        La galería va afuera de la tarjeta: aunque el portal la monte en el
        `body`, los eventos de React siguen el árbol de componentes, y el clic
        en el fondo negro para cerrarla volvería a caer en el `onClick` que la
        abre, dejándola imposible de cerrar.
      */}
      {expanded && (
        <MediaLightbox
          media={media}
          alt={product.name}
          startIndex={index}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  )
}

/** Las fotos subidas desde el ERP, en el formato del carrusel. */
const fotosDelErp = (producto) =>
  (producto?.fotos ?? []).map((src) => ({ type: 'image', src }))

function Products() {
  const catalogo = useCatalogo()

  /*
    Cada tarjeta fija con su producto del ERP. Si la fija no trae fotos y el
    producto tiene fotos subidas en el ERP, van ésas.
  */
  const fijas = products.map((product) => {
    const producto = productoPara(catalogo, product.erp)
    return {
      product: product.media?.length ? product : { ...product, media: fotosDelErp(producto) },
      producto,
    }
  })

  /*
    Los del ERP que quedaron sin tarjeta fija: el poste, las torniquetas, lo
    que se cargue mañana. Salen con su nombre, su precio y las fotos de su
    ficha, sin tocar la web. Sólo los que tienen precio, y no los de nombre
    igual a uno ya usado: ésos son duplicados cargados de más.
  */
  const usados = new Set(fijas.map(({ producto }) => producto?.id).filter(Boolean))
  const nombresUsados = new Set(
    fijas.map(({ producto }) => producto?.nombre.trim().toLowerCase()).filter(Boolean),
  )
  const sueltos = (catalogo ?? [])
    .filter(
      (item) =>
        !usados.has(item.id) &&
        !nombresUsados.has(item.nombre.trim().toLowerCase()) &&
        tienePrecio(item),
    )
    .map((producto) => ({
      product: { name: producto.nombre, media: fotosDelErp(producto), specs: [] },
      producto,
    }))

  return (
    <section id="productos" className="bg-grafito-100 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl text-grafito-900 sm:text-5xl lg:text-6xl">
            Lisa o agujereada a la medida de tu alambrado.
          </h2>
          <p className="mt-5 text-lg text-grafito-500">
            3 × 3 × 120 cm, de plástico recuperado. Cortamos, perforamos y
            adaptamos la varilla según lo que necesite el establecimiento.
          </p>
        </div>

        {/*
          Dos por fila, y dentro de cada una el material al costado: el video es
          vertical y apilado arriba del texto estiraba la tarjeta a lo largo de
          toda la pantalla. Al lado, la altura la fija la foto y no el texto.
        */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {[...fijas, ...sueltos].map(({ product, producto }) => (
            <ProductCard
              key={producto?.id ?? product.name}
              product={product}
              producto={producto}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Products
