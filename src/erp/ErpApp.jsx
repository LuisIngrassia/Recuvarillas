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
import { LOGO } from '../lib/marca'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const LeadsToday = lazy(() => import('./pages/LeadsToday'))
const LeadsBoard = lazy(() => import('./pages/LeadsBoard'))
const LeadDetail = lazy(() => import('./pages/LeadDetail'))
const LeadsFunnel = lazy(() => import('./pages/LeadsFunnel'))
const Leads = lazy(() => import('./pages/Leads'))
const Customers = lazy(() => import('./pages/Customers'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const QuotePrint = lazy(() => import('./pages/QuotePrint'))
const Stock = lazy(() => import('./pages/Stock'))
const Cash = lazy(() => import('./pages/Cash'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Shipping = lazy(() => import('./pages/Shipping'))
const ExpenseTypes = lazy(() => import('./pages/ExpenseTypes'))
const Profit = lazy(() => import('./pages/Profit'))
const Prices = lazy(() => import('./pages/Prices'))
const Products = lazy(() => import('./pages/Products'))
const Carriers = lazy(() => import('./pages/Carriers'))
const Sellers = lazy(() => import('./pages/Sellers'))
const ProductionCost = lazy(() => import('./pages/ProductionCost'))
const Documents = lazy(() => import('./pages/Documents'))
const DocPriceList = lazy(() => import('./pages/DocPriceList'))
const DocBrochure = lazy(() => import('./pages/DocBrochure'))
const DocDatasheet = lazy(() => import('./pages/DocDatasheet'))
const Social = lazy(() => import('./pages/Social'))
const SocialPost = lazy(() => import('./pages/SocialPost'))

/*
  El menú va partido en dos porque las pantallas se usan con frecuencias muy
  distintas: arriba lo del día a día y abajo lo que se toca cuando cambia una
  lista de precios o llega un tarifario nuevo. Sin la división son once ítems
  todos igual de importantes, que es como no tener menú.
*/
const SECTIONS = [
  /*
    "Hoy" es la pantalla de entrada, no el dashboard.

    El dashboard contesta cómo viene el negocio; "Hoy" contesta qué hay que
    hacer ahora, y eso es lo que se necesita al abrir el sistema a la mañana. El
    panel de siempre no se perdió: quedó acá abajo como "Panel".
  */
  { to: '/erp', label: 'Hoy', end: true },
  { to: '/erp/leads/tablero', label: 'Tablero' },
  { to: '/erp/leads/embudo', label: 'Embudo' },
  { to: '/erp/leads', label: 'Leads', end: true },
  { to: '/erp/panel', label: 'Panel' },
  { to: '/erp/clientes', label: 'Clientes' },
  { to: '/erp/pedidos', label: 'Pedidos' },
  { to: '/erp/stock', label: 'Stock' },
  { to: '/erp/caja', label: 'Caja' },
  { to: '/erp/envios', label: 'Envíos' },
  { to: '/erp/costos', label: 'Costos' },
  { to: '/erp/rentabilidad', label: 'Rentabilidad' },
  { to: '/erp/documentos', label: 'Documentos' },
  { to: '/erp/redes', label: 'Redes' },
]

const SETTINGS = [
  { to: '/erp/productos', label: 'Productos' },
  { to: '/erp/precios', label: 'Precios' },
  // { to: '/erp/costo-varilla', label: 'Costo de la varilla' },
  { to: '/erp/fletes', label: 'Fletes' },
  { to: '/erp/vendedores', label: 'Vendedores' },
  { to: '/erp/tipos-de-gasto', label: 'Tipos de gasto' },
]

/** Qué hacer cuando el proyecto todavía no tiene las claves de Supabase. */
function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="text-xl font-bold text-grafito-800">Falta conectar la base</h1>
      <p className="mt-3 text-sm leading-relaxed text-grafito-600">
        El ERP guarda todo en Supabase y todavía no tiene las claves del
        proyecto. Copiá <code className="rounded bg-grafito-100 px-1">.env.example</code>{' '}
        a <code className="rounded bg-grafito-100 px-1">.env</code>, completá{' '}
        <code className="rounded bg-grafito-100 px-1">VITE_SUPABASE_URL</code> y{' '}
        <code className="rounded bg-grafito-100 px-1">VITE_SUPABASE_ANON_KEY</code>, y
        volvé a levantar el servidor.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-grafito-600">
        El paso a paso completo, incluido el archivo SQL que crea las tablas,
        está en <code className="rounded bg-grafito-100 px-1">docs/erp.md</code>.
      </p>
      <p className="mt-6 text-sm text-grafito-400">
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
        `block rounded px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-grafito-700 font-semibold text-white shadow-[inset_0_-2px_0_var(--color-celeste-400)]'
            : 'font-medium text-grafito-300 hover:bg-grafito-800 hover:text-white'
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
    <div className="min-h-screen bg-grafito-100 lg:flex">
      {/* Barra de arriba: sólo en pantallas chicas, donde no entra la columna. */}
      <header className="flex items-center justify-between bg-grafito-900 px-4 py-3 lg:hidden print:hidden">
        <img
          src={LOGO.palabra.negativo}
          alt="Recuvarilla"
          width={LOGO.palabra.width}
          height={LOGO.palabra.height}
          className="h-5 w-auto"
        />
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          className="rounded-md border border-grafito-600 px-3 py-1.5 text-sm font-semibold text-white"
        >
          {menuOpen ? 'Cerrar' : 'Menú'}
        </button>
      </header>

      <nav
        className={`overflow-y-auto bg-grafito-900 px-3 py-3 print:hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:w-56 lg:shrink-0 ${
          menuOpen ? 'block' : 'hidden'
        }`}
      >
        <div className="mb-6 hidden px-3 pt-2 lg:block">
          <img
            src={LOGO.palabra.negativo}
            alt="Recuvarilla"
            width={LOGO.palabra.width}
            height={LOGO.palabra.height}
            className="h-auto w-36"
          />
          <p className="rotulo mt-2 text-grafito-400">Gestión</p>
        </div>

        <div className="space-y-1">
          {SECTIONS.map((section) => (
            <NavItem key={section.to} {...section} onNavigate={closeMenu} />
          ))}
        </div>

        <div className="mt-5 space-y-1 border-t border-grafito-700 pt-4">
          <p className="rotulo px-3 pb-1 text-grafito-400">
            Ajustes
          </p>
          {SETTINGS.map((section) => (
            <NavItem key={section.to} {...section} onNavigate={closeMenu} />
          ))}
        </div>

        <div className="mt-6 border-t border-grafito-700 pt-4">
          <p className="truncate px-3 text-xs text-grafito-400" title={email}>
            {email}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 w-full rounded px-3 py-2 text-left text-sm font-medium text-grafito-300 hover:bg-grafito-800 hover:text-white"
          >
            Cerrar sesión
          </button>
          <a
            href="/"
            className="mt-1 block rounded px-3 py-2 text-sm font-medium text-grafito-300 hover:bg-grafito-800 hover:text-white"
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
          <Route index element={<LeadsToday />} />
          <Route path="panel" element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          {/* El tablero va antes que `:id` para que "tablero" no se lea como un id. */}
          <Route path="leads/tablero" element={<LeadsBoard />} />
          <Route path="leads/embudo" element={<LeadsFunnel />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="clientes" element={<Customers />} />
          <Route path="clientes/:id" element={<CustomerDetail />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="pedidos/:id" element={<OrderDetail />} />
          <Route path="pedidos/:id/presupuesto" element={<QuotePrint />} />
          <Route path="stock" element={<Stock />} />
          <Route path="caja" element={<Cash />} />
          <Route path="envios" element={<Shipping />} />
          <Route path="costos" element={<Expenses />} />
          <Route path="tipos-de-gasto" element={<ExpenseTypes />} />
          <Route path="rentabilidad" element={<Profit />} />
          <Route path="productos" element={<Products />} />
          <Route path="precios" element={<Prices />} />
          <Route path="costo-varilla" element={<ProductionCost />} />
          <Route path="fletes" element={<Carriers />} />
          <Route path="vendedores" element={<Sellers />} />
          <Route path="documentos" element={<Documents />} />
          <Route path="documentos/lista-de-precios" element={<DocPriceList />} />
          <Route path="documentos/folleto" element={<DocBrochure />} />
          <Route path="documentos/ficha-tecnica" element={<DocDatasheet />} />
          <Route path="redes" element={<Social />} />
          <Route path="redes/:id" element={<SocialPost />} />
          <Route path="*"element={<p className="text-sm text-grafito-500">No existe esa pantalla.</p>} />
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
