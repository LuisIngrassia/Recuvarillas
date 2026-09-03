/**
 * Las piezas visuales que repiten todas las pantallas del ERP.
 *
 * Son deliberadamente chicas y sin estado: acá vive cómo se ve un botón o una
 * tabla, no qué hace. La paleta es la misma de la landing (`src/index.css`),
 * pero todo va más apretado: esto se usa muchas horas y con muchas filas a la
 * vista, no es una página para recorrer una vez.
 */
import { useEffect } from 'react'
import { formatPesos } from '../lib/format'

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-steel-800">{title}</h1>
        {description && <p className="mt-1 text-sm text-steel-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section
      className={`rounded-xl border border-steel-200 bg-white shadow-sm ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-steel-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-steel-700">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

/** Un número grande con su rótulo. El bloque del panel de entrada. */
export function Stat({ label, value, hint, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-steel-800',
    good: 'text-secondary-500',
    warn: 'text-amber-600',
  }

  return (
    <div className="rounded-xl border border-steel-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-steel-400">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-steel-400">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Controles
// ---------------------------------------------------------------------------

const buttonStyles = {
  primary: 'bg-secondary-500 text-white hover:bg-secondary-600 disabled:bg-steel-300',
  soft: 'bg-steel-100 text-steel-700 hover:bg-steel-200',
  ghost: 'border border-steel-200 bg-white text-steel-600 hover:border-steel-300',
  danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
}

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${buttonStyles[variant]} ${className}`}
    />
  )
}

const controlClass =
  'w-full rounded-md border border-steel-200 bg-white px-3 py-2 text-sm text-steel-800 focus:border-secondary-500 focus:outline-none focus:ring-2 focus:ring-secondary-500/20 disabled:bg-steel-50'

export function Input({ className = '', ...props }) {
  return <input {...props} className={`${controlClass} ${className}`} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea {...props} className={`${controlClass} ${className}`} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select {...props} className={`${controlClass} ${className}`}>
      {children}
    </select>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-steel-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-steel-400">{hint}</span>}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

/**
 * El contenedor de las tablas hace scroll horizontal por su cuenta.
 *
 * Son tablas con muchas columnas y se miran también desde el teléfono: sin esto
 * la página entera se correría de costado y arrastraría al menú con ella.
 */
export function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-steel-100 bg-steel-50 text-xs uppercase tracking-wide text-steel-500">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-steel-100">{children}</tbody>
      </table>
    </div>
  )
}

/*
  Las clases se escriben enteras y se eligen de este mapa. Tailwind busca los
  nombres tal cual aparecen en el código, así que armar `text-${align}` a mano
  daría una clase que nunca llega a generarse.
*/
const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }

export function Th({ align = 'left', className = '', children }) {
  return (
    <th className={`px-4 py-2.5 font-semibold ${alignClass[align]} ${className}`}>
      {children}
    </th>
  )
}

export function Td({ align = 'left', className = '', children, ...props }) {
  return (
    <td {...props} className={`px-4 py-2.5 ${alignClass[align]} ${className}`}>
      {children}
    </td>
  )
}

const badgeTones = {
  neutral: 'bg-steel-100 text-steel-600',
  info: 'bg-primary-100 text-primary-700',
  good: 'bg-secondary-100 text-secondary-700',
  warn: 'bg-amber-100 text-amber-700',
  bad: 'bg-red-100 text-red-700',
}

export function Badge({ tone = 'neutral', children }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTones[tone]}`}
    >
      {children}
    </span>
  )
}

/** Importe alineado a la derecha, con los ceros en la misma columna. */
export function Money({ value, className = '' }) {
  return (
    <span className={`tabular-nums ${className}`}>{formatPesos(Number(value ?? 0))}</span>
  )
}

// ---------------------------------------------------------------------------
// Estados de la pantalla
// ---------------------------------------------------------------------------

export function Loading({ children = 'Cargando…' }) {
  return <p className="px-4 py-8 text-center text-sm text-steel-400">{children}</p>
}

export function Empty({ children }) {
  return <p className="px-4 py-8 text-center text-sm text-steel-400">{children}</p>
}

export function ErrorNote({ children, onRetry }) {
  if (!children) return null

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-2 font-semibold underline underline-offset-2"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

/**
 * Muestra el estado de una carga: cargando, error o los datos.
 *
 * Existe para que ninguna pantalla se olvide de contemplar los tres casos, que
 * es como se termina viendo una tabla vacía cuando en realidad la consulta
 * falló.
 */
export function Async({ query, empty, children }) {
  if (query.loading) return <Loading />
  if (query.error) return <ErrorNote onRetry={query.reload}>{query.error}</ErrorNote>
  if (empty && (!query.data || query.data.length === 0)) return <Empty>{empty}</Empty>
  return children(query.data)
}

// ---------------------------------------------------------------------------
// Diálogo
// ---------------------------------------------------------------------------

export function Modal({ title, onClose, children, wide }) {
  // Escape cierra: es lo que espera cualquiera que abrió una ventana encima de
  // lo que estaba haciendo.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-steel-900/40 p-4 sm:p-8">
      {/* El fondo cierra al hacer clic, pero el diálogo no: por eso el stopPropagation. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`relative w-full rounded-xl bg-white shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <header className="flex items-center justify-between border-b border-steel-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-steel-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
