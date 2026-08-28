import { testimonials } from '../data/siteContent'

function Testimonials() {
  return (
    // El fondo gris la separa de "Nosotros", que viene justo antes en blanco.
    <section className="bg-steel-100 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
            Testimonios
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-steel-800">
            Lo que dicen nuestros clientes
          </h2>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 gap-8">
          {testimonials.map((testimonial) => (
            <blockquote
              key={testimonial.author}
              className="rounded-xl border border-steel-200 bg-white p-8"
            >
              <p className="text-steel-600 leading-relaxed">“{testimonial.quote}”</p>
              <footer className="mt-4 text-sm font-semibold text-secondary-500">
                {testimonial.author}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials
