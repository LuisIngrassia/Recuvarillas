import { company, navLinks } from '../data/siteContent'

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-secondary-900 text-steel-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid sm:grid-cols-3 gap-8">
        <div>
          <span className="flex items-center gap-2 font-bold text-lg text-white">
            <span className="inline-block w-3 h-8 bg-primary-400 rounded-sm" />
            {company.name}
          </span>
          <p className="mt-3 text-sm text-steel-400 max-w-xs">
            Producción y venta de varillas para el campo elaboradas con
            material recuperado.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
            Navegación
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:text-primary-300 transition-colors">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
            Contacto
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-steel-400">
            <li>{company.phone}</li>
            <li>{company.email}</li>
            <li>{company.address}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-xs text-steel-500">
          © {year} {company.name}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}

export default Footer
