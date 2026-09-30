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
      /*
        Fondo blanco liso: el manual pide el mayor contraste posible entre la
        varilla negra y el fondo, y nada de halos de color detrás.
      */
      className="relative isolate flex min-h-[40rem] items-end overflow-hidden bg-white lg:min-h-[46rem] lg:items-center"
    >

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
      <div className="pointer-events-none absolute inset-0 [background:linear-gradient(to_top,rgb(255,255,255)_0%,rgb(255,255,255)_34%,rgba(255,255,255,0.72)_50%,rgba(255,255,255,0.22)_62%,transparent_72%)] lg:[background:linear-gradient(to_right,rgb(255,255,255)_0%,rgb(255,255,255)_20%,rgba(255,255,255,0.68)_34%,rgba(255,255,255,0.2)_50%,transparent_62%)]" />

      {/*
        El texto no captura el puntero para que se puedan agarrar las varillas
        desde cualquier parte del hero; sólo los botones vuelven a capturarlo.
      */}
      <div className="pointer-events-none relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-xl">
          <h1 className="font-display text-5xl text-grafito-900 sm:text-6xl lg:text-[5.5rem]">
            Varillas de plástico recuperado, para tu campo.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-grafito-500">
            Botellas y tapitas que otros tiraron, fundidas en varillas de
            3&nbsp;×&nbsp;3 para tu alambrado. No se pudren, no se oxidan y
            vienen agujereadas a la medida de cada hilo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#presupuesto" className="btn-principal pointer-events-auto">
              Calcular mi presupuesto
            </a>
            <a
              href={`https://wa.me/${company.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-contorno pointer-events-auto bg-white/70"
            >
              Escribir por WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/*
        Solo en escritorio: en celular la pista chocaría con el texto y además el
        gesto no aplica, porque en táctil el arrastre queda reservado para
        scrollear la página.
      */}
      <span className="pointer-events-none absolute inset-x-0 bottom-7 hidden text-center text-xs text-grafito-400 lg:block">
        Arrastrá para ver una varilla en detalle · doble clic para volver al alambrado
      </span>

      {/* La franja cierra el hero: la marca de origen, una sola vez en la página. */}
      <div className="franja absolute inset-x-0 bottom-0 h-3" aria-hidden="true" />
    </section>
  )
}

export default Hero
