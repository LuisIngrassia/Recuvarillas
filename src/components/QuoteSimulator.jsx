import { useEffect, useMemo, useState } from 'react'
import { company } from '../data/siteContent'
import { ORIGIN, QUOTE_VALID_DAYS, ROAD_FACTOR } from '../data/pricing'
import { buildQuote, formatNumber, formatPesos } from '../lib/quote'
import { findPostalCode, loadPostalCodes } from '../lib/postalCodes'
import { canonicalProvince } from '../lib/provinces'
import { usePriceTiers } from '../lib/priceTiers'
import { recordLead } from '../lib/leads'
import { useCatalogo } from '../lib/catalogo'
import { enPlural } from '../lib/productos'

const EMPTY = {
  quantity: '1000',
  drilled: 'no',
  delivery: 'pickup',
  postalCode: '',
  name: '',
  phone: '',
  email: '',
}

/** Resuelve el código postal contra el padrón, que se descarga al primer uso. */
function usePostalLookup(code, enabled) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || data) return
    setLoading(true)
    let cancelled = false
    loadPostalCodes()
      .then((loaded) => {
        if (!cancelled) setData(loaded)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, data])

  const place = useMemo(() => (data ? findPostalCode(data, code) : null), [data, code])
  const ready = /^\d{4}$/.test(code.trim())

  return { place, loading, ready, notFound: ready && data !== null && place === null }
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-grafito-800">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-grafito-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const inputClass =
  'min-h-11 w-full rounded-md border-[1.5px] border-alambre bg-white px-3 py-2 text-base text-grafito-900 focus:border-celeste-700 focus:outline-none focus:ring-2 focus:ring-celeste-700/20'

