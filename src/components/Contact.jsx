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
    <section id="contacto" className="border-t border-grafito-200 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12">
        <div>
          <h2 className="font-display text-4xl text-grafito-900 sm:text-5xl lg:text-6xl">
            Escribinos. Te contestamos en el día.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-grafito-500">
            Contanos qué necesitás y te respondemos a la brevedad con precio y
            disponibilidad.
          </p>

          <dl className="mt-8 space-y-4 border-t-2 border-grafito-900 pt-6 text-[0.9375rem]">
            <div>
              <dt className="font-semibold text-grafito-800">Teléfono / WhatsApp</dt>
              <dd className="font-mono text-grafito-700">{company.phone}</dd>
            </div>
            <div>
              <dt className="font-semibold text-grafito-800">Email</dt>
              <dd className="text-grafito-500">{company.email}</dd>
            </div>
            <div>
              <dt className="font-semibold text-grafito-800">Dirección</dt>
              <dd className="text-grafito-500">{company.address}</dd>
            </div>
            <div>
              <dt className="font-semibold text-grafito-800">Horario</dt>
              <dd className="text-grafito-500">{company.hours}</dd>
            </div>
          </dl>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-md bg-grafito-100 p-6 sm:p-8"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-grafito-800">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              className="mt-1.5 min-h-11 w-full rounded-md border-[1.5px] border-alambre bg-white px-3 py-2 text-base text-grafito-900 focus:border-celeste-700 focus:outline-none focus:ring-2 focus:ring-celeste-700/20"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-semibold text-grafito-800">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              value={form.phone}
              onChange={handleChange}
              className="mt-1.5 min-h-11 w-full rounded-md border-[1.5px] border-alambre bg-white px-3 py-2 text-base text-grafito-900 focus:border-celeste-700 focus:outline-none focus:ring-2 focus:ring-celeste-700/20"
              placeholder="Tu teléfono de contacto"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-semibold text-grafito-800">
              Mensaje
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              required
              value={form.message}
              onChange={handleChange}
              className="mt-1.5 min-h-11 w-full rounded-md border-[1.5px] border-alambre bg-white px-3 py-2 text-base text-grafito-900 focus:border-celeste-700 focus:outline-none focus:ring-2 focus:ring-celeste-700/20"
              placeholder="Contanos qué necesitás: tipo de varilla, cantidad, ubicación..."
            />
          </div>

          <button
            type="submit"
            className="btn-principal w-full"
          >
            Enviar consulta por WhatsApp
          </button>
        </form>
      </div>
    </section>
  )
}

export default Contact
