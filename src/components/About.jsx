function About() {
  const stats = [
    { value: '+25', label: 'clientes que confiaron' },
    { value: '+100 t', label: 'de material recuperado por año' },
    { value: '+1000', label: 'arboles contentos' },
  ]

  return (
    <section id="nosotros" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div className=" w-full overflow-hidden rounded-xl bg-steel-100 order-last lg:order-first">
          <img
            src="/fogata.jpg"
            alt="Varillas de Recuvarilla en stock"
            loading="lazy"
            className="h-full w-full object-cover"
          />
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
           MISIÓN:  Transformar el residuo industrial en infraestructura para el futuro. 
           Generar soluciones definitivas para el agro mediante la inyeccion de plasticos recuperados, 
           ofreciendo productos de alta calidad y durabilidad. Proteger el medio ambiente 
           y la tala indiscriminada de nuestros bosques nativos. 
          </p>
          <p className="mt-4 text-steel-500 leading-relaxed">
            VISIÓN: Liderar el cambio hacia una economia circular en el campo argentino 
            demostrando que la innovacion y la tecnologia inyectada pueden superar a los sistemas tradicionales. 
          </p>
          <p className="mt-4 text-steel-500 leading-relaxed">
            VALORES: Crear una ECONOMIA CIRCULAR REAL. Generamos valor donde otros ven basura. Utilizamos el 100% 
            de polimeros recuperados de procesos industriales
          </p>
          <p className="mt-4 text-steel-500 leading-relaxed">
            INNOVACION Y RESISTENCIA EXTREMA: diseñamos tecnologia aplicada a la sustentabilidad para crear productos que no se 
            pudren, no se oxidan y soportan condiciones hostiles.
          </p>
          <p className="mt-4 text-steel-500 leading-relaxed">
            COMPROMISO 100% ARGENTINO: entendemos las necesidades reales del campo y de nuestra tierra, 
            fabricando a nivel local soluciones diseñadas para el productor Argentino
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6">
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
