import { useState } from 'react'
import { company } from '../data/siteContent'

function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', message: '' })

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const text = encodeURIComponent(
      `Hola ${company.name}, mi nombre es ${form.name || '[nombre]'}.\n` +
        `Teléfono: ${form.phone || '[teléfono]'}\n` +
        `Consulta: ${form.message || '[mensaje]'}`,
    )
    window.open(`https://wa.me/${company.whatsapp}?text=${text}`, '_blank', 'noopener')
  }

  return (
    <section id="contacto" className="bg-steel-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12">
        <div>
          <span className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
            Contacto
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-steel-800">
            Pedí tu presupuesto sin cargo
          </h2>
          <p className="mt-4 text-steel-500 leading-relaxed">
            Contanos qué necesitás y te respondemos a la brevedad con precio y
            disponibilidad.
          </p>

          <dl className="mt-8 space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-steel-800">Teléfono / WhatsApp</dt>
              <dd className="text-steel-500">{company.phone}</dd>
            </div>
            <div>
              <dt className="font-semibold text-steel-800">Email</dt>
              <dd className="text-steel-500">{company.email}</dd>
            </div>
            <div>
              <dt className="font-semibold text-steel-800">Dirección</dt>
              <dd className="text-steel-500">{company.address}</dd>
            </div>
            <div>
              <dt className="font-semibold text-steel-800">Horario</dt>
              <dd className="text-steel-500">{company.hours}</dd>
            </div>
          </dl>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-steel-200 bg-white p-6 sm:p-8 space-y-5"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-steel-800">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              className="mt-1.5 w-full rounded-md border border-steel-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-semibold text-steel-800">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              value={form.phone}
              onChange={handleChange}
              className="mt-1.5 w-full rounded-md border border-steel-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Tu teléfono de contacto"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-semibold text-steel-800">
              Mensaje
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              required
              value={form.message}
              onChange={handleChange}
              className="mt-1.5 w-full rounded-md border border-steel-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Contanos qué necesitás: tipo de varilla, cantidad, ubicación..."
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center rounded-md bg-secondary-500 px-6 py-3 text-sm font-semibold text-white hover:bg-secondary-600 transition-colors"
          >
            Enviar consulta por WhatsApp
          </button>
        </form>
      </div>
    </section>
  )
}

export default Contact