/** Grupo de dos opciones excluyentes, estilo botones. */
function Choice({ value, onChange, options }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`min-h-11 rounded-md border-[1.5px] px-3 py-2 text-sm font-semibold transition-colors ${
            value === option.value
              ? 'border-grafito-900 bg-grafito-900 text-white'
              : 'border-alambre bg-white text-grafito-700 hover:border-grafito-500'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className={strong ? 'font-semibold text-grafito-800' : 'text-grafito-500'}>
        {label}
      </span>
      <span
        className={`whitespace-nowrap font-mono ${
          strong ? 'text-lg font-semibold text-grafito-900' : 'font-medium text-grafito-700'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function QuoteSimulator() {
  const [form, setForm] = useState(EMPTY)
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')

  const set = (key) => (event) => {
    const value = event?.target ? event.target.value : event
    setForm((prev) => ({ ...prev, [key]: value }))
    // Un cambio invalida el presupuesto anterior: que no quede a la vista un
    // número que ya no corresponde a lo que dice el formulario.
    setQuote(null)
  }

  const quantity = Number.parseInt(form.quantity, 10)
  const shipping = form.delivery === 'shipping'
  const { place, loading, notFound } = usePostalLookup(form.postalCode, shipping)

  // La lista viene de la base para poder cambiar precios sin deployar.
  const tiers = usePriceTiers()

  /*
    Qué producto cotiza: el marcado para la web en el ERP. Hace falta saberlo
    para nombrarlo bien —no todo son varillas— y para dejarlo asentado en el
    lead, así el presupuesto que arma el ERP es de lo mismo que se cotizó acá.
    Sin catálogo (la base no contestó) los precios son los del código, que son
    los de la varilla, y se la nombra así.
  */
  const catalogo = useCatalogo()
  const producto = catalogo?.find((item) => item.en_web) ?? null
  const cosas = producto ? enPlural(producto) : 'varillas'
  const seAgujerea = producto ? producto.se_agujerea : true
  const drilled = seAgujerea && form.drilled === 'si'

  /*
    El simulador cotiza siempre la lista minorista, que es la pública. La
    mayorista es la de los revendedores con acuerdo y no se muestra acá: no es
    un descuento que se gane por llevar mucho de una vez, es una condición de
    quien compra todos los meses.

    El número que se muestra es desde dónde empieza a bajar el precio dentro de
    la lista pública, que es el segundo escalón.
  */
  const descuentoDesde = useMemo(
    () => tiers.filter((tier) => tier.kind === 'minorista')[1]?.min,
    [tiers],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!Number.isFinite(quantity) || quantity < 1) {
      setError(`Poné cuántos ${cosas} necesitás.`)
      return
    }
    if (shipping && !place) {
      setError('Necesitamos un código postal válido para saber a dónde llega el pedido.')
      return
    }
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Dejanos tu nombre y un teléfono para poder responderte.')
      return
    }

    setError('')
    const result = buildQuote({
      quantity,
      drilled,
      tiers,
      kind: 'minorista',
    })
    setQuote({ ...result, place: shipping ? place : null })

    // Sin await: que el registro ande o no, no puede demorar el presupuesto.
    recordLead({
      nombre: form.name.trim(),
      telefono: form.phone.trim(),
      email: form.email.trim(),
      productId: producto?.id ?? null,
      cantidad: quantity,
      agujereada: drilled,
      entrega: shipping ? 'envio' : 'retiro',
      codigoPostal: shipping ? place.code : '',
      localidad: shipping ? place.name : '',
      /* Con el nombre de la lista y no como lo escribe el padrón: un lead que
         entró por la web tiene que decir lo mismo que uno cargado a mano. */
      provincia: shipping ? canonicalProvince(place.province) : '',
      kilometros: shipping ? Math.round(place.km * ROAD_FACTOR) : null,
      precioUnitario: result.unitPrice,
      mercaderia: result.total,
    })
  }

  const whatsappLink = useMemo(() => {
    if (!quote) return '#'

    const lines = [
      `Hola ${company.name}, simulé un presupuesto en la web:`,
      '',
      `• ${formatNumber(quantity)} ${cosas}${seAgujerea ? (drilled ? ' agujereados' : ' sin agujerear') : ''}`,
      `• Precio unitario: ${formatPesos(quote.unitPrice)} + IVA`,
      `• Mercadería: ${formatPesos(quote.total)} + IVA`,
    ]

    if (quote.place) {
      lines.push(`• Envío a ${quote.place.name} (${quote.place.code}): flete a cotizar`)
    } else {
      lines.push(`• Retiro en fábrica (${ORIGIN.city})`)
    }

    lines.push(
      `• TOTAL mercadería: ${formatPesos(quote.total)} + IVA (sin el flete)`,
      '',
      `Mi nombre es ${form.name.trim()}.`,
    )

    return `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`
  }, [quote, quantity, drilled, seAgujerea, cosas, form.name])

  return (
    <section id="presupuesto" className="border-t border-grafito-200 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl text-grafito-900 sm:text-5xl lg:text-6xl">
            Calculá tu presupuesto en un minuto.
          </h2>
          <p className="mt-5 text-lg text-grafito-500">
            Poné la cantidad y te mostramos el precio de la mercadería al
            instante. Todos los valores son{' '}
            <strong className="text-grafito-700">sin IVA</strong> y el flete se
            cotiza aparte.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          <form onSubmit={handleSubmit} className="lg:col-span-3">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={`Cantidad de ${cosas}`}
                hint={
                  descuentoDesde &&
                  `Desde ${formatNumber(descuentoDesde)} unidades el precio baja`
                }
              >
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={set('quantity')}
                  className={inputClass}
                />
              </Field>

              {seAgujerea && (
                <Field label="¿Agujereado de fábrica?">
                  <Choice
                    value={form.drilled}
                    onChange={set('drilled')}
                    options={[
                      { value: 'no', label: 'Sin agujerear' },
                      { value: 'si', label: 'Agujereado' },
                    ]}
                  />
                </Field>
              )}

              <Field label="¿Cómo la recibís?">
                <Choice
                  value={form.delivery}
                  onChange={set('delivery')}
                  options={[
                    { value: 'pickup', label: `Retiro en ${ORIGIN.city}` },
                    { value: 'shipping', label: 'Con envío' },
                  ]}
                />
              </Field>

              {shipping && (
                <Field label="Código postal del destino" hint="Para cotizarte el flete">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="6700"
                    value={form.postalCode}
                    onChange={set('postalCode')}
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-xs">
                    {loading && <span className="text-grafito-400">Buscando…</span>}
                    {place && (
                      <span className="font-medium text-celeste-700">
                        {place.name}, {place.province} · a{' '}
                        {formatNumber(Math.round(place.km * ROAD_FACTOR))} km aprox.
                      </span>
                    )}
                    {notFound && (
                      <span className="text-grafito-500">
                        No encontramos ese código. Escribinos y lo cotizamos a mano.
                      </span>
                    )}
                  </p>
                </Field>
              )}
            </div>

            <div className="mt-8 rounded-md bg-grafito-100 p-5">
              <p className="text-sm font-semibold text-grafito-800">¿Con quién hablamos?</p>
              <p className="mt-1 text-xs text-grafito-500">
                Para poder responderte si necesitás ajustar algo del presupuesto.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre">
                  <input
                    type="text"
                    value={form.name}
                    onChange={set('name')}
                    className={inputClass}
                  />
                </Field>
                <Field label="WhatsApp o teléfono">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    className={inputClass}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Email (opcional)">
                    <input
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {error && <p className="mt-4 text-sm font-medium text-tapita-600">{error}</p>}

            <button type="submit" className="btn-principal mt-6 w-full sm:w-auto">
              Calcular presupuesto
            </button>
          </form>

          <div className="lg:col-span-2">
            {quote ? (
              <div className="rounded-md border border-grafito-200 border-t-4 border-t-grafito-900 bg-white p-6 shadow-sm">
                {/* Antes decía el `kind` del escalón, que era 'mayorista' a
                    partir de 1.000. Ahora la lista mayorista es la de los
                    revendedores con acuerdo y no la que cotiza la web, así que
                    mostrar ese rótulo acá prometía un precio que no es este. */}
                <p className="rotulo text-grafito-500">Precio de lista</p>

                <div className="mt-4 divide-y divide-grafito-100 text-sm">
                  <Row
                    label={`${formatNumber(quantity)} ${cosas} × ${formatPesos(quote.unitPrice)}`}
                    value={formatPesos(quote.total)}
                  />

                  {quote.place ? (
                    <Row
                      label={
                        <>
                          Flete a {quote.place.name}
                          <span className="block text-xs text-grafito-400">
                            Lo cotiza la empresa de transporte
                          </span>
                        </>
                      }
                      value="A cotizar"
                    />
                  ) : (
                    <Row label={`Retiro en fábrica (${ORIGIN.city})`} value="Sin cargo" />
                  )}

                  <Row
                    label="Total mercadería sin IVA"
                    value={formatPesos(quote.total)}
                    strong
                  />
                </div>

                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-principal mt-6 w-full"
                >
                  Cerrar el pedido por WhatsApp
                </a>

                <p className="mt-4 text-xs leading-relaxed text-grafito-400">
                  Los importes no incluyen IVA. Presupuesto válido por{' '}
                  {QUOTE_VALID_DAYS} días. El total es sólo la mercadería: el
                  flete lo cotiza la empresa de transporte según el destino y se
                  suma al cerrar el pedido. Precios sujetos a modificación sin
                  previo aviso.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-alambre p-6 text-sm text-grafito-500">
                Completá los datos y te mostramos el total acá.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default QuoteSimulator
