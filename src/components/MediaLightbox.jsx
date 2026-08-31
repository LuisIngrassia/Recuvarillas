import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Botón de la barra superior y de los costados, todos del mismo molde. */
function IconButton({ label, onClick, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60 ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * Galería a pantalla completa del material de un producto.
 *
 * En la tarjeta las fotos entran en una tira angosta y recortada; acá se ven
 * enteras (`object-contain`) y a la mayor escala que permita la ventana, que es
 * lo que se busca al hacer clic sobre ellas.
 *
 * Va montada en `document.body` con un portal: adentro de la tarjeta quedaría
 * atrapada por su `overflow-hidden` y por el apilado de la sección.
 *
 * El desplazamiento es el mismo scroll horizontal con snap que usa el carrusel,
 * así el swipe táctil y el trackpad salen gratis; el teclado y las flechas
 * mueven ese mismo scroll.
 */
function MediaLightbox({ media, alt, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex)
  const [track, setTrack] = useState(null)
  const panel = useRef(null)

  const total = media.length

  const goTo = useCallback(
    (next) => {
      const target = (next + total) % total
      setIndex(target)
      track?.scrollTo({ left: track.clientWidth * target, behavior: 'smooth' })
    },
    [total, track],
  )

  // Abre parada en la pieza que se estaba viendo en la tarjeta. Sin `instant` la
  // apertura arrancaría en la primera y se desplazaría a la vista, porque la
  // tira lleva `scroll-smooth`.
  useEffect(() => {
    if (!track) return
    track.scrollTo({ left: track.clientWidth * startIndex, behavior: 'instant' })
  }, [track, startIndex])

  // Mientras está abierta, el fondo no se mueve: si no, la rueda del mouse
  // sobre los bordes negros scrollea la página que quedó atrás.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // El foco entra al panel al abrir y vuelve al control que la abrió al cerrar,
  // para no dejar a quien navega con teclado en el principio del documento.
  useEffect(() => {
    const opener = document.activeElement
    panel.current?.focus()
    return () => opener?.focus?.()
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') goTo(index - 1)
      else if (event.key === 'ArrowRight') goTo(index + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goTo, index, onClose])

  // El swipe mueve la tira sin pasar por `goTo`, así que el contador y los
  // puntos se sincronizan mirando dónde quedó parada.
  const onScroll = (event) => {
    const el = event.currentTarget
    if (!el.clientWidth) return
    const visible = Math.round(el.scrollLeft / el.clientWidth)
    if (visible !== index) setIndex(visible)
  }

  // Clic en el negro de alrededor cierra. Se compara contra el propio marco de
  // la diapositiva para que el clic sobre la foto o sobre los controles del
  // video no cuente.
  const onBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose()
  }

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={`Galería de ${alt}`}
      tabIndex={-1}
      className="fixed inset-0 z-[60] bg-black/92 focus:outline-none"
    >
      <div
        ref={setTrack}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {media.map((item, i) => {
          const label = total > 1 ? `${alt} (${i + 1} de ${total})` : alt
          const frame =
            'flex h-full w-full shrink-0 snap-center items-center justify-center px-4 py-16 sm:px-16'
          const piece = 'max-h-full max-w-full object-contain'

          return (
            <div key={item.src} className={frame} onClick={onBackdropClick}>
              {item.type === 'video' ? (
                // Con controles y sin arrancar solo: acá el video se mira a
                // propósito, no es el relleno animado de una tarjeta.
                <video
                  src={`/${item.src}`}
                  poster={item.poster ? `/${item.poster}` : undefined}
                  aria-label={label}
                  controls
                  playsInline
                  preload="metadata"
                  className={piece}
                />
              ) : (
                <img src={`/${item.src}`} alt={label} className={piece} />
              )}
            </div>
          )
        })}
      </div>

      <IconButton label="Cerrar galería" onClick={onClose} className="absolute right-3 top-3">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </IconButton>

      {total > 1 && (
        <>
          <IconButton
            label="Anterior"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 sm:left-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </IconButton>
          <IconButton
            label="Siguiente"
            onClick={() => goTo(index + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 sm:right-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </IconButton>

          <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-2">
            <div className="flex gap-1.5">
              {media.map((item, i) => (
                <button
                  key={item.src}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Ver ${item.type === 'video' ? 'video' : 'imagen'} ${i + 1}`}
                  aria-current={i === index}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i === index ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-white/70">
              {index + 1} / {total}
            </span>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

export default MediaLightbox
