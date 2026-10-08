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
  /* Lo fabricado que se agujerea y no tiene tarjeta propia de agujereada
     muestra los dos precios. */
  const agujereadaAparte =
    agujereada === undefined && producto.se_produce && producto.se_agujerea
      ? precioMasAlto(producto, { agujereada: true })
      : null

  return (
    <div className="mt-4">
      <p>
        <span className="font-mono text-2xl font-semibold text-grafito-900 sm:text-3xl">
          {formatPesos(precio)}
        </span>
        <span className="ml-1.5 text-sm text-grafito-500">+ IVA</span>
      </p>
      {agujereadaAparte !== null && agujereadaAparte !== precio && (
        <p className="text-sm text-grafito-600">
          Agujereado: <span className="font-mono font-semibold">{formatPesos(agujereadaAparte)}</span> + IVA
        </p>
      )}
      <p className="text-xs text-grafito-400">
        {porCantidad ? 'Por unidad. Baja con la cantidad.' : 'Por unidad.'}
      </p>
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
 * El índice del carrusel se guarda acá arriba para que la galería abra en la
 * pieza que se estaba viendo: pasar tres fotos en la tarjeta y que al ampliar
 * vuelva a la primera obliga a rehacer el camino.
 */
function ProductCard({ product, producto }) {
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)

  // Amplía la tarjeta entera y no sólo la foto: en el celular la tira es
  // angosta y apuntarle es incómodo. Lo que ya hace otra cosa —flechas, puntos,
  // la lupa, la ficha técnica, el enlace a contacto— sigue haciendo lo suyo.
  const onCardClick = (event) => {
    if (event.target.closest('a, button')) return
    // Con movimiento reducido el video de la tarjeta lleva controles propios, y
    // usarlos no es pedir que se amplíe.
    if (event.target.matches('video[controls]')) return
    setExpanded(true)
  }

  return (
    <>
      <div
        onClick={onCardClick}
        className="flex cursor-zoom-in gap-5 rounded-md bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:gap-6 sm:p-5"
      >
        <ProductCarousel
          media={product.media}
          alt={product.name}
          paused={expanded}
          onIndexChange={setIndex}
          onExpand={() => setExpanded(true)}
          className="aspect-[9/16] w-28 shrink-0 sm:w-36 lg:w-40"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-display text-2xl text-grafito-900 sm:text-3xl">{product.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-grafito-500">{product.description}</p>

          {/* La viñeta es la perforación de la varilla, como en todo el sistema. */}
          <ul className="lista-agujero mt-3 space-y-1.5 text-sm text-grafito-700">
            {product.specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>

          <Precio producto={producto} agujereada={Boolean(product.agujereada)} />

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
            <a
              href="#contacto"
              className="link-marca text-sm"
            >
              Consultar disponibilidad →
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
          media={product.media}
          alt={product.name}
          startIndex={index}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  )
}

/**
 * Un producto del ERP que no tiene tarjeta con fotos: el poste, las
 * torniquetas, lo que se cargue mañana. Sale con su nombre y su precio, sin
 * tener que tocar la web.
 */
function ErpCard({ producto }) {
  return (
    <div className="flex flex-col rounded-md bg-white p-4 shadow-sm sm:p-5">
      <h3 className="font-display text-2xl text-grafito-900 sm:text-3xl">{producto.nombre}</h3>
      <Precio producto={producto} />
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
        {producto.en_web && (
          <a href="#presupuesto" className="btn-principal min-h-10 px-3.5 py-2 text-sm">
            Calcular presupuesto
          </a>
        )}
        <a
          href={consultaPorWhatsapp(producto.nombre)}
          target="_blank"
          rel="noopener noreferrer"
          className="link-marca text-sm"
        >
          Consultar por WhatsApp →
        </a>
      </div>
    </div>
  )
}

function Products() {
  const catalogo = useCatalogo()

  /* Cada tarjeta fija con su producto del ERP, y los del ERP que quedaron sin
     tarjeta. Sólo los que tienen precio: una tarjeta nueva sin precio no dice
     nada que no diga ya la de al lado. */
  const fijas = products.map((product) => ({
    product,
    producto: productoPara(catalogo, product.erp),
  }))
  const usados = new Set(fijas.map(({ producto }) => producto?.id).filter(Boolean))
  /* Los de nombre igual a uno ya usado tampoco: son duplicados cargados de más,
     no productos distintos. */
  const nombresUsados = new Set(
    fijas.map(({ producto }) => producto?.nombre.trim().toLowerCase()).filter(Boolean),
  )
  const sueltos = (catalogo ?? []).filter(
    (item) =>
      !usados.has(item.id) &&
      !nombresUsados.has(item.nombre.trim().toLowerCase()) &&
      tienePrecio(item),
  )

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
          {fijas.map(({ product, producto }) => (
            <ProductCard key={product.name} product={product} producto={producto} />
          ))}
          {sueltos.map((producto) => (
            <ErpCard key={producto.id} producto={producto} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Products
