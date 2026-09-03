/**
 * Las dos mitades del proyecto: la web pública en `/` y el ERP en `/erp`.
 *
 * El ERP se carga con `lazy` a propósito. Comparten proyecto y deploy, pero no
 * bundle: quien entra a la landing no se baja el sistema de gestión, que es
 * código que no va a usar nunca y que además arrastra el cliente de Supabase.
 *
 * Para que entrar directo a /erp o recargar ahí no dé 404, el server tiene que
 * devolver `index.html` en cualquier ruta. En Vercel eso lo hace `vercel.json`.
 */
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import Landing from './Landing'

const ErpApp = lazy(() => import('./erp/ErpApp'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/erp/*"
          element={
            <Suspense
              fallback={
                <p className="p-8 text-center text-sm text-steel-400">Cargando…</p>
              }
            >
              <ErpApp />
            </Suspense>
          }
        />
        {/* Cualquier otra dirección cae en la landing, que es lo que se espera
            de un link viejo o mal copiado. */}
        <Route path="*" element={<Landing />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  )
}

export default App
