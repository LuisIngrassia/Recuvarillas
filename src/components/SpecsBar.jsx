/**
 * La franja grafito debajo del hero: los cuatro datos de la ficha.
 *
 * Son datos del producto, no números para impresionar: el manual pide que el
 * número diga algo medible (sección 07 · Tono).
 */
const SPECS = [
  { value: '120 cm', label: 'Largo estándar' },
  { value: '3 × 3 cm', label: 'Sección cuadrada' },
  { value: '100%', label: 'Polipropileno recuperado' },
  { value: '0', label: 'Mantenimiento: no se pinta ni se repone' },
]

function SpecsBar() {
  return (
    <section aria-label="Ficha de la varilla" className="bg-grafito-900 text-white">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
        {SPECS.map((spec) => (
          <div key={spec.label} className="flex flex-col-reverse gap-1 py-6 pr-4">
            <dt className="text-sm text-grafito-300">{spec.label}</dt>
            <dd className="font-mono text-2xl font-medium sm:text-3xl">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default SpecsBar
