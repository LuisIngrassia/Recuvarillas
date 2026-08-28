import { useState } from 'react'
import { company, navLinks } from '../data/siteContent'

function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white backdrop-blur border-b border-steel-100">
      <nav className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/*
          El logo ya trae el nombre, así que no lo repetimos al lado. El alt
          cumple ese papel para lectores de pantalla y buscadores.

          Las medidas van explícitas para que el navegador reserve el lugar
          antes de que baje la imagen y la barra no pegue un salto al cargar.
        */}
        <a href="#inicio" className="flex items-center">
          <img
            src="/logo.png"
            alt={company.name}
            width={366}
            height={200}
            className="h-11 w-auto"
          />
        </a>

        <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-steel-600">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="hover:text-secondary-500 transition-colors">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#presupuesto"
          className="hidden md:inline-flex items-center rounded-md bg-secondary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-secondary-600 transition-colors"
        >
          Pedir presupuesto
        </a>

        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-steel-600 hover:bg-steel-100"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-steel-100 bg-white">
          <ul className="flex flex-col px-4 py-3 gap-1 text-sm font-medium text-steel-600">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block rounded-md px-2 py-2 hover:bg-steel-50 hover:text-secondary-500"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="pt-2">
              <a
                href="#presupuesto"
                className="inline-flex w-full items-center justify-center rounded-md bg-secondary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-secondary-600"
                onClick={() => setOpen(false)}
              >
                Pedir presupuesto
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}

export default Navbar
