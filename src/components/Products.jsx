import { useState } from 'react'
import MediaLightbox from './MediaLightbox'
import ProductCarousel from './ProductCarousel'
import { products } from '../data/siteContent'

/**
 * Tarjeta de un producto, con su material al costado y la galería que se abre
 * al tocarla.
 *
 * El índice del carrusel se guarda acá arriba para que la galería abra en la
 * pieza que se estaba viendo: pasar tres fotos en la tarjeta y que al ampliar
 * vuelva a la primera obliga a rehacer el camino.
 */
function ProductCard({ product }) {
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
        className="flex cursor-zoom-in gap-5 rounded-xl border border-steel-200 bg-white p-4 sm:gap-6 sm:p-5 hover:shadow-lg transition-shadow"
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
          <h3 className="text-base sm:text-lg font-bold text-steel-800">{product.name}</h3>
          <p className="mt-1.5 text-sm text-steel-500 leading-relaxed">{product.description}</p>

          <ul className="mt-3 space-y-1.5 text-sm text-steel-600">
            {product.specs.map((spec) => (
              <li key={spec} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-primary-400" />
                {spec}
              </li>
            ))}
          </ul>

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
                className="inline-flex items-center gap-1.5 rounded-md bg-secondary-500 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-secondary-600"
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
              className="inline-flex items-center text-xs sm:text-sm font-semibold text-secondary-500 hover:text-secondary-600"
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

function Products() {
  return (
    <section id="productos" className="bg-steel-100 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
            Productos
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-steel-800">
            Varillas para cada necesidad del campo
          </h2>
          <p className="mt-3 text-sm sm:text-base text-steel-500">
            Todos nuestros productos parten de material recuperado y pasan por
            control de calidad antes de salir de planta.
          </p>
        </div>

        {/*
          Dos por fila, y dentro de cada una el material al costado: el video es
          vertical y apilado arriba del texto estiraba la tarjeta a lo largo de
          toda la pantalla. Al lado, la altura la fija la foto y no el texto.
        */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {products.map((product) => (
            <ProductCard key={product.name} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Products
