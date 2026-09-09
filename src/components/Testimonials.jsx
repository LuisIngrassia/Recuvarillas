import { useCallback, useEffect, useState } from 'react'
import { testimonials, reviewsSummary, reviewLink } from '../data/siteContent'
import { useReducedMotion } from '../hooks/useReducedMotion'

/** Cuántas reseñas se ven a la vez. */
const PER_PAGE = 2

/** Cuánto se queda quieto un par antes de pasar al siguiente. */
const PAGE_MS = 20000

/** Las reseñas de a dos: cada grupo es una pantalla del carrusel. */
function paginate(items) {
  const pages = []
  for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE))
  return pages
}

/**
 * Las estrellas de una reseña.
 *
 * Dibujadas en SVG y no con el emoji ★, que cambia de forma en cada sistema.
 * El puntaje va además en texto para quien navega con lector de pantalla: la
 * fila de estrellas es decorativa y queda oculta con `aria-hidden`.
 */
function Stars({ rating }) {
  const value = Math.round(rating || 0)

  return (
    <div className="flex items-center gap-0.5">
      <span className="sr-only">{rating} de 5 estrellas</span>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${star <= value ? 'fill-amber-400' : 'fill-steel-200'}`}
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </div>
  )
}

/**
 * La foto de quien escribió, o la inicial de su nombre.
 *
 * La mayoría de las reseñas van sin foto —bajar una imagen por cliente para un
 * círculo de 40 píxeles no se paga—, así que la inicial es el caso normal y no
 * el de excepción. El `onError` cubre además el archivo mal escrito: antes que
 * el ícono de imagen rota, la inicial.
 */
function Avatar({ name, photo }) {
  const [broken, setBroken] = useState(false)
  const initial = (name || '?').trim().charAt(0).toUpperCase()

  if (!photo || broken) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-sm font-semibold text-secondary-600">
        {initial}
      </div>
    )
  }

  return (
    <img
      src={photo}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-10 w-10 shrink-0 rounded-full object-cover"
    />
  )
}

function TestimonialCard({ testimonial }) {
  return (
    <blockquote className="flex flex-col rounded-xl border border-steel-200 bg-white p-8">
      <div className="flex items-center gap-3">
        <Avatar name={testimonial.author} photo={testimonial.photo} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-steel-800">{testimonial.author}</p>
          {testimonial.place || testimonial.when ? (
            <p className="truncate text-xs text-steel-400">
              {[testimonial.place, testimonial.when].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      {testimonial.rating ? (
        <div className="mt-4">
          <Stars rating={testimonial.rating} />
        </div>
      ) : null}

      <p className="mt-3 text-steel-600 leading-relaxed">“{testimonial.text}”</p>

      {testimonial.url ? (
        <a
          href={testimonial.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-4 self-start text-sm font-semibold text-secondary-500 hover:text-secondary-600"
        >
          Ver en Google
        </a>
      ) : null}
    </blockquote>
  )
}

/**
 * La insignia con el promedio del perfil de Google.
 *
 * Sólo aparece si `reviewsSummary` tiene datos cargados; con `null` la sección
 * queda con las tarjetas nomás. Es a propósito: un promedio inventado es de las
 * pocas cosas de esta web que serían directamente una mentira.
 */
function GoogleBadge({ summary }) {
  const content = (
    <>
      <span className="text-2xl font-bold text-steel-800">{summary.rating.toFixed(1)}</span>
      <span>
        <Stars rating={summary.rating} />
        <span className="mt-1 block text-xs text-steel-500">
          {summary.total} reseñas en Google
        </span>
      </span>
    </>
  )

  const className =
    'flex items-center gap-3 rounded-xl border border-steel-200 bg-white px-5 py-3'

  if (!summary.url) return <div className={className}>{content}</div>

  return (
    <a
      href={summary.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`${className} transition-colors hover:border-steel-300`}
    >
      {content}
    </a>
  )
}

/** El par de tarjetas. En una sola columna abajo de 640px, donde no entran dos. */
function ReviewsGrid({ items, className = '' }) {
  return (
    <div className={`grid sm:grid-cols-2 gap-8 ${className}`}>
      {items.map((testimonial) => (
        <TestimonialCard key={testimonial.text} testimonial={testimonial} />
      ))}
    </div>
  )
}

/** Flecha de navegación, apuntando a un lado o al otro. */
function NavArrow({ direction, onClick }) {
  const back = direction === 'back'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={back ? 'Reseñas anteriores' : 'Reseñas siguientes'}
      className="inline-flex items-center justify-center rounded-full border border-steel-200 bg-white p-2 text-steel-500 transition-colors hover:border-steel-300 hover:text-steel-800 focus:outline-none focus:ring-2 focus:ring-secondary-500/40"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={back ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        />
      </svg>
    </button>
  )
}

/**
 * Las reseñas de a dos, pasando solas cada veinte segundos.
 *
 * El desplazamiento es el scroll horizontal nativo del contenedor y no un
 * `translate`, igual que en el carrusel de productos: sale gratis el gesto de
 * swipe en táctil y el trackpad en escritorio.
 *
 * Los controles van **abajo** y no encima de las tarjetas, que es donde los
 * pone el otro carrusel. Ahí tapan una foto y no molestan; acá taparían texto,
 * que es justamente lo que se viene a leer.
 *
 * Se frena en tres casos, porque veinte segundos es mucho tiempo para que algo
 * se mueva sin permiso: fuera de pantalla, con el puntero encima o con el foco
 * adentro —alguien recorriendo los enlaces con el teclado no puede quedarse sin
 * la tarjeta a mitad de camino—, y no arranca nunca con `prefers-reduced-motion`.
 */
function ReviewsCarousel({ pages }) {
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [track, setTrack] = useState(null)
  const [onScreen, setOnScreen] = useState(false)
  const [held, setHeld] = useState(false)

  const total = pages.length
  const auto = onScreen && !held && !reducedMotion

  const goTo = useCallback(
    (next) => {
      // El módulo hace que dé la vuelta en vez de frenar en los bordes.
      const target = (next + total) % total
      setIndex(target)
      track?.scrollTo({ left: track.clientWidth * target, behavior: 'smooth' })
    },
    [total, track],
  )

  useEffect(() => {
    if (!track) return
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.5 },
    )
    observer.observe(track)
    return () => observer.disconnect()
  }, [track])

  // Como el efecto depende de `index`, pasar de grupo a mano reinicia la cuenta
  // desde cero en vez de dejar corriendo la anterior.
  useEffect(() => {
    if (!auto) return
    const timer = setTimeout(() => goTo(index + 1), PAGE_MS)
    return () => clearTimeout(timer)
  }, [auto, index, goTo])

  // El scroll manda: el swipe mueve la tira sin pasar por `goTo`, así que los
  // puntos se sincronizan mirando dónde quedó parada.
  const onScroll = (event) => {
    const el = event.currentTarget
    if (!el.clientWidth) return
    const visible = Math.round(el.scrollLeft / el.clientWidth)
    if (visible !== index) setIndex(visible)
  }

  return (
    <div
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div
        ref={setTrack}
        onScroll={onScroll}
        aria-label="Reseñas de clientes"
        className="mt-12 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page) => (
          <ReviewsGrid
            key={page[0].text}
            items={page}
            className="w-full shrink-0 snap-center px-0.5"
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <NavArrow direction="back" onClick={() => goTo(index - 1)} />

        <div className="flex items-center gap-2">
          {pages.map((page, i) => (
            <button
              key={page[0].text}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ver reseñas ${i * PER_PAGE + 1} a ${i * PER_PAGE + page.length}`}
              aria-current={i === index}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === index ? 'bg-secondary-500' : 'bg-steel-300 hover:bg-steel-400'
              }`}
            />
          ))}
        </div>

        <NavArrow direction="forward" onClick={() => goTo(index + 1)} />
      </div>
    </div>
  )
}

/**
 * La invitación a dejar una reseña.
 *
 * Va al final de la sección y no arriba a propósito: recién después de leer lo
 * que dijeron otros el pedido tiene sentido. El enlace abre el formulario de
 * Google directamente, con las estrellas listas.
 *
 * Sin `reviewLink` cargado queda sólo el enlace al perfil, y sin ninguno de los
 * dos la sección termina en las tarjetas.
 */
function ReviewInvite() {
  const verTodas = reviewsSummary?.url ? (
    <a
      href={reviewsSummary.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="font-semibold text-secondary-500 hover:text-secondary-600"
    >
      Ver todas las reseñas en Google
    </a>
  ) : null

  if (!reviewLink) {
    return verTodas ? <p className="mt-8 text-sm text-steel-500">{verTodas}</p> : null
  }

  return (
    <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-steel-200 bg-white p-8">
      <div className="max-w-xl">
        <p className="text-lg font-semibold text-steel-800">¿Ya usás nuestras varillas?</p>
        <p className="mt-1 text-sm text-steel-500 leading-relaxed">
          Contanos cómo te fue. Una reseña tuya ayuda a que otros productores nos
          encuentren, y a nosotros nos dice qué mejorar.
        </p>
        {verTodas ? <p className="mt-3 text-sm">{verTodas}</p> : null}
      </div>

      <a
        href={reviewLink}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex items-center rounded-md bg-secondary-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary-600"
      >
        Dejar una reseña en Google
      </a>
    </div>
  )
}

const pages = paginate(testimonials)

function Testimonials() {
  return (
    // El fondo gris la separa de "Nosotros", que viene justo antes en blanco.
    <section className="bg-steel-100 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
              Testimonios
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-steel-800">
              Lo que dicen nuestros clientes
            </h2>
            {reviewsSummary ? (
              <p className="mt-3 text-sm text-steel-500">
                Reseñas publicadas en nuestro perfil de Google.
              </p>
            ) : null}
          </div>

          {reviewsSummary?.rating ? <GoogleBadge summary={reviewsSummary} /> : null}
        </div>

        {pages.length > 1 ? (
          <ReviewsCarousel pages={pages} />
        ) : (
          // Con dos o menos no hay nada que pasar: la grilla suelta, sin
          // controles muertos abajo.
          <ReviewsGrid items={testimonials} className="mt-12" />
        )}

        <ReviewInvite />
      </div>
    </section>
  )
}

export default Testimonials
