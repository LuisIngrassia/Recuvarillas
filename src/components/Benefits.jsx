import { benefits } from '../data/siteContent'

function Benefits() {
  return (
    <section id="beneficios" className="bg-secondary-900 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary-300">
            Por qué elegirnos
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-white">
            Calidad probada, precio justo y compromiso ambiental
          </h2>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-400/20 flex items-center justify-center mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-400" />
              </div>
              <h3 className="font-semibold text-white">{benefit.title}</h3>
              <p className="mt-2 text-sm text-steel-300 leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Benefits
