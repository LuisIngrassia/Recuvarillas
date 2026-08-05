import { Suspense, lazy, useEffect, useState } from 'react'
import { useNearViewport, useScrollProgress } from '../hooks/useScrollProgress'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { STORY_CHAPTERS, chapterIndexAt } from '../data/storyChapters'

// La escena carga aparte para que three.js no pese en el bundle inicial.
const RodScene = lazy(() => import('../three/RodScene'))

/**
 * Alto de la sección en pantallas. El scroll útil es este valor menos 1 (la
 * pantalla que queda fija), repartido entre los 6 capítulos. Subilo si la
 * historia se siente apurada, bajalo si se hace larga.
 *
 * Va por style y no por clase de Tailwind porque Tailwind necesita ver el
 * valor escrito literal en el código para generar la clase.
 */
const SECTION_HEIGHT_VH = 350

function RodStory() {
  const { targetRef, progressRef } = useScrollProgress()
  const [activeChapter, setActiveChapter] = useState(0)
  const reducedMotion = useReducedMotion()
  const isNear = useNearViewport(targetRef)

  // Sincroniza el texto visible con el scroll sin re-renderizar en cada frame:
  // el estado sólo cambia cuando cambia el capítulo activo.
  useEffect(() => {
    if (reducedMotion) return undefined

    let frame
    const tick = () => {
      const index = chapterIndexAt(progressRef.current)
      setActiveChapter((current) => (current === index ? current : index))
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [progressRef, reducedMotion])

  if (reducedMotion) {
    return (
      <section id="proceso" className="bg-primary-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary-300">
            La historia de la varilla
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-white">
            De la botella descartada al alambrado del campo
          </h2>
          <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {STORY_CHAPTERS.map((chapter) => (
              <li key={chapter.step}>
                <span className="text-sm font-bold text-primary-300">{chapter.step}</span>
                <h3 className="mt-2 font-semibold text-white">{chapter.title}</h3>
                <p className="mt-2 text-sm text-steel-300 leading-relaxed">
                  {chapter.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    )
  }

  return (
    <section
      id="proceso"
      ref={targetRef}
      className="relative bg-primary-900"
      style={{ height: `${SECTION_HEIGHT_VH}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {isNear ? (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-primary-900">
                <span className="text-sm text-steel-400">Cargando escena…</span>
              </div>
            }
          >
            <div className="absolute inset-0">
              <RodScene progressRef={progressRef} />
            </div>
          </Suspense>
        ) : null}

        {/*
          Capa de texto sincronizada con el scroll. Va sobre un degradado en
          lugar de una caja opaca para no tapar la escena, y anclada abajo a la
          izquierda: la cámara compensa corriendo la acción hacia el otro lado.
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <div className="bg-gradient-to-t from-primary-900 via-primary-900/85 to-transparent pt-24">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-10">
              <div className="max-w-xs sm:max-w-sm">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary-300">
                  La historia de la varilla
                </span>

                {STORY_CHAPTERS.map((chapter, index) => (
                  <div
                    key={chapter.step}
                    className={index === activeChapter ? 'block' : 'hidden'}
                  >
                    <h2 className="mt-2 flex items-baseline gap-2 text-xl sm:text-2xl font-bold text-white">
                      <span className="text-primary-400">{chapter.step}</span>
                      {chapter.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-steel-300 leading-relaxed">
                      {chapter.description}
                    </p>
                  </div>
                ))}

                {/* Indicador de avance entre capítulos. */}
                <div className="mt-5 flex gap-1.5">
                  {STORY_CHAPTERS.map((chapter, index) => (
                    <span
                      key={chapter.step}
                      className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                        index <= activeChapter ? 'bg-primary-400' : 'bg-white/15'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default RodStory
