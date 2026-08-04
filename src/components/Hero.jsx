import { company } from '../data/siteContent'

function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden bg-secondary-900">
      <div className="absolute inset-0 opacity-20 [background:repeating-linear-gradient(115deg,theme(colors.primary.400)_0px,theme(colors.primary.400)_2px,transparent_2px,transparent_40px)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block rounded-full bg-primary-400/15 px-3 py-1 text-xs font-semibold tracking-wide text-primary-300 uppercase">
            Material recuperado · Uso rural
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Varillas resistentes para el campo, con material recuperado
          </h1>
          <p className="mt-5 text-lg text-steel-200 max-w-xl">
            En {company.name} producimos y comercializamos varillas de plástico
            recuperado para alambrados y cercos rurales: no se oxidan ni se
            pudren, cuestan menos y le dan una segunda vida al material.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#contacto"
              className="inline-flex items-center rounded-md bg-primary-400 px-6 py-3 text-sm font-semibold text-secondary-900 hover:bg-primary-300 transition-colors"
            >
              Solicitar presupuesto
            </a>
            <a
              href="#productos"
              className="inline-flex items-center rounded-md border border-steel-200/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Ver productos
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-[4/3] w-full rounded-xl border border-white/10 bg-steel-800/60 flex items-center justify-center">
            <span className="text-steel-400 text-sm px-6 text-center">
              [ Imagen de varillas / alambrado en campo — reemplazar por foto real ]
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
