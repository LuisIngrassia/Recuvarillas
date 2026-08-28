import { Suspense, lazy } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { company } from '../data/siteContent'

// Igual que la historia del scroll: three.js va en su propio trozo para no
// pesar en la primera carga. Comparten el mismo chunk, así que el segundo en
// pedirlo no descarga nada nuevo.
const RodViewer = lazy(() => import('../three/RodViewer'))

function Hero() {
  const reducedMotion = useReducedMotion()

  return (
    <section
      id="inicio"
      /*
        Hasta lg el texto se apoya abajo y el alambrado se queda con la franja
        de arriba: sobre pantalla angosta no hay lugar para ponerlos uno al lado
        del otro, y superpuestos el texto lo tapa entero.
      */
      className="relative isolate flex min-h-[40rem] items-end overflow-hidden bg-steel-50 lg:min-h-[46rem] lg:items-center"
    >
      {/* Apenas de color de marca detrás de las varillas, para que el claro no quede lavado. */}
      <div className="absolute inset-0 [background:radial-gradient(58%_55%_at_64%_45%,rgba(108,172,228,0.14),transparent_70%)]" />

      {/* Las varillas ocupan el hero entero y quedan detrás del texto. */}
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <RodViewer spin={!reducedMotion} />
        </Suspense>
      </div>

      {/*
        Velo que garantiza la lectura del texto. Sobre fondo claro aclara en vez
        de oscurecer, así las varillas se desvanecen hacia el lado del texto.

        Los cortes van escritos a mano y no con `via`, porque `via` planta el
        punto medio en el 50% exacto: sobre pantalla ancha eso deja el centro
        cubierto por un velo casi opaco y las varillas se ven blancas. Acá ya
        está transparente al 62%, pasando apenas el ancho del texto.
      */}
      <div className="pointer-events-none absolute inset-0 [background:linear-gradient(to_top,rgb(245,246,247)_0%,rgb(245,246,247)_34%,rgba(245,246,247,0.72)_50%,rgba(245,246,247,0.22)_62%,transparent_72%)] lg:[background:linear-gradient(to_right,rgb(245,246,247)_0%,rgb(245,246,247)_20%,rgba(245,246,247,0.68)_34%,rgba(245,246,247,0.2)_50%,transparent_62%)]" />

      {/*
        El texto no captura el puntero para que se puedan agarrar las varillas
        desde cualquier parte del hero; sólo los botones vuelven a capturarlo.
      */}
      <div className="pointer-events-none relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-xl">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-steel-900 sm:text-5xl lg:text-6xl">
            Varillas resistentes para el campo, con material recuperado
          </h1>
          <p className="mt-5 max-w-lg text-lg text-steel-500">
            En {company.name} producimos y comercializamos varillas de plástico
            recuperado para alambrados y cercos rurales: no se oxidan ni se
            pudren, cuestan menos y le dan una segunda vida al material.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#presupuesto"
              className="pointer-events-auto inline-flex items-center rounded-md bg-secondary-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary-600"
            >
              Solicitar presupuesto
            </a>
            <a
              href="#productos"
              className="pointer-events-auto inline-flex items-center rounded-md border border-steel-300 px-6 py-3 text-sm font-semibold text-steel-700 transition-colors hover:bg-steel-100"
            >
              Ver productos
            </a>
          </div>
        </div>
      </div>

      {/*
        Solo en escritorio: en celular la pista chocaría con el texto y además el
        gesto no aplica, porque en táctil el arrastre queda reservado para
        scrollear la página.
      */}
      <span className="pointer-events-none absolute inset-x-0 bottom-4 hidden text-center text-xs text-steel-400 lg:block">
        Arrastrá para ver una varilla en detalle · doble clic para volver al alambrado
      </span>
    </section>
  )
}

export default Hero
