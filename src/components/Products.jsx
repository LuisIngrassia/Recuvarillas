import { products } from '../data/siteContent'

function Products() {
  return (
    <section id="productos" className="bg-steel-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
            Productos
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-steel-800">
            Varillas para cada necesidad del campo
          </h2>
          <p className="mt-4 text-steel-500">
            Todos nuestros productos parten de material recuperado y pasan por
            control de calidad antes de salir de planta.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <div
              key={product.name}
              className="flex flex-col rounded-xl border border-steel-200 bg-white p-6 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="aspect-video w-full rounded-lg bg-steel-100 flex items-center justify-center mb-5">
                <span className="text-steel-400 text-xs px-4 text-center">
                  [ Foto del producto ]
                </span>
              </div>
              <h3 className="text-lg font-bold text-steel-800">{product.name}</h3>
              <p className="mt-2 text-sm text-steel-500 leading-relaxed">
                {product.description}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-steel-600">
                {product.specs.map((spec) => (
                  <li key={spec} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                    {spec}
                  </li>
                ))}
              </ul>
              <a
                href="#contacto"
                className="mt-6 inline-flex items-center text-sm font-semibold text-secondary-500 hover:text-secondary-600"
              >
                Consultar disponibilidad →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Products
