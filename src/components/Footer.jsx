import { company, navLinks } from '../data/siteContent'
import { LOGO } from '../lib/marca'

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-grafito-900 text-grafito-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-5">
          {/* El logo principal en negativo: la franja y la bajada se leen sobre grafito. */}
          <img
            src={LOGO.principal.negativo}
            alt={`${company.name}, 100% Argentina`}
            width={LOGO.principal.width}
            height={LOGO.principal.height}
            loading="lazy"
            className="h-auto w-56"
          />
          <p className="mt-6 max-w-xs font-display text-3xl text-white">
            Hecha para el campo. Pensada para durar.
          </p>
        </div>

        <nav aria-label="Secciones" className="lg:col-span-3">
          <h3 className="rotulo text-grafito-400">Navegación</h3>
          <ul className="mt-4 space-y-2 text-[0.9375rem]">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-4">
          <h3 className="rotulo text-grafito-400">Contacto</h3>
          <ul className="mt-4 space-y-2 font-mono text-sm leading-relaxed">
            <li>
              <a
                href={`https://wa.me/${company.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white transition-colors hover:text-celeste-300"
              >
                WhatsApp {company.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${company.email}`} className="transition-colors hover:text-white">
                {company.email}
              </a>
            </li>
            <li>
              <a
                href={company.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                @recuvarilla
              </a>
            </li>
            <li>{company.address}</li>
            <li>{company.hours}</li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <span className="varilla-blanca w-full max-w-sm opacity-90" aria-hidden="true" />
        <p className="py-6 text-xs text-grafito-400">
          © {year} {company.name}. Hecha en Luján con plástico recuperado.
        </p>
      </div>
    </footer>
  )
}

export default Footer
