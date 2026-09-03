/**
 * El ERP entero, colgado de /erp.
 *
 * Vive en el mismo proyecto que la landing pero se carga aparte (ver el
 * `lazy()` en `src/App.jsx`): quien entra a la web pública no se baja ni una
 * línea de esto.
 *
 * Nada de acá adentro se muestra sin sesión iniciada. La comprobación está en
 * un solo lugar, `Gate`, en vez de repetida en cada pantalla, y de todos modos
 * no es lo que protege los datos: eso lo hacen las políticas de Supabase, que
 * responderían vacío aunque alguien lograra pintar la interfaz.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import { signOut, useSession } from './lib/session'
import SessionProvider from './components/SessionProvider'
import Login from './pages/Login'
import { Loading } from './components/ui'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Leads = lazy(() => import('./pages/Leads'))
const Customers = lazy(() => import('./pages/Customers'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const QuotePrint = lazy(() => import('./pages/QuotePrint'))
const Stock = lazy(() => import('./pages/Stock'))
const Cash = lazy(() => import('./pages/Cash'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Profit = lazy(() => import('./pages/Profit'))
const Prices = lazy(() => import('./pages/Prices'))
const Carriers = lazy(() => import('./pages/Carriers'))
const Sellers = lazy(() => import('./pages/Sellers'))
const Documents = lazy(() => import('./pages/Documents'))
const DocPriceList = lazy(() => import('./pages/DocPriceList'))
const DocBrochure = lazy(() => import('./pages/DocBrochure'))
const DocDatasheet = lazy(() => import('./pages/DocDatasheet'))

/*
  El menú va partido en dos porque las pantallas se usan con frecuencias muy
  distintas: arriba lo del día a día y abajo lo que se toca cuando cambia una
  lista de precios o llega un tarifario nuevo. Sin la división son once ítems
  todos igual de importantes, que es como no tener menú.
*/
const SECTIONS = [
  { to: '/erp', label: 'Dashboard', end: true },
  { to: '/erp/leads', label: 'Leads' },
  { to: '/erp/clientes', label: 'Clientes' },
  { to: '/erp/pedidos', label: 'Pedidos' },
  { to: '/erp/stock', label: 'Stock' },
  { to: '/erp/caja', label: 'Caja' },
  { to: '/erp/costos', label: 'Costos' },
  { to: '/erp/rentabilidad', label: 'Rentabilidad' },
  { to: '/erp/documentos', label: 'Documentos' },
]

const SETTINGS = [
  { to: '/erp/precios', label: 'Precios' },
  { to: '/erp/fletes', label: 'Fletes' },
  { to: '/erp/vendedores', label: 'Vendedores' },
]

/** Qué hacer cuando el proyecto todavía no tiene las claves de Supabase. */
function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="text-xl font-bold text-steel-800">Falta conectar la base</h1>
      <p className="mt-3 text-sm leading-relaxed text-steel-600">
        El ERP guarda todo en Supabase y todavía no tiene las claves del
        proyecto. Copiá <code className="rounded bg-steel-100 px-1">.env.example</code>{' '}
        a <code className="rounded bg-steel-100 px-1">.env</code>, completá{' '}
        <code className="rounded bg-steel-100 px-1">VITE_SUPABASE_URL</code> y{' '}
        <code className="rounded bg-steel-100 px-1">VITE_SUPABASE_ANON_KEY</code>, y
        volvé a levantar el servidor.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-steel-600">
        El paso a paso completo, incluido el archivo SQL que crea las tablas,
        está en <code className="rounded bg-steel-100 px-1">docs/erp.md</code>.
      </p>
      <p className="mt-6 text-sm text-steel-400">
        Mientras tanto la landing funciona igual, con los precios del código.
      </p>
    </div>
  )
}

function NavItem({ to, label, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-secondary-500 text-white'
            : 'text-steel-600 hover:bg-steel-100 hover:text-steel-800'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

function Shell({ email, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="min-h-screen bg-steel-50 lg:flex">
      {/* Barra de arriba: sólo en pantallas chicas, donde no entra la columna. */}
      <header className="flex items-center justify-between border-b border-steel-200 bg-white px-4 py-3 lg:hidden print:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-7 w-auto" />
          <span className="text-sm font-bold text-steel-800">ERP</span>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          className="rounded-md border border-steel-200 px-3 py-1.5 text-sm font-semibold text-steel-600"
        >
          {menuOpen ? 'Cerrar' : 'Menú'}
        </button>
      </header>

      <nav
        className={`border-b border-steel-200 bg-white px-3 py-3 print:hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r ${
          menuOpen ? 'block' : 'hidden'
        }`}
      >
        <div className="mb-6 hidden items-center gap-2 px-2 lg:flex">
          <img src="/logo.png" alt="" className="h-8 w-auto" />
          <div>
            <p className="text-sm font-bold leading-tight text-steel-800">Recuvarilla</p>
            <p className="text-xs leading-tight text-steel-400">Gestión</p>
          </div>
        </div>

        <div className="space-y-1">
          {SECTIONS.map((section) => (
            <NavItem key={section.to} {...section} onNavigate={closeMenu} />
          ))}
        </div>

        <div className="mt-5 space-y-1 border-t border-steel-100 pt-4">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-steel-400">
            Ajustes
          </p>
          {SETTINGS.map((section) => (
            <NavItem key={section.to} {...section} onNavigate={closeMenu} />
          ))}
        </div>

        <div className="mt-6 border-t border-steel-100 pt-4">
          <p className="truncate px-3 text-xs text-steel-400" title={email}>
            {email}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-steel-500 hover:bg-steel-100"
          >
            Cerrar sesión
          </button>
          <a
            href="/"
            className="mt-1 block rounded-md px-3 py-2 text-sm font-medium text-steel-400 hover:bg-steel-100"
          >
            Ir a la web
          </a>
        </div>
      </nav>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}

function Gate() {
  const { session, loading } = useSession()

  if (!isSupabaseConfigured) return <SetupNotice />
  if (loading) return <Loading>Entrando…</Loading>
  if (!session) return <Login />

  return (
    <Shell email={session.user.email}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="clientes" element={<Customers />} />
          <Route path="clientes/:id" element={<CustomerDetail />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="pedidos/:id" element={<OrderDetail />} />
          <Route path="pedidos/:id/presupuesto" element={<QuotePrint />} />
          <Route path="stock" element={<Stock />} />
          <Route path="caja" element={<Cash />} />
          <Route path="costos" element={<Expenses />} />
          <Route path="rentabilidad" element={<Profit />} />
          <Route path="precios" element={<Prices />} />
          <Route path="fletes" element={<Carriers />} />
          <Route path="vendedores" element={<Sellers />} />
          <Route path="documentos" element={<Documents />} />
          <Route path="documentos/lista-de-precios" element={<DocPriceList />} />
          <Route path="documentos/folleto" element={<DocBrochure />} />
          <Route path="documentos/ficha-tecnica" element={<DocDatasheet />} />
          <Route path="*" element={<p className="text-sm text-steel-500">No existe esa pantalla.</p>} />
        </Routes>
      </Suspense>
    </Shell>
  )
}

export default function ErpApp() {
  /*
    El ERP no tiene por qué aparecer en Google. `robots.txt` ya lo pide, pero eso
    sólo vale para el crawler que lo respeta y para la ruta escrita ahí; esta
    etiqueta la agrega la propia pantalla y cubre cualquier subruta.
  */
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)

    const previousTitle = document.title
    document.title = 'Recuvarilla · Gestión'

    return () => {
      meta.remove()
      document.title = previousTitle
    }
  }, [])

  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  )
}
