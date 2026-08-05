function About() {
  const stats = [
    { value: '+25', label: 'clientes que confiaron' },
    { value: '+100 t', label: 'de material recuperado por año' },
    { value: '+1000', label: 'arboles contentos' },
  ]

  return (
    <section id="nosotros" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div className="aspect-[4/3] w-full rounded-xl bg-steel-100 flex items-center justify-center order-last lg:order-first">
          <img src="stock.png" alt="Stock" className="text-steel-400 text-sm px-6 text-center">
            
          </img>
        </div>

        <div>
          <span className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
            Nosotros
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-steel-800">
            Le damos una segunda vida al plástico para el trabajo rural
          </h2>
          <p className="mt-4 text-steel-500 leading-relaxed">
            Recuvarilla nace para ofrecer una alternativa sustentable y
            económica a la varilla tradicional. Recuperamos plástico en desuso,
            lo procesamos con controles de calidad propios y lo transformamos
            en varillas listas para alambrados y cercos de uso rural.
          </p>
          <p className="mt-4 text-steel-500 leading-relaxed">
            [ Espacio para historia, misión y valores reales de la empresa. ]
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl sm:text-3xl font-extrabold text-secondary-500">
                  {stat.value}
                </dd>
                <p className="mt-1 text-xs sm:text-sm text-steel-500">{stat.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

export default About
