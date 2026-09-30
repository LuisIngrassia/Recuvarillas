import { useState } from 'react'
import { company, navLinks } from '../data/siteContent'
import { LOGO } from '../lib/marca'

function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-grafito-200 bg-white">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {/*
          La versión "solo palabra" del logo: la barra es baja y ancha, que es
          justo para lo que está pensada. El alt hace de nombre para lectores
          de pantalla y buscadores.
        */}
        <a href="#inicio" className="flex shrink-0 items-center">
          <img
            src={LOGO.palabra.color}
            alt={company.name}
            width={LOGO.palabra.width}
            height={LOGO.palabra.height}
            className="h-6 w-auto sm:h-7"
          />
        </a>

        <ul className="hidden items-center gap-7 text-[0.9375rem] font-semibold text-grafito-700 lg:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="transition-colors hover:text-celeste-700">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <a href="#presupuesto" className="btn-principal hidden min-h-10 px-4 py-2 text-[0.9375rem] lg:inline-flex">
          Cotizar
        </a>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-grafito-700 hover:bg-grafito-100 lg:hidden"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {open ? (
              <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="square" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-grafito-200 bg-white lg:hidden">
          <ul className="flex flex-col gap-1 px-4 py-3 text-base font-semibold text-grafito-700">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block rounded-md px-2 py-2.5 hover:bg-grafito-50 hover:text-celeste-700"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="pt-2">
              <a href="#presupuesto" className="btn-principal w-full" onClick={() => setOpen(false)}>
                Calcular mi presupuesto
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}

export default Navbar
