import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'

/** Cuánto se queda quieta una foto antes de pasar a la siguiente. */
const IMAGE_MS = 5000

/** Flecha de navegación, apuntando a un lado o al otro. */
function Arrow({ direction, onClick }) {
  const back = direction === 'back'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={back ? 'Anterior' : 'Siguiente'}
      className={`absolute top-1/2 -translate-y-1/2 ${back ? 'left-1.5' : 'right-1.5'} inline-flex items-center justify-center rounded-full bg-white/85 p-1 text-steel-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-secondary-500/40`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
 * Carrusel de fotos y videos de un producto.
 *
 * Pasa solo: las fotos duran unos segundos y los videos, lo que duren. Se
 * detiene mientras la tarjeta está fuera de pantalla, así nadie llega a una
 * tarjeta empezada ni quedan videos corriendo abajo del pliegue.
 *
 * Con una sola pieza se comporta como una imagen suelta: no aparecen ni flechas
 * ni puntos, así una tarjeta sin material extra no queda con controles muertos.
 *
 * El desplazamiento es el scroll horizontal nativo del contenedor, no un
 * `translate`: sale gratis el gesto de swipe en táctil y el trackpad en
 * escritorio, que a mano habría que reimplementar.
 *
 * Con `onExpand` la tira se vuelve clicable y suma una lupa: en la tarjeta las
 * fotos entran chicas y recortadas, y de ahí se salta a verlas enteras.
 */
function ProductCarousel({
  media,
  alt,
  className = '',
  paused = false,
  onIndexChange,
  onExpand,
}) {
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [track, setTrack] = useState(null)
  const [onScreen, setOnScreen] = useState(false)
  const videos = useRef(new Map())

  const total = media.length
  // Con movimiento reducido no avanza solo: se pasa a mano y los videos llevan
  // controles.
  const auto = onScreen && !paused && !reducedMotion && total > 1

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
    // Con la mitad a la vista alcanza: la tarjeta puede quedar cortada por el
    // borde de la pantalla y el carrusel se ve igual.
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.5 },
    )
    observer.observe(track)
    return () => observer.disconnect()
  }, [track])

  // Sólo corre el video que está a la vista: los de al lado quedan pausados y
  // vueltos al arranque, para que no se los encuentre por la mitad al volver.
  useEffect(() => {
    videos.current.forEach((video, position) => {
      if (!video) return
      if (position === index && onScreen && !paused && !reducedMotion) {
        // Safari rechaza la promesa si el usuario todavía no interactuó; con el
        // video muteado no debería pasar, pero si pasa queda el póster y listo.
        video.play().catch(() => {})
      } else {
        video.pause()
        video.currentTime = 0
      }
    })
  }, [index, onScreen, paused, reducedMotion])

  // La tarjeta necesita saber dónde quedó parada la tira para que la galería
  // abra en la misma pieza que se estaba viendo, y no siempre en la primera.
  useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

  // Las fotos no avisan cuándo terminaron, así que se les pone reloj; los
  // videos no entran acá porque avanzan con `onEnded`. Como el efecto depende
  // de `index`, pasar de slide a mano reinicia la cuenta desde cero.
  useEffect(() => {
    if (!auto || media[index].type === 'video') return
    const timer = setTimeout(() => goTo(index + 1), IMAGE_MS)
    return () => clearTimeout(timer)
  }, [auto, index, media, goTo])

  // El scroll manda: el swipe mueve la tira sin pasar por `goTo`, así que los
  // puntos se sincronizan mirando dónde quedó parada.
  const onScroll = (event) => {
    const el = event.currentTarget
    if (!el.clientWidth) return
    const visible = Math.round(el.scrollLeft / el.clientWidth)
    if (visible !== index) setIndex(visible)
  }

  return (
    <div className={`relative overflow-hidden rounded-lg bg-steel-100 ${className}`}>
      <div
        ref={setTrack}
        onScroll={onScroll}
        className={`flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          onExpand ? 'cursor-zoom-in' : ''
        }`}
      >
        {media.map((item, i) => {
          const label = total > 1 ? `${alt} (${i + 1} de ${total})` : alt
          // Fotos y videos vienen todos exportados a 720x1280, así que el mismo
          // marco les queda justo a los dos y ninguno necesita recorte.
          const slide = 'h-full w-full shrink-0 snap-center object-cover'

          return item.type === 'video' ? (
            <video
              key={item.src}
              ref={(el) => {
                if (el) videos.current.set(i, el)
                else videos.current.delete(i)
              }}
              src={`/${item.src}`}
              poster={item.poster ? `/${item.poster}` : undefined}
              aria-label={label}
              muted
              playsInline
              // Sólo encadena si hay con qué seguir; si el video es todo lo que
              // hay, se repite en vez de quedarse clavado en el último cuadro.
              loop={total === 1}
              onEnded={() => goTo(i + 1)}
              // Con movimiento reducido el video no arranca solo, así que hace
              // falta darle los controles para que se pueda ver igual.
              controls={reducedMotion}
              preload="metadata"
              className={slide}
            />
          ) : (
            <img
              key={item.src}
              src={`/${item.src}`}
              alt={label}
              loading="lazy"
              className={slide}
            />
          )
        })}
      </div>

      {onExpand && (
        <button
          type="button"
          onClick={() => onExpand(index)}
          aria-label={`Ampliar fotos de ${alt}`}
          className="absolute right-1.5 top-1.5 inline-flex items-center justify-center rounded-full bg-white/85 p-1 text-steel-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-secondary-500/40"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14zM11 8v6M8 11h6"
            />
          </svg>
        </button>
      )}

      {total > 1 && (
        <>
          <Arrow direction="back" onClick={() => goTo(index - 1)} />
          <Arrow direction="forward" onClick={() => goTo(index + 1)} />

          <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
            {media.map((item, i) => (
              <button
                key={item.src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ver ${item.type === 'video' ? 'video' : 'imagen'} ${i + 1}`}
                aria-current={i === index}
                className={`h-1 w-1 rounded-full transition-colors ${
                  i === index ? 'bg-white' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ProductCarousel
